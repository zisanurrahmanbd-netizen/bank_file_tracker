import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { PWAContextType, OfflineQueueItem } from '@/types';
import { logger } from '@/utils/logger';

const PWAContext = createContext<PWAContextType | undefined>(undefined);

interface PWAProviderProps {
  children: ReactNode;
}

export const PWAProvider: React.FC<PWAProviderProps> = ({ children }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isInstallable, setIsInstallable] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [queueSize, setQueueSize] = useState(0);

  useEffect(() => {
    // Online/offline status
    const handleOnline = () => {
      setIsOnline(true);
      logger.info('App is online');
    };

    const handleOffline = () => {
      setIsOnline(false);
      logger.info('App is offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // PWA install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
      logger.info('PWA install prompt available');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Update queue size periodically
    const updateQueueSize = async () => {
      try {
        const queueItems = await getOfflineQueue();
        setQueueSize(queueItems.length);
      } catch (error) {
        logger.error('Failed to update queue size:', error);
      }
    };

    updateQueueSize();
    const interval = setInterval(updateQueueSize, 5000); // Update every 5 seconds

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      clearInterval(interval);
    };
  }, []);

  const installApp = async (): Promise<void> => {
    if (!deferredPrompt) {
      throw new Error('Install prompt not available');
    }

    const choiceResult = await deferredPrompt.prompt();
    logger.info('PWA install choice:', choiceResult.outcome);

    if (choiceResult.outcome === 'accepted') {
      setIsInstallable(false);
      setDeferredPrompt(null);
    }
  };

  const syncQueue = async (): Promise<void> => {
    if (!isOnline) {
      throw new Error('Cannot sync while offline');
    }

    try {
      const queueItems = await getOfflineQueue();
      logger.info(`Syncing ${queueItems.length} items from offline queue`);

      for (const item of queueItems) {
        try {
          await processQueueItem(item);
          await removeFromQueue(item.id);
          logger.info(`Synced item ${item.id}`);
        } catch (error) {
          logger.error(`Failed to sync item ${item.id}:`, error);
          await updateQueueItemStatus(item.id, 'FAILED');
        }
      }

      setQueueSize(0);
    } catch (error) {
      logger.error('Queue sync failed:', error);
      throw error;
    }
  };

  const value: PWAContextType = {
    isOnline,
    isInstallable,
    installApp,
    queueSize,
    syncQueue,
  };

  return (
    <PWAContext.Provider value={value}>
      {children}
    </PWAContext.Provider>
  );
};

export const usePWA = (): PWAContextType => {
  const context = useContext(PWAContext);
  if (context === undefined) {
    throw new Error('usePWA must be used within a PWAProvider');
  }
  return context;
};

// Offline queue management functions
async function getOfflineQueue(): Promise<OfflineQueueItem[]> {
  // This would be implemented with IndexedDB
  // For now, return empty array
  return [];
}

async function removeFromQueue(id: string): Promise<void> {
  // Implementation with IndexedDB
  logger.debug(`Removing item ${id} from queue`);
}

async function updateQueueItemStatus(id: string, status: OfflineQueueItem['status']): Promise<void> {
  // Implementation with IndexedDB
  logger.debug(`Updating item ${id} status to ${status}`);
}

async function processQueueItem(item: OfflineQueueItem): Promise<void> {
  // Process the queued item based on its type
  switch (item.type) {
    case 'UPDATE':
      // Process account update
      break;
    case 'COLLECTION':
      // Process collection submission
      break;
    case 'VISIT':
      // Process visit log
      break;
    default:
      throw new Error(`Unknown queue item type: ${item.type}`);
  }
}