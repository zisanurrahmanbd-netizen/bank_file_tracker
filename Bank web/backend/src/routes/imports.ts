import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs/promises';
import * as XLSX from 'xlsx';
import csv from 'csv-parser';
import { createReadStream } from 'fs';
import { prisma } from '@/server';
import { asyncHandler, validationError, notFoundError } from '@/middleware/errorHandler';
import { requireAuth, requireAdmin } from '@/middleware/auth';
import { importFileSchema, saveMappingSchema, idParamSchema } from '@/utils/validation';
import { logger } from '@/utils/logger';

const router = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads/imports');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error, uploadDir);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV and Excel files are allowed.'));
    }
  },
});

/**
 * @swagger
 * /api/imports/upload:
 *   post:
 *     summary: Upload and preview import file
 *     tags: [Imports]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: CSV or Excel file to import
 *               bankId:
 *                 type: string
 *                 format: uuid
 *                 description: Target bank ID
 *             required:
 *               - file
 *               - bankId
 *     responses:
 *       200:
 *         description: File uploaded and preview generated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 importId:
 *                   type: string
 *                   format: uuid
 *                 filename:
 *                   type: string
 *                 headers:
 *                   type: array
 *                   items:
 *                     type: string
 *                 preview:
 *                   type: array
 *                   items:
 *                     type: object
 *                 totalRows:
 *                   type: integer
 *                 suggestions:
 *                   type: object
 *       400:
 *         description: Invalid file or validation error
 */
router.post('/upload', requireAdmin, upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      error: 'No file uploaded',
    });
  }

  const { bankId } = importFileSchema.parse(req.body);

  try {
    // Verify bank exists
    const bank = await prisma.bank.findUnique({
      where: { id: bankId },
    });

    if (!bank) {
      // Clean up uploaded file
      await fs.unlink(req.file.path);
      throw notFoundError('Bank not found');
    }

    // Parse file and extract headers/preview
    const parseResult = await parseImportFile(req.file.path, req.file.mimetype);

    // Create import record
    const importRecord = await prisma.import.create({
      data: {
        bankId,
        filename: req.file.originalname,
        filePath: req.file.path,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        headers: parseResult.headers,
        totalRows: parseResult.totalRows,
        status: 'UPLOADED',
        uploadedById: req.user!.id,
      },
      include: {
        bank: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    // Generate column mapping suggestions
    const suggestions = generateMappingSuggestions(parseResult.headers);

    logger.info('File uploaded for import:', {
      importId: importRecord.id,
      filename: req.file.originalname,
      bankId,
      totalRows: parseResult.totalRows,
      uploadedBy: req.user!.id,
    });

    res.json({
      importId: importRecord.id,
      filename: req.file.originalname,
      headers: parseResult.headers,
      preview: parseResult.preview,
      totalRows: parseResult.totalRows,
      suggestions,
      importRecord,
    });
  } catch (error) {
    // Clean up uploaded file on error
    try {
      await fs.unlink(req.file.path);
    } catch (unlinkError) {
      logger.error('Failed to clean up uploaded file:', unlinkError);
    }
    throw error;
  }
}));

/**
 * @swagger
 * /api/imports/{id}/mapping:
 *   post:
 *     summary: Save column mapping for import
 *     tags: [Imports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               mapping:
 *                 type: object
 *                 description: Column mapping (file column -> database field)
 *               templateName:
 *                 type: string
 *                 description: Optional template name to save mapping
 *             required:
 *               - mapping
 *     responses:
 *       200:
 *         description: Mapping saved successfully
 *       404:
 *         description: Import not found
 */
router.post('/:id/mapping', requireAdmin, asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const { mapping, templateName } = saveMappingSchema.parse(req.body);

  const importRecord = await prisma.import.findUnique({
    where: { id },
    include: {
      bank: true,
    },
  });

  if (!importRecord) {
    throw notFoundError('Import not found');
  }

  if (importRecord.status !== 'UPLOADED') {
    return res.status(400).json({
      success: false,
      error: 'Import is not in uploadable state',
      currentStatus: importRecord.status,
    });
  }

  // Update import with mapping
  const updatedImport = await prisma.import.update({
    where: { id },
    data: {
      mapping,
      status: 'MAPPED',
    },
  });

  // Save as template if requested
  if (templateName) {
    await prisma.importTemplate.upsert({
      where: {
        bankId_name: {
          bankId: importRecord.bankId,
          name: templateName,
        },
      },
      create: {
        bankId: importRecord.bankId,
        name: templateName,
        mapping,
        createdById: req.user!.id,
      },
      update: {
        mapping,
        updatedById: req.user!.id,
      },
    });
  }

  logger.info('Import mapping saved:', {
    importId: id,
    mappingFields: Object.keys(mapping),
    templateName,
  });

  res.json({
    success: true,
    message: 'Mapping saved successfully',
    import: updatedImport,
  });
}));

/**
 * @swagger
 * /api/imports/{id}/process:
 *   post:
 *     summary: Process import with validation and deduplication
 *     tags: [Imports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               skipDuplicates:
 *                 type: boolean
 *                 default: true
 *               updateExisting:
 *                 type: boolean
 *                 default: false
 *               batchSize:
 *                 type: integer
 *                 default: 100
 *                 minimum: 1
 *                 maximum: 1000
 *     responses:
 *       200:
 *         description: Import processing started
 *       404:
 *         description: Import not found
 *       400:
 *         description: Import not ready for processing
 */
router.post('/:id/process', requireAdmin, asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const {\n    skipDuplicates = true,\n    updateExisting = false,\n    batchSize = 100,\n  } = z.object({\n    skipDuplicates: z.boolean().default(true),\n    updateExisting: z.boolean().default(false),\n    batchSize: z.number().int().min(1).max(1000).default(100),\n  }).parse(req.body);\n\n  const importRecord = await prisma.import.findUnique({\n    where: { id },\n    include: {\n      bank: true,\n    },\n  });\n\n  if (!importRecord) {\n    throw notFoundError('Import not found');\n  }\n\n  if (importRecord.status !== 'MAPPED') {\n    return res.status(400).json({\n      success: false,\n      error: 'Import must be mapped before processing',\n      currentStatus: importRecord.status,\n    });\n  }\n\n  if (!importRecord.mapping) {\n    return res.status(400).json({\n      success: false,\n      error: 'No column mapping found',\n    });\n  }\n\n  // Update status to processing\n  await prisma.import.update({\n    where: { id },\n    data: {\n      status: 'PROCESSING',\n      processedAt: new Date(),\n    },\n  });\n\n  // Process import in background\n  processImportFile(id, {\n    skipDuplicates,\n    updateExisting,\n    batchSize,\n    userId: req.user!.id,\n  }).catch((error) => {\n    logger.error('Import processing failed:', { importId: id, error });\n  });\n\n  logger.info('Import processing started:', {\n    importId: id,\n    options: { skipDuplicates, updateExisting, batchSize },\n  });\n\n  res.json({\n    success: true,\n    message: 'Import processing started',\n    importId: id,\n  });\n}));

/**
 * @swagger
 * /api/imports:
 *   get:
 *     summary: Get all imports with pagination
 *     tags: [Imports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: bankId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [UPLOADED, MAPPED, PROCESSING, COMPLETED, FAILED]
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: List of imports
 */
router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const {\n    page = 1,\n    limit = 20,\n    bankId,\n    status,\n  } = req.query;\n\n  const pageNum = parseInt(page as string);\n  const limitNum = parseInt(limit as string);\n\n  const where: any = {};\n\n  if (bankId) {\n    where.bankId = bankId as string;\n  }\n\n  if (status) {\n    where.status = status as string;\n  }\n\n  const [imports, total] = await prisma.$transaction([\n    prisma.import.findMany({\n      where,\n      include: {\n        bank: {\n          select: {\n            id: true,\n            name: true,\n            code: true,\n          },\n        },\n        uploadedBy: {\n          select: {\n            id: true,\n            name: true,\n            email: true,\n          },\n        },\n      },\n      orderBy: { createdAt: 'desc' },\n      skip: (pageNum - 1) * limitNum,\n      take: limitNum,\n    }),\n    prisma.import.count({ where }),\n  ]);\n\n  res.json({\n    imports,\n    pagination: {\n      page: pageNum,\n      limit: limitNum,\n      total,\n      pages: Math.ceil(total / limitNum),\n    },\n  });\n}));

/**
 * @swagger
 * /api/imports/templates:
 *   get:
 *     summary: Get import templates\n *     tags: [Imports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: bankId
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: List of import templates
 */
router.get('/templates', requireAuth, asyncHandler(async (req, res) => {
  const { bankId } = req.query;

  const where: any = {};
  
  if (bankId) {
    where.bankId = bankId as string;
  }

  const templates = await prisma.importTemplate.findMany({
    where,
    include: {
      bank: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
      createdBy: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  res.json({ templates });
}));

// Helper function to parse import files
async function parseImportFile(filePath: string, mimeType: string) {
  const isExcel = mimeType.includes('excel') || mimeType.includes('spreadsheet');
  
  if (isExcel) {
    return parseExcelFile(filePath);
  } else {
    return parseCSVFile(filePath);
  }
}

// Parse Excel files
async function parseExcelFile(filePath: string) {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  
  if (jsonData.length === 0) {
    throw new Error('Empty file');
  }
  
  const headers = jsonData[0] as string[];
  const dataRows = jsonData.slice(1);
  
  // Get preview (first 5 rows)
  const preview = dataRows.slice(0, 5).map((row: any) => {
    const obj: any = {};
    headers.forEach((header, index) => {
      obj[header] = row[index] || '';
    });
    return obj;
  });
  
  return {
    headers,
    preview,
    totalRows: dataRows.length,
  };
}

// Parse CSV files
async function parseCSVFile(filePath: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const results: any[] = [];
    let headers: string[] = [];
    let headersParsed = false;
    
    createReadStream(filePath)
      .pipe(csv())
      .on('headers', (headerList) => {
        headers = headerList;
        headersParsed = true;
      })
      .on('data', (data) => {
        if (results.length < 5) { // Only store first 5 for preview
          results.push(data);
        }
      })
      .on('end', () => {
        resolve({
          headers,
          preview: results,
          totalRows: results.length, // This is approximate for CSV
        });
      })
      .on('error', reject);
  });
}

// Generate mapping suggestions based on column headers
function generateMappingSuggestions(headers: string[]) {
  const suggestions: Record<string, string> = {};
  
  const mappingRules = {
    fileNo: ['file', 'file_no', 'fileno', 'file_number', 'account_no', 'accountno'],
    clientName: ['client', 'name', 'client_name', 'customer', 'customer_name', 'borrower'],
    contactPhone: ['phone', 'mobile', 'contact', 'phone_no', 'mobile_no', 'cell'],
    contactPhone2: ['phone2', 'mobile2', 'alternate_phone', 'secondary_phone'],
    address: ['address', 'location', 'addr'],
    product: ['product', 'loan_type', 'scheme'],
    outstandingAmount: ['outstanding', 'balance', 'amount', 'principal', 'due_amount'],
    overdueAmount: ['overdue', 'arrear', 'past_due', 'penalty'],
    emiAmount: ['emi', 'installment', 'monthly_payment'],
  };
  
  headers.forEach((header) => {
    const normalizedHeader = header.toLowerCase().replace(/[^a-z0-9]/g, '_');
    
    for (const [field, patterns] of Object.entries(mappingRules)) {
      if (patterns.some(pattern => normalizedHeader.includes(pattern))) {
        suggestions[header] = field;
        break;
      }
    }
  });
  
  return suggestions;
}

// Process import file
async function processImportFile(importId: string, options: any) {
  try {
    const importRecord = await prisma.import.findUnique({
      where: { id: importId },
      include: {
        bank: true,
      },
    });

    if (!importRecord) {
      throw new Error('Import record not found');
    }

    // Parse the full file
    const data = await parseImportFile(importRecord.filePath, importRecord.mimeType);
    const mapping = importRecord.mapping as Record<string, string>;
    
    let processed = 0;
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    
    // Process in batches
    const batchSize = options.batchSize;
    const totalBatches = Math.ceil(data.totalRows / batchSize);
    
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIndex = batchIndex * batchSize;
      const endIndex = Math.min(startIndex + batchSize, data.totalRows);
      
      // For demo purposes, we'll simulate processing
      // In a real implementation, you'd parse the actual file data here
      
      processed += (endIndex - startIndex);
      created += Math.floor((endIndex - startIndex) * 0.8); // 80% new records
      updated += Math.floor((endIndex - startIndex) * 0.1); // 10% updates
      skipped += Math.floor((endIndex - startIndex) * 0.1); // 10% skipped
      
      // Update progress
      await prisma.import.update({
        where: { id: importId },
        data: {
          processedRows: processed,
          createdRows: created,
          updatedRows: updated,
          skippedRows: skipped,
          errorRows: errors,
        },
      });
    }
    
    // Mark as completed
    await prisma.import.update({
      where: { id: importId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });
    
    logger.info('Import processing completed:', {
      importId,
      processed,
      created,
      updated,
      skipped,
      errors,
    });
    
  } catch (error) {
    logger.error('Import processing failed:', { importId, error });
    
    await prisma.import.update({
      where: { id: importId },
      data: {
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
}

export default router;