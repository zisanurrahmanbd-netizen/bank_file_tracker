import { Worker, Queue } from 'bullmq';
import { createClient } from 'redis';
import cron from 'node-cron';
import pino from 'pino';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize logger
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname',
    },
  } : undefined,
});

// Redis connection
const redisConnection = {
  host: process.env.REDIS_HOST || 'redis',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD || 'redispass123',
};

// Job queues
const emailQueue = new Queue('email', { connection: redisConnection });
const reportQueue = new Queue('reports', { connection: redisConnection });
const reconciliationQueue = new Queue('reconciliation', { connection: redisConnection });
const alertQueue = new Queue('alerts', { connection: redisConnection });

// Email worker
const emailWorker = new Worker('email', async (job) => {
  logger.info(`Processing email job: ${job.id}`);
  
  const { type, data } = job.data;
  
  switch (type) {
    case 'weekly_report':
      await sendWeeklyReport(data);
      break;
    case 'alert_notification':
      await sendAlertNotification(data);
      break;
    case 'collection_approved':
      await sendCollectionApproval(data);
      break;
    default:
      logger.warn(`Unknown email job type: ${type}`);
  }
}, { connection: redisConnection });

// Reports worker
const reportsWorker = new Worker('reports', async (job) => {
  logger.info(`Processing report job: ${job.id}`);
  
  const { type, data } = job.data;
  
  switch (type) {
    case 'weekly_bank_report':
      await generateWeeklyBankReport(data);
      break;
    case 'monthly_summary':
      await generateMonthlySummary(data);
      break;
    case 'custom_export':
      await generateCustomExport(data);
      break;
    default:
      logger.warn(`Unknown report job type: ${type}`);
  }
}, { connection: redisConnection });

// Reconciliation worker
const reconciliationWorker = new Worker('reconciliation', async (job) => {
  logger.info(`Processing reconciliation job: ${job.id}`);
  
  const { type, data } = job.data;
  
  switch (type) {
    case 'auto_match_payments':
      await autoMatchPayments(data);
      break;
    case 'bank_statement_processing':
      await processBankStatement(data);
      break;
    case 'variance_detection':
      await detectVariances(data);
      break;
    default:
      logger.warn(`Unknown reconciliation job type: ${type}`);
  }
}, { connection: redisConnection });

// Alerts worker
const alertWorker = new Worker('alerts', async (job) => {
  logger.info(`Processing alert job: ${job.id}`);
  
  const { type, data } = job.data;
  
  switch (type) {
    case 'sla_breach_check':
      await checkSLABreaches(data);
      break;
    case 'missed_ptp_check':
      await checkMissedPTPs(data);
      break;
    case 'no_update_check':
      await checkNoUpdates(data);
      break;
    default:
      logger.warn(`Unknown alert job type: ${type}`);
  }
}, { connection: redisConnection });

// Scheduled jobs
cron.schedule('0 23 * * 0', async () => {
  // Weekly reports - every Sunday at 11 PM
  logger.info('Scheduling weekly reports generation');
  await reportQueue.add('weekly_bank_report', { weekStart: new Date() });
});

cron.schedule('0 9 * * *', async () => {
  // Daily SLA checks - every day at 9 AM
  logger.info('Scheduling daily SLA checks');
  await alertQueue.add('sla_breach_check', { date: new Date() });
});

cron.schedule('0 */6 * * *', async () => {
  // Reconciliation checks - every 6 hours
  logger.info('Scheduling reconciliation checks');
  await reconciliationQueue.add('auto_match_payments', { timestamp: new Date() });
});

// Job processing functions (placeholders)
async function sendWeeklyReport(data: any): Promise<void> {
  logger.info('Sending weekly report', data);
  // Implementation for sending weekly reports
}

async function sendAlertNotification(data: any): Promise<void> {
  logger.info('Sending alert notification', data);
  // Implementation for sending alert notifications
}

async function sendCollectionApproval(data: any): Promise<void> {
  logger.info('Sending collection approval notification', data);
  // Implementation for sending collection approval notifications
}

async function generateWeeklyBankReport(data: any): Promise<void> {
  logger.info('Generating weekly bank report', data);
  // Implementation for generating weekly bank reports
}

async function generateMonthlySummary(data: any): Promise<void> {
  logger.info('Generating monthly summary', data);
  // Implementation for generating monthly summaries
}

async function generateCustomExport(data: any): Promise<void> {
  logger.info('Generating custom export', data);
  // Implementation for generating custom exports
}

async function autoMatchPayments(data: any): Promise<void> {
  logger.info('Auto-matching payments', data);
  // Implementation for auto-matching payments
}

async function processBankStatement(data: any): Promise<void> {
  logger.info('Processing bank statement', data);
  // Implementation for processing bank statements
}

async function detectVariances(data: any): Promise<void> {
  logger.info('Detecting variances', data);
  // Implementation for detecting variances
}

async function checkSLABreaches(data: any): Promise<void> {
  logger.info('Checking SLA breaches', data);
  // Implementation for checking SLA breaches
}

async function checkMissedPTPs(data: any): Promise<void> {
  logger.info('Checking missed PTPs', data);
  // Implementation for checking missed PTPs
}

async function checkNoUpdates(data: any): Promise<void> {
  logger.info('Checking accounts with no updates', data);
  // Implementation for checking accounts with no updates
}

// Worker event handlers
emailWorker.on('completed', (job) => {
  logger.info(`Email job ${job.id} completed`);
});

emailWorker.on('failed', (job, err) => {
  logger.error(`Email job ${job?.id} failed:`, err);
});

reportsWorker.on('completed', (job) => {
  logger.info(`Report job ${job.id} completed`);
});

reportsWorker.on('failed', (job, err) => {
  logger.error(`Report job ${job?.id} failed:`, err);
});

reconciliationWorker.on('completed', (job) => {
  logger.info(`Reconciliation job ${job.id} completed`);
});

reconciliationWorker.on('failed', (job, err) => {
  logger.error(`Reconciliation job ${job?.id} failed:`, err);
});

alertWorker.on('completed', (job) => {
  logger.info(`Alert job ${job.id} completed`);
});

alertWorker.on('failed', (job, err) => {
  logger.error(`Alert job ${job?.id} failed:`, err);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  await Promise.all([
    emailWorker.close(),
    reportsWorker.close(),
    reconciliationWorker.close(),
    alertWorker.close(),
  ]);
  
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  
  await Promise.all([
    emailWorker.close(),
    reportsWorker.close(),
    reconciliationWorker.close(),
    alertWorker.close(),
  ]);
  
  process.exit(0);
});

logger.info('Bank Recovery Worker started successfully');
logger.info('Scheduled jobs configured:');
logger.info('- Weekly reports: Sunday 23:00');
logger.info('- Daily SLA checks: Daily 09:00');
logger.info('- Reconciliation: Every 6 hours');