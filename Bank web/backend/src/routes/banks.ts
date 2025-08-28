import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@/server';
import { asyncHandler, notFoundError, forbiddenError } from '@/middleware/errorHandler';
import { requireAdmin, requireAuth } from '@/middleware/auth';
import { createBankSchema, updateBankSchema, idParamSchema, paginationSchema } from '@/utils/validation';
import { logger } from '@/utils/logger';

const router = Router();

/**
 * @swagger
 * /api/banks:
 *   get:
 *     summary: Get all banks with pagination
 *     tags: [Banks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of banks
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 banks:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Bank'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 */
router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, search } = paginationSchema.extend({
    search: z.string().optional()
  }).parse(req.query);

  const where: any = {};
  
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { code: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [banks, total] = await prisma.$transaction([
    prisma.bank.findMany({
      where,
      include: {
        _count: {
          select: {
            accounts: true,
            agents: true,
          },
        },
      },
      orderBy: { name: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.bank.count({ where }),
  ]);

  res.json({
    banks,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  });
}));

/**
 * @swagger
 * /api/banks/{id}:
 *   get:
 *     summary: Get bank by ID
 *     tags: [Banks]
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
 *         description: Bank details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Bank'
 *       404:
 *         description: Bank not found
 */
router.get('/:id', requireAuth, asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);

  const bank = await prisma.bank.findUnique({
    where: { id },
    include: {
      accounts: {
        select: {
          id: true,
          fileNo: true,
          clientName: true,
          outstandingAmount: true,
          overdueAmount: true,
          statusStage: true,
        },
        take: 10,
        orderBy: { updatedAt: 'desc' },
      },
      agents: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
      _count: {
        select: {
          accounts: true,
          agents: true,
        },
      },
    },
  });

  if (!bank) {
    throw notFoundError('Bank not found');
  }

  res.json(bank);
}));

/**
 * @swagger
 * /api/banks:
 *   post:
 *     summary: Create a new bank
 *     tags: [Banks]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: ABC Bank Limited
 *               code:
 *                 type: string
 *                 example: ABC
 *               contactEmail:
 *                 type: string
 *                 format: email
 *                 example: contact@abcbank.com
 *               contactPhone:
 *                 type: string
 *                 example: +8801XXXXXXXXX
 *               commissionRules:
 *                 type: object
 *               slaSettings:
 *                 type: object
 *             required:
 *               - name
 *               - code
 *     responses:
 *       201:
 *         description: Bank created successfully
 *       400:
 *         description: Validation error
 *       403:
 *         description: Admin access required
 */
router.post('/', requireAdmin, asyncHandler(async (req, res) => {
  const data = createBankSchema.parse(req.body);

  // Check if bank code already exists
  const existingBank = await prisma.bank.findUnique({
    where: { code: data.code },
  });

  if (existingBank) {
    return res.status(400).json({
      success: false,
      error: 'Bank code already exists',
    });
  }

  const bank = await prisma.bank.create({
    data,
    include: {
      _count: {
        select: {
          accounts: true,
          agents: true,
        },
      },
    },
  });

  // Log the creation
  await prisma.eventLog.create({
    data: {
      userId: req.user!.id,
      action: 'CREATE',
      resource: 'bank',
      resourceId: bank.id,
      newData: data,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    },
  });

  logger.info('Bank created:', { bankId: bank.id, name: bank.name, createdBy: req.user!.id });

  res.status(201).json(bank);
}));

/**
 * @swagger
 * /api/banks/{id}:
 *   put:
 *     summary: Update bank
 *     tags: [Banks]
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
 *               name:
 *                 type: string
 *               contactEmail:
 *                 type: string
 *                 format: email
 *               contactPhone:
 *                 type: string
 *               commissionRules:
 *                 type: object
 *               slaSettings:
 *                 type: object
 *     responses:
 *       200:
 *         description: Bank updated successfully
 *       404:
 *         description: Bank not found
 *       403:
 *         description: Admin access required
 */
router.put('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const data = updateBankSchema.parse(req.body);

  // Get existing bank for comparison
  const existingBank = await prisma.bank.findUnique({
    where: { id },
  });

  if (!existingBank) {
    throw notFoundError('Bank not found');
  }

  const bank = await prisma.bank.update({
    where: { id },
    data,
    include: {
      _count: {
        select: {
          accounts: true,
          agents: true,
        },
      },
    },
  });

  // Log the update
  await prisma.eventLog.create({
    data: {
      userId: req.user!.id,
      action: 'UPDATE',
      resource: 'bank',
      resourceId: bank.id,
      oldData: existingBank,
      newData: data,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    },
  });

  logger.info('Bank updated:', { bankId: bank.id, name: bank.name, updatedBy: req.user!.id });

  res.json(bank);
}));

/**
 * @swagger
 * /api/banks/{id}:
 *   delete:
 *     summary: Delete bank
 *     tags: [Banks]
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
 *         description: Bank deleted successfully
 *       404:
 *         description: Bank not found
 *       400:
 *         description: Cannot delete bank with existing accounts
 *       403:
 *         description: Admin access required
 */
router.delete('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);

  const bank = await prisma.bank.findUnique({
    where: { id },
    include: {
      _count: {
        select: {
          accounts: true,
          agents: true,
        },
      },
    },
  });

  if (!bank) {
    throw notFoundError('Bank not found');
  }

  // Check if bank has accounts or agents
  if (bank._count.accounts > 0 || bank._count.agents > 0) {
    return res.status(400).json({
      success: false,
      error: 'Cannot delete bank with existing accounts or agents',
      details: {
        accountsCount: bank._count.accounts,
        agentsCount: bank._count.agents,
      },
    });
  }

  await prisma.bank.delete({
    where: { id },
  });

  // Log the deletion
  await prisma.eventLog.create({
    data: {
      userId: req.user!.id,
      action: 'DELETE',
      resource: 'bank',
      resourceId: id,
      oldData: bank,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    },
  });

  logger.info('Bank deleted:', { bankId: id, name: bank.name, deletedBy: req.user!.id });

  res.json({ success: true, message: 'Bank deleted successfully' });
}));

export default router;