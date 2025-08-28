import { Queue, Worker, Job } from 'bullmq';
import { createClient } from 'redis';
import { prisma } from '@/server';
import { logger } from '@/utils/logger';
import * as XLSX from 'xlsx';
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';

// Redis connection configuration for BullMQ
const redisConnection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
};

// Redis client for other operations
const redis = createClient({
  socket: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
  },
  password: process.env.REDIS_PASSWORD,
});

redis.connect().catch(console.error);

// Job Queues
export const reportQueue = new Queue('report-generation', {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 10,
    removeOnFail: 20,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
});

export const alertQueue = new Queue('alert-processing', {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 5,
    removeOnFail: 10,
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  },
});

export const reconciliationQueue = new Queue('reconciliation', {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 5,
    removeOnFail: 10,
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
});

export const emailQueue = new Queue('email-notifications', {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 5,
    removeOnFail: 10,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  },
});

// Job Data Interfaces
interface ReportJobData {
  reportId: string;
  type: 'WEEKLY' | 'MONTHLY' | 'CUSTOM';
  startDate: string;
  endDate: string;
  bankId?: string;
  includeCollections: boolean;
  includeUpdates: boolean;
  format: 'XLSX' | 'CSV';
  requestedById: string;
}

interface AlertJobData {
  type: 'SLA_BREACH' | 'VARIANCE' | 'MISSED_PTP' | 'HIGH_OVERDUE' | 'NO_UPDATE';
  accountId?: string;
  agentId?: string;
  data: any;
}

interface EmailJobData {
  to: string[];
  subject: string;
  template: string;
  data: any;
  attachments?: Array<{
    filename: string;
    path?: string;
    content?: Buffer;
  }>;
}

// Email transporter setup
const emailTransporter = nodemailer.createTransporter({
  host: process.env.SMTP_HOST || 'localhost',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
});

// Report Generation Worker
const reportWorker = new Worker(
  'report-generation',
  async (job: Job<ReportJobData>) => {
    const { reportId, type, startDate, endDate, bankId, includeCollections, includeUpdates, format } = job.data;
    
    logger.info(`Starting report generation for ${reportId}`, job.data);
    
    try {
      // Update report status
      await prisma.report.update({
        where: { id: reportId },
        data: { status: 'GENERATING' },
      });
      
      // Generate report data
      const reportData = await generateReportData({
        type,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        bankId,
        includeCollections,
        includeUpdates,
      });
      
      // Create Excel/CSV file
      const filePath = await createReportFile(reportData, format, reportId);
      
      // Update report with completion
      await prisma.report.update({
        where: { id: reportId },
        data: {
          status: 'COMPLETED',
          filePath,
          completedAt: new Date(),
        },
      });
      
      // Send completion email
      const report = await prisma.report.findUnique({
        where: { id: reportId },
        include: {
          requestedBy: true,
          bank: true,
        },
      });
      
      if (report) {
        await emailQueue.add('report-ready', {
          to: [report.requestedBy.email],
          subject: 'Report Ready for Download',
          template: 'report-ready',
          data: {
            reportType: type,
            reportId,
            bankName: report.bank?.name || 'All Banks',
            dateRange: `${startDate} to ${endDate}`,
          },
        });
      }
      
      logger.info(`Report generation completed for ${reportId}`);
      
    } catch (error) {
      logger.error(`Report generation failed for ${reportId}:`, error);
      
      await prisma.report.update({
        where: { id: reportId },
        data: {
          status: 'FAILED',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 3,
  }
);

// Alert Processing Worker
const alertWorker = new Worker(
  'alert-processing',
  async (job: Job<AlertJobData>) => {
    const { type, accountId, agentId, data } = job.data;
    
    logger.info(`Processing alert: ${type}`, job.data);
    
    try {
      // Create alert record
      const alert = await prisma.alert.create({
        data: {
          type,
          title: generateAlertTitle(type, data),
          description: generateAlertDescription(type, data),
          severity: getAlertSeverity(type),
          accountId,
          agentId,
          data,
        },
      });
      
      // Send email notifications based on alert type
      const recipients = await getAlertRecipients(type, accountId, agentId);
      
      if (recipients.length > 0) {
        await emailQueue.add('alert-notification', {
          to: recipients,
          subject: `Alert: ${alert.title}`,
          template: 'alert-notification',
          data: {
            alertType: type,
            title: alert.title,
            description: alert.description,
            severity: alert.severity,
            alertData: data,
          },
        });
      }
      
      logger.info(`Alert processed: ${alert.id}`);
      
    } catch (error) {
      logger.error(`Alert processing failed:`, error);
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 5,
  }
);

// Email Notification Worker
const emailWorker = new Worker(
  'email-notifications',
  async (job: Job<EmailJobData>) => {
    const { to, subject, template, data, attachments } = job.data;
    
    logger.info(`Sending email to ${to.join(', ')}`, { subject, template });
    
    try {
      const htmlContent = await generateEmailContent(template, data);
      
      const mailOptions = {
        from: process.env.FROM_EMAIL || 'noreply@bankrecovery.com',
        to: to.join(', '),
        subject,
        html: htmlContent,
        attachments,
      };
      
      await emailTransporter.sendMail(mailOptions);
      
      logger.info(`Email sent successfully to ${to.join(', ')}`);
      
    } catch (error) {
      logger.error(`Email sending failed:`, error);
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 10,
  }
);

// Reconciliation Worker
const reconciliationWorker = new Worker(
  'reconciliation',
  async (job: Job) => {
    const { type, data } = job.data;
    
    logger.info(`Processing reconciliation: ${type}`, data);
    
    try {
      switch (type) {
        case 'daily-reconciliation':
          await performDailyReconciliation(data.date);
          break;
        case 'webhook-matching':
          await performWebhookMatching(data.webhookId);
          break;
        case 'variance-detection':
          await performVarianceDetection(data.bankId, data.date);
          break;
        default:
          throw new Error(`Unknown reconciliation type: ${type}`);
      }
      
      logger.info(`Reconciliation completed: ${type}`);
      
    } catch (error) {
      logger.error(`Reconciliation failed:`, error);
      throw error;
    }
  },
  {
    connection: redisConnection,
    concurrency: 2,
  }
);

// Helper Functions
async function generateReportData(params: {
  type: string;
  startDate: Date;
  endDate: Date;
  bankId?: string;
  includeCollections: boolean;
  includeUpdates: boolean;
}) {
  const { startDate, endDate, bankId, includeCollections, includeUpdates } = params;
  
  const data: any = {
    accounts: [],
    collections: [],
    updates: [],
  };
  
  // Base where clause
  const where: any = {
    updatedAt: {
      gte: startDate,
      lte: endDate,
    },
  };
  
  if (bankId) {
    where.bankId = bankId;
  }
  
  // Get accounts
  data.accounts = await prisma.account.findMany({
    where,
    include: {
      bank: {
        select: { name: true, code: true },
      },
      assignments: {
        where: { isActive: true },
        include: {
          agent: {
            include: {
              user: {
                select: { name: true, email: true },
              },
            },
          },
        },
      },
    },
  });
  
  // Get collections if requested
  if (includeCollections) {
    data.collections = await prisma.collection.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        ...(bankId && {
          account: {
            bankId,
          },
        }),
      },
      include: {
        account: {
          select: {
            fileNo: true,
            clientName: true,
            bank: {
              select: { name: true },
            },
          },
        },
        user: {
          select: { name: true },
        },
      },
    });
  }
  
  // Get updates if requested
  if (includeUpdates) {
    data.updates = await prisma.update.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
        ...(bankId && {
          account: {
            bankId,
          },
        }),
      },
      include: {
        account: {
          select: {
            fileNo: true,
            clientName: true,
            bank: {
              select: { name: true },
            },
          },
        },
        user: {
          select: { name: true },
        },
      },
    });
  }
  
  return data;
}

async function createReportFile(data: any, format: 'XLSX' | 'CSV', reportId: string): Promise<string> {
  const wb = XLSX.utils.book_new();
  
  // Accounts sheet
  if (data.accounts.length > 0) {
    const accountsData = data.accounts.map((account: any) => ({
      'File No': account.fileNo,
      'Client Name': account.clientName,
      'Bank': account.bank.name,
      'Outstanding Amount': account.outstandingAmount,
      'Overdue Amount': account.overdueAmount,
      'Status': account.statusStage,
      'Agent': account.assignments[0]?.agent?.user?.name || 'Unassigned',
      'Last Updated': account.updatedAt.toISOString(),
    }));
    
    const ws = XLSX.utils.json_to_sheet(accountsData);
    XLSX.utils.book_append_sheet(wb, ws, 'Accounts');
  }
  
  // Collections sheet
  if (data.collections.length > 0) {
    const collectionsData = data.collections.map((collection: any) => ({
      'Account': collection.account.fileNo,
      'Client': collection.account.clientName,
      'Bank': collection.account.bank.name,
      'Amount': collection.amount,
      'Type': collection.type,
      'Date': collection.collectionDate.toISOString().split('T')[0],
      'Status': collection.status,
      'Agent': collection.user.name,
      'Created': collection.createdAt.toISOString(),
    }));
    
    const ws = XLSX.utils.json_to_sheet(collectionsData);
    XLSX.utils.book_append_sheet(wb, ws, 'Collections');
  }
  
  // Save file
  const fileName = `report_${reportId}.${format.toLowerCase()}`;
  const filePath = `uploads/reports/${fileName}`;
  
  // Ensure directory exists
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  if (format === 'XLSX') {
    XLSX.writeFile(wb, filePath);
  } else {
    // Convert to CSV (first sheet only)
    const ws = wb.Sheets[wb.SheetNames[0]];
    const csvData = XLSX.utils.sheet_to_csv(ws);
    fs.writeFileSync(filePath, csvData);
  }
  
  return filePath;
}

function generateAlertTitle(type: string, data: any): string {
  switch (type) {
    case 'SLA_BREACH':
      return `SLA Breach: Account ${data.fileNo}`;
    case 'MISSED_PTP':
      return `Missed PTP: Account ${data.fileNo}`;
    case 'HIGH_OVERDUE':
      return `High Overdue Amount: Account ${data.fileNo}`;
    case 'NO_UPDATE':
      return `No Recent Updates: Account ${data.fileNo}`;
    default:
      return `System Alert: ${type}`;
  }
}

function generateAlertDescription(type: string, data: any): string {
  switch (type) {
    case 'SLA_BREACH':
      return `Account ${data.fileNo} has breached SLA requirements. No update for ${data.daysSinceUpdate} days.`;
    case 'MISSED_PTP':
      return `Account ${data.fileNo} missed PTP date ${data.ptpDate}. Amount: ৳${data.ptpAmount}`;
    case 'HIGH_OVERDUE':
      return `Account ${data.fileNo} has high overdue amount: ৳${data.overdueAmount}`;
    default:
      return `Alert triggered for ${type}`;
  }
}

function getAlertSeverity(type: string): 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL' {
  switch (type) {
    case 'SLA_BREACH':
    case 'MISSED_PTP':
      return 'ERROR';
    case 'HIGH_OVERDUE':
      return 'CRITICAL';
    case 'NO_UPDATE':
    case 'VARIANCE':
      return 'WARNING';
    default:
      return 'INFO';
  }
}

async function getAlertRecipients(type: string, accountId?: string, agentId?: string): Promise<string[]> {
  const recipients: string[] = [];
  
  // Get admin emails
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', isActive: true },
    select: { email: true },
  });
  recipients.push(...admins.map(admin => admin.email));
  
  // Get agent email if specified
  if (agentId) {
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      include: {
        user: {
          select: { email: true },
        },
      },
    });
    if (agent?.user.email) {
      recipients.push(agent.user.email);
    }
  }
  
  return [...new Set(recipients)];
}

async function generateEmailContent(template: string, data: any): Promise<string> {
  // Simple template system - in production, use a proper template engine
  const templates: Record<string, string> = {
    'report-ready': `
      <h2>Report Ready for Download</h2>
      <p>Your ${data.reportType} report for ${data.bankName} (${data.dateRange}) is ready for download.</p>
      <p>Report ID: ${data.reportId}</p>
      <p>Please log in to the system to download your report.</p>
    `,
    'alert-notification': `
      <h2>System Alert: ${data.title}</h2>
      <p><strong>Severity:</strong> ${data.severity}</p>
      <p><strong>Type:</strong> ${data.alertType}</p>
      <p><strong>Description:</strong> ${data.description}</p>
      <p>Please review this alert in the system.</p>
    `,
  };
  
  return templates[template] || `<p>Notification: ${JSON.stringify(data)}</p>`;
}

async function performDailyReconciliation(date: string): Promise<void> {
  logger.info(`Performing daily reconciliation for ${date}`);
  
  // Get all collections for the date
  const collections = await prisma.collection.findMany({
    where: {
      collectionDate: {
        gte: new Date(date),
        lt: new Date(new Date(date).getTime() + 24 * 60 * 60 * 1000),
      },
      status: 'APPROVED',
    },
    include: {
      account: {
        include: {
          bank: true,
        },
      },
    },
  });
  
  // Process reconciliation logic here
  logger.info(`Processed ${collections.length} collections for reconciliation`);
}

async function performWebhookMatching(webhookId: string): Promise<void> {
  logger.info(`Performing webhook matching for ${webhookId}`);
  // Webhook matching logic already implemented in webhook routes
}

async function performVarianceDetection(bankId: string, date: string): Promise<void> {
  logger.info(`Performing variance detection for bank ${bankId} on ${date}`);
  // Variance detection logic
}

// Scheduled Jobs
export async function setupScheduledJobs() {
  // Daily reconciliation at 1 AM
  await reconciliationQueue.add(
    'daily-reconciliation',
    { type: 'daily-reconciliation', data: { date: new Date().toISOString().split('T')[0] } },
    {
      repeat: { pattern: '0 1 * * *' },
      jobId: 'daily-reconciliation',
    }
  );
  
  // Weekly reports on Monday at 9 AM
  await reportQueue.add(
    'weekly-auto-report',
    {
      type: 'WEEKLY',
      startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      endDate: new Date().toISOString(),
      includeCollections: true,
      includeUpdates: false,
      format: 'XLSX',
    },
    {
      repeat: { pattern: '0 9 * * 1' },
      jobId: 'weekly-auto-report',
    }
  );
  
  logger.info('Scheduled jobs setup completed');
}

// Error handlers
reportWorker.on('failed', (job, err) => {
  logger.error(`Report job ${job?.id} failed:`, err);
});

alertWorker.on('failed', (job, err) => {
  logger.error(`Alert job ${job?.id} failed:`, err);
});

emailWorker.on('failed', (job, err) => {
  logger.error(`Email job ${job?.id} failed:`, err);
});

reconciliationWorker.on('failed', (job, err) => {
  logger.error(`Reconciliation job ${job?.id} failed:`, err);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  await reportWorker.close();
  await alertWorker.close();
  await emailWorker.close();
  await reconciliationWorker.close();
  await redis.disconnect();
});