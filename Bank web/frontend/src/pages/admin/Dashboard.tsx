import React from 'react';
import { useTranslation } from 'react-i18next';

const AdminDashboard: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          {t('dashboard.title')}
        </h1>
        <div className="text-sm text-gray-500">
          Admin Dashboard - Coming Soon
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Placeholder metric cards */}
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Metric {i}
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {Math.floor(Math.random() * 1000)}
                </p>
              </div>
              <div className="w-12 h-12 bg-porisheba-red-100 dark:bg-porisheba-red-900/20 rounded-lg flex items-center justify-center">
                <div className="w-6 h-6 bg-porisheba-red-600 rounded"></div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Recent Activity
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Dashboard content will be implemented here...
        </p>
      </div>
    </div>
  );
};

export default AdminDashboard;