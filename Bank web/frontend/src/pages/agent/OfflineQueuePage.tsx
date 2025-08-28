import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
  ArrowPathIcon,
  BanknotesIcon,
  DocumentTextIcon,
  PhotoIcon,
  TrashIcon,
  WifiIcon,
  NoSymbolIcon,
} from '@heroicons/react/24/outline';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';

interface QueueItemDisplay {
  id: string;
  type: 'collection' | 'update' | 'photo';
  data: any;
  timestamp: number;
  retryCount: number;
  status: 'pending' | 'syncing' | 'failed';
  description: string;
  icon: React.ComponentType<any>;
  color: string;
}

const OfflineQueuePage: React.FC = () => {
  const { t } = useTranslation();
  const isOnline = useOnlineStatus();
  const { queue, queueSize, isSync, syncQueue, removeFromQueue, clearQueue } = useOfflineQueue();
  
  const [displayItems, setDisplayItems] = useState<QueueItemDisplay[]>([]);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [lastSyncAttempt, setLastSyncAttempt] = useState<Date | null>(null);

  useEffect(() => {
    // Transform queue items for display
    const items: QueueItemDisplay[] = queue.map(item => {
      let description = '';
      let icon = DocumentTextIcon;
      let color = 'text-blue-600';

      switch (item.type) {
        case 'collection':
          icon = BanknotesIcon;
          color = 'text-green-600';
          description = `Collection: ৳${item.data.amount} (${item.data.type})`;
          if (item.data.accountId) {
            description += ` for Account ${item.data.accountId.slice(-8)}`;
          }
          break;
        case 'update':
          icon = DocumentTextIcon;
          color = 'text-blue-600';
          description = `Update: ${item.data.visitType} visit`;
          if (item.data.accountId) {
            description += ` for Account ${item.data.accountId.slice(-8)}`;
          }
          break;
        case 'photo':
          icon = PhotoIcon;
          color = 'text-purple-600';
          description = `Photo upload: ${item.data.type || 'Proof image'}`;
          break;
        default:
          description = `${item.type} - ${JSON.stringify(item.data).slice(0, 50)}...`;
      }

      return {
        id: item.id,
        type: item.type,
        data: item.data,
        timestamp: item.timestamp,
        retryCount: item.retryCount,
        status: item.retryCount > 0 ? 'failed' : 'pending',
        description,
        icon,
        color,
      };
    });

    setDisplayItems(items);
  }, [queue]);

  const handleSyncAll = async () => {
    setLastSyncAttempt(new Date());
    await syncQueue();
  };

  const handleRemoveItem = (id: string) => {
    removeFromQueue(id);
  };

  const handleClearAll = () => {
    clearQueue();
    setShowClearConfirm(false);
  };

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString('bn-BD', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusIcon = (item: QueueItemDisplay) => {
    if (isSync) {
      return <ArrowPathIcon className="w-4 h-4 text-yellow-600 animate-spin" />;
    }
    
    switch (item.status) {
      case 'failed':
        return <ExclamationTriangleIcon className="w-4 h-4 text-red-600" />;
      case 'syncing':
        return <ArrowPathIcon className="w-4 h-4 text-yellow-600 animate-spin" />;
      default:
        return <ClockIcon className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusColor = (item: QueueItemDisplay) => {
    if (item.status === 'failed') {
      return 'border-l-red-500 bg-red-50 dark:bg-red-900/10';
    }
    if (isSync) {
      return 'border-l-yellow-500 bg-yellow-50 dark:bg-yellow-900/10';
    }
    return 'border-l-gray-500 bg-gray-50 dark:bg-gray-900/10';
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                Offline Queue
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {queueSize} {queueSize === 1 ? 'item' : 'items'} waiting to sync
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
                <span>{isOnline ? 'Online' : 'Offline'}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-3">
            <button
              onClick={handleSyncAll}
              disabled={!isOnline || isSync || queueSize === 0}
              className="flex items-center space-x-2 px-4 py-2 bg-porisheba-red-600 text-white rounded-xl font-medium hover:bg-porisheba-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSync ? (
                <ArrowPathIcon className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircleIcon className="w-4 h-4" />
              )}
              <span>{isSync ? 'Syncing...' : 'Sync All'}</span>
            </button>
            
            {queueSize > 0 && (
              <button
                onClick={() => setShowClearConfirm(true)}
                disabled={isSync}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-xl font-medium hover:bg-gray-700 disabled:opacity-50"
              >
                <TrashIcon className="w-4 h-4" />
                <span>Clear All</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Connection Status Card */}
        <div className={`rounded-2xl p-4 mb-6 border-l-4 ${
          isOnline 
            ? 'border-l-green-500 bg-green-50 dark:bg-green-900/10'
            : 'border-l-red-500 bg-red-50 dark:bg-red-900/10'
        }`}>
          <div className="flex items-center space-x-3">
            {isOnline ? (
              <WifiIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
            ) : (
              <NoSymbolIcon className="w-6 h-6 text-red-600 dark:text-red-400" />
            )}
            <div>
              <h3 className={`font-medium ${
                isOnline ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'
              }`}>
                {isOnline ? 'Connected to Internet' : 'No Internet Connection'}
              </h3>
              <p className={`text-sm ${
                isOnline ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
              }`}>
                {isOnline 
                  ? 'Items will be synced automatically'
                  : 'Items will be synced when connection is restored'
                }
              </p>
            </div>
          </div>
        </div>

        {/* Queue Items */}
        {displayItems.length === 0 ? (
          <div className="text-center py-12">
            <CheckCircleIcon className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              All Synced!
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              No items waiting to be synchronized
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayItems.map((item) => {
              const Icon = item.icon;
              
              return (
                <div
                  key={item.id}
                  className={`bg-white dark:bg-gray-800 rounded-2xl p-4 border-l-4 ${getStatusColor(item)} shadow-sm`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1">
                      <div className="flex-shrink-0">
                        <Icon className={`w-6 h-6 ${item.color} dark:${item.color.replace('600', '400')}`} />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {item.description}
                        </p>
                        
                        <div className="flex items-center space-x-4 mt-1">
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {formatTimestamp(item.timestamp)}
                          </span>
                          
                          {item.retryCount > 0 && (
                            <span className="text-xs text-red-600 dark:text-red-400">
                              Failed {item.retryCount} time{item.retryCount > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        
                        {/* Data Preview */}
                        {item.type === 'collection' && item.data && (
                          <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                            Amount: ৳{item.data.amount} • Type: {item.data.type}
                            {item.data.txnId && ` • TXN: ${item.data.txnId}`}
                          </div>
                        )}
                        
                        {item.type === 'update' && item.data && (
                          <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                            Visit: {item.data.visitType} • Date: {new Date(item.data.visitDate).toLocaleDateString('bn-BD')}
                            {item.data.remarks && ` • ${item.data.remarks.slice(0, 50)}...`}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2 ml-3">
                      {getStatusIcon(item)}
                      
                      <button
                        onClick={() => handleRemoveItem(item.id)}
                        disabled={isSync}
                        className="p-1 text-gray-400 hover:text-red-600 disabled:opacity-50"
                        title="Remove from queue"
                      >
                        <XMarkIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Sync Status */}
        {lastSyncAttempt && (
          <div className="mt-6 text-center text-xs text-gray-500 dark:text-gray-400">
            Last sync attempt: {lastSyncAttempt.toLocaleTimeString('bn-BD')}
          </div>
        )}
      </div>

      {/* Clear Confirmation Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-sm w-full">
            <div className="text-center">
              <ExclamationTriangleIcon className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Clear All Items?
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                This will permanently remove all {queueSize} pending items from the queue. This action cannot be undone.
              </p>
              
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-xl font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleClearAll}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700"
                >
                  Clear All
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OfflineQueuePage;