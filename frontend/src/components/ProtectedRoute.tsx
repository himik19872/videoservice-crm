import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Spin, Typography, Button } from 'antd';

const { Text } = Typography;

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'admin' | 'dispatcher' | 'master';
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole,
}) => {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Сотруднику разрешён только мобильный доступ — веб-интерфейс закрыт
  const accessScope = (user as any)?.profile?.access_scope || 'both';
  if (accessScope === 'mobile') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, justifyContent: 'center', alignItems: 'center', height: '100vh', padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 44 }}>📱</div>
        <Text strong style={{ fontSize: 18 }}>Доступ только в мобильном приложении</Text>
        <Text type="secondary">
          Вашей учётной записи запрещён вход в веб-интерфейс. Используйте мобильное приложение
          ВидеоСервис или обратитесь к администратору.
        </Text>
        <Button onClick={() => { localStorage.removeItem('token'); window.location.href = '/login'; }}>
          Выйти
        </Button>
      </div>
    );
  }

  if (requiredRole && user?.role !== requiredRole) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
