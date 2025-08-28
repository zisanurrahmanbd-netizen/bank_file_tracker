import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import {
  CameraIcon,
  XMarkIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  PhotoIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '@/hooks/useAuth';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { apiClient } from '@/services/apiClient';

interface Account {
  id: string;
  fileNo: string;
  clientName: string;
  bank: {
    name: string;
    code: string;
  };
  outstandingAmount: number;
  overdueAmount: number;
}

interface CollectionForm {
  accountId: string;
  type: 'BKASH' | 'NAGAD' | 'CASH' | 'BANK_DEPOSIT';
  amount: number;
  collectionDate: string;
  txnId?: string;
  slipNo?: string;
  cashReceipt?: string;
  proofImages: File[];
}

const CollectionSubmitPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { accountId } = useParams<{ accountId: string }>();
  const isOnline = useOnlineStatus();
  const { addToQueue } = useOfflineQueue();

  const [account, setAccount] = useState<Account | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [previewImages, setPreviewImages] = useState<string[]>([]);

  const [form, setForm] = useState<CollectionForm>({
    accountId: accountId || '',
    type: 'BKASH',
    amount: 0,
    collectionDate: new Date().toISOString().split('T')[0],
    proofImages: [],
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (accountId) {
      loadAccount();
    }
  }, [accountId]);

  const loadAccount = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.get(`/accounts/${accountId}`);
      setAccount(response.data);
      setForm(prev => ({ ...prev, accountId: response.data.id }));
    } catch (error) {
      console.error('Failed to load account:', error);
      // Try to load from localStorage for offline
      const cachedAccount = localStorage.getItem(`account_${accountId}`);
      if (cachedAccount) {
        const parsedAccount = JSON.parse(cachedAccount);
        setAccount(parsedAccount);
        setForm(prev => ({ ...prev, accountId: parsedAccount.id }));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!form.amount || form.amount <= 0) {
      newErrors.amount = 'Amount is required';
    }

    if (!form.collectionDate) {
      newErrors.collectionDate = 'Date is required';
    }

    // Type-specific validations
    if ((form.type === 'BKASH' || form.type === 'NAGAD') && !form.txnId?.trim()) {
      newErrors.txnId = 'Transaction ID is required';
    }

    if (form.type === 'BANK_DEPOSIT' && !form.slipNo?.trim()) {
      newErrors.slipNo = 'Slip number is required';
    }

    if (form.type === 'CASH' && !form.cashReceipt?.trim()) {
      newErrors.cashReceipt = 'Receipt number is required';
    }

    if (form.proofImages.length === 0) {
      newErrors.proofImages = 'At least one proof image is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const submissionData = {
        ...form,
        collectionDate: new Date(form.collectionDate).toISOString(),
      };

      if (isOnline) {
        // Submit directly if online
        await submitCollection(submissionData);
        
        // Show success message
        alert('Collection submitted successfully!');
        navigate('/agent/accounts');
      } else {
        // Add to offline queue
        addToQueue('collection', submissionData);
        
        // Show offline success message
        alert('Collection queued for submission when online');
        navigate('/agent/accounts');
      }
    } catch (error) {
      console.error('Failed to submit collection:', error);
      
      if (isOnline) {
        // If online submission failed, add to queue as fallback
        addToQueue('collection', form);
        alert('Submission failed, added to queue');
      } else {
        alert('Failed to queue collection');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitCollection = async (data: any) => {
    const formData = new FormData();
    
    // Add form fields
    Object.keys(data).forEach(key => {
      if (key !== 'proofImages') {
        formData.append(key, data[key]);
      }
    });
    
    // Add images
    data.proofImages.forEach((file: File, index: number) => {
      formData.append(`proofImages[${index}]`, file);
    });

    await apiClient.post('/collections', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  };

  const handleImageCapture = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    if (files.length > 0) {
      const newImages = [...form.proofImages, ...files].slice(0, 5); // Max 5 images
      setForm(prev => ({ ...prev, proofImages: newImages }));
      
      // Create preview URLs
      const newPreviews = files.map(file => URL.createObjectURL(file));
      setPreviewImages(prev => [...prev, ...newPreviews].slice(0, 5));
    }
  };

  const removeImage = (index: number) => {
    setForm(prev => ({
      ...prev,
      proofImages: prev.proofImages.filter((_, i) => i !== index)
    }));
    
    setPreviewImages(prev => {
      const newPreviews = prev.filter((_, i) => i !== index);
      // Revoke the removed URL to free memory
      if (prev[index]) {
        URL.revokeObjectURL(prev[index]);
      }
      return newPreviews;
    });
  };

  const collectionTypes = [
    { value: 'BKASH', label: 'bKash', color: 'bg-pink-500', icon: '💳' },
    { value: 'NAGAD', label: 'Nagad', color: 'bg-orange-500', icon: '📱' },
    { value: 'CASH', label: 'Cash', color: 'bg-green-500', icon: '💵' },
    { value: 'BANK_DEPOSIT', label: 'Bank Deposit', color: 'bg-blue-500', icon: '🏦' },
  ];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-porisheba-red-600 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!account) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <ExclamationTriangleIcon className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Account not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-gray-900 dark:text-white">
                Submit Collection
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {account.fileNo} - {account.clientName}
              </p>
            </div>
            
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Account Info */}
      <div className="p-4">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-4 shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Outstanding Amount
            </span>
            <span className="text-lg font-bold text-gray-900 dark:text-white">
              ৳{account.outstandingAmount.toLocaleString('bn-BD')}
            </span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Overdue Amount
            </span>
            <span className="text-lg font-bold text-red-600 dark:text-red-400">
              ৳{account.overdueAmount.toLocaleString('bn-BD')}
            </span>
          </div>
        </div>

        {/* Collection Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Collection Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Collection Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              {collectionTypes.map((type) => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, type: type.value as any }))}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    form.type === type.value
                      ? 'border-porisheba-red-500 bg-porisheba-red-50 dark:bg-porisheba-red-900/20'
                      : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                  }`}
                >
                  <div className="text-2xl mb-1">{type.icon}</div>
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {type.label}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Amount *
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400">
                ৳
              </span>
              <input
                type="number"
                value={form.amount || ''}
                onChange={(e) => setForm(prev => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))}
                className={`w-full pl-8 pr-4 py-3 rounded-xl border ${errors.amount ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-porisheba-red-500`}
                placeholder="0"
              />
            </div>
            {errors.amount && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.amount}</p>
            )}
          </div>

          {/* Collection Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Collection Date *
            </label>
            <input
              type="date"
              value={form.collectionDate}
              onChange={(e) => setForm(prev => ({ ...prev, collectionDate: e.target.value }))}
              className={`w-full px-4 py-3 rounded-xl border ${errors.collectionDate ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-porisheba-red-500`}
            />
            {errors.collectionDate && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.collectionDate}</p>
            )}
          </div>

          {/* Type-specific fields */}
          {(form.type === 'BKASH' || form.type === 'NAGAD') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Transaction ID *
              </label>
              <input
                type="text"
                value={form.txnId || ''}
                onChange={(e) => setForm(prev => ({ ...prev, txnId: e.target.value }))}
                className={`w-full px-4 py-3 rounded-xl border ${errors.txnId ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-porisheba-red-500`}
                placeholder="Enter transaction ID"
              />
              {errors.txnId && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.txnId}</p>
              )}
            </div>
          )}

          {form.type === 'BANK_DEPOSIT' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Slip Number *
              </label>
              <input
                type="text"
                value={form.slipNo || ''}
                onChange={(e) => setForm(prev => ({ ...prev, slipNo: e.target.value }))}
                className={`w-full px-4 py-3 rounded-xl border ${errors.slipNo ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-porisheba-red-500`}
                placeholder="Enter slip number"
              />
              {errors.slipNo && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.slipNo}</p>
              )}
            </div>
          )}

          {form.type === 'CASH' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Receipt Number *
              </label>
              <input
                type="text"
                value={form.cashReceipt || ''}
                onChange={(e) => setForm(prev => ({ ...prev, cashReceipt: e.target.value }))}
                className={`w-full px-4 py-3 rounded-xl border ${errors.cashReceipt ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-porisheba-red-500`}
                placeholder="Enter receipt number"
              />
              {errors.cashReceipt && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.cashReceipt}</p>
              )}
            </div>
          )}

          {/* Photo Upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Proof Images * ({form.proofImages.length}/5)
            </label>
            
            {/* Image Previews */}
            {previewImages.length > 0 && (
              <div className="grid grid-cols-3 gap-2 mb-4">
                {previewImages.map((preview, index) => (
                  <div key={index} className="relative">
                    <img
                      src={preview}
                      alt={`Preview ${index + 1}`}
                      className="w-full h-20 object-cover rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs"
                    >
                      <XMarkIcon className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            
            {/* Camera/Upload Button */}
            {form.proofImages.length < 5 && (
              <div>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  multiple
                  onChange={handleImageCapture}
                  className="hidden"
                  id="photo-upload"
                />
                <label
                  htmlFor="photo-upload"
                  className={`w-full flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                    errors.proofImages 
                      ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                      : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <CameraIcon className="w-8 h-8 text-gray-400 mb-2" />
                  <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Take Photo
                  </span>
                  <span className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                    Tap to capture receipt/slip image
                  </span>
                </label>
              </div>
            )}
            
            {errors.proofImages && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.proofImages}</p>
            )}
          </div>

          {/* Offline Status Warning */}
          {!isOnline && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
              <div className="flex items-center space-x-2">
                <ClockIcon className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  Offline Mode
                </span>
              </div>
              <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1">
                Collection will be queued and submitted when connection is restored
              </p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-porisheba-red-600 text-white py-4 rounded-xl font-medium hover:bg-porisheba-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                <span>Submitting...</span>
              </>
            ) : (
              <>
                {isOnline ? (
                  <CheckCircleIcon className="w-5 h-5" />
                ) : (
                  <ClockIcon className="w-5 h-5" />
                )}
                <span>
                  {isOnline ? 'Submit Collection' : 'Queue for Submission'}
                </span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default CollectionSubmitPage;