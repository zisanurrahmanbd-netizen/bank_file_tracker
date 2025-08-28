import { z } from 'zod';

// User schemas
export const createUserSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  name: z.string().min(1, 'Name is required'),
  phone: z.string().optional(),
  role: z.enum(['ADMIN', 'AGENT', 'AUDITOR']).default('AGENT'),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
});

export const updateUserSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
  phone: z.string().optional(),
  language: z.string().optional(),
  settings: z.any().optional(),
});

// Bank schemas
export const createBankSchema = z.object({
  name: z.string().min(1, 'Bank name is required'),
  code: z.string().min(1, 'Bank code is required'),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  commissionRules: z.any().optional(),
  slaSettings: z.any().optional(),
});

export const updateBankSchema = createBankSchema.partial();

// Agent schemas
export const createAgentSchema = z.object({
  userId: z.string().uuid(),
  employeeId: z.string().optional(),
  bankId: z.string().uuid().optional(),
  territory: z.string().optional(),
  targetMonthly: z.number().positive().optional(),
  commissionRate: z.number().min(0).max(100).optional(),
});

export const updateAgentSchema = createAgentSchema.partial().omit({ userId: true });

// Account schemas
export const createAccountSchema = z.object({
  bankId: z.string().uuid(),
  fileNo: z.string().min(1, 'File number is required'),
  clientName: z.string().min(1, 'Client name is required'),
  contactPhone: z.string().optional(),
  contactPhone2: z.string().optional(),
  address: z.string().optional(),
  product: z.string().optional(),
  month: z.string().optional(),
  allocationDate: z.string().datetime().optional(),
  expiryDate: z.string().datetime().optional(),
  workOrderExpiry: z.string().datetime().optional(),
  outstandingAmount: z.number().nonnegative(),
  overdueAmount: z.number().nonnegative(),
  emiAmount: z.number().positive().optional(),
  statusStage: z.string().default('New'),
});

export const updateAccountSchema = createAccountSchema.partial().omit({ bankId: true, fileNo: true });

export const assignAccountSchema = z.object({
  agentId: z.string().uuid(),
});

// Update schemas
export const createUpdateSchema = z.object({
  visitType: z.enum(['PHONE', 'FIELD', 'FOLLOWUP', 'PTP']),
  visitDate: z.string().datetime(),
  remarks: z.string().optional(),
  ptpAmount: z.number().positive().optional(),
  ptpDate: z.string().datetime().optional(),
  address: z.string().optional(),
  gpsLocation: z.object({
    lat: z.number(),
    lng: z.number(),
  }).optional(),
  proofImages: z.array(z.string()).optional(),
});

// Collection schemas
export const createCollectionSchema = z.object({
  type: z.enum(['BKASH', 'NAGAD', 'CASH', 'BANK_DEPOSIT']),
  amount: z.number().positive('Amount must be positive'),
  collectionDate: z.string().datetime(),
  txnId: z.string().optional(),
  slipNo: z.string().optional(),
  cashReceipt: z.string().optional(),
  proofImages: z.array(z.string()).optional(),
}).refine((data) => {
  // Validate required fields based on collection type
  if (data.type === 'BKASH' || data.type === 'NAGAD') {
    return !!data.txnId;
  }
  if (data.type === 'BANK_DEPOSIT') {
    return !!data.slipNo;
  }
  if (data.type === 'CASH') {
    return !!data.cashReceipt;
  }
  return true;
}, {
  message: 'Required fields missing for collection type',
});

export const verifyCollectionSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
  rejectionReason: z.string().optional(),
}).refine((data) => {
  if (data.status === 'REJECTED') {
    return !!data.rejectionReason;
  }
  return true;
}, {
  message: 'Rejection reason is required when rejecting collection',
});

// Import schemas
export const importFileSchema = z.object({
  bankId: z.string().uuid(),
  mapping: z.record(z.string()).optional(), // Column mapping
});

export const saveMappingSchema = z.object({
  mapping: z.record(z.string()),
  templateName: z.string().optional(),
});

// Filter schemas
export const accountFilterSchema = z.object({
  bankId: z.string().uuid().optional(),
  agentId: z.string().uuid().optional(),
  statusStage: z.string().optional(),
  product: z.string().optional(),
  month: z.string().optional(),
  allocationDateFrom: z.string().datetime().optional(),
  allocationDateTo: z.string().datetime().optional(),
  expiryDateFrom: z.string().datetime().optional(),
  expiryDateTo: z.string().datetime().optional(),
  overdueMin: z.number().nonnegative().optional(),
  overdueMax: z.number().nonnegative().optional(),
  lastUpdatedFrom: z.string().datetime().optional(),
  lastUpdatedTo: z.string().datetime().optional(),
  search: z.string().optional(), // Global search
  page: z.number().positive().default(1),
  limit: z.number().positive().max(100).default(20),
  sortBy: z.string().default('updatedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const collectionFilterSchema = z.object({
  bankId: z.string().uuid().optional(),
  agentId: z.string().uuid().optional(),
  type: z.enum(['BKASH', 'NAGAD', 'CASH', 'BANK_DEPOSIT']).optional(),
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
  collectionDateFrom: z.string().datetime().optional(),
  collectionDateTo: z.string().datetime().optional(),
  amountMin: z.number().nonnegative().optional(),
  amountMax: z.number().nonnegative().optional(),
  isMatched: z.boolean().optional(),
  page: z.number().positive().default(1),
  limit: z.number().positive().max(100).default(20),
  sortBy: z.string().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Report schemas
export const generateReportSchema = z.object({
  bankId: z.string().uuid().optional(),
  reportType: z.enum(['WEEKLY', 'MONTHLY', 'CUSTOM']),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  includeCollections: z.boolean().default(true),
  includeUpdates: z.boolean().default(false),
  format: z.enum(['XLSX', 'CSV']).default('XLSX'),
});

// Webhook schemas
export const bkashWebhookSchema = z.object({
  txnId: z.string(),
  amount: z.number().positive(),
  currency: z.string().default('BDT'),
  status: z.string(),
  date: z.string(),
  customerMobile: z.string().optional(),
  merchantInvoiceNumber: z.string().optional(),
  signature: z.string(),
});

export const nagadWebhookSchema = z.object({
  paymentRefId: z.string(),
  amount: z.number().positive(),
  currency: z.string().default('BDT'),
  status: z.string(),
  dateTime: z.string(),
  customerMobile: z.string().optional(),
  orderId: z.string().optional(),
  signature: z.string(),
});

// Reconciliation schemas
export const uploadStatementSchema = z.object({
  bankId: z.string().uuid(),
  statementDate: z.string().datetime(),
  format: z.enum(['CSV', 'XLSX']),
});

// Alert schemas
export const createAlertSchema = z.object({
  type: z.enum(['SLA_BREACH', 'VARIANCE', 'MISSED_PTP', 'HIGH_OVERDUE', 'NO_UPDATE', 'SYSTEM']),
  title: z.string().min(1, 'Title is required'),
  description: z.string().min(1, 'Description is required'),
  severity: z.enum(['INFO', 'WARNING', 'ERROR', 'CRITICAL']).default('INFO'),
  accountId: z.string().uuid().optional(),
  agentId: z.string().uuid().optional(),
  data: z.any().optional(),
});

export const updateAlertSchema = z.object({
  isRead: z.boolean().optional(),
  isResolved: z.boolean().optional(),
});

// Pagination schema
export const paginationSchema = z.object({
  page: z.number().positive().default(1),
  limit: z.number().positive().max(100).default(20),
});

// ID parameter schema
export const idParamSchema = z.object({
  id: z.string().uuid('Invalid ID format'),
});

// Export types
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type CreateBankInput = z.infer<typeof createBankSchema>;
export type UpdateBankInput = z.infer<typeof updateBankSchema>;
export type CreateAgentInput = z.infer<typeof createAgentSchema>;
export type UpdateAgentInput = z.infer<typeof updateAgentSchema>;
export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type AssignAccountInput = z.infer<typeof assignAccountSchema>;
export type CreateUpdateInput = z.infer<typeof createUpdateSchema>;
export type CreateCollectionInput = z.infer<typeof createCollectionSchema>;
export type VerifyCollectionInput = z.infer<typeof verifyCollectionSchema>;
export type AccountFilterInput = z.infer<typeof accountFilterSchema>;
export type CollectionFilterInput = z.infer<typeof collectionFilterSchema>;
export type GenerateReportInput = z.infer<typeof generateReportSchema>;
export type CreateAlertInput = z.infer<typeof createAlertSchema>;
export type UpdateAlertInput = z.infer<typeof updateAlertSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;