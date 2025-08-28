import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '@/server';
import { asyncHandler, notFoundError } from '@/middleware/errorHandler';
import { requireAuth, requireAdmin } from '@/middleware/auth';
import { createAlertSchema, updateAlertSchema, idParamSchema } from '@/utils/validation';
import { logger } from '@/utils/logger';

const router = Router();

/**
 * @swagger
 * /api/alerts:
 *   get:
 *     summary: Get alerts with filtering and pagination
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [SLA_BREACH, VARIANCE, MISSED_PTP, HIGH_OVERDUE, NO_UPDATE, SYSTEM]
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *           enum: [INFO, WARNING, ERROR, CRITICAL]
 *       - in: query
 *         name: isRead
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: isResolved
 *         schema:
 *           type: boolean
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
 *         description: List of alerts
 */
router.get('/', requireAuth, asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    type,
    severity,
    isRead,
    isResolved,
  } = req.query;

  const pageNum = parseInt(page as string);
  const limitNum = parseInt(limit as string);

  const where: any = {};

  // Role-based filtering
  if (req.user?.role === 'AGENT') {
    // Agents can only see alerts for their assigned accounts
    const agent = await prisma.agent.findUnique({
      where: { userId: req.user.id },
    });

    if (agent) {
      where.OR = [
        { agentId: agent.id },
        { 
          account: {
            assignments: {
              some: {
                agentId: agent.id,
                isActive: true,
              },
            },
          },
        },
      ];
    } else {
      // If agent profile not found, return empty
      return res.json({
        alerts: [],
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: 0,
          pages: 0,
        },
      });
    }
  }

  if (type) {
    where.type = type as string;
  }

  if (severity) {
    where.severity = severity as string;
  }

  if (isRead !== undefined) {
    where.isRead = isRead === 'true';
  }

  if (isResolved !== undefined) {
    where.isResolved = isResolved === 'true';
  }

  const [alerts, total] = await prisma.$transaction([
    prisma.alert.findMany({
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
      orderBy: [
        { isRead: 'asc' },
        { severity: 'desc' },
        { createdAt: 'desc' },
      ],
      skip: (pageNum - 1) * limitNum,
      take: limitNum,
    }),
    prisma.alert.count({ where }),
  ]);

  res.json({
    alerts,
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
 * /api/alerts/{id}:
 *   get:
 *     summary: Get alert by ID
 *     tags: [Alerts]
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
 *         description: Alert details
 *       404:
 *         description: Alert not found
 */
router.get('/:id', requireAuth, asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);

  const alert = await prisma.alert.findUnique({
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
        },
      },
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

  if (!alert) {
    throw notFoundError('Alert not found');
  }

  // Check access permissions for agents
  if (req.user?.role === 'AGENT') {
    const agent = await prisma.agent.findUnique({
      where: { userId: req.user.id },
    });

    if (!agent) {
      throw notFoundError('Alert not found');
    }

    // Check if agent has access to this alert
    const hasAccess = 
      alert.agentId === agent.id ||
      (alert.account?.assignments?.some(
        (assignment: any) => assignment.agentId === agent.id && assignment.isActive
      ));

    if (!hasAccess) {
      throw notFoundError('Alert not found');
    }
  }

  res.json(alert);
}));

/**
 * @swagger
 * /api/alerts:
 *   post:
 *     summary: Create a new alert
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [SLA_BREACH, VARIANCE, MISSED_PTP, HIGH_OVERDUE, NO_UPDATE, SYSTEM]
 *               title:
 *                 type: string
 *               description:
 *                 type: string
 *               severity:
 *                 type: string
 *                 enum: [INFO, WARNING, ERROR, CRITICAL]
 *                 default: INFO
 *               accountId:
 *                 type: string
 *                 format: uuid
 *               agentId:
 *                 type: string
 *                 format: uuid
 *               data:
 *                 type: object
 *             required:
 *               - type
 *               - title
 *               - description
 *     responses:
 *       201:
 *         description: Alert created successfully
 *       400:
 *         description: Validation error
 *       403:
 *         description: Admin access required for manual alert creation
 */
router.post('/', requireAdmin, asyncHandler(async (req, res) => {
  const data = createAlertSchema.parse(req.body);

  const alert = await prisma.alert.create({
    data,
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

  logger.info('Alert created:', {
    alertId: alert.id,
    type: alert.type,
    severity: alert.severity,
    createdBy: req.user!.id,
  });

  res.status(201).json(alert);
}));

/**
 * @swagger
 * /api/alerts/{id}:
 *   patch:
 *     summary: Update alert (mark as read/resolved)
 *     tags: [Alerts]
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
 *               isRead:
 *                 type: boolean
 *               isResolved:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Alert updated successfully
 *       404:
 *         description: Alert not found
 *       403:
 *         description: Access denied
 */
router.patch('/:id', requireAuth, asyncHandler(async (req, res) => {
  const { id } = idParamSchema.parse(req.params);
  const data = updateAlertSchema.parse(req.body);

  // Check if alert exists and user has access
  const existingAlert = await prisma.alert.findUnique({
    where: { id },
    include: {
      account: {
        include: {
          assignments: {
            where: { isActive: true },
          },
        },
      },
    },
  });

  if (!existingAlert) {
    throw notFoundError('Alert not found');
  }

  // Check access permissions for agents
  if (req.user?.role === 'AGENT') {
    const agent = await prisma.agent.findUnique({
      where: { userId: req.user.id },
    });

    if (!agent) {
      throw notFoundError('Alert not found');
    }

    const hasAccess = 
      existingAlert.agentId === agent.id ||
      (existingAlert.account?.assignments?.some(
        (assignment: any) => assignment.agentId === agent.id
      ));

    if (!hasAccess) {
      throw notFoundError('Alert not found');
    }
  }

  const alert = await prisma.alert.update({
    where: { id },
    data: {
      ...data,
      readAt: data.isRead ? new Date() : existingAlert.readAt,
      resolvedAt: data.isResolved ? new Date() : existingAlert.resolvedAt,
    },
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

  logger.info('Alert updated:', {
    alertId: alert.id,
    changes: data,
    updatedBy: req.user!.id,
  });

  res.json(alert);
}));

/**
 * @swagger
 * /api/alerts/stats:
 *   get:
 *     summary: Get alert statistics
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Alert statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total:
 *                   type: integer
 *                 unread:
 *                   type: integer
 *                 unresolved:
 *                   type: integer
 *                 bySeverity:
 *                   type: object
 *                 byType:
 *                   type: object
 */
router.get('/stats', requireAuth, asyncHandler(async (req, res) => {
  const where: any = {};

  // Role-based filtering
  if (req.user?.role === 'AGENT') {
    const agent = await prisma.agent.findUnique({
      where: { userId: req.user.id },
    });

    if (agent) {
      where.OR = [
        { agentId: agent.id },
        { 
          account: {
            assignments: {
              some: {
                agentId: agent.id,
                isActive: true,
              },
            },
          },
        },
      ];
    }
  }

  const [total, unread, unresolved, bySeverity, byType] = await prisma.$transaction([
    prisma.alert.count({ where }),
    prisma.alert.count({ where: { ...where, isRead: false } }),
    prisma.alert.count({ where: { ...where, isResolved: false } }),
    prisma.alert.groupBy({
      by: ['severity'],
      where,
      _count: { id: true },
    }),
    prisma.alert.groupBy({
      by: ['type'],
      where,
      _count: { id: true },
    }),
  ]);

  const severityStats = bySeverity.reduce((acc, item) => {
    acc[item.severity] = item._count.id;
    return acc;
  }, {} as Record<string, number>);

  const typeStats = byType.reduce((acc, item) => {
    acc[item.type] = item._count.id;
    return acc;
  }, {} as Record<string, number>);

  res.json({
    total,
    unread,
    unresolved,
    bySeverity: severityStats,
    byType: typeStats,
  });
}));

/**
 * @swagger
 * /api/alerts/mark-all-read:
 *   post:
 *     summary: Mark all alerts as read for the current user
 *     tags: [Alerts]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All alerts marked as read
 */
router.post('/mark-all-read', requireAuth, asyncHandler(async (req, res) => {
  const where: any = { isRead: false };

  // Role-based filtering
  if (req.user?.role === 'AGENT') {
    const agent = await prisma.agent.findUnique({
      where: { userId: req.user.id },
    });

    if (agent) {
      where.OR = [
        { agentId: agent.id },
        { 
          account: {
            assignments: {
              some: {
                agentId: agent.id,
                isActive: true,
              },
            },
          },
        },
      ];
    }
  }

  const result = await prisma.alert.updateMany({
    where,
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  logger.info('All alerts marked as read:', {
    count: result.count,
    userId: req.user!.id,
  });

  res.json({
    success: true,
    message: `${result.count} alerts marked as read`,
    count: result.count,
  });
}));

export default router;