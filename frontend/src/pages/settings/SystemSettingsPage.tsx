import React, { useState, useEffect } from 'react';
import {
  Card, Form, Input, Button, Switch, Typography, message, Spin, Tabs, Tag, InputNumber,
  Divider, Row, Col,
} from 'antd';
import {
  SettingOutlined, GlobalOutlined, ApiOutlined, SafetyOutlined,
  EnvironmentOutlined, MessageOutlined, AimOutlined,
} from '@ant-design/icons';
import api from '../../services/api';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

const SettingsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<any>({});
  const [form] = Form.useForm();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const res = await api.get('/system-settings/');
      setSettings(res.data);
      form.setFieldsValue(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const onFinish = async (values: any) => {
    setSaving(true);
    try {
      await api.put(`/system-settings/${settings.id || 1}/`, values);
      message.success('Настройки сохранены');
      fetchSettings();
    } catch (e: any) {
      message.error(e?.response?.data?.error || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Spin style={{ display: 'block', margin: '40px auto' }} />;

  return (
    <Card>
      <Title level={3}><SettingOutlined /> Настройки системы</Title>

      <Form form={form} layout="vertical" onFinish={onFinish} style={{ maxWidth: 700 }}>

        <Tabs defaultActiveKey="network">
          <TabPane tab={<span><GlobalOutlined /> Сеть</span>} key="network">
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="external_ip" label="Внешний IP">
                  <Input placeholder="83.243.73.86" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="internal_ip" label="Внутренний IP">
                  <Input placeholder="192.168.1.38" />
                </Form.Item>
              </Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="external_port" label="Внешний порт">
                  <InputNumber min={1} max={65535} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="internal_port" label="Внутренний порт">
                  <InputNumber min={1} max={65535} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="dns_name" label="DNS-имя">
              <Input placeholder="crm.mydomain.ru" />
            </Form.Item>
            <Form.Item name="api_base_url" label="API base URL">
              <Input placeholder="/api" />
            </Form.Item>
          </TabPane>

          <TabPane tab={<span><ApiOutlined /> Внешние API</span>} key="api">
            <Divider>DaData (подсказки адресов)</Divider>
            <Form.Item name="dadata_token" label="DaData API токен">
              <Input.Password placeholder="Token xxx..." />
            </Form.Item>
            <Form.Item name="dadata_secret" label="DaData секретный ключ">
              <Input.Password placeholder="Secret xxx..." />
            </Form.Item>

            <Divider>Max (мессенджер)</Divider>
            <Form.Item name="max_bot_active" label="Max бот активен" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="max_bot_name" label="Имя бота">
              <Input placeholder="CRM Bot" />
            </Form.Item>
            <Form.Item name="max_bot_token" label="Токен бота Max">
              <Input.Password placeholder="Вставьте токен..." />
            </Form.Item>
            <Form.Item name="max_api_url" label="Max API URL">
              <Input placeholder="https://business.max.ru" />
            </Form.Item>

            <Divider>Traccar (GPS-трекеры)</Divider>
            <Form.Item name="traccar_active" label="Traccar активен" valuePropName="checked">
              <Switch />
            </Form.Item>
            <Form.Item name="traccar_url" label="Traccar URL">
              <Input placeholder="http://traccar.example.com:8082" />
            </Form.Item>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="traccar_user" label="Логин">
                  <Input placeholder="admin" />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="traccar_pass" label="Пароль">
                  <Input.Password placeholder="..." />
                </Form.Item>
              </Col>
            </Row>
          </TabPane>

          <TabPane tab={<span><SafetyOutlined /> Медиа</span>} key="media">
            <Form.Item name="media_max_size_mb" label="Макс. размер файла (МБ)">
              <InputNumber min={1} max={500} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="media_allowed_types" label="Разрешённые типы">
              <Input placeholder="jpg,jpeg,png,mp4,mov,avi" />
            </Form.Item>
            <Form.Item name="media_retention_days" label="Хранить дней">
              <InputNumber min={1} max={365} style={{ width: '100%' }} />
            </Form.Item>
          </TabPane>
        </Tabs>

        <Divider />
        <Button type="primary" htmlType="submit" loading={saving} icon={<SettingOutlined />} size="large">
          Сохранить все настройки
        </Button>
      </Form>
    </Card>
  );
};

export default SettingsPage;
