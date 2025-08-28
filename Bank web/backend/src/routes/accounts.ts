import { Router } from 'express';
import { prisma } from '@/server';
import { asyncHandler, notFoundError, forbiddenError } from '@/middleware/errorHandler';
import { requireAdmin, requireAgentOrAdmin, requireAccountAccess } from '@/middleware/auth';
import { 
  createAccountSchema, 
  updateAccountSchema, 
  assignAccountSchema,
  accountFilterSchema,
  createUpdateSchema,
  idParamSchema
} from '@/utils/validation';
import { logger } from '@/utils/logger';

const router = Router();

/**
 * @swagger
 * /api/accounts:
 *   get:
 *     summary: Get accounts with filtering and pagination
 *     tags: [Accounts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: bankId
 *         schema:
 *           type: string
 *       - in: query
 *         name: agentId
 *         schema:
 *           type: string
 *       - in: query
 *         name: statusStage
 *         schema:
 *           type: string
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
 *         description: List of accounts
 */
router.get('/', requireAgentOrAdmin, asyncHandler(async (req, res) => {
  const filters = accountFilterSchema.parse(req.query);
  const { page, limit, sortBy, sortOrder, ...filterCriteria } = filters;

  // Build where clause
  const where: any = {};

  // Role-based filtering
  if (req.user?.role === 'AGENT') {
    // Agents can only see their assigned accounts
    const agent = await prisma.agent.findUnique({
      where: { userId: req.user.id },
    });

    if (agent) {
      where.assignments = {
        some: {
          agentId: agent.id,
          isActive: true,
        },
      };
    } else {
      // If user is agent but no agent profile, return empty
      return res.json({
        accounts: [],
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
    where.bankId = filterCriteria.bankId;
  }

  if (filterCriteria.statusStage) {
    where.statusStage = filterCriteria.statusStage;
  }

  if (filterCriteria.product) {
    where.product = filterCriteria.product;
  }

  if (filterCriteria.month) {
    where.month = filterCriteria.month;
  }

  if (filterCriteria.allocationDateFrom || filterCriteria.allocationDateTo) {
    where.allocationDate = {};
    if (filterCriteria.allocationDateFrom) {
      where.allocationDate.gte = new Date(filterCriteria.allocationDateFrom);
    }
    if (filterCriteria.allocationDateTo) {
      where.allocationDate.lte = new Date(filterCriteria.allocationDateTo);
    }
  }

  if (filterCriteria.expiryDateFrom || filterCriteria.expiryDateTo) {
    where.expiryDate = {};
    if (filterCriteria.expiryDateFrom) {
      where.expiryDate.gte = new Date(filterCriteria.expiryDateFrom);
    }
    if (filterCriteria.expiryDateTo) {
      where.expiryDate.lte = new Date(filterCriteria.expiryDateTo);
    }
  }

  if (filterCriteria.overdueMin !== undefined || filterCriteria.overdueMax !== undefined) {
    where.overdueAmount = {};
    if (filterCriteria.overdueMin !== undefined) {
      where.overdueAmount.gte = filterCriteria.overdueMin;
    }
    if (filterCriteria.overdueMax !== undefined) {
      where.overdueAmount.lte = filterCriteria.overdueMax;
    }
  }

  if (filterCriteria.search) {
    where.OR = [
      { fileNo: { contains: filterCriteria.search, mode: 'insensitive' } },
      { clientName: { contains: filterCriteria.search, mode: 'insensitive' } },
      { contactPhone: { contains: filterCriteria.search, mode: 'insensitive' } },
    ];
  }

  // Get total count
  const total = await prisma.account.count({ where });

  // Get accounts with pagination
  const accounts = await prisma.account.findMany({
    where,
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
      updates: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              role: true,
            },
          },
        },
      },
      collections: {
        where: { status: 'APPROVED' },
        select: {
          id: true,
          amount: true,
          collectionDate: true,
          type: true,
        },
      },
    },
    orderBy: {
      [sortBy]: sortOrder,
    },
    skip: (page - 1) * limit,
    take: limit,
  });

  const pages = Math.ceil(total / limit);

  res.json({
    accounts: accounts.map(account => ({
      ...account,
      lastUpdate: account.updates[0] || null,
      assignedAgent: account.assignments[0]?.agent || null,
      totalCollected: account.collections.reduce((sum, col) => sum + Number(col.amount), 0),
    })),
    pagination: {
      page,
      limit,
      total,
      pages,
    },
  });
}));

/**
 * @swagger
 * /api/accounts/{id}:
 *   get:
 *     summary: Get account by ID
 *     tags: [Accounts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Account details
 *       404:
 *         description: Account not found
 */
router.get('/:id', requireAccountAccess, asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);

  const account = await prisma.account.findUnique({
    where: { id },
    include: {
      bank: true,
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
                  phone: true,
                },
              },
            },
          },
        },
      },
      updates: {
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              role: true,
            },
          },
        },
      },
      collections: {
        orderBy: { createdAt: 'desc' },
        include: {
          submitter: {
            select: {
              id: true,
              name: true,
              role: true,
            },
          },
        },
      },
    },
  });

  if (!account) {
    throw notFoundError('Account not found');
  }

  res.json({
    ...account,
    assignedAgent: account.assignments[0]?.agent || null,
    totalCollected: account.collections
      .filter(col => col.status === 'APPROVED')
      .reduce((sum, col) => sum + Number(col.amount), 0),
  });
}));

/**
 * @swagger
 * /api/accounts:
 *   post:
 *     summary: Create new account (Admin only)
 *     tags: [Accounts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       201:
 *         description: Account created successfully
 *       400:
 *         description: Validation error
 */
router.post('/', requireAdmin, asyncHandler(async (req, res) => {
  const accountData = createAccountSchema.parse(req.body);

  // Check if account with same file number exists for this bank
  const existingAccount = await prisma.account.findUnique({
    where: {
      bankId_fileNo: {
        bankId: accountData.bankId,
        fileNo: accountData.fileNo,
      },
    },
  });

  if (existingAccount) {
    return res.status(409).json({
      error: 'Account with this file number already exists for this bank',
    });
  }

  // Convert date strings to Date objects
  const processedData = {
    ...accountData,
    allocationDate: accountData.allocationDate ? new Date(accountData.allocationDate) : null,
    expiryDate: accountData.expiryDate ? new Date(accountData.expiryDate) : null,
    workOrderExpiry: accountData.workOrderExpiry ? new Date(accountData.workOrderExpiry) : null,
  };

  const account = await prisma.account.create({
    data: processedData,
    include: {
      bank: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
    },
  });

  // Log the creation
  await prisma.eventLog.create({
    data: {
      userId: req.user!.id,
      action: 'CREATE',
      resource: 'accounts',
      resourceId: account.id,
      newData: account,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    },
  });

  res.status(201).json(account);
}));

/**
 * @swagger
 * /api/accounts/{id}:
 *   put:
 *     summary: Update account (Admin only)
 *     tags: [Accounts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Account updated successfully
 *       404:
 *         description: Account not found
 */
router.put('/:id', requireAdmin, asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const updateData = updateAccountSchema.parse(req.body);

  const existingAccount = await prisma.account.findUnique({
    where: { id },
  });

  if (!existingAccount) {
    throw notFoundError('Account not found');
  }

  // Convert date strings to Date objects
  const processedData: any = { ...updateData };
  if (updateData.allocationDate) {
    processedData.allocationDate = new Date(updateData.allocationDate);
  }
  if (updateData.expiryDate) {
    processedData.expiryDate = new Date(updateData.expiryDate);
  }
  if (updateData.workOrderExpiry) {
    processedData.workOrderExpiry = new Date(updateData.workOrderExpiry);
  }

  const account = await prisma.account.update({
    where: { id },
    data: processedData,
    include: {
      bank: {
        select: {
          id: true,
          name: true,
          code: true,
        },
      },
    },
  });

  // Log the update
  await prisma.eventLog.create({
    data: {
      userId: req.user!.id,
      action: 'UPDATE',
      resource: 'accounts',
      resourceId: account.id,
      oldData: existingAccount,
      newData: account,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    },
  });

  res.json(account);
}));

/**
 * @swagger
 * /api/accounts/{id}/assign:
 *   post:
 *     summary: Assign account to agent (Admin only)
 *     tags: [Accounts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Account assigned successfully
 */
router.post('/:id/assign', requireAdmin, asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const { agentId } = assignAccountSchema.parse(req.body);

  const account = await prisma.account.findUnique({
    where: { id },
  });

  if (!account) {
    throw notFoundError('Account not found');
  }

  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!agent) {
    throw notFoundError('Agent not found');
  }

  // Deactivate existing assignments
  await prisma.assignment.updateMany({
    where: {
      accountId: id,
      isActive: true,
    },
    data: {
      isActive: false,
    },
  });

  // Create new assignment
  const assignment = await prisma.assignment.create({
    data: {
      accountId: id,
      agentId,
    },
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
  });

  // Log the assignment
  await prisma.eventLog.create({
    data: {
      userId: req.user!.id,
      action: 'ASSIGN',
      resource: 'accounts',
      resourceId: id,
      newData: { agentId, agentName: agent.user.name },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    },
  });

  res.json({
    message: 'Account assigned successfully',
    assignment,
  });
}));

/**
 * @swagger
 * /api/accounts/{id}/updates:
 *   post:
 *     summary: Add update to account (Agents and Admins)
 *     tags: [Accounts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       201:
 *         description: Update added successfully
 */
router.post('/:id/updates', requireAccountAccess, asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const updateData = createUpdateSchema.parse(req.body);

  const account = await prisma.account.findUnique({
    where: { id },
  });

  if (!account) {
    throw notFoundError('Account not found');
  }

  // Convert date string to Date object
  const processedData = {
    ...updateData,
    visitDate: new Date(updateData.visitDate),
    ptpDate: updateData.ptpDate ? new Date(updateData.ptpDate) : null,
    accountId: id,
    userId: req.user!.id,
  };

  const update = await prisma.update.create({
    data: processedData,
    include: {
      user: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
    },
  });

  // Update account's last contact date
  await prisma.account.update({
    where: { id },
    data: {
      lastContactDate: new Date(),
    },
  });

  // Log the update
  await prisma.eventLog.create({
    data: {
      userId: req.user!.id,
      action: 'CREATE',
      resource: 'updates',
      resourceId: update.id,
      newData: update,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    },
  });

  res.status(201).json(update);
}));

export default router;