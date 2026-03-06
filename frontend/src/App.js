import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/api/auth';
import { ProtectedRoute } from '@/api/ProtectedRoute';
import { LogoProvider } from '@/contexts/LogoContext';
import { LotoPamAuthProvider } from '@/context/LotoPamAuthContext';
import { Toaster } from 'sonner';
import '@/App.css';
import '@/i18n';

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

// Company Admin Pages
import { CompanyDashboardPage } from '@/pages/CompanyDashboardPage';
import { CompanySuccursalesPage } from '@/pages/CompanySuccursalesPage';
import { CompanyLotteriesPage } from '@/pages/CompanyLotteriesPage';
import { CompanyLotteriesForAgentsPage } from '@/pages/CompanyLotteriesForAgentsPage';
import { CompanyResultsPage } from '@/pages/CompanyResultsPage';
import { SchedulesPage } from '@/pages/SchedulesPage';
import { TicketsPage } from '@/pages/TicketsPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { CompanyUsersPage } from '@/pages/CompanyUsersPage';
import { CompanyActivityLogsPage } from '@/pages/CompanyActivityLogsPage';
import { CompanySettingsPage } from '@/pages/CompanySettingsPage';
import { CompanyConfigurationPage } from '@/pages/CompanyConfigurationPage';
import { CompanyStatisticsPage } from '@/pages/CompanyStatisticsPage';
import { CompanyDailyReportsPage } from '@/pages/CompanyDailyReportsPage';
import CompanyProfileSettingsPage from '@/pages/company/CompanySettingsPage';
import { CompanyWinningTicketsPage } from '@/pages/CompanyWinningTicketsPage';
import { BranchLotteriesPage } from '@/pages/BranchLotteriesPage';
import CompanyRapportVentes from '@/pages/CompanyRapportVentes';

// Supervisor Pages
import { SupervisorLayout } from '@/layouts/SupervisorLayout';
import { SupervisorDashboardPage } from '@/pages/supervisor/SupervisorDashboardPage';
import { SupervisorAgentsPage } from '@/pages/supervisor/SupervisorAgentsPage';
import { SupervisorTicketsPage } from '@/pages/supervisor/SupervisorTicketsPage';
import { SupervisorReportsPage } from '@/pages/supervisor/SupervisorReportsPage';
import { SupervisorResultsPage } from '@/pages/supervisor/SupervisorResultsPage';
import { SupervisorLotterySchedulesPage } from '@/pages/supervisor/SupervisorLotterySchedulesPage';

// Vendeur Pages
import VendeurLayout from '@/layouts/VendeurLayout';
import {
  VendeurDashboard,
  VendeurNouvelleVente,
  VendeurMesTickets,
  VendeurResultats,
  VendeurTirages,
  VendeurMesVentes,
  VendeurProfil,
  VendeurRecherche
} from '@/pages/vendeur';

// LOTO PAM Public Platform Pages
import LotoPamHomePage from '@/pages/lotopam/LotoPamHomePage';
import LotoPamLoginPage from '@/pages/lotopam/LotoPamLoginPage';
import LotoPamRegisterPage from '@/pages/lotopam/LotoPamRegisterPage';
import LotoPamWalletPage from '@/pages/lotopam/LotoPamWalletPage';
import LotoPamPlayPage from '@/pages/lotopam/LotoPamPlayPage';
import LotoPamLotteryPlayPage from '@/pages/lotopam/LotoPamLotteryPlayPage';
import LotoPamMyTicketsPage from '@/pages/lotopam/LotoPamMyTicketsPage';
import LotoPamResultsPage from '@/pages/lotopam/LotoPamResultsPage';
import LotoPamKYCPage from '@/pages/lotopam/LotoPamKYCPage';
import LotoPamProfilePage from '@/pages/lotopam/LotoPamProfilePage';

// Super Admin LOTO PAM Module
import SuperOnlineDashboardPage from '@/pages/super/SuperOnlineDashboardPage';
import SuperOnlinePlayersPage from '@/pages/super/SuperOnlinePlayersPage';
import SuperOnlineDepositsPage from '@/pages/super/SuperOnlineDepositsPage';
import SuperOnlineWithdrawalsPage from '@/pages/super/SuperOnlineWithdrawalsPage';
import SuperOnlineTicketsPage from '@/pages/super/SuperOnlineTicketsPage';
import SuperOnlineKYCPage from '@/pages/super/SuperOnlineKYCPage';
import SuperOnlineSettingsPage from '@/pages/super/SuperOnlineSettingsPage';

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

  const redirectMap = {
    SUPER_ADMIN: '/super/dashboard',
    COMPANY_ADMIN: '/company/dashboard',
    COMPANY_MANAGER: '/company/dashboard',
    AUDITOR_READONLY: '/company/dashboard',
    VENDEUR: '/vendeur/dashboard',
    AGENT_POS: '/vendeur/dashboard'
  };

  return <Navigate to={redirectMap[user.role] || '/login'} replace />;
};

// Domain-based rendering check
const isLotoPamDomain = () => {
  const hostname = window.location.hostname;
  return hostname.includes('lotopam') || hostname === 'lotopam.com' || hostname === 'www.lotopam.com';
};

// LOTO PAM Public App Routes
const LotoPamApp = () => {
  return (
    <LotoPamAuthProvider>
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
              duration: 3000,
            }}
          />
          <Routes>
            {/* Public LOTO PAM Routes */}
            <Route path="/" element={<LotoPamHomePage />} />
            <Route path="/login" element={<LotoPamLoginPage />} />
            <Route path="/register" element={<LotoPamRegisterPage />} />
            <Route path="/wallet" element={<LotoPamWalletPage />} />
            <Route path="/play" element={<LotoPamPlayPage />} />
            <Route path="/play/lottery" element={<LotoPamLotteryPlayPage />} />
            <Route path="/play/lottery/:lotteryId" element={<LotoPamLotteryPlayPage />} />
            <Route path="/my-tickets" element={<LotoPamMyTicketsPage />} />
            <Route path="/results" element={<LotoPamResultsPage />} />
            <Route path="/kyc" element={<LotoPamKYCPage />} />
            <Route path="/profile" element={<LotoPamProfilePage />} />
            
            {/* Catch all - redirect to home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </BrowserRouter>
    </LotoPamAuthProvider>
  );
};

// Main SaaS App Routes
const SaaSApp = () => {
  return (
    <AuthProvider>
      <LogoProvider>
        <LotoPamAuthProvider>
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

                {/* ================== LOTO PAM PUBLIC ROUTES ================== */}
                <Route path="/lotopam" element={<LotoPamHomePage />} />
                <Route path="/lotopam/login" element={<LotoPamLoginPage />} />
                <Route path="/lotopam/register" element={<LotoPamRegisterPage />} />
                <Route path="/lotopam/wallet" element={<LotoPamWalletPage />} />
                <Route path="/lotopam/play" element={<LotoPamPlayPage />} />
                <Route path="/lotopam/play/lottery" element={<LotoPamLotteryPlayPage />} />
                <Route path="/lotopam/play/lottery/:lotteryId" element={<LotoPamLotteryPlayPage />} />
                <Route path="/lotopam/my-tickets" element={<LotoPamMyTicketsPage />} />
                <Route path="/lotopam/results" element={<LotoPamResultsPage />} />
                <Route path="/lotopam/kyc" element={<LotoPamKYCPage />} />
                <Route path="/lotopam/profile" element={<LotoPamProfilePage />} />

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

                {/* ================== SUPER ADMIN - LOTO PAM ONLINE MODULE ================== */}
                <Route
                  path="/super/online/dashboard"
                  element={
                    <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                      <SuperOnlineDashboardPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/super/online/players"
                  element={
                    <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                      <SuperOnlinePlayersPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/super/online/deposits"
                  element={
                    <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                      <SuperOnlineDepositsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/super/online/withdrawals"
                  element={
                    <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                      <SuperOnlineWithdrawalsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/super/online/tickets"
                  element={
                    <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                      <SuperOnlineTicketsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/super/online/kyc"
                  element={
                    <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                      <SuperOnlineKYCPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/super/online/settings"
                  element={
                    <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
                      <SuperOnlineSettingsPage />
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
                  path="/company/succursales"
                  element={
                    <ProtectedRoute allowedRoles={['COMPANY_ADMIN', 'COMPANY_MANAGER']}>
                      <CompanySuccursalesPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/company/branches/:branchId/lotteries"
                  element={
                    <ProtectedRoute allowedRoles={['COMPANY_ADMIN', 'COMPANY_MANAGER']}>
                      <BranchLotteriesPage />
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
                  path="/company/lotteries-for-agents"
                  element={
                    <ProtectedRoute allowedRoles={['COMPANY_ADMIN', 'COMPANY_MANAGER']}>
                      <CompanyLotteriesForAgentsPage />
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
                  path="/company/rapport-ventes"
                  element={
                    <ProtectedRoute allowedRoles={['COMPANY_ADMIN', 'COMPANY_MANAGER', 'AUDITOR_READONLY']}>
                      <CompanyRapportVentes />
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
                  path="/company/winning-tickets"
                  element={
                    <ProtectedRoute allowedRoles={['COMPANY_ADMIN', 'COMPANY_MANAGER']}>
                      <CompanyWinningTicketsPage />
                    </ProtectedRoute>
                  }
                />

                {/* ================== SUPERVISOR ROUTES ================== */}
                <Route
                  path="/supervisor"
                  element={
                    <ProtectedRoute allowedRoles={['BRANCH_SUPERVISOR']}>
                      <SupervisorLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route path="dashboard" element={<SupervisorDashboardPage />} />
                  <Route path="agents" element={<SupervisorAgentsPage />} />
                  <Route path="tickets" element={<SupervisorTicketsPage />} />
                  <Route path="reports" element={<SupervisorReportsPage />} />
                  <Route path="results" element={<SupervisorResultsPage />} />
                  <Route path="lottery-schedules" element={<SupervisorLotterySchedulesPage />} />
                  <Route index element={<Navigate to="/supervisor/dashboard" replace />} />
                </Route>

                {/* ================== VENDEUR ROUTES ================== */}
                <Route
                  path="/vendeur"
                  element={
                    <ProtectedRoute allowedRoles={['VENDEUR', 'AGENT_POS']}>
                      <VendeurLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route path="dashboard" element={<VendeurDashboard />} />
                  <Route path="nouvelle-vente" element={<VendeurNouvelleVente />} />
                  <Route path="mes-tickets" element={<VendeurMesTickets />} />
                  <Route path="recherche" element={<VendeurRecherche />} />
                  <Route path="tirages" element={<VendeurTirages />} />
                  <Route path="resultats" element={<VendeurResultats />} />
                  <Route path="mes-ventes" element={<VendeurMesVentes />} />
                  <Route path="profil" element={<VendeurProfil />} />
                  <Route index element={<Navigate to="/vendeur/dashboard" replace />} />
                </Route>

                {/* Catch all - redirect to role-based home */}
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>
          </BrowserRouter>
        </LotoPamAuthProvider>
      </LogoProvider>
    </AuthProvider>
  );
};

function App() {
  // Domain-based rendering: lotopam.com shows LOTO PAM public portal
  if (isLotoPamDomain()) {
    return <LotoPamApp />;
  }
  
  // Default: SaaS platform (lottolab.tech or any other domain)
  return <SaaSApp />;
}

export default App;
