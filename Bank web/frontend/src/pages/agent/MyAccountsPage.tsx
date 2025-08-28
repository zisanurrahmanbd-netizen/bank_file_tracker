import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  MagnifyingGlassIcon,
  FunnelIcon,
  PlusIcon,
  CreditCardIcon,
  BanknotesIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  CheckCircleIcon,
  XMarkIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { apiClient } from '@/services/apiClient';

interface Account {
  id: string;
  fileNo: string;
  clientName: string;
  contactPhone?: string;
  address?: string;
  product?: string;
  statusStage: string;
  outstandingAmount: number;
  overdueAmount: number;
  emiAmount?: number;
  allocationDate?: string;
  expiryDate?: string;
  lastUpdated?: string;
  bank: {
    id: string;
    name: string;
    code: string;
  };
  updates?: Array<{
    id: string;
    visitType: string;
    visitDate: string;
    remarks?: string;
  }>;
  collections?: Array<{
    id: string;
    amount: number;
    type: string;
    status: string;
    collectionDate: string;
  }>;
}

interface Filters {
  search: string;
  statusStage: string;
  product: string;
  overdueOnly: boolean;
}

const MyAccountsPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [filteredAccounts, setFilteredAccounts] = useState<Account[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  const [filters, setFilters] = useState<Filters>({
    search: '',
    statusStage: '',
    product: '',
    overdueOnly: false,
  });

  const [stats, setStats] = useState({
    total: 0,
    overdue: 0,
    collected: 0,
    pending: 0,
  });

  useEffect(() => {
    loadAccounts();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [accounts, filters]);

  const loadAccounts = async () => {
    try {
      setIsLoading(true);
      
      if (isOnline) {
        const response = await apiClient.get('/accounts', {
          params: {
            agentId: user?.agentProfile?.id,
            includeUpdates: true,
            includeCollections: true,
          },
        });
        
        const accountsData = response.data.accounts || [];
        setAccounts(accountsData);
        setLastSync(new Date());
        
        // Cache data for offline use
        localStorage.setItem('cached_accounts', JSON.stringify(accountsData));
        localStorage.setItem('accounts_last_sync', new Date().toISOString());
      } else {
        // Load from cache when offline
        const cachedData = localStorage.getItem('cached_accounts');
        const lastSyncStr = localStorage.getItem('accounts_last_sync');
        
        if (cachedData) {
          setAccounts(JSON.parse(cachedData));
          setLastSync(lastSyncStr ? new Date(lastSyncStr) : null);
        }
      }
    } catch (error) {
      console.error('Failed to load accounts:', error);
      
      // Fallback to cached data on error
      const cachedData = localStorage.getItem('cached_accounts');
      if (cachedData) {
        setAccounts(JSON.parse(cachedData));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...accounts];

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(
        (account) =>
          account.fileNo.toLowerCase().includes(searchLower) ||
          account.clientName.toLowerCase().includes(searchLower) ||
          account.contactPhone?.toLowerCase().includes(searchLower)
      );
    }

    // Status filter
    if (filters.statusStage) {
      filtered = filtered.filter((account) => account.statusStage === filters.statusStage);
    }

    // Product filter
    if (filters.product) {
      filtered = filtered.filter((account) => account.product === filters.product);
    }

    // Overdue only filter
    if (filters.overdueOnly) {
      filtered = filtered.filter((account) => account.overdueAmount > 0);
    }

    setFilteredAccounts(filtered);

    // Update stats
    const newStats = {
      total: accounts.length,
      overdue: accounts.filter((a) => a.overdueAmount > 0).length,
      collected: accounts.filter((a) => 
        a.collections?.some((c) => c.status === 'APPROVED' && 
          new Date(c.collectionDate).getMonth() === new Date().getMonth())
      ).length,
      pending: accounts.filter((a) => a.statusStage === 'Pending').length,
    };
    setStats(newStats);
  };

  const handleRefresh = () => {
    loadAccounts();
  };

  const resetFilters = () => {
    setFilters({
      search: '',
      statusStage: '',
      product: '',
      overdueOnly: false,
    });
    setShowFilters(false);
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'new':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
      case 'contacted':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
      case 'promised':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300';
      case 'paid':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      case 'defaulted':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('bn-BD', {
      style: 'currency',
      currency: 'BDT',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const uniqueStatuses = [...new Set(accounts.map((a) => a.statusStage))];
  const uniqueProducts = [...new Set(accounts.map((a) => a.product).filter(Boolean))];

  if (isLoading && accounts.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-porisheba-red-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading accounts...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                My Accounts
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {filteredAccounts.length} of {accounts.length} accounts
              </p>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={handleRefresh}
                disabled={isLoading}
                className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
              >
                <ArrowPathIcon className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                <FunnelIcon className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative mb-4">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by file no, name, or phone..."
              value={filters.search}
              onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-porisheba-red-500"
            />
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-4 gap-3">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-blue-600 dark:text-blue-400">{stats.total}</div>
              <div className="text-xs text-blue-700 dark:text-blue-300">Total</div>
            </div>
            <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-red-600 dark:text-red-400">{stats.overdue}</div>
              <div className="text-xs text-red-700 dark:text-red-300">Overdue</div>
            </div>
            <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-green-600 dark:text-green-400">{stats.collected}</div>
              <div className="text-xs text-green-700 dark:text-green-300">Collected</div>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 rounded-xl p-3 text-center">
              <div className="text-lg font-bold text-yellow-600 dark:text-yellow-400">{stats.pending}</div>
              <div className="text-xs text-yellow-700 dark:text-yellow-300">Pending</div>
            </div>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="px-4 pb-4 border-t border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Status
                </label>
                <select
                  value={filters.statusStage}
                  onChange={(e) => setFilters((prev) => ({ ...prev, statusStage: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="">All Statuses</option>
                  {uniqueStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Product
                </label>
                <select
                  value={filters.product}
                  onChange={(e) => setFilters((prev) => ({ ...prev, product: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                >
                  <option value="">All Products</option>
                  {uniqueProducts.map((product) => (
                    <option key={product} value={product}>
                      {product}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="flex items-center space-x-4">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={filters.overdueOnly}
                    onChange={(e) => setFilters((prev) => ({ ...prev, overdueOnly: e.target.checked }))}
                    className="rounded border-gray-300 text-porisheba-red-600 focus:ring-porisheba-red-500"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Overdue Only</span>
                </label>
                
                <button
                  onClick={resetFilters}
                  className="text-sm text-porisheba-red-600 hover:text-porisheba-red-700"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Accounts List */}
      <div className="p-4 space-y-3">
        {filteredAccounts.length === 0 ? (
          <div className="text-center py-12">
            <CreditCardIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">
              {filters.search || filters.statusStage || filters.product || filters.overdueOnly
                ? 'No accounts match your filters'
                : 'No accounts assigned'}
            </p>
          </div>
        ) : (
          filteredAccounts.map((account) => (
            <div
              key={account.id}
              onClick={() => navigate(`/agent/accounts/${account.id}`)}
              className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow cursor-pointer"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {account.fileNo}
                    </h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(account.statusStage)}`}>
                      {account.statusStage}
                    </span>
                  </div>
                  
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                    {account.clientName}
                  </p>
                  
                  {account.contactPhone && (
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      📞 {account.contactPhone}
                    </p>
                  )}
                  
                  {account.product && (
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      💼 {account.product}
                    </p>
                  )}
                </div>
                
                <div className="text-right">
                  <div className="text-sm font-semibold text-gray-900 dark:text-white">
                    {formatCurrency(account.outstandingAmount)}
                  </div>
                  {account.overdueAmount > 0 && (
                    <div className="text-sm font-medium text-red-600 dark:text-red-400">
                      Overdue: {formatCurrency(account.overdueAmount)}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
                <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                  {account.updates && account.updates.length > 0 && (
                    <span>✏️ {account.updates.length} updates</span>
                  )}
                  {account.collections && account.collections.length > 0 && (
                    <span>💰 {account.collections.length} collections</span>
                  )}
                  {account.lastUpdated && (
                    <span>🕒 {new Date(account.lastUpdated).toLocaleDateString('bn-BD')}</span>
                  )}
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/agent/accounts/${account.id}/collect`);
                    }}
                    className="px-3 py-1 bg-porisheba-red-600 text-white text-xs rounded-lg hover:bg-porisheba-red-700"
                  >
                    Collect
                  </button>
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/agent/accounts/${account.id}/update`);
                    }}
                    className="px-3 py-1 bg-gray-600 text-white text-xs rounded-lg hover:bg-gray-700"
                  >
                    Update
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Sync Status */}
      {lastSync && (
        <div className="fixed bottom-4 left-4 right-4 bg-white dark:bg-gray-800 rounded-xl p-3 shadow-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {isOnline ? (
                <CheckCircleIcon className="w-4 h-4 text-green-500" />
              ) : (
                <ExclamationTriangleIcon className="w-4 h-4 text-yellow-500" />
              )}
              <span className="text-xs text-gray-600 dark:text-gray-400">
                {isOnline ? 'Online' : 'Offline'} • Last sync: {lastSync.toLocaleTimeString('bn-BD')}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyAccountsPage;