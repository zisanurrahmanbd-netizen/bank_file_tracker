import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { prisma } from '@/server';
import { asyncHandler, notFoundError, forbiddenError } from '@/middleware/errorHandler';
import { requireAuth, requireAdmin } from '@/middleware/auth';
import { 
  createUserSchema, 
  updateUserSchema,
  createAgentSchema,
  updateAgentSchema,
  idParamSchema,
  paginationSchema 
} from '@/utils/validation';
import { logger } from '@/utils/logger';

const router = Router();

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Get all users with pagination and filtering
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [ADMIN, AGENT, AUDITOR]
 *       - in: query
 *         name: bankId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: search
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
 *         description: List of users
 *       403:
 *         description: Admin access required
 */
router.get('/', requireAdmin, asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, role, bankId, search } = paginationSchema.extend({
    role: z.enum(['ADMIN', 'AGENT', 'AUDITOR']).optional(),
    bankId: z.string().uuid().optional(),
    search: z.string().optional(),
  }).parse(req.query);

  const where: any = {};

  if (role) {
    where.role = role;
  }

  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  // Filter by bank for agents
  if (bankId) {
    where.agentProfile = {
      bankId,
    };
  }

  const [users, total] = await prisma.$transaction([
    prisma.user.findMany({
      where,
      include: {
        agentProfile: {
          include: {
            bank: {
              select: {
                id: true,
                name: true,
                code: true,
              },
            },
            _count: {
              select: {
                assignments: {
                  where: { isActive: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.user.count({ where }),
  ]);

  // Remove sensitive data
  const sanitizedUsers = users.map(user => ({
    ...user,
    password: undefined,
    supabaseId: undefined,
  }));

  res.json({
    users: sanitizedUsers,
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
 * /api/users/{id}:
 *   get:
 *     summary: Get user by ID
 *     tags: [Users]
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
 *         description: User details
 *       404:
 *         description: User not found
 *       403:
 *         description: Access denied
 */
router.get('/:id', requireAuth, asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);

  // Check if user can access this profile
  if (req.user?.role !== 'ADMIN' && req.user?.id !== id) {
    throw forbiddenError('Access denied');
  }

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      agentProfile: {
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
              account: {
                select: {
                  id: true,
                  fileNo: true,
                  clientName: true,
                  outstandingAmount: true,
                  overdueAmount: true,
                  statusStage: true,
                },
              },
            },
            take: 10,
            orderBy: { createdAt: 'desc' },
          },
          _count: {
            select: {
              assignments: {
                where: { isActive: true },
              },
            },
          },
        },
      },
    },
  });

  if (!user) {
    throw notFoundError('User not found');
  }

  // Remove sensitive data
  const sanitizedUser = {
    ...user,
    password: undefined,
    supabaseId: req.user?.role === 'ADMIN' ? user.supabaseId : undefined,
  };

  res.json(sanitizedUser);
}));

/**
 * @swagger
 * /api/users:
 *   post:
 *     summary: Create a new user
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 minLength: 6
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [ADMIN, AGENT, AUDITOR]
 *               agentProfile:
 *                 type: object
 *                 properties:
 *                   bankId:
 *                     type: string
 *                     format: uuid
 *                   employeeId:
 *                     type: string
 *                   territory:
 *                     type: string
 *                   targetMonthly:
 *                     type: number
 *                   commissionRate:
 *                     type: number
 *             required:
 *               - email
 *               - password
 *               - name
 *               - role
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Validation error or email already exists
 *       403:
 *         description: Admin access required
 */
router.post('/', requireAdmin, asyncHandler(async (req, res) => {
  const { agentProfile, ...userData } = createUserSchema.extend({
    agentProfile: createAgentSchema.omit({ userId: true }).optional(),
  }).parse(req.body);

  // Check if email already exists
  const existingUser = await prisma.user.findUnique({
    where: { email: userData.email },
  });

  if (existingUser) {
    return res.status(400).json({
      success: false,
      error: 'Email already exists',
    });
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(userData.password, 12);

  // Create user with transaction
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        ...userData,
        password: hashedPassword,
      },
    });

    // Create agent profile if provided
    let agent = null;
    if (userData.role === 'AGENT' && agentProfile) {
      agent = await tx.agent.create({
        data: {
          ...agentProfile,
          userId: user.id,
        },
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
    }

    return { user, agent };
  });

  // Log the creation
  await prisma.eventLog.create({
    data: {
      userId: req.user!.id,
      action: 'CREATE',
      resource: 'user',
      resourceId: result.user.id,
      newData: { ...userData, agentProfile },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    },
  });

  logger.info('User created:', {
    userId: result.user.id,
    email: result.user.email,
    role: result.user.role,
    createdBy: req.user!.id,
  });

  // Remove sensitive data
  const sanitizedUser = {
    ...result.user,
    password: undefined,
    agentProfile: result.agent,
  };

  res.status(201).json(sanitizedUser);
}));

/**
 * @swagger
 * /api/users/{id}:
 *   put:
 *     summary: Update user
 *     tags: [Users]
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
 *               phone:
 *                 type: string
 *               language:
 *                 type: string
 *               settings:
 *                 type: object
 *               agentProfile:
 *                 type: object
 *                 properties:
 *                   employeeId:
 *                     type: string
 *                   territory:
 *                     type: string
 *                   targetMonthly:
 *                     type: number
 *                   commissionRate:
 *                     type: number
 *     responses:
 *       200:
 *         description: User updated successfully
 *       404:
 *         description: User not found
 *       403:
 *         description: Access denied
 */
router.put('/:id', requireAuth, asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const { agentProfile, ...updateData } = updateUserSchema.extend({
    agentProfile: updateAgentSchema.optional(),
  }).parse(req.body);

  // Check if user can update this profile
  if (req.user?.role !== 'ADMIN' && req.user?.id !== id) {
    throw forbiddenError('Access denied');
  }

  // Get existing user
  const existingUser = await prisma.user.findUnique({
    where: { id },
    include: {
      agentProfile: true,
    },
  });

  if (!existingUser) {
    throw notFoundError('User not found');
  }

  // Update user with transaction
  const result = await prisma.$transaction(async (tx) => {
    const user = await tx.user.update({
      where: { id },
      data: updateData,
    });

    // Update agent profile if provided and user is agent
    let agent = null;
    if (user.role === 'AGENT' && agentProfile && existingUser.agentProfile) {
      agent = await tx.agent.update({
        where: { userId: id },
        data: agentProfile,
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
    }

    return { user, agent };
  });

  // Log the update
  await prisma.eventLog.create({
    data: {
      userId: req.user!.id,
      action: 'UPDATE',
      resource: 'user',
      resourceId: id,
      oldData: existingUser,
      newData: { ...updateData, agentProfile },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    },
  });

  logger.info('User updated:', {
    userId: id,
    updatedBy: req.user!.id,
    changes: Object.keys(updateData),
  });

  // Remove sensitive data
  const sanitizedUser = {
    ...result.user,
    password: undefined,
    supabaseId: undefined,
    agentProfile: result.agent || existingUser.agentProfile,
  };

  res.json(sanitizedUser);
}));

/**
 * @swagger
 * /api/users/{id}/activate:
 *   post:
 *     summary: Activate/deactivate user
 *     tags: [Users]
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
 *               isActive:
 *                 type: boolean
 *             required:
 *               - isActive
 *     responses:
 *       200:
 *         description: User status updated
 *       404:
 *         description: User not found
 *       403:
 *         description: Admin access required
 */
router.post('/:id/activate', requireAdmin, asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const { isActive } = z.object({ isActive: z.boolean() }).parse(req.body);

  const existingUser = await prisma.user.findUnique({
    where: { id },
  });

  if (!existingUser) {
    throw notFoundError('User not found');
  }

  const user = await prisma.user.update({
    where: { id },
    data: { isActive },
  });

  // Log the status change
  await prisma.eventLog.create({
    data: {
      userId: req.user!.id,
      action: 'UPDATE',
      resource: 'user',
      resourceId: id,
      oldData: { isActive: existingUser.isActive },
      newData: { isActive },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    },
  });

  logger.info('User status updated:', {
    userId: id,
    isActive,
    updatedBy: req.user!.id,
  });

  res.json({
    success: true,
    message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
    user: {
      ...user,
      password: undefined,
      supabaseId: undefined,
    },
  });
}));

/**
 * @swagger
 * /api/users/{id}/reset-password:
 *   post:
 *     summary: Reset user password (Admin only)
 *     tags: [Users]
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
 *               newPassword:
 *                 type: string
 *                 minLength: 6
 *             required:
 *               - newPassword
 *     responses:
 *       200:
 *         description: Password reset successfully
 *       404:
 *         description: User not found
 *       403:
 *         description: Admin access required
 */
router.post('/:id/reset-password', requireAdmin, asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const { newPassword } = z.object({
    newPassword: z.string().min(6, 'Password must be at least 6 characters'),
  }).parse(req.body);

  const existingUser = await prisma.user.findUnique({
    where: { id },
  });

  if (!existingUser) {
    throw notFoundError('User not found');
  }

  // Hash new password
  const hashedPassword = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id },
    data: { password: hashedPassword },
  });

  // Log the password reset
  await prisma.eventLog.create({
    data: {
      userId: req.user!.id,
      action: 'UPDATE',
      resource: 'user',
      resourceId: id,
      newData: { action: 'password_reset' },
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    },
  });

  logger.info('Password reset by admin:', {
    userId: id,
    resetBy: req.user!.id,
  });

  res.json({
    success: true,
    message: 'Password reset successfully',
  });
}));

export default router;