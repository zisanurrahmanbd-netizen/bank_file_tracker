import { Routes, Route, Navigate } from 'react-router-dom';
import { Suspense } from 'react';

import { useAuth } from '@/hooks/useAuth';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import Layout from '@/components/layout/Layout';

// Public pages
import LoginPage from '@/pages/auth/LoginPage';

// Admin pages
import AdminDashboard from '@/pages/admin/Dashboard';
import AccountsPage from '@/pages/admin/AccountsPage';
import CollectionsPage from '@/pages/admin/CollectionsPage';
import AgentsPage from '@/pages/admin/AgentsPage';
import BanksPage from '@/pages/admin/BanksPage';
import ReportsPage from '@/pages/admin/ReportsPage';
import SettingsPage from '@/pages/admin/SettingsPage';

// Agent pages
import AgentDashboard from '@/pages/agent/Dashboard';
import MyAccountsPage from '@/pages/agent/MyAccountsPage';
import CollectionSubmitPage from '@/pages/agent/CollectionSubmitPage';
import OfflineQueuePage from '@/pages/agent/OfflineQueuePage';

// Shared pages
import AccountDetailPage from '@/pages/shared/AccountDetailPage';
import ProfilePage from '@/pages/shared/ProfilePage';

// Error pages
import NotFoundPage from '@/pages/error/NotFoundPage';
import UnauthorizedPage from '@/pages/error/UnauthorizedPage';

function App() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Suspense fallback={
        <div className="min-h-screen flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
      }>
        <Routes>
          {/* Public Routes */}
          <Route
            path="/login"
            element={
              user ? <Navigate to={getDashboardPath(user.role)} replace /> : <LoginPage />
            }
          />

          {/* Protected Routes */}
          {user ? (
            <Route path="/" element={<Layout />}>
              {/* Dashboard Routes */}
              <Route
                index
                element={<Navigate to={getDashboardPath(user.role)} replace />}
              />
              
              {/* Admin Routes */}
              {user.role === 'ADMIN' && (
                <>
                  <Route path="admin/dashboard" element={<AdminDashboard />} />
                  <Route path="admin/accounts" element={<AccountsPage />} />
                  <Route path="admin/collections" element={<CollectionsPage />} />
                  <Route path="admin/agents" element={<AgentsPage />} />
                  <Route path="admin/banks" element={<BanksPage />} />
                  <Route path="admin/reports" element={<ReportsPage />} />
                  <Route path="admin/settings" element={<SettingsPage />} />
                </>
              )}

              {/* Agent Routes */}
              {user.role === 'AGENT' && (
                <>
                  <Route path="agent/dashboard" element={<AgentDashboard />} />
                  <Route path="agent/accounts" element={<MyAccountsPage />} />
                  <Route path="agent/submit-collection" element={<CollectionSubmitPage />} />
                  <Route path="agent/offline-queue" element={<OfflineQueuePage />} />
                </>
              )}

              {/* Auditor Routes */}
              {user.role === 'AUDITOR' && (
                <>
                  <Route path="auditor/dashboard" element={<AdminDashboard />} />
                  <Route path="auditor/accounts" element={<AccountsPage />} />
                  <Route path="auditor/collections" element={<CollectionsPage />} />
                  <Route path="auditor/reports" element={<ReportsPage />} />
                </>
              )}

              {/* Shared Routes */}
              <Route path="account/:id" element={<AccountDetailPage />} />
              <Route path="profile" element={<ProfilePage />} />

              {/* Error Routes */}
              <Route path="unauthorized" element={<UnauthorizedPage />} />
              <Route path="*" element={<NotFoundPage />} />
            </Route>
          ) : (
            // Redirect to login if not authenticated
            <Route path="*" element={<Navigate to="/login" replace />} />
          )}
        </Routes>
      </Suspense>
    </div>
  );
}

function getDashboardPath(role: string): string {
  switch (role) {
    case 'ADMIN':
      return '/admin/dashboard';
    case 'AGENT':
      return '/agent/dashboard';
    case 'AUDITOR':
      return '/auditor/dashboard';
    default:
      return '/login';
  }
}

export default App;