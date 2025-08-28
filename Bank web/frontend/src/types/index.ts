// User and Authentication Types
export interface User {
  id: string;
  email: string;
  name: string;
  phone?: string;
  role: UserRole;
  status: UserStatus;
  language: string;
  settings?: Record<string, any>;
  supabaseId?: string;
  agentProfile?: Agent;
  createdAt: string;
  updatedAt: string;
}

export type UserRole = 'ADMIN' | 'AGENT' | 'AUDITOR';
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateProfile: (data: Partial<User>) => Promise<void>;
}

// Bank Types
export interface Bank {
  id: string;
  name: string;
  code: string;
  contactEmail?: string;
  contactPhone?: string;
  commissionRules?: CommissionRules;
  slaSettings?: SLASettings;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CommissionRules {
  rate: number;
  tiers: CommissionTier[];
}

export interface CommissionTier {
  min: number;
  max: number | null;
  rate: number;
}

export interface SLASettings {
  depositHours: number;
  updateDays: number;
  ptpFollowupDays: number;
}

// Agent Types
export interface Agent {
  id: string;
  userId: string;
  employeeId?: string;
  bankId?: string;
  territory?: string;
  targetMonthly?: number;
  commissionRate?: number;
  isActive: boolean;
  user: User;
  bank?: Bank;
  createdAt: string;
  updatedAt: string;
}

// Account Types
export interface Account {
  id: string;
  bankId: string;
  fileNo: string;
  clientName: string;
  contactPhone?: string;
  contactPhone2?: string;
  address?: string;
  product?: string;
  month?: string;
  allocationDate?: string;
  expiryDate?: string;
  workOrderExpiry?: string;
  outstandingAmount: number;
  overdueAmount: number;
  emiAmount?: number;
  statusStage: string;
  lastContactDate?: string;
  totalCollected: number;
  collectionRate: number;
  bank: Bank;
  assignedAgent?: Agent;
  lastUpdate?: Update;
  updates: Update[];
  collections: Collection[];
  createdAt: string;
  updatedAt: string;
}

// Update Types
export interface Update {
  id: string;
  accountId: string;
  userId: string;
  visitType: VisitType;
  visitDate: string;
  remarks?: string;
  ptpAmount?: number;
  ptpDate?: string;
  address?: string;
  gpsLocation?: GPSLocation;
  proofImages: string[];
  user: {
    id: string;
    name: string;
    role: UserRole;
  };
  createdAt: string;
  updatedAt: string;
}

export type VisitType = 'PHONE' | 'FIELD' | 'FOLLOWUP' | 'PTP';

export interface GPSLocation {
  lat: number;
  lng: number;
}

// Collection Types
export interface Collection {
  id: string;
  accountId: string;
  submittedBy: string;
  type: CollectionType;
  amount: number;
  collectionDate: string;
  txnId?: string;
  slipNo?: string;
  cashReceipt?: string;
  status: CollectionStatus;
  verifiedBy?: string;
  verifiedAt?: string;
  rejectionReason?: string;
  isMatched: boolean;
  matchedAt?: string;
  matchSource?: string;
  proofImages: string[];
  submitter: {
    id: string;
    name: string;
    role: UserRole;
  };
  account?: Account;
  createdAt: string;
  updatedAt: string;
}

export type CollectionType = 'BKASH' | 'NAGAD' | 'CASH' | 'BANK_DEPOSIT';
export type CollectionStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

// Batch and Import Types
export interface Batch {
  id: string;
  bankId: string;
  fileName: string;
  fileSize: number;
  totalRows: number;
  processedRows: number;
  status: BatchStatus;
  mapping?: Record<string, string>;
  rawData: any[];
  summary?: BatchSummary;
  errorLog?: any[];
  bank: Bank;
  diffs: BatchDiff[];
  createdAt: string;
  updatedAt: string;
}

export type BatchStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface BatchSummary {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  createdAccounts: number;
  updatedAccounts: number;
}

export interface BatchDiff {
  id: string;
  batchId: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  rowData: any;
  oldData?: any;
  createdAt: string;
}

// Alert Types
export interface Alert {
  id: string;
  type: AlertType;
  title: string;
  description: string;
  severity: AlertSeverity;
  accountId?: string;
  agentId?: string;
  data?: Record<string, any>;
  isRead: boolean;
  isResolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  createdAt: string;
  updatedAt: string;
}

export type AlertType = 'SLA_BREACH' | 'VARIANCE' | 'MISSED_PTP' | 'HIGH_OVERDUE' | 'NO_UPDATE' | 'SYSTEM';
export type AlertSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';

// Report Types
export interface WeeklyReport {
  id: string;
  bankId: string;
  weekStart: string;
  weekEnd: string;
  filePath: string;
  emailSent: boolean;
  sentAt?: string;
  totalAccounts: number;
  totalCollections: number;
  collectionRate: number;
  bank: Bank;
  createdAt: string;
}

// Filter Types
export interface AccountFilters {
  bankId?: string;
  agentId?: string;
  statusStage?: string;
  product?: string;
  month?: string;
  allocationDateFrom?: string;
  allocationDateTo?: string;
  expiryDateFrom?: string;
  expiryDateTo?: string;
  overdueMin?: number;
  overdueMax?: number;
  lastUpdatedFrom?: string;
  lastUpdatedTo?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CollectionFilters {
  bankId?: string;
  agentId?: string;
  type?: CollectionType;
  status?: CollectionStatus;
  collectionDateFrom?: string;
  collectionDateTo?: string;
  amountMin?: number;
  amountMax?: number;
  isMatched?: boolean;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// API Response Types
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp: string;
}

// Dashboard Metrics Types
export interface DashboardMetrics {
  totalAccounts: number;
  totalOutstanding: number;
  totalOverdue: number;
  totalCollected: number;
  collectionRate: number;
  pendingAccounts: number;
  pendingCollections: number;
  weeklyTrend: MetricTrend[];
  bankMetrics: BankMetric[];
}

export interface MetricTrend {
  date: string;
  value: number;
}

export interface BankMetric {
  bankId: string;
  bankName: string;
  totalAccounts: number;
  totalCollected: number;
  collectionRate: number;
}

// PWA Types
export interface PWAContextType {
  isOnline: boolean;
  isInstallable: boolean;
  installApp: () => Promise<void>;
  queueSize: number;
  syncQueue: () => Promise<void>;
}

export interface OfflineQueueItem {
  id: string;
  type: 'UPDATE' | 'COLLECTION' | 'VISIT';
  data: any;
  timestamp: string;
  retryCount: number;
  status: 'PENDING' | 'SYNCING' | 'SYNCED' | 'FAILED';
}

// Form Types
export interface LoginForm {
  email: string;
  password: string;
}

export interface AccountForm {
  bankId: string;
  fileNo: string;
  clientName: string;
  contactPhone?: string;
  contactPhone2?: string;
  address?: string;
  product?: string;
  month?: string;
  allocationDate?: string;
  expiryDate?: string;
  workOrderExpiry?: string;
  outstandingAmount: number;
  overdueAmount: number;
  emiAmount?: number;
  statusStage: string;
}

export interface UpdateForm {
  visitType: VisitType;
  visitDate: string;
  remarks?: string;
  ptpAmount?: number;
  ptpDate?: string;
  address?: string;
  gpsLocation?: GPSLocation;
  proofImages?: File[];
}

export interface CollectionForm {
  accountId: string;
  type: CollectionType;
  amount: number;
  collectionDate: string;
  txnId?: string;
  slipNo?: string;
  cashReceipt?: string;
  proofImages?: File[];
}

// Table Types
export interface TableColumn<T = any> {
  key: string;
  title: string;
  dataIndex?: string;
  render?: (value: any, record: T, index: number) => React.ReactNode;
  sortable?: boolean;
  filterable?: boolean;
  width?: string | number;
  className?: string;
}

export interface TableProps<T = any> {
  columns: TableColumn<T>[];
  data: T[];
  loading?: boolean;
  pagination?: {
    current: number;
    total: number;
    pageSize: number;
    onChange: (page: number, pageSize: number) => void;
  };
  rowKey?: string | ((record: T) => string);
  onRow?: (record: T, index: number) => Record<string, any>;
  className?: string;
}

// Theme Types
export interface ThemeContextType {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

// Utility Types
export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequiredBy<T, K extends keyof T> = T & Required<Pick<T, K>>;

// Event Log Types
export interface EventLog {
  id: string;
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  oldData?: any;
  newData?: any;
  ipAddress?: string;
  userAgent?: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: string;
}

// Webhook Types
export interface WebhookPayload {
  provider: 'bkash' | 'nagad';
  txnId: string;
  amount: number;
  currency: string;
  status: string;
  date: string;
  customerMobile?: string;
  signature: string;
}

// Settings Types
export interface UserSettings {
  language: string;
  theme: 'light' | 'dark';
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
  };
  dashboard: {
    defaultFilters: Record<string, any>;
    refreshInterval: number;
  };
}

export interface SystemSettings {
  sla: {
    depositHours: number;
    updateDays: number;
    ptpFollowupDays: number;
  };
  commission: {
    defaultRate: number;
    tiers: CommissionTier[];
  };
  security: {
    sessionTimeout: number;
    maxLoginAttempts: number;
    passwordMinLength: number;
  };
}