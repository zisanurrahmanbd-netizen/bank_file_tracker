import { Router } from 'express';
import { z } from 'zod';
import * as XLSX from 'xlsx';
import { prisma } from '@/server';
import { asyncHandler, notFoundError } from '@/middleware/errorHandler';
import { requireAuth, requireAdminOrAuditor } from '@/middleware/auth';
import { generateReportSchema, idParamSchema } from '@/utils/validation';
import { logger } from '@/utils/logger';

const router = Router();

/**
 * @swagger
 * /api/reports/generate:
 *   post:
 *     summary: Generate a new report
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               bankId:
 *                 type: string
 *                 format: uuid
 *               reportType:
 *                 type: string
 *                 enum: [WEEKLY, MONTHLY, CUSTOM]
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *               includeCollections:
 *                 type: boolean
 *                 default: true
 *               includeUpdates:
 *                 type: boolean
 *                 default: false
 *               format:
 *                 type: string
 *                 enum: [XLSX, CSV]
 *                 default: XLSX
 *             required:
 *               - reportType
 *               - startDate
 *               - endDate
 *     responses:
 *       201:
 *         description: Report generation started
 *       400:
 *         description: Validation error
 *       403:
 *         description: Admin/Auditor access required
 */
router.post('/generate', requireAdminOrAuditor, asyncHandler(async (req, res) => {
  const data = generateReportSchema.parse(req.body);

  // Create report record
  const report = await prisma.report.create({
    data: {
      type: data.reportType,
      bankId: data.bankId,
      startDate: new Date(data.startDate),
      endDate: new Date(data.endDate),
      format: data.format,
      parameters: {
        includeCollections: data.includeCollections,
        includeUpdates: data.includeUpdates,
      },
      status: 'GENERATING',
      requestedById: req.user!.id,
    },
    include: {
      bank: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
      requestedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  // For now, generate report synchronously
  // In production, this should be queued as a background job
  try {
    await generateReportData(report.id, data);
  } catch (error) {
    logger.error('Report generation failed:', error);
    await prisma.report.update({
      where: { id: report.id },
      data: {
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }

  logger.info('Report generation started:', {
    reportId: report.id,
    type: data.reportType,
    requestedBy: req.user!.id,
  });

  res.status(201).json(report);
}));

/**
 * @swagger
 * /api/reports:
 *   get:
 *     summary: Get all reports with pagination
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: bankId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [WEEKLY, MONTHLY, CUSTOM]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [GENERATING, COMPLETED, FAILED]
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
 *         description: List of reports
 */
router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    bankId,
    type,
    status,
  } = req.query;

  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);

  const where: any = {};

  // Role-based filtering
  if (req.user?.role === 'AGENT') {
    // Agents can only see reports they requested
    where.requestedById = req.user.id;
  }

  if (bankId) {
    where.bankId = bankId as string;
  }

  if (type) {
    where.type = type as string;
  }

  if (status) {
    where.status = status as string;
  }

  const [reports, total] = await prisma.$transaction([
    prisma.report.findMany({
      where,
      include: {
        bank: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        requestedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    }),
    prisma.report.count({ where }),
  ]);

  res.json({
    reports,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum),
    },
  });
}));

/**
 * @swagger
 * /api/reports/{id}:
 *   get:
 *     summary: Get report by ID
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Report details
 *       404:
 *         description: Report not found
 */
router.get('/:id', requireAuth, asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);

  const report = await prisma.report.findUnique({
    where: { id },
    include: {
      bank: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
      requestedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!report) {
    throw notFoundError('Report not found');
  }

  // Check access permissions
  if (req.user?.role === 'AGENT' && report.requestedById !== req.user.id) {
    throw notFoundError('Report not found');
  }

  res.json(report);
}));

/**
 * @swagger
 * /api/reports/{id}/download:
 *   get:
 *     summary: Download report file
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Report file
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *           text/csv:
 *             schema:
 *               type: string
 *       404:
 *         description: Report not found or not ready
 */
router.get('/:id/download', requireAuth, asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);

  const report = await prisma.report.findUnique({
    where: { id },
    include: {
      bank: {
        select: {
          name: true,
          code: true,
        },
      },
    },
  });

  if (!report) {
    throw notFoundError('Report not found');
  }

  // Check access permissions
  if (req.user?.role === 'AGENT' && report.requestedById !== req.user.id) {
    throw notFoundError('Report not found');
  }

  if (report.status !== 'COMPLETED' || !report.filePath) {
    return res.status(400).json({
      success: false,
      error: 'Report is not ready for download',
      status: report.status,
    });
  }

  const filename = `${report.bank?.code || 'ALL'}_${report.type}_${report.startDate.toISOString().split('T')[0]}_${report.endDate.toISOString().split('T')[0]}.${report.format.toLowerCase()}`;

  // Set appropriate headers
  if (report.format === 'XLSX') {
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  } else {
    res.setHeader('Content-Type', 'text/csv');
  }
  
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

  // In a real implementation, you would read from file system or cloud storage
  // For now, we'll generate a simple report
  if (report.format === 'XLSX') {
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([{
      'Report': 'Sample Report',
      'Generated': new Date().toISOString(),
      'Bank': report.bank?.name || 'All Banks',
      'Period': `${report.startDate.toISOString().split('T')[0]} to ${report.endDate.toISOString().split('T')[0]}`,
    }]);
    
    XLSX.utils.book_append_sheet(wb, ws, 'Report');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    res.send(buffer);
  } else {
    res.send('Report,Generated,Bank,Period\nSample Report,' + new Date().toISOString() + ',' + (report.bank?.name || 'All Banks') + ',' + report.startDate.toISOString().split('T')[0] + ' to ' + report.endDate.toISOString().split('T')[0]);
  }
}));

/**
 * @swagger
 * /api/reports/templates:
 *   get:
 *     summary: Get available report templates
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of report templates
 */
router.get('/templates', requireAuth, asyncHandler(async (req, res) => {
  const templates = [
    {
      id: 'weekly-collection',
      name: 'Weekly Collection Report',
      description: 'Weekly summary of collections by bank and agent',
      type: 'WEEKLY',
      includeCollections: true,
      includeUpdates: false,
    },
    {
      id: 'monthly-performance',
      name: 'Monthly Performance Report',
      description: 'Monthly performance report with targets and achievements',
      type: 'MONTHLY',
      includeCollections: true,
      includeUpdates: true,
    },
    {
      id: 'account-status',
      name: 'Account Status Report',
      description: 'Current status of all accounts with last update information',
      type: 'CUSTOM',
      includeCollections: false,
      includeUpdates: true,
    },
    {
      id: 'collection-verification',
      name: 'Collection Verification Report',
      description: 'Pending and verified collections summary',
      type: 'CUSTOM',
      includeCollections: true,
      includeUpdates: false,
    },
  ];

  res.json({ templates });
}));

// Helper function to generate report data
async function generateReportData(reportId: string, params: any) {
  try {
    // Update status to generating
    await prisma.report.update({
      where: { id: reportId },
      data: { status: 'GENERATING' },
    });

    // Simulate report generation time
    await new Promise(resolve => setTimeout(resolve, 2000));

    // In a real implementation, you would:
    // 1. Query the database for relevant data
    // 2. Process and format the data
    // 3. Generate Excel/CSV file
    // 4. Upload to cloud storage
    // 5. Update the report record with file path

    // For now, just mark as completed
    await prisma.report.update({
      where: { id: reportId },
      data: {
        status: 'COMPLETED',
        filePath: `/reports/${reportId}.${params.format.toLowerCase()}`,
        completedAt: new Date(),
      },
    });

    logger.info('Report generation completed:', { reportId });
  } catch (error) {
    logger.error('Report generation failed:', { reportId, error });
    
    await prisma.report.update({
      where: { id: reportId },
      data: {
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    });
    
    throw error;
  }
}

export default router;