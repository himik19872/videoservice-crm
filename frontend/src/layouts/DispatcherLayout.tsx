import React from 'react';
import { Layout, Menu, theme, Typography, Space, Avatar } from 'antd';
import {
  DashboardOutlined,
  OrderedListOutlined,
  UsergroupAddOutlined,
  AppstoreOutlined,
  TeamOutlined,
  EnvironmentOutlined,
  UserOutlined,
  HomeOutlined,
  BarChartOutlined,
  CheckCircleOutlined, FileExcelOutlined, DollarOutlined,
  FileTextOutlined, BankOutlined, ShopOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { getEffectivePermissions, roleName } from '../utils/access';

const { Header, Content, Sider } = Layout;
const { Text } = Typography;

interface DispatcherLayoutProps {
  children: React.ReactNode;
}

const DispatcherLayout: React.FC<DispatcherLayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { token } = theme.useToken();

  const menuItems = [
    {
      key: '/',
      icon: <DashboardOutlined />,
      label: 'Главная',
    },
    {
      key: '/orders',
      icon: <OrderedListOutlined />,
      label: 'Заявки',
      perm: 'orders_view_all',
    },
    {
      key: '/orders/confirm',
      icon: <CheckCircleOutlined />,
      label: 'Подтверждение заявок',
      perm: 'orders_confirm',
    },
    {
      key: '/orders/create',
      icon: <AppstoreOutlined />,
      label: 'Новая заявка',
      perm: 'orders_create',
    },
    {
      key: '/clients',
      icon: <UsergroupAddOutlined />,
      label: 'Клиенты',
      perm: 'clients_view',
    },
    {
      key: '/clients/create',
      icon: <AppstoreOutlined />,
      label: 'Новый клиент',
      perm: 'clients_create',
    },
    {
      key: '/equipment',
      icon: <AppstoreOutlined />,
      label: 'Оборудование',
      perm: 'equipment_view',
    },
    {
      key: '/masters',
      icon: <TeamOutlined />,
      label: 'Мастера',
      perm: 'masters_view',
    },
    {
      key: '/regions',
      icon: <EnvironmentOutlined />,
      label: 'Районы',
      perm: 'buildings_view',
    },
    {
      key: '/buildings',
      icon: <HomeOutlined />,
      label: 'Дома',
      perm: 'buildings_view',
    },
    {
      key: '/reports',
      icon: <BarChartOutlined />,
      label: 'Отчёты',
      perm: 'reports_view',
    },
    {
      key: '/estimates',
      icon: <FileTextOutlined />,
      label: 'Сметы и КП',
      perm: 'estimates_view',
    },
    {
      key: '/tariffs',
      icon: <DollarOutlined />,
      label: 'Тарифы',
      perm: 'tariffs_view',
    },
    {
      key: '/management-companies',
      icon: <BankOutlined />,
      label: 'УК / ТСЖ',
      perm: 'companies_view',
    },
    {
      key: '/legal-entities',
      icon: <ShopOutlined />,
      label: 'Юрлица',
      perm: 'clients_view',
    },
    {
      key: '/import',
      icon: <FileExcelOutlined />,
      label: 'Импорт',
      perm: 'clients_create',
    },
    {
      key: '/erc-payments',
      icon: <DollarOutlined />,
      label: 'ЕРЦ',
      perm: 'payments_view',
    },
    {
      key: '/storage-locations',
      icon: <EnvironmentOutlined />,
      label: 'Места хранения',
      perm: 'inventory_view',
    },
  ];

  // Показываем только те пункты, на которые у сотрудника есть право
  const allowedPermissions = getEffectivePermissions(
    user?.role,
    (user as any)?.profile?.permissions || {},
  );
  const visibleMenuItems = menuItems
    .filter((item: any) => !item.perm || allowedPermissions.has(item.perm))
    .map(({ perm, ...rest }: any) => rest);

  const handleMenuClick = ({ key }: { key: string }) => {
    navigate(key);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={220} theme="dark">
        <div style={{ color: 'white', padding: '16px', fontSize: '20px', fontWeight: 'bold' }}>
          CRM
        </div>
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={visibleMenuItems}
          onClick={handleMenuClick}
          style={{ borderRight: 0 }}
        />
        <div style={{ padding: 16, borderTop: `1px solid ${token.colorSplit}` }}>
          <Space>
            <Avatar icon={<UserOutlined />}>
              {user?.first_name?.[0] || user?.username?.[0]}
            </Avatar>
            <div>
              <Text strong>{user?.first_name || user?.username}</Text>
              <br />
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {roleName(user?.role)}
              </Text>
            </div>
          </Space>
        </div>
        <div style={{ padding: 16 }}>
          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              padding: '8px',
              backgroundColor: '#ff4d4f',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Выйти
          </button>
        </div>
      </Sider>
      <Layout>
        <Header style={{ background: token.colorBgLayout, padding: '0 24px' }}>
          <Text style={{ fontSize: '18px', fontWeight: '500' }}>
            {menuItems.find(item => item.key === location.pathname)?.label}
          </Text>
        </Header>
        <Content style={{ margin: '24px', background: token.colorBgLayout, minHeight: 280 }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};

export default DispatcherLayout;
