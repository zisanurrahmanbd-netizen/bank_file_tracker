import React from 'react';
import { useTranslation } from 'react-i18next';

const AccountsPage: React.FC = () => {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
        {t('accounts.title')}
      </h1>
      <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm">
        <p className="text-gray-600 dark:text-gray-400">Accounts page coming soon...</p>
      </div>
    </div>
  );
};

export default AccountsPage;