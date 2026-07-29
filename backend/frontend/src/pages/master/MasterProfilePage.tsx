import React from 'react';
import { Card, Typography, Descriptions, Avatar, Space, Button, message } from 'antd';
import { EditOutlined, UserOutlined } from '@ant-design/icons';
import { useAuth } from '../../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

const MasterProfilePage: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user?.master_profile) {
    return (
      <Card>
        <Title level={3}>Профиль</Title>
        <Text>Профиль мастера не найден</Text>
      </Card>
    );
  }

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <Card>
      <Title level={3}>Мой профиль</Title>

      <Space size="large">
        <Avatar size={80} icon={<UserOutlined />} />
        <div>
          <Title level={4}>
            {user.first_name || user.username}
          </Title>
          <Text type="secondary">{user.email}</Text>
          <br />
          <Text type="secondary">{user.master_profile.phone}</Text>
        </div>
      </Space>

      <div style={{ marginTop: 32 }}>
        <Descriptions title="Информация о мастере" column={2} size="small">
          <Descriptions.Item label="ФИО">
            {user?.first_name || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Телефон">
            {user.master_profile.phone || '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Район">
            {user.master_profile.region || 'Не указан'}
          </Descriptions.Item>
        </Descriptions>
      </div>

      <div style={{ marginTop: 32 }}>
        <Button icon={<EditOutlined />} onClick={() => navigate('/profile/edit')}>
          Редактировать профиль
        </Button>
        <Button style={{ marginLeft: 8 }} danger onClick={handleLogout}>
          Выйти
        </Button>
      </div>
    </Card>
  );
};

export default MasterProfilePage;
