import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Switch, Typography, message, Spin, Tag } from 'antd';
import { SettingOutlined, SendOutlined } from '@ant-design/icons';
import api from '../../services/api';

const { Title, Text } = Typography;

const MaxSettingsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await api.get('/max-settings/');
      setSettings(res.data);
      form.setFieldsValue({
        bot_token: res.data.bot_token || '',
        bot_name: res.data.bot_name || 'CRM Bot',
        is_active: res.data.is_active || false,
        api_base_url: res.data.api_base_url || 'https://business.max.ru',
      });
    } catch (e) {
      // Настройки ещё не созданы — ок
    } finally {
      setLoading(false);
    }
  };

  const onFinish = async (values: any) => {
    setSaving(true);
    try {
      if (settings?.id) {
        await api.patch(`/max-settings/${settings.id}/`, values);
      } else {
        await api.post('/max-settings/', values);
      }
      message.success('Настройки Max сохранены');
      fetchSettings();
    } catch (e: any) {
      message.error(e?.response?.data?.error || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    try {
      await api.post('/max-settings/test/');
      message.success('Тестовое сообщение отправлено');
    } catch (e: any) {
      message.error(e?.response?.data?.error || 'Ошибка теста');
    }
  };

  if (loading) return <Spin style={{ display: 'block', margin: '40px auto' }} />;

  return (
    <Card>
      <Title level={3}><SettingOutlined /> Настройки Max бота</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
        Max — мессенджер (аналог Telegram). Бот отправляет уведомления клиентам о статусе заявок.
        <br />
        Получить токен: <a href="https://dev.max.ru" target="_blank" rel="noreferrer">dev.max.ru</a>
      </Text>

      <Form form={form} layout="vertical" onFinish={onFinish} style={{ maxWidth: 500 }}>
        <Form.Item name="is_active" label="Бот активен" valuePropName="checked">
          <Switch />
        </Form.Item>
        <Form.Item name="bot_name" label="Имя бота">
          <Input placeholder="CRM Bot" />
        </Form.Item>
        <Form.Item
          name="bot_token"
          label="Токен бота"
          rules={[{ required: true, message: 'Введите токен' }]}
        >
          <Input.Password placeholder="Вставьте токен из Max" />
        </Form.Item>
        <Form.Item name="api_base_url" label="API URL">
          <Input placeholder="https://business.max.ru" />
        </Form.Item>

        <Button type="primary" htmlType="submit" loading={saving} icon={<SettingOutlined />}>
          Сохранить
        </Button>
        <Button onClick={handleTest} style={{ marginLeft: 8 }} icon={<SendOutlined />}>
          Тест-уведомление
        </Button>
      </Form>

      {settings?.id && (
        <div style={{ marginTop: 16 }}>
          <Tag color={settings.is_active ? 'green' : 'red'}>
            {settings.is_active ? '🟢 Активен' : '🔴 Не активен'}
          </Tag>
        </div>
      )}
    </Card>
  );
};

export default MaxSettingsPage;
