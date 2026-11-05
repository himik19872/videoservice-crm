import React from 'react';
import { Layout, Menu, theme, Typography, Space, Avatar } from 'antd';
import {
  DashboardOutlined, OrderedListOutlined, UsergroupAddOutlined,
  AppstoreOutlined, TeamOutlined, EnvironmentOutlined,
  BarChartOutlined, SettingOutlined, ShopOutlined, DollarOutlined,
  HomeOutlined, CalendarOutlined, MessageOutlined, CalculatorOutlined, ToolOutlined, BankOutlined, FileTextOutlined,
  UserOutlined, CheckCircleOutlined, FileExcelOutlined, HddOutlined,
  PhoneOutlined, ApartmentOutlined, SwapOutlined, SafetyCertificateOutlined,
  AuditOutlined, BookOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { roleName } from '../utils/access';

const { Header, Content, Sider } = Layout;
const { Text } = Typography;

interface AdminLayoutProps {
  children: React.ReactNode;
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children }) => {
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
      key: '/clients',
      icon: <UsergroupAddOutlined />,
      label: 'Клиенты',
    },
    {
      key: '/legal-entities',
      icon: <BankOutlined />,
      label: 'Юрлица',
    },
    {
      key: '/equipment',
      icon: <AppstoreOutlined />,
      label: 'Оборудование у клиентов',
    },
    {
      key: '/masters',
      icon: <TeamOutlined />,
      label: 'Мастера',
    },
    {
      key: '/dispatchers',
      icon: <UsergroupAddOutlined />,
      label: 'Диспетчеры',
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
      key: '/management-companies',
      icon: <BankOutlined />,
      label: 'УК / ТСЖ',
    },
    {
      key: '/entrances',
      icon: <ApartmentOutlined />,
      label: 'Подъезды',
    },
    {
      key: '/tariffs',
      icon: <DollarOutlined />,
      label: 'Тарифы',
    },
    {
      key: '/beward-devices',
      icon: <SafetyCertificateOutlined />,
      label: 'Beward IP',
    },
    {
      key: '/inventory',
      icon: <ShopOutlined />,
      label: 'Склад',
    },
    {
      key: '/estimates',
      icon: <CalculatorOutlined />,
      label: 'Сметы и КП',
    },
    {
      key: '/estimate-services',
      icon: <ToolOutlined />,
      label: 'Справочник услуг',
    },
    {
      key: '/finance',
      icon: <DollarOutlined />,
      label: 'Финансы',
    },
    {
      key: '/calendar',
      icon: <CalendarOutlined />,
      label: 'Календарь',
    },
    {
      key: '/messages',
      icon: <MessageOutlined />,
      label: 'Сообщения',
    },
    {
      key: '/instructions',
      icon: <BookOutlined />,
      label: 'Инструкции',
    },
    {
      key: '/reports',
      icon: <BarChartOutlined />,
      label: 'Отчёты',
    },
    {
      key: '/audit-log',
      icon: <AuditOutlined />,
      label: 'Журнал действий',
    },
    {
      key: '/import',
      icon: <FileExcelOutlined />,
      label: 'Импорт',
    },
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: 'Настройки',
      children: [
        {
          key: '/settings/system',
          icon: <SettingOutlined />,
          label: 'Системные настройки',
        },
        {
          key: '/settings/estimate-template',
          icon: <FileTextOutlined />,
          label: 'Шаблон КП',
        },
        {
          key: '/storage-locations',
          icon: <EnvironmentOutlined />,
          label: 'Места хранения',
        },
        {
          key: '/settings/traccar',
          icon: <EnvironmentOutlined />,
          label: 'Traccar GPS',
        },
        {
          key: '/settings/telegram',
          icon: <MessageOutlined />,
          label: 'Telegram-бот',
        },
        {
          key: '/settings/asterisk',
          icon: <PhoneOutlined />,
          label: 'Asterisk PBX',
        },
        {
          key: '/settings/update',
          icon: <HddOutlined />,
          label: 'Обновление приложения',
        },
        {
          key: '/settings/stats',
          icon: <HddOutlined />,
          label: 'Статистика сервера',
        },
        {
          key: '/settings/migration',
          icon: <SwapOutlined />,
          label: 'Миграция',
        },
        {
          key: '/settings/admin',
          icon: <SafetyCertificateOutlined />,
          label: 'Пользователи и права',
        },
      ],
    },
  ];

  /** Заголовок страницы: ищем пункт меню, включая подменю */
  const currentTitle = (() => {
    const flat: any[] = [];
    menuItems.forEach((item: any) => {
      if (item.children) flat.push(...item.children);
      else flat.push(item);
    });
    return flat.find(item => item.key === location.pathname)?.label || '';
  })();

  const settingsOpen = location.pathname.startsWith('/settings')
    || location.pathname.startsWith('/storage-locations');

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
          defaultOpenKeys={settingsOpen ? ['settings'] : []}
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
            {currentTitle}
          </Text>
        </Header>
        <Content style={{ margin: '24px', background: token.colorBgLayout, minHeight: 280 }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};

export default AdminLayout;
