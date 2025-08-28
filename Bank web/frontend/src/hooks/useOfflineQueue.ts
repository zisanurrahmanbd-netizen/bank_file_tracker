import { useState, useEffect, useCallback } from 'react';
import { useOnlineStatus } from './useOnlineStatus';

interface QueueItem {
  id: string;
  type: 'collection' | 'update' | 'photo';
  data: any;
  timestamp: number;
  retryCount: number;
}

const QUEUE_STORAGE_KEY = 'offline_queue';
const MAX_RETRY_COUNT = 3;

export const useOfflineQueue = () => {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isSync, setIsSync] = useState(false);
  const isOnline = useOnlineStatus();

  // Load queue from localStorage on mount
  useEffect(() => {
    const savedQueue = localStorage.getItem(QUEUE_STORAGE_KEY);
    if (savedQueue) {
      try {
        const parsedQueue = JSON.parse(savedQueue);
        setQueue(parsedQueue);
      } catch (error) {
        console.error('Failed to parse offline queue:', error);
        localStorage.removeItem(QUEUE_STORAGE_KEY);
      }
    }
  }, []);

  // Save queue to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  }, [queue]);

  // Auto-sync when coming online
  useEffect(() => {
    if (isOnline && queue.length > 0 && !isSync) {
      syncQueue();
    }
  }, [isOnline, queue.length, isSync]);

  const addToQueue = useCallback((type: QueueItem['type'], data: any) => {
    const item: QueueItem = {
      id: Date.now().toString() + Math.random().toString(36),
      type,
      data,
      timestamp: Date.now(),
      retryCount: 0,
    };

    setQueue(prev => [...prev, item]);
    return item.id;
  }, []);

  const removeFromQueue = useCallback((id: string) => {
    setQueue(prev => prev.filter(item => item.id !== id));
  }, []);

  const syncQueue = useCallback(async () => {
    if (!isOnline || queue.length === 0 || isSync) {
      return;
    }

    setIsSync(true);

    try {
      const itemsToSync = [...queue];
      
      for (const item of itemsToSync) {
        try {
          await processQueueItem(item);
          removeFromQueue(item.id);
        } catch (error) {
          console.error('Failed to sync queue item:', error);
          
          // Increment retry count
          setQueue(prev => prev.map(queueItem => 
            queueItem.id === item.id 
              ? { ...queueItem, retryCount: queueItem.retryCount + 1 }
              : queueItem
          ));

          // Remove items that have exceeded max retry count
          if (item.retryCount >= MAX_RETRY_COUNT) {
            removeFromQueue(item.id);
            console.warn('Queue item removed after max retries:', item);
          }
        }
      }
    } finally {
      setIsSync(false);
    }
  }, [isOnline, queue, isSync, removeFromQueue]);

  const clearQueue = useCallback(() => {
    setQueue([]);
    localStorage.removeItem(QUEUE_STORAGE_KEY);
  }, []);

  return {
    queue,
    queueSize: queue.length,
    isSync,
    addToQueue,
    removeFromQueue,
    syncQueue,
    clearQueue,
  };
};

// Helper function to process individual queue items
async function processQueueItem(item: QueueItem): Promise<void> {
  const { type, data } = item;

  switch (type) {
    case 'collection':
      await submitCollection(data);
      break;
    case 'update':
      await submitUpdate(data);
      break;
    case 'photo':
      await uploadPhoto(data);
      break;
    default:
      throw new Error(`Unknown queue item type: ${type}`);
  }
}

// API functions for syncing data
async function submitCollection(data: any): Promise<void> {
  const response = await fetch('/api/collections', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Failed to submit collection: ${response.statusText}`);
  }
}

async function submitUpdate(data: any): Promise<void> {
  const response = await fetch(`/api/accounts/${data.accountId}/updates`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
    },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Failed to submit update: ${response.statusText}`);
  }
}

async function uploadPhoto(data: any): Promise<void> {
  const formData = new FormData();
  formData.append('file', data.file);
  formData.append('accountId', data.accountId);
  formData.append('type', data.type);

  const response = await fetch('/api/uploads', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('token')}`,
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Failed to upload photo: ${response.statusText}`);
  }
}