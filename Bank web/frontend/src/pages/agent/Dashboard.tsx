import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { 
  CreditCardIcon, 
  BanknotesIcon, 
  ClockIcon, 
  CheckCircleIcon,
  ExclamationTriangleIcon,
  WifiIcon,
  NoSymbolIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';

interface DashboardStats {
  totalAccounts: number;
  pendingCollections: number;
  thisMonthCollections: number;
  targetAchievement: number;
  overdueAccounts: number;
  lastSyncTime?: string;
}

const AgentDashboard: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isOnline = useOnlineStatus();
  const { queueSize, isSync, syncQueue } = useOfflineQueue();
  
  const [stats, setStats] = useState<DashboardStats>({
    totalAccounts: 0,
    pendingCollections: 0,
    thisMonthCollections: 0,
    targetAchievement: 0,
    overdueAccounts: 0,
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      
      // In a real implementation, this would fetch from API
      // For demo purposes, we'll use mock data
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const mockStats: DashboardStats = {
        totalAccounts: 47,
        pendingCollections: 12,
        thisMonthCollections: 85000,
        targetAchievement: 68.5,
        overdueAccounts: 8,
        lastSyncTime: new Date().toISOString(),
      };
      
      setStats(mockStats);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = () => {
    loadDashboardData();
    if (isOnline && queueSize > 0) {
      syncQueue();
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('bn-BD', {
      style: 'currency',
      currency: 'BDT',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const statCards = [
    {
      title: t('dashboard.totalAccounts'),
      value: stats.totalAccounts.toString(),
      icon: CreditCardIcon,
      color: 'bg-blue-500',
      textColor: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: t('dashboard.pendingCollections'),
      value: stats.pendingCollections.toString(),
      icon: ClockIcon,
      color: 'bg-yellow-500',
      textColor: 'text-yellow-600',
      bgColor: 'bg-yellow-50',
    },
    {
      title: t('dashboard.thisMonthCollections'),
      value: formatCurrency(stats.thisMonthCollections),
      icon: BanknotesIcon,
      color: 'bg-green-500',
      textColor: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: t('dashboard.overdueAccounts'),
      value: stats.overdueAccounts.toString(),
      icon: ExclamationTriangleIcon,
      color: 'bg-red-500',
      textColor: 'text-red-600',
      bgColor: 'bg-red-50',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t('dashboard.welcome', { name: user?.name || 'Agent' })}
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {t('dashboard.todayDate', { date: new Date().toLocaleDateString('bn-BD') })}
              </p>
            </div>
            
            <div className="flex items-center space-x-2">
              {/* Online/Offline Status */}
              <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${
                isOnline 
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
              }`}>
                {isOnline ? (
                  <WifiIcon className="w-3 h-3" />
                ) : (
                  <NoSymbolIcon className="w-3 h-3" />
                )}
                <span>{isOnline ? t('status.online') : t('status.offline')}</span>
              </div>
              
              {/* Offline Queue Counter */}
              {queueSize > 0 && (
                <div className="flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                  <span>{queueSize} {t('queue.pending')}</span>
                </div>
              )}
              
              {/* Refresh Button */}
              <button
                onClick={handleRefresh}
                disabled={isLoading || isSync}
                className="p-1.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50"
              >
                <ArrowPathIcon className={`w-4 h-4 ${(isLoading || isSync) ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="p-4 space-y-6">
        {/* Target Achievement */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('dashboard.monthlyTarget')}
            </h2>
            <span className={`text-sm font-medium ${
              stats.targetAchievement >= 100 
                ? 'text-green-600 dark:text-green-400'
                : stats.targetAchievement >= 70
                ? 'text-yellow-600 dark:text-yellow-400'
                : 'text-red-600 dark:text-red-400'
            }`}>
              {stats.targetAchievement.toFixed(1)}%
            </span>
          </div>
          
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mb-2">
            <div 
              className={`h-3 rounded-full transition-all duration-300 ${
                stats.targetAchievement >= 100 
                  ? 'bg-green-500'
                  : stats.targetAchievement >= 70
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
              }`}
              style={{ width: `${Math.min(stats.targetAchievement, 100)}%` }}
            />
          </div>
          
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
            <span>{formatCurrency(stats.thisMonthCollections)}</span>
            <span>{formatCurrency(124000)} {t('dashboard.target')}</span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-4">
          {statCards.map((card, index) => {
            const Icon = card.icon;
            
            return (
              <div
                key={index}
                className={`${card.bgColor} dark:bg-gray-800 rounded-2xl p-4 border border-gray-200 dark:border-gray-700`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-sm font-medium ${card.textColor} dark:text-gray-300`}>
                      {card.title}
                    </p>
                    <p className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                      {card.value}
                    </p>
                  </div>
                  <div className={`p-2 rounded-lg ${card.color}`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {t('dashboard.quickActions')}
          </h2>
          
          <div className="grid grid-cols-2 gap-3">
            <button className="flex flex-col items-center p-4 bg-porisheba-red-50 dark:bg-porisheba-red-900/20 rounded-xl border border-porisheba-red-200 dark:border-porisheba-red-800 hover:bg-porisheba-red-100 dark:hover:bg-porisheba-red-900/30 transition-colors">
              <CreditCardIcon className="w-6 h-6 text-porisheba-red-600 dark:text-porisheba-red-400 mb-2" />
              <span className="text-sm font-medium text-porisheba-red-700 dark:text-porisheba-red-300">
                {t('actions.viewAccounts')}
              </span>
            </button>
            
            <button className="flex flex-col items-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors">
              <BanknotesIcon className="w-6 h-6 text-blue-600 dark:text-blue-400 mb-2" />
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                {t('actions.submitCollection')}
              </span>
            </button>
            
            <button className="flex flex-col items-center p-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors">
              <CheckCircleIcon className="w-6 h-6 text-green-600 dark:text-green-400 mb-2" />
              <span className="text-sm font-medium text-green-700 dark:text-green-300">
                {t('actions.updateStatus')}
              </span>
            </button>
            
            <button className="flex flex-col items-center p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors">
              <ClockIcon className="w-6 h-6 text-yellow-600 dark:text-yellow-400 mb-2" />
              <span className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
                {t('actions.offlineQueue')}
              </span>
            </button>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {t('dashboard.recentActivity')}
          </h2>
          
          <div className="space-y-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="w-2 h-2 bg-porisheba-red-500 rounded-full" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    Collection submitted for Account #ABC-{item}001
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    2 hours ago
                  </p>
                </div>
                <span className="text-xs font-medium text-green-600 dark:text-green-400">
                  ৳5,000
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Last Sync Info */}
        {stats.lastSyncTime && (
          <div className="text-center text-xs text-gray-500 dark:text-gray-400">
            {t('dashboard.lastSync')}: {new Date(stats.lastSyncTime).toLocaleString('bn-BD')}
          </div>
        )}
      </div>
    </div>
  );
};

export default AgentDashboard;