import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@/server';
import { asyncHandler, notFoundError, forbiddenError } from '@/middleware/errorHandler';
import { requireAuth, requireAdminOrAuditor, requireAccountAccess } from '@/middleware/auth';
import { 
  createCollectionSchema, 
  verifyCollectionSchema,
  collectionFilterSchema,
  idParamSchema 
} from '@/utils/validation';
import { logger } from '@/utils/logger';

const router = Router();

/**
 * @swagger
 * /api/collections:
 *   get:
 *     summary: Get collections with filtering and pagination
 *     tags: [Collections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: accountId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: bankId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [BKASH, NAGAD, CASH, BANK_DEPOSIT]
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED]
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
 *         description: List of collections
 */
router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const filters = collectionFilterSchema.parse(req.query);
  const { page, limit, sortBy, sortOrder, ...filterCriteria } = filters;

  // Build where clause
  const where: any = {};

  // Role-based filtering
  if (req.user?.role === 'AGENT') {
    // Agents can only see collections for their assigned accounts
    const agent = await prisma.agent.findUnique({
      where: { userId: req.user.id },
    });

    if (agent) {
      where.account = {
        assignments: {
          some: {
            agentId: agent.id,
            isActive: true,
          },
        },
      };
    } else {
      return res.json({
        collections: [],
        pagination: {
          page,
          limit,
          total: 0,
          pages: 0,
        },
      });
    }
  }

  // Apply filters
  if (filterCriteria.bankId) {
    where.account = {
      ...where.account,
      bankId: filterCriteria.bankId,
    };
  }

  if (filterCriteria.agentId) {
    where.account = {
      ...where.account,
      assignments: {
        some: {
          agentId: filterCriteria.agentId,
          isActive: true,
        },
      },
    };
  }

  if (filterCriteria.type) {
    where.type = filterCriteria.type;
  }

  if (filterCriteria.status) {
    where.status = filterCriteria.status;
  }

  if (filterCriteria.collectionDateFrom || filterCriteria.collectionDateTo) {
    where.collectionDate = {};
    if (filterCriteria.collectionDateFrom) {
      where.collectionDate.gte = new Date(filterCriteria.collectionDateFrom);
    }
    if (filterCriteria.collectionDateTo) {
      where.collectionDate.lte = new Date(filterCriteria.collectionDateTo);
    }
  }

  if (filterCriteria.amountMin !== undefined || filterCriteria.amountMax !== undefined) {
    where.amount = {};
    if (filterCriteria.amountMin !== undefined) {
      where.amount.gte = filterCriteria.amountMin;
    }
    if (filterCriteria.amountMax !== undefined) {
      where.amount.lte = filterCriteria.amountMax;
    }
  }

  if (filterCriteria.isMatched !== undefined) {
    where.isMatched = filterCriteria.isMatched;
  }

  // Get total count
  const total = await prisma.collection.count({ where });

  // Get collections with pagination
  const collections = await prisma.collection.findMany({
    where,
    include: {
      account: {
        select: {
          id: true,
          fileNo: true,
          clientName: true,
          bank: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
      verifiedBy: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
      reconciliation: {
        select: {
          id: true,
          status: true,
          matchedAt: true,
        },
      },
    },
    orderBy: {
      [sortBy]: sortOrder,
    },
    skip: (page - 1) * limit,
    take: limit,
  });

  res.json({
    collections,
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
 * /api/collections/{id}:
 *   get:
 *     summary: Get collection by ID
 *     tags: [Collections]
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
 *         description: Collection details
 *       404:
 *         description: Collection not found
 */
router.get('/:id', requireAuth, asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);

  const collection = await prisma.collection.findUnique({
    where: { id },
    include: {
      account: {
        include: {
          bank: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          assignments: {
            where: { isActive: true },
            include: {
              agent: {
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
            },
          },
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
      verifiedBy: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
      reconciliation: true,
    },
  });

  if (!collection) {
    throw notFoundError('Collection not found');
  }

  // Check access permissions
  if (req.user?.role === 'AGENT') {
    const agent = await prisma.agent.findUnique({
      where: { userId: req.user.id },
    });

    if (!agent) {
      throw forbiddenError('Agent profile not found');
    }

    // Check if agent has access to this account
    const hasAccess = collection.account.assignments.some(
      assignment => assignment.agentId === agent.id && assignment.isActive
    );

    if (!hasAccess) {
      throw forbiddenError('Access denied to this collection');
    }
  }

  res.json(collection);
}));

/**
 * @swagger
 * /api/collections:
 *   post:
 *     summary: Submit a new collection
 *     tags: [Collections]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               accountId:
 *                 type: string
 *                 format: uuid
 *               type:
 *                 type: string
 *                 enum: [BKASH, NAGAD, CASH, BANK_DEPOSIT]
 *               amount:
 *                 type: number
 *                 minimum: 0.01
 *               collectionDate:
 *                 type: string
 *                 format: date-time
 *               txnId:
 *                 type: string
 *               slipNo:
 *                 type: string
 *               cashReceipt:
 *                 type: string
 *               proofImages:
 *                 type: array
 *                 items:
 *                   type: string
 *             required:
 *               - accountId
 *               - type
 *               - amount
 *               - collectionDate
 *     responses:
 *       201:
 *         description: Collection submitted successfully
 *       400:
 *         description: Validation error
 *       403:
 *         description: Access denied
 *       404:
 *         description: Account not found
 */
router.post('/', requireAuth, asyncHandler(async (req, res) => {
  const { accountId, ...collectionData } = createCollectionSchema.extend({
    accountId: z.string().uuid(),
  }).parse(req.body);

  // Check if account exists and user has access
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    include: {
      bank: true,
      assignments: {
        where: { isActive: true },
        include: {
          agent: {
            include: {
              user: true,
            },
          },
        },
      },
    },
  });

  if (!account) {
    throw notFoundError('Account not found');
  }

  // Check access permissions for agents
  if (req.user?.role === 'AGENT') {
    const agent = await prisma.agent.findUnique({
      where: { userId: req.user.id },
    });

    if (!agent) {
      throw forbiddenError('Agent profile not found');
    }

    const hasAccess = account.assignments.some(
      assignment => assignment.agentId === agent.id && assignment.isActive
    );

    if (!hasAccess) {
      throw forbiddenError('Access denied to this account');
    }
  }

  // Create collection
  const collection = await prisma.collection.create({
    data: {
      ...collectionData,
      accountId,
      userId: req.user!.id,
      status: 'PENDING',
    },
    include: {
      account: {
        include: {
          bank: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
    },
  });

  // Log the collection submission
  await prisma.eventLog.create({
    data: {
      userId: req.user!.id,
      action: 'CREATE',
      resource: 'collection',
      resourceId: collection.id,
      newData: { ...collectionData, accountId },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    },
  });

  // Update account last activity
  await prisma.account.update({
    where: { id: accountId },
    data: { updatedAt: new Date() },
  });

  logger.info('Collection submitted:', {
    collectionId: collection.id,
    accountId,
    amount: collection.amount,
    type: collection.type,
    submittedBy: req.user!.id,
  });

  res.status(201).json(collection);
}));

/**
 * @swagger
 * /api/collections/{id}/verify:
 *   post:
 *     summary: Verify/approve or reject a collection
 *     tags: [Collections]
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
 *               status:
 *                 type: string
 *                 enum: [APPROVED, REJECTED]
 *               rejectionReason:
 *                 type: string
 *             required:
 *               - status
 *     responses:
 *       200:
 *         description: Collection verification updated
 *       400:
 *         description: Validation error or invalid status
 *       403:
 *         description: Admin/Auditor access required
 *       404:
 *         description: Collection not found
 */
router.post('/:id/verify', requireAdminOrAuditor, asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const { status, rejectionReason } = verifyCollectionSchema.parse(req.body);

  // Get existing collection
  const existingCollection = await prisma.collection.findUnique({
    where: { id },
    include: {
      account: {
        include: {
          bank: true,
        },
      },
      user: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!existingCollection) {
    throw notFoundError('Collection not found');
  }

  if (existingCollection.status !== 'PENDING') {
    return res.status(400).json({
      success: false,
      error: 'Collection has already been verified',
      currentStatus: existingCollection.status,
    });
  }

  // Update collection status
  const collection = await prisma.collection.update({
    where: { id },
    data: {
      status,
      rejectionReason: status === 'REJECTED' ? rejectionReason : null,
      verifiedById: req.user!.id,
      verifiedAt: new Date(),
    },
    include: {
      account: {
        include: {
          bank: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
        },
      },
      user: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
      verifiedBy: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
    },
  });

  // Log the verification
  await prisma.eventLog.create({
    data: {
      userId: req.user!.id,
      action: 'UPDATE',
      resource: 'collection',
      resourceId: collection.id,
      oldData: { status: existingCollection.status },
      newData: { status, rejectionReason },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    },
  });

  logger.info('Collection verification updated:', {
    collectionId: collection.id,
    status,
    verifiedBy: req.user!.id,
    rejectionReason,
  });

  res.json(collection);
}));

/**
 * @swagger
 * /api/collections/pending:
 *   get:
 *     summary: Get pending collections for verification
 *     tags: [Collections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: bankId
 *         schema:
 *           type: string
 *           format: uuid
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
 *         description: List of pending collections
 *       403:
 *         description: Admin/Auditor access required
 */
router.get('/pending', requireAdminOrAuditor, asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, bankId } = req.query;
  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);

  const where: any = {
    status: 'PENDING',
  };

  if (bankId) {
    where.account = {
      bankId: bankId as string,
    };
  }

  const [collections, total] = await prisma.$transaction([
    prisma.collection.findMany({
      where,
      include: {
        account: {
          include: {
            bank: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
          },
        },
        user: {
          select: {
            id: true,
            name: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' }, // Oldest first for FIFO processing
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    }),
    prisma.collection.count({ where }),
  ]);

  res.json({
    collections,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum),
    },
  });
}));

export default router;