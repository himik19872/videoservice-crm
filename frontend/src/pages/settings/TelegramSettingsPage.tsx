import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Switch, Typography, message, Spin, Tag, Alert, Space, Table } from 'antd';
import { SettingOutlined, SendOutlined, LinkOutlined, ApiOutlined } from '@ant-design/icons';
import api from '../../services/api';

const { Title, Text } = Typography;

const TelegramSettingsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [form] = Form.useForm();
  const [myCode, setMyCode] = useState<any>(null);
  const [links, setLinks] = useState<any[]>([]);
  const [webhookLoading, setWebhookLoading] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchLinks();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await api.get('/telegram-settings/');
      setSettings(res.data);
      form.setFieldsValue({
        bot_token: res.data.bot_token || '',
        bot_username: res.data.bot_username || '',
        bot_name: res.data.bot_name || 'CRM Bot',
        is_active: res.data.is_active || false,
      });
    } catch (e) {
      // ещё не настроено
    } finally {
      setLoading(false);
    }
  };

  const fetchLinks = async () => {
    try {
      const res = await api.get('/telegram-settings/links/');
      setLinks(res.data.links || []);
    } catch (e) { /* нет прав */ }
  };

  const onFinish = async (values: any) => {
    setSaving(true);
    try {
      if (settings?.id) {
        await api.patch(`/telegram-settings/${settings.id}/`, values);
      } else {
        await api.post('/telegram-settings/', values);
      }
      message.success('Настройки Telegram сохранены');
      fetchSettings();
    } catch (e: any) {
      message.error(e?.response?.data?.error || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    try {
      await api.post('/telegram-settings/test/');
      message.success('Тестовое сообщение отправлено в ваш Telegram');
    } catch (e: any) {
      message.error(e?.response?.data?.error || 'Ошибка теста');
    }
  };

  const handleLinkMe = async () => {
    try {
      const res = await api.post('/telegram-settings/link_me/');
      setMyCode(res.data);
      message.success('Код привязки сгенерирован');
    } catch (e: any) {
      message.error(e?.response?.data?.error || 'Ошибка');
    }
  };

  const handleSetWebhook = async () => {
    setWebhookLoading(true);
    try {
      const res = await api.post('/telegram-settings/set_webhook/', {});
      message.success('Webhook установлен: ' + res.data.webhook);
    } catch (e: any) {
      message.error(e?.response?.data?.error || 'Ошибка установки webhook');
    } finally {
      setWebhookLoading(false);
    }
  };

  if (loading) return <Spin style={{ display: 'block', margin: '40px auto' }} />;

  const linkColumns = [
    { title: 'Сотрудник', dataIndex: 'name', key: 'name' },
    { title: 'Telegram', dataIndex: 'username', key: 'username', render: (v: string) => v ? '@' + v : '—' },
    { title: 'Привязан', dataIndex: 'linked_at', key: 'linked_at', render: (v: string) => v ? new Date(v).toLocaleString('ru-RU') : '—' },
  ];

  return (
    <div>
      <Card>
        <Title level={3}><SettingOutlined /> Настройки Telegram-бота</Title>
        <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
          Telegram-бот отправляет уведомления сотрудникам (о заявках, сообщениях чата и т.п.).
          Токен получают у <a href="https://t.me/BotFather" target="_blank" rel="noreferrer">@BotFather</a> (команда /newbot).
        </Text>

        <Form form={form} layout="vertical" onFinish={onFinish} style={{ maxWidth: 520 }}>
          <Form.Item name="is_active" label="Бот активен" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="bot_name" label="Имя бота">
            <Input placeholder="VideoService Bot" />
          </Form.Item>
          <Form.Item name="bot_username" label="Username бота (без @)">
            <Input placeholder="VideoServiceBot" />
          </Form.Item>
          <Form.Item name="bot_token" label="Токен бота" rules={[{ required: true, message: 'Введите токен' }]}>
            <Input.Password placeholder="123456:ABC-DEF..." />
          </Form.Item>

          <Space>
            <Button type="primary" htmlType="submit" loading={saving} icon={<SettingOutlined />}>Сохранить</Button>
            <Button icon={<ApiOutlined />} loading={webhookLoading} onClick={handleSetWebhook}>Установить webhook</Button>
            <Button icon={<SendOutlined />} onClick={handleTest}>Тест-уведомление</Button>
          </Space>
        </Form>

        {settings?.id && (
          <div style={{ marginTop: 12 }}>
            <Tag color={settings.is_active ? 'green' : 'red'}>{settings.is_active ? '🟢 Активен' : '🔴 Не активен'}</Tag>
          </div>
        )}
      </Card>

      <Card title="🔗 Привязка сотрудников" style={{ marginTop: 16 }}>
        <Alert
          type="info"
          showIcon
          message="Как привязать сотрудника к Telegram"
          description="Сотрудник жмёт «Привязать меня», получает код, открывает бота и отправляет ему /start <код>. После этого уведомления начнут приходить ему в Telegram."
          style={{ marginBottom: 16 }}
        />
        <Space style={{ marginBottom: 16 }}>
          <Button icon={<LinkOutlined />} onClick={handleLinkMe}>Привязать меня (мой код)</Button>
          {myCode?.code && (
            <>
              <Tag color="blue">Код: <b style={{ fontFamily: 'monospace' }}>{myCode.code}</b></Tag>
              {myCode.link && (
                <Button type="link" href={myCode.link} target="_blank">Открыть бота → {myCode.link}</Button>
              )}
            </>
          )}
        </Space>

        <Table
          columns={linkColumns}
          dataSource={links}
          rowKey="user_id"
          size="small"
          pagination={false}
          locale={{ emptyText: 'Пока никто не привязан' }}
        />
      </Card>
    </div>
  );
};

export default TelegramSettingsPage;
