import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  CheckCircleIcon,
  XMarkIcon,
  BanknotesIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';
import { apiClient } from '@/services/apiClient';

interface Collection {
  id: string;
  type: string;
  amount: number;
  collectionDate: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  account: {
    fileNo: string;
    clientName: string;
    bank: { name: string };
  };
  user: { name: string };
}

const CollectionsVerificationPage: React.FC = () => {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCollection, setSelectedCollection] = useState<Collection | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    loadCollections();
  }, []);

  const loadCollections = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.get('/collections/pending');
      setCollections(response.data.collections || []);
    } catch (error) {
      console.error('Failed to load collections:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCollection = async (collectionId: string, status: 'APPROVED' | 'REJECTED', rejectionReason?: string) => {
    try {
      setIsVerifying(true);
      await apiClient.post(`/collections/${collectionId}/verify`, {
        status,
        rejectionReason,
      });
      await loadCollections();
      setSelectedCollection(null);
      alert(`Collection ${status.toLowerCase()} successfully`);
    } catch (error) {
      console.error('Failed to verify collection:', error);
      alert('Failed to verify collection');
    } finally {
      setIsVerifying(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('bn-BD', {
      style: 'currency',
      currency: 'BDT',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  if (isLoading) {
    return (
      <div className=\"space-y-6\">
        <h1 className=\"text-3xl font-bold text-gray-900 dark:text-white\">Collection Verification</h1>
        <div className=\"flex justify-center py-12\">
          <div className=\"animate-spin rounded-full h-8 w-8 border-b-2 border-porisheba-red-600\" />
        </div>
      </div>
    );
  }

  return (
    <div className=\"space-y-6\">
      <div className=\"flex justify-between items-center\">
        <h1 className=\"text-3xl font-bold text-gray-900 dark:text-white\">
          Collection Verification ({collections.length})
        </h1>
        <button
          onClick={loadCollections}
          className=\"flex items-center space-x-2 px-4 py-2 bg-porisheba-red-600 text-white rounded-xl hover:bg-porisheba-red-700\"
        >
          <ArrowPathIcon className=\"w-4 h-4\" />
          <span>Refresh</span>
        </button>
      </div>

      <div className=\"bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700\">
        {collections.length === 0 ? (
          <div className=\"p-8 text-center\">
            <BanknotesIcon className=\"w-12 h-12 text-gray-400 mx-auto mb-4\" />
            <p className=\"text-gray-600 dark:text-gray-400\">No pending collections</p>
          </div>
        ) : (
          <div className=\"divide-y divide-gray-200 dark:divide-gray-700\">
            {collections.map((collection) => (
              <div key={collection.id} className=\"p-6\">
                <div className=\"flex items-center justify-between\">
                  <div className=\"flex-1\">
                    <div className=\"flex items-center space-x-2 mb-1\">
                      <h3 className=\"font-semibold text-gray-900 dark:text-white\">
                        {formatCurrency(collection.amount)}
                      </h3>
                      <span className=\"px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800\">
                        {collection.type}
                      </span>
                    </div>
                    <p className=\"text-sm text-gray-600 dark:text-gray-400\">
                      {collection.account.fileNo} - {collection.account.clientName}
                    </p>
                    <div className=\"flex items-center space-x-4 text-xs text-gray-500 mt-1\">
                      <span>\ud83c\udfe6 {collection.account.bank.name}</span>
                      <span>\ud83d\udc64 {collection.user.name}</span>
                      <span>\ud83d\udcc5 {new Date(collection.collectionDate).toLocaleDateString('bn-BD')}</span>
                    </div>
                  </div>
                  <div className=\"flex items-center space-x-2\">
                    <button
                      onClick={() => handleVerifyCollection(collection.id, 'APPROVED')}
                      disabled={isVerifying}
                      className=\"px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50\"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => {
                        const reason = prompt('Rejection reason:');
                        if (reason) handleVerifyCollection(collection.id, 'REJECTED', reason);
                      }}
                      disabled={isVerifying}
                      className=\"px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50\"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CollectionsVerificationPage;