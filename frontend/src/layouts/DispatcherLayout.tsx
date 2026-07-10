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
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

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
    },
    {
      key: '/orders/confirm',
      icon: <CheckCircleOutlined />,
      label: 'Подтверждение заявок',
    },
    {
      key: '/orders/create',
      icon: <AppstoreOutlined />,
      label: 'Новая заявка',
    },
    {
      key: '/clients',
      icon: <UsergroupAddOutlined />,
      label: 'Клиенты',
    },
    {
      key: '/clients/create',
      icon: <AppstoreOutlined />,
      label: 'Новый клиент',
    },
    {
      key: '/equipment',
      icon: <AppstoreOutlined />,
      label: 'Оборудование',
    },
    {
      key: '/masters',
      icon: <TeamOutlined />,
      label: 'Мастера',
    },
    {
      key: '/regions',
      icon: <EnvironmentOutlined />,
      label: 'Районы',
    },
    {
      key: '/buildings',
      icon: <HomeOutlined />,
      label: 'Дома',
    },
    {
      key: '/reports',
      icon: <BarChartOutlined />,
      label: 'Отчёты',
    },
    {
      key: '/import',
      icon: <FileExcelOutlined />,
      label: 'Импорт',
    },
    {
      key: '/erc-payments',
      icon: <DollarOutlined />,
      label: 'ЕРЦ',
    },
  ];

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
          items={menuItems}
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
                Диспетчер
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
