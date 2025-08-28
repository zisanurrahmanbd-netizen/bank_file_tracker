import { Router } from 'express';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '@/server';
import { asyncHandler, validationError } from '@/middleware/errorHandler';
import { bkashWebhookSchema, nagadWebhookSchema } from '@/utils/validation';
import { logger } from '@/utils/logger';

const router = Router();

// Middleware to verify webhook signature
const verifyWebhookSignature = (provider: 'bkash' | 'nagad') => {
  return (req: any, res: any, next: any) => {
    try {
      const signature = req.headers['x-signature'] || req.headers['signature'];
      const timestamp = req.headers['x-timestamp'] || req.headers['timestamp'];
      
      if (!signature) {
        return res.status(401).json({
          success: false,
          error: 'Missing signature header',
        });
      }

      // Get webhook secret from environment
      const secret = provider === 'bkash' 
        ? process.env.BKASH_WEBHOOK_SECRET
        : process.env.NAGAD_WEBHOOK_SECRET;

      if (!secret) {
        logger.error(`${provider.toUpperCase()} webhook secret not configured`);
        return res.status(500).json({
          success: false,
          error: 'Webhook not configured',
        });
      }

      // Create payload for signature verification
      const payload = timestamp ? `${timestamp}.${JSON.stringify(req.body)}` : JSON.stringify(req.body);
      
      // Calculate expected signature
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload)
        .digest('hex');

      // Compare signatures
      const providedSignature = signature.replace('sha256=', '');
      
      if (!crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(providedSignature, 'hex')
      )) {
        logger.warn(`${provider.toUpperCase()} webhook signature verification failed`, {
          provided: providedSignature,
          expected: expectedSignature,
        });
        
        return res.status(401).json({
          success: false,
          error: 'Invalid signature',
        });
      }

      // Check timestamp if provided (prevent replay attacks)
      if (timestamp) {
        const timestampMs = parseInt(timestamp) * 1000;
        const now = Date.now();
        const timeDiff = Math.abs(now - timestampMs);
        
        // Allow 5 minutes tolerance
        if (timeDiff > 5 * 60 * 1000) {
          return res.status(401).json({
            success: false,
            error: 'Request timestamp too old',
          });
        }
      }

      next();
    } catch (error) {
      logger.error(`${provider.toUpperCase()} webhook signature verification error:`, error);
      return res.status(500).json({
        success: false,
        error: 'Signature verification failed',
      });
    }
  };
};

/**
 * @swagger
 * /webhook/bkash:
 *   post:
 *     summary: bKash payment webhook
 *     tags: [Webhooks]
 *     description: Webhook endpoint for bKash payment notifications
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               txnId:
 *                 type: string
 *                 description: bKash transaction ID
 *               amount:
 *                 type: number
 *                 description: Payment amount
 *               currency:
 *                 type: string
 *                 default: BDT
 *               status:
 *                 type: string
 *                 description: Payment status
 *               date:
 *                 type: string
 *                 description: Payment date
 *               customerMobile:
 *                 type: string
 *                 description: Customer mobile number
 *               merchantInvoiceNumber:
 *                 type: string
 *                 description: Merchant invoice number
 *               signature:
 *                 type: string
 *                 description: Webhook signature
 *             required:
 *               - txnId
 *               - amount
 *               - status
 *               - date
 *               - signature
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 *       400:
 *         description: Invalid webhook payload
 *       401:
 *         description: Invalid signature
 */
router.post('/bkash', verifyWebhookSignature('bkash'), asyncHandler(async (req, res) => {
  try {
    const data = bkashWebhookSchema.parse(req.body);
    
    logger.info('bKash webhook received:', {
      txnId: data.txnId,
      amount: data.amount,
      status: data.status,
    });

    // Process the webhook
    const result = await processBkashWebhook(data);
    
    res.json({
      success: true,
      message: 'Webhook processed successfully',
      matched: result.matched,
      collectionId: result.collectionId,
    });
  } catch (error) {
    logger.error('bKash webhook processing error:', error);
    
    if (error instanceof z.ZodError) {
      throw validationError('Invalid webhook payload', error.errors);
    }
    
    throw error;
  }
}));

/**
 * @swagger
 * /webhook/nagad:
 *   post:
 *     summary: Nagad payment webhook
 *     tags: [Webhooks]
 *     description: Webhook endpoint for Nagad payment notifications
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               paymentRefId:
 *                 type: string
 *                 description: Nagad payment reference ID
 *               amount:
 *                 type: number
 *                 description: Payment amount
 *               currency:
 *                 type: string
 *                 default: BDT
 *               status:
 *                 type: string
 *                 description: Payment status
 *               dateTime:
 *                 type: string
 *                 description: Payment date and time
 *               customerMobile:
 *                 type: string
 *                 description: Customer mobile number
 *               orderId:
 *                 type: string
 *                 description: Order ID
 *               signature:
 *                 type: string
 *                 description: Webhook signature
 *             required:
 *               - paymentRefId
 *               - amount
 *               - status
 *               - dateTime
 *               - signature
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 *       400:
 *         description: Invalid webhook payload
 *       401:
 *         description: Invalid signature
 */
router.post('/nagad', verifyWebhookSignature('nagad'), asyncHandler(async (req, res) => {
  try {
    const data = nagadWebhookSchema.parse(req.body);
    
    logger.info('Nagad webhook received:', {
      paymentRefId: data.paymentRefId,
      amount: data.amount,
      status: data.status,
    });

    // Process the webhook
    const result = await processNagadWebhook(data);
    
    res.json({
      success: true,
      message: 'Webhook processed successfully',
      matched: result.matched,
      collectionId: result.collectionId,
    });
  } catch (error) {
    logger.error('Nagad webhook processing error:', error);
    
    if (error instanceof z.ZodError) {
      throw validationError('Invalid webhook payload', error.errors);
    }
    
    throw error;
  }
}));

/**
 * @swagger
 * /webhook/test:
 *   post:
 *     summary: Test webhook endpoint
 *     tags: [Webhooks]
 *     description: Test endpoint for webhook development and debugging
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               provider:
 *                 type: string
 *                 enum: [bkash, nagad]
 *               txnId:
 *                 type: string
 *               amount:
 *                 type: number
 *               status:
 *                 type: string
 *               customerMobile:
 *                 type: string
 *             required:
 *               - provider
 *               - txnId
 *               - amount
 *               - status
 *     responses:
 *       200:
 *         description: Test webhook processed
 *       403:
 *         description: Test webhooks only allowed in development
 */
router.post('/test', asyncHandler(async (req, res) => {
  // Only allow test webhooks in development
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      success: false,
      error: 'Test webhooks not allowed in production',
    });
  }

  const { provider, txnId, amount, status, customerMobile } = req.body;

  logger.info('Test webhook received:', {
    provider,
    txnId,
    amount,
    status,
  });

  // Simulate webhook processing
  const mockData = {
    txnId: txnId || `TEST_${Date.now()}`,
    amount: amount || 100,
    status: status || 'SUCCESS',
    date: new Date().toISOString(),
    customerMobile: customerMobile || '+8801XXXXXXXXX',
    signature: 'test_signature',
  };

  let result;
  if (provider === 'bkash') {
    result = await processBkashWebhook({
      ...mockData,
      currency: 'BDT',
      merchantInvoiceNumber: `INV_${Date.now()}`,
    });
  } else if (provider === 'nagad') {
    result = await processNagadWebhook({
      paymentRefId: mockData.txnId,
      amount: mockData.amount,
      currency: 'BDT',
      status: mockData.status,
      dateTime: mockData.date,
      customerMobile: mockData.customerMobile,
      orderId: `ORDER_${Date.now()}`,
      signature: mockData.signature,
    });
  } else {
    return res.status(400).json({
      success: false,
      error: 'Invalid provider',
    });
  }

  res.json({
    success: true,
    message: 'Test webhook processed',
    data: mockData,
    result,
  });
}));

// Helper function to process bKash webhooks
async function processBkashWebhook(data: any) {
  try {
    // Store webhook data
    const webhookLog = await prisma.webhookLog.create({
      data: {
        provider: 'BKASH',
        txnId: data.txnId,
        amount: data.amount,
        status: data.status,
        payload: data,
        processedAt: new Date(),
      },
    });

    // Try to match with existing collections
    let matchedCollection = null;
    
    if (data.status === 'SUCCESS' || data.status === 'COMPLETED') {
      // Try to match by transaction ID first
      matchedCollection = await prisma.collection.findFirst({
        where: {
          type: 'BKASH',
          txnId: data.txnId,
          status: 'PENDING',
        },
        include: {
          account: {
            include: {
              bank: true,
            },
          },
        },
      });

      // If no exact match, try to match by amount and date range (within 24 hours)
      if (!matchedCollection) {
        const paymentDate = new Date(data.date);
        const startDate = new Date(paymentDate.getTime() - 24 * 60 * 60 * 1000);
        const endDate = new Date(paymentDate.getTime() + 24 * 60 * 60 * 1000);

        matchedCollection = await prisma.collection.findFirst({
          where: {
            type: 'BKASH',
            amount: data.amount,
            collectionDate: {
              gte: startDate,
              lte: endDate,
            },
            status: 'PENDING',
            isMatched: false,
          },
          include: {
            account: {
              include: {
                bank: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc', // Match oldest first
          },
        });
      }

      if (matchedCollection) {
        // Update collection with webhook data
        await prisma.collection.update({
          where: { id: matchedCollection.id },
          data: {
            txnId: data.txnId,
            isMatched: true,
            webhookData: data,
            status: 'APPROVED', // Auto-approve matched collections
          },
        });

        // Create reconciliation record
        await prisma.reconciliation.create({
          data: {
            collectionId: matchedCollection.id,
            webhookLogId: webhookLog.id,
            status: 'MATCHED',
            matchedAt: new Date(),
            matchType: data.txnId === matchedCollection.txnId ? 'EXACT' : 'FUZZY',
          },
        });

        logger.info('bKash collection matched and approved:', {
          collectionId: matchedCollection.id,
          txnId: data.txnId,
          amount: data.amount,
        });

        return {
          matched: true,
          collectionId: matchedCollection.id,
          webhookLogId: webhookLog.id,
        };
      }
    }

    // If no match found, log for manual review
    logger.warn('bKash webhook could not be matched:', {
      txnId: data.txnId,
      amount: data.amount,
      status: data.status,
    });

    return {
      matched: false,
      webhookLogId: webhookLog.id,
    };
  } catch (error) {
    logger.error('bKash webhook processing error:', error);
    throw error;
  }
}

// Helper function to process Nagad webhooks
async function processNagadWebhook(data: any) {
  try {
    // Store webhook data
    const webhookLog = await prisma.webhookLog.create({
      data: {
        provider: 'NAGAD',
        txnId: data.paymentRefId,
        amount: data.amount,
        status: data.status,
        payload: data,
        processedAt: new Date(),
      },
    });

    // Try to match with existing collections
    let matchedCollection = null;
    
    if (data.status === 'SUCCESS' || data.status === 'COMPLETED') {
      // Try to match by payment reference ID first
      matchedCollection = await prisma.collection.findFirst({
        where: {
          type: 'NAGAD',
          txnId: data.paymentRefId,
          status: 'PENDING',
        },
        include: {
          account: {
            include: {
              bank: true,
            },
          },
        },
      });

      // If no exact match, try to match by amount and date range (within 24 hours)
      if (!matchedCollection) {
        const paymentDate = new Date(data.dateTime);
        const startDate = new Date(paymentDate.getTime() - 24 * 60 * 60 * 1000);
        const endDate = new Date(paymentDate.getTime() + 24 * 60 * 60 * 1000);

        matchedCollection = await prisma.collection.findFirst({
          where: {
            type: 'NAGAD',
            amount: data.amount,
            collectionDate: {
              gte: startDate,
              lte: endDate,
            },
            status: 'PENDING',
            isMatched: false,
          },
          include: {
            account: {
              include: {
                bank: true,
              },
            },
          },
          orderBy: {
            createdAt: 'asc', // Match oldest first
          },
        });
      }

      if (matchedCollection) {
        // Update collection with webhook data
        await prisma.collection.update({
          where: { id: matchedCollection.id },
          data: {
            txnId: data.paymentRefId,
            isMatched: true,
            webhookData: data,
            status: 'APPROVED', // Auto-approve matched collections
          },
        });

        // Create reconciliation record
        await prisma.reconciliation.create({
          data: {
            collectionId: matchedCollection.id,
            webhookLogId: webhookLog.id,
            status: 'MATCHED',
            matchedAt: new Date(),
            matchType: data.paymentRefId === matchedCollection.txnId ? 'EXACT' : 'FUZZY',
          },
        });

        logger.info('Nagad collection matched and approved:', {
          collectionId: matchedCollection.id,
          paymentRefId: data.paymentRefId,
          amount: data.amount,
        });

        return {
          matched: true,
          collectionId: matchedCollection.id,
          webhookLogId: webhookLog.id,
        };
      }
    }

    // If no match found, log for manual review
    logger.warn('Nagad webhook could not be matched:', {
      paymentRefId: data.paymentRefId,
      amount: data.amount,
      status: data.status,
    });

    return {
      matched: false,
      webhookLogId: webhookLog.id,
    };
  } catch (error) {
    logger.error('Nagad webhook processing error:', error);
    throw error;
  }
}

export default router;