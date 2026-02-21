import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/api/auth';
import { ProtectedRoute } from '@/api/ProtectedRoute';
import { LogoProvider } from '@/contexts/LogoContext';
import { Toaster } from 'sonner';
import '@/App.css';

// Super Admin Pages
import { LoginPage } from '@/pages/LoginPage';
import { SuperDashboardPage } from '@/pages/SuperDashboardPage';
import { SuperCompaniesPage } from '@/pages/SuperCompaniesPage';
import { SuperUsersPage } from '@/pages/SuperUsersPage';
import { SuperPlansPage } from '@/pages/SuperPlansPage';
import { SuperActivityLogsPage } from '@/pages/SuperActivityLogsPage';
import { SuperSettingsPage } from '@/pages/SuperSettingsPage';
import { SuperLotteryCatalogPage } from '@/pages/SuperLotteryCatalogPage';
import { SuperGlobalSchedulesPage } from '@/pages/SuperGlobalSchedulesPage';
import { SuperGlobalResultsPage } from '@/pages/SuperGlobalResultsPage';
import { SuperResultManagementPage } from '@/pages/SuperResultManagementPage';
import { SuperCreateCompanyPage } from '@/pages/SuperCreateCompanyPage';
import { AgentResultsViewPage } from '@/pages/agent/AgentResultsViewPage';

// Company Admin Pages
import { CompanyDashboardPage } from '@/pages/CompanyDashboardPage';
import { CompanyAgentsPage } from '@/pages/CompanyAgentsPage';
import { CompanyCreateAgentPage } from '@/pages/CompanyCreateAgentPage';
import { CompanyLotteriesPage } from '@/pages/CompanyLotteriesPage';
import { CompanyResultsPage } from '@/pages/CompanyResultsPage';
import { POSDevicesPage } from '@/pages/POSDevicesPage';
import { SchedulesPage } from '@/pages/SchedulesPage';
import { TicketsPage } from '@/pages/TicketsPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { CompanyUsersPage } from '@/pages/CompanyUsersPage';
import { CompanyActivityLogsPage } from '@/pages/CompanyActivityLogsPage';
import { CompanySettingsPage } from '@/pages/CompanySettingsPage';
import { CompanyBranchesPage } from '@/pages/CompanyBranchesPage';
import { CompanyConfigurationPage } from '@/pages/CompanyConfigurationPage';
import { CompanyStatisticsPage } from '@/pages/CompanyStatisticsPage';
import { CompanyDailyReportsPage } from '@/pages/CompanyDailyReportsPage';
import CompanyProfileSettingsPage from '@/pages/company/CompanySettingsPage';
import { CompanyAgentBalancesPage } from '@/pages/CompanyAgentBalancesPage';
import { CompanyWinningTicketsPage } from '@/pages/CompanyWinningTicketsPage';

// Agent Universal Terminal Pages (NEW)
import { AgentLayout } from '@/layouts/AgentLayout';
import { 
  AgentLoginPage,
  AgentDashboardPage, 
  AgentNewTicketPage, 
  AgentTicketsPage, 
  AgentResultsPage, 
  AgentReportsPage 
} from '@/pages/agent';

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

  // Role-based redirect - STRICT separation
  const redirectMap = {
    SUPER_ADMIN: '/super/dashboard',
    COMPANY_ADMIN: '/company/dashboard',
    COMPANY_MANAGER: '/company/dashboard',
    AGENT_POS: '/agent/dashboard',  // Agents go to universal dashboard
    AUDITOR_READONLY: '/company/dashboard'
  };

  return <Navigate to={redirectMap[user.role] || '/login'} replace />;
};

function App() {
  return (
    <AuthProvider>
      <LogoProvider>
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
              <Route path="/agent/login" element={<AgentLoginPage />} />
              
              {/* Root redirect */}
              <Route path="/" element={<RoleBasedRedirect />} />

            {/* ================== SUPER ADMIN ROUTES ================== */}
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
              path="/super/companies/create"
              element={
                <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                  <SuperCreateCompanyPage />
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
            <Route
              path="/super/lottery-catalog"
              element={
                <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                  <SuperLotteryCatalogPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/super/global-schedules"
              element={
                <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                  <SuperGlobalSchedulesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/super/global-results"
              element={
                <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                  <SuperGlobalResultsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/super/result-management"
              element={
                <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                  <SuperResultManagementPage />
                </ProtectedRoute>
              }
            />

            {/* ================== COMPANY ADMIN ROUTES ================== */}
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
              path="/company/agents/create"
              element={
                <ProtectedRoute allowedRoles={['COMPANY_ADMIN']}>
                  <CompanyCreateAgentPage />
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
            <Route
              path="/company/branches"
              element={
                <ProtectedRoute allowedRoles={['COMPANY_ADMIN', 'COMPANY_MANAGER']}>
                  <CompanyBranchesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/company/configuration"
              element={
                <ProtectedRoute allowedRoles={['COMPANY_ADMIN']}>
                  <CompanyConfigurationPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/company/statistics"
              element={
                <ProtectedRoute allowedRoles={['COMPANY_ADMIN', 'COMPANY_MANAGER', 'AUDITOR_READONLY']}>
                  <CompanyStatisticsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/company/daily-reports"
              element={
                <ProtectedRoute allowedRoles={['COMPANY_ADMIN', 'COMPANY_MANAGER', 'AUDITOR_READONLY']}>
                  <CompanyDailyReportsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/company/profile-settings"
              element={
                <ProtectedRoute allowedRoles={['COMPANY_ADMIN']}>
                  <CompanyProfileSettingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/company/agent-balances"
              element={
                <ProtectedRoute allowedRoles={['COMPANY_ADMIN', 'COMPANY_MANAGER']}>
                  <CompanyAgentBalancesPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/company/winning-tickets"
              element={
                <ProtectedRoute allowedRoles={['COMPANY_ADMIN', 'COMPANY_MANAGER']}>
                  <CompanyWinningTicketsPage />
                </ProtectedRoute>
              }
            />

            {/* ================== UNIVERSAL AGENT TERMINAL ROUTES ================== */}
            {/* Agent routes use nested layout for better UX */}
            <Route
              path="/agent"
              element={
                <ProtectedRoute allowedRoles={['AGENT_POS']}>
                  <AgentLayout />
                </ProtectedRoute>
              }
            >
              <Route path="dashboard" element={<AgentDashboardPage />} />
              <Route path="new-ticket" element={<AgentNewTicketPage />} />
              <Route path="tickets" element={<AgentTicketsPage />} />
              <Route path="results" element={<AgentResultsPage />} />
              <Route path="reports" element={<AgentReportsPage />} />
              <Route index element={<Navigate to="/agent/dashboard" replace />} />
            </Route>

            {/* Legacy POS route redirect */}
            <Route
              path="/pos"
              element={<Navigate to="/agent/dashboard" replace />}
            />
            <Route
              path="/agent/pos"
              element={<Navigate to="/agent/dashboard" replace />}
            />

            {/* Catch all - redirect to role-based home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
        </BrowserRouter>
      </LogoProvider>
    </AuthProvider>
  );
}

export default App;
