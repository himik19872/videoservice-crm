import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout, theme } from 'antd';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import MasterLayout from './layouts/MasterLayout';
import AdminLayout from './layouts/AdminLayout';
import DispatcherLayout from './layouts/DispatcherLayout';
import LoginPage from './pages/auth/LoginPage';
import OrdersPage from './pages/orders/OrdersPage';
import OrdersCreatePage from './pages/orders/OrdersCreatePage';
import OrdersDetailPage from './pages/orders/OrdersDetailPage';
import OrdersEditPage from './pages/orders/OrdersEditPage';
import OrdersConfirmPage from './pages/orders/OrdersConfirmPage';
import ClientsPage from './pages/clients/ClientsPage';
import ClientsCreatePage from './pages/clients/ClientsCreatePage';
import ClientsDetailPage from './pages/clients/ClientsDetailPage';
import EquipmentPage from './pages/equipment/EquipmentPage';
import EquipmentCreatePage from './pages/equipment/EquipmentCreatePage';
import EquipmentDetailPage from './pages/equipment/EquipmentDetailPage';
import MastersPage from './pages/masters/MastersPage';
import MastersCreatePage from './pages/masters/MastersCreatePage';
import MasterDetailPage from './pages/masters/MasterDetailPage';
import RegionsPage from './pages/regions/RegionsPage';
import BuildingsPage from './pages/buildings/BuildingsPage';
import BuildingDetailPage from './pages/buildings/BuildingDetailPage';
import TraccarIntegrationPage from './pages/settings/TraccarIntegrationPage';
import AdminSettingsPage from './pages/settings/AdminSettingsPage';
import MaxSettingsPage from './pages/settings/MaxSettingsPage';
import SystemSettingsPage from './pages/settings/SystemSettingsPage';
import ReportsPage from './pages/reports/ReportsPage';
import FinancePage from './pages/reports/FinancePage';
import InventoryPage from './pages/equipment/InventoryPage';
import CalendarPage from './pages/CalendarPage';
import MessagesPage from './pages/MessagesPage';
import EstimatesPage from './pages/estimates/EstimatesPage';
import EstimateDetailPage from './pages/estimates/EstimateDetailPage';
import EstimateServicesPage from './pages/estimates/EstimateServicesPage';
import LegalEntitiesPage from './pages/settings/LegalEntitiesPage';
import EstimateSettingsPage from './pages/settings/EstimateSettingsPage';
import DispatchersPage from './pages/dispatchers/DispatchersPage';
import DashboardPage from './pages/DashboardPage';
import MasterDashboardPage from './pages/master/MasterDashboardPage';
import MasterOrdersPage from './pages/master/MasterOrdersPage';
import MasterProfilePage from './pages/master/MasterProfilePage';
import ProtectedRoute from './components/ProtectedRoute';

const { Content } = Layout;

function AppContent() {
  const { user, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  if (user?.role === 'master' || user?.role === 'installer') {
    return (
      <MasterLayout>
        <Routes>
          <Route path="/" element={<MasterDashboardPage />} />
          <Route path="/orders" element={<MasterOrdersPage />} />
          <Route path="/orders/:id" element={<OrdersDetailPage />} />
          <Route path="/profile" element={<MasterProfilePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </MasterLayout>
    );
  }

  if (user?.role === 'dispatcher') {
    return (
      <DispatcherLayout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/orders/create" element={<OrdersCreatePage />} />
          <Route path="/orders/:id" element={<OrdersDetailPage />} />
          <Route path="/orders/confirm" element={<OrdersConfirmPage />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/clients/create" element={<ClientsCreatePage />} />
          <Route path="/clients/:id" element={<ClientsDetailPage />} />
          <Route path="/equipment" element={<EquipmentPage />} />
          <Route path="/equipment/create" element={<EquipmentCreatePage />} />
          <Route path="/equipment/:id" element={<EquipmentDetailPage />} />
          <Route path="/masters" element={<MastersPage />} />
          <Route path="/masters/create" element={<MastersCreatePage />} />
          <Route path="/masters/:id" element={<MasterDetailPage />} />
          <Route path="/regions" element={<RegionsPage />} />
          <Route path="/buildings" element={<BuildingsPage />} />
          <Route path="/buildings/:id" element={<BuildingDetailPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </DispatcherLayout>
    );
  }

  // Admin + управленческие роли (расширенный доступ)
  const isManagement = user?.role === 'admin' || user?.role === 'general_director' || user?.role === 'executive_director' || user?.role === 'tech_director' || user?.role === 'chief_engineer';
  const isFinance = user?.role === 'accountant' || user?.role === 'cashier';
  const isOffice = user?.role === 'clerk' || user?.role === 'secretary' || user?.role === 'supervisor';

  // Инженер (отдельная роль с ограниченным доступом к заявкам и оборудованию)
  if (user?.role === 'engineer') {
    return (
      <DispatcherLayout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/orders/:id" element={<OrdersDetailPage />} />
          <Route path="/equipment" element={<EquipmentPage />} />
          <Route path="/equipment/:id" element={<EquipmentDetailPage />} />
          <Route path="/masters" element={<MastersPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </DispatcherLayout>
    );
  }

  // Финансы: видят заявки (просмотр), оплаты, отчёты
  if (isFinance) {
    return (
      <AdminLayout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/orders/:id" element={<OrdersDetailPage />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/clients/:id" element={<ClientsDetailPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/finance" element={<FinancePage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/estimates" element={<EstimatesPage />} />
          <Route path="/estimates/:id" element={<EstimateDetailPage />} />
          <Route path="/estimate-services" element={<EstimateServicesPage />} />
          {user?.role === 'accountant' && <Route path="/settings/admin" element={<AdminSettingsPage />} />}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AdminLayout>
    );
  }

  // Делопроизводитель, секретарь, начальник сервисной службы
  if (isOffice) {
    return (
      <AdminLayout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/orders/create" element={<OrdersCreatePage />} />
          <Route path="/orders/:id" element={<OrdersDetailPage />} />
          <Route path="/orders/confirm" element={<OrdersConfirmPage />} />
          <Route path="/clients" element={<ClientsPage />} />
          <Route path="/clients/create" element={<ClientsCreatePage />} />
          <Route path="/clients/:id" element={<ClientsDetailPage />} />
          <Route path="/equipment" element={<EquipmentPage />} />
          <Route path="/equipment/:id" element={<EquipmentDetailPage />} />
          <Route path="/masters" element={<MastersPage />} />
          <Route path="/masters/:id" element={<MasterDetailPage />} />
          <Route path="/buildings" element={<BuildingsPage />} />
          <Route path="/buildings/:id" element={<BuildingDetailPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/estimates" element={<EstimatesPage />} />
          <Route path="/estimates/:id" element={<EstimateDetailPage />} />
          <Route path="/estimate-services" element={<EstimateServicesPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AdminLayout>
    );
  }

  // Управленцы (admin, директора) — полный доступ
  if (isManagement) {
    return (
    <AdminLayout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/orders/create" element={<OrdersCreatePage />} />
        <Route path="/orders/:id" element={<OrdersDetailPage />} />
        <Route path="/orders/confirm" element={<OrdersConfirmPage />} />
        <Route path="/clients" element={<ClientsPage />} />
        <Route path="/clients/create" element={<ClientsCreatePage />} />
        <Route path="/clients/:id" element={<ClientsDetailPage />} />
        <Route path="/equipment" element={<EquipmentPage />} />
        <Route path="/equipment/create" element={<EquipmentCreatePage />} />
        <Route path="/equipment/:id" element={<EquipmentDetailPage />} />
        <Route path="/masters" element={<MastersPage />} />
        <Route path="/masters/create" element={<MastersCreatePage />} />
        <Route path="/masters/:id" element={<MasterDetailPage />} />
        <Route path="/regions" element={<RegionsPage />} />
        <Route path="/buildings" element={<BuildingsPage />} />
        <Route path="/buildings/:id" element={<BuildingDetailPage />} />
        <Route path="/settings/traccar" element={<TraccarIntegrationPage />} />
        <Route path="/settings/max" element={<MaxSettingsPage />} />
        <Route path="/settings/system" element={<SystemSettingsPage />} />
        <Route path="/settings/legal-entities" element={<LegalEntitiesPage />} />
        <Route path="/settings/estimate-template" element={<EstimateSettingsPage />} />
        <Route path="/settings/admin" element={<AdminSettingsPage />} />
        <Route path="/dispatchers" element={<DispatchersPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/inventory" element={<InventoryPage />} />
        <Route path="/finance" element={<FinancePage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/messages" element={<MessagesPage />} />
        <Route path="/estimates" element={<EstimatesPage />} />
        <Route path="/estimates/:id" element={<EstimateDetailPage />} />
        <Route path="/estimate-services" element={<EstimateServicesPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AdminLayout>
  );
  }

  // Fallback для неизвестных ролей
  return <LoginPage />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
