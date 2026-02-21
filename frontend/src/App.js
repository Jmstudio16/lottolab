import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/api/auth';
import { ProtectedRoute } from '@/api/ProtectedRoute';
import { Toaster } from 'sonner';
import '@/App.css';

// Pages
import { LoginPage } from '@/pages/LoginPage';
import { SuperDashboardPage } from '@/pages/SuperDashboardPage';
import { SuperCompaniesPage } from '@/pages/SuperCompaniesPage';
import { SuperUsersPage } from '@/pages/SuperUsersPage';
import { SuperPlansPage } from '@/pages/SuperPlansPage';
import { SuperActivityLogsPage } from '@/pages/SuperActivityLogsPage';
import { SuperSettingsPage } from '@/pages/SuperSettingsPage';
import { CompanyDashboardPage } from '@/pages/CompanyDashboardPage';
import { CompanyAgentsPage } from '@/pages/CompanyAgentsPage';
import { CompanyLotteriesPage } from '@/pages/CompanyLotteriesPage';
import { CompanyResultsPage } from '@/pages/CompanyResultsPage';
import { POSDevicesPage } from '@/pages/POSDevicesPage';
import { SchedulesPage } from '@/pages/SchedulesPage';
import { TicketsPage } from '@/pages/TicketsPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { CompanyUsersPage } from '@/pages/CompanyUsersPage';
import { CompanyActivityLogsPage } from '@/pages/CompanyActivityLogsPage';
import { CompanySettingsPage } from '@/pages/CompanySettingsPage';
import { POSPage } from '@/pages/POSPage';

const RoleBasedRedirect = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Role-based redirect
  const redirectMap = {
    SUPER_ADMIN: '/super/dashboard',
    COMPANY_ADMIN: '/company/dashboard',
    COMPANY_MANAGER: '/company/dashboard',
    AGENT_POS: '/pos',
    AUDITOR_READONLY: '/company/dashboard'
  };

  return <Navigate to={redirectMap[user.role] || '/login'} replace />;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="App">
          <Toaster 
            position="top-right" 
            theme="dark"
            toastOptions={{
              style: {
                background: '#1e293b',
                border: '1px solid #334155',
                color: '#f1f5f9',
              },
              className: 'font-sans',
              duration: 3000,
            }}
          />
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<LoginPage />} />
            
            {/* Root redirect */}
            <Route path="/" element={<RoleBasedRedirect />} />

            {/* Super Admin Routes */}
            <Route
              path="/super/dashboard"
              element={
                <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                  <SuperDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/super/companies"
              element={
                <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                  <SuperCompaniesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/super/users"
              element={
                <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                  <SuperUsersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/super/plans"
              element={
                <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                  <SuperPlansPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/super/activity-logs"
              element={
                <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                  <SuperActivityLogsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/super/settings"
              element={
                <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                  <SuperSettingsPage />
                </ProtectedRoute>
              }
            />

            {/* Company Admin Routes */}
            <Route
              path="/company/dashboard"
              element={
                <ProtectedRoute allowedRoles={['COMPANY_ADMIN', 'COMPANY_MANAGER', 'AUDITOR_READONLY']}>
                  <CompanyDashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/company/agents"
              element={
                <ProtectedRoute allowedRoles={['COMPANY_ADMIN', 'COMPANY_MANAGER']}>
                  <CompanyAgentsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/company/pos-devices"
              element={
                <ProtectedRoute allowedRoles={['COMPANY_ADMIN', 'COMPANY_MANAGER']}>
                  <POSDevicesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/company/lotteries"
              element={
                <ProtectedRoute allowedRoles={['COMPANY_ADMIN', 'COMPANY_MANAGER']}>
                  <CompanyLotteriesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/company/schedules"
              element={
                <ProtectedRoute allowedRoles={['COMPANY_ADMIN', 'COMPANY_MANAGER']}>
                  <SchedulesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/company/results"
              element={
                <ProtectedRoute allowedRoles={['COMPANY_ADMIN', 'COMPANY_MANAGER']}>
                  <CompanyResultsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/company/tickets"
              element={
                <ProtectedRoute allowedRoles={['COMPANY_ADMIN', 'COMPANY_MANAGER', 'AUDITOR_READONLY']}>
                  <TicketsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/company/reports"
              element={
                <ProtectedRoute allowedRoles={['COMPANY_ADMIN', 'COMPANY_MANAGER', 'AUDITOR_READONLY']}>
                  <ReportsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/company/users"
              element={
                <ProtectedRoute allowedRoles={['COMPANY_ADMIN']}>
                  <CompanyUsersPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/company/activity-logs"
              element={
                <ProtectedRoute allowedRoles={['COMPANY_ADMIN', 'AUDITOR_READONLY']}>
                  <CompanyActivityLogsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/company/settings"
              element={
                <ProtectedRoute allowedRoles={['COMPANY_ADMIN']}>
                  <CompanySettingsPage />
                </ProtectedRoute>
              }
            />

            {/* POS Routes */}
            <Route
              path="/pos"
              element={
                <ProtectedRoute allowedRoles={['AGENT_POS']}>
                  <POSPage />
                </ProtectedRoute>
              }
            />

            {/* Catch all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
