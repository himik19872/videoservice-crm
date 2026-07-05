import React from 'react';
import { Form, Input, Button, Typography, Card, Divider, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const { Title, Text } = Typography;

const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form] = Form.useForm();

  const onFinish = async (values: { username: string; password: string }) => {
    try {
      await login(values.username, values.password);
      message.success('Вход выполнен успешно');
      navigate('/');
    } catch (error) {
      message.error((error as Error).message || 'Ошибка при входе');
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      }}
    >
      <Card
        style={{ width: 400, borderRadius: 12, boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}
        bodyStyle={{ padding: '40px' }}
      >
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Title level={2} style={{ color: '#1890ff', marginBottom: 8 }}>
            CRM Система
          </Title>
          <Text type="secondary">Вход в систему управления</Text>
        </div>

        <Form
          form={form}
          name="login"
          initialValues={{ remember: true }}
          onFinish={onFinish}
          layout="vertical"
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: 'Введите имя пользователя' }]}
          >
            <Input
              prefix={<UserOutlined style={{ color: '#1890ff' }} />}
              placeholder="Имя пользователя"
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: 'Введите пароль' }]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: '#1890ff' }} />}
              placeholder="Пароль"
              size="large"
            />
          </Form.Item>

          <Form.Item style={{ marginTop: 24 }}>
            <Button
              type="primary"
              htmlType="submit"
              block
              size="large"
              style={{ backgroundColor: '#1890ff', fontWeight: 'bold' }}
            >
              Войти
            </Button>
          </Form.Item>

          <Divider style={{ margin: '24px 0' }}>Демо учетные данные</Divider>

          <div style={{ fontSize: 12, color: '#8c8c8c' }}>
            <p>
              <strong>Администратор:</strong> admin / admin123
            </p>
            <p>
              <strong>Диспетчер:</strong> dispatcher / dispatcher123
            </p>
            <p>
              <strong>Мастер:</strong> master / master123
            </p>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default LoginPage;
