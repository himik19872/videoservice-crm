import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Switch, Typography, message, Space, Tag, Divider, Descriptions, Spin, Alert } from 'antd';
import { CloudDownloadOutlined, ReloadOutlined, CheckCircleOutlined, GithubOutlined, SyncOutlined } from '@ant-design/icons';
import api from '../../services/api';

const { Title, Text, Paragraph } = Typography;

const UpdatePage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [checking, setChecking] = useState(false);
  const [settings, setSettings] = useState<any>({});
  const [updateResult, setUpdateResult] = useState<any>(null);
  const [form] = Form.useForm();

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/system-settings/');
      setSettings(res.data);
      form.setFieldsValue(res.data);
    } catch { message.error('Ошибка загрузки настроек'); }
    finally { setLoading(false); }
  };

  const saveSettings = async (values: any) => {
    setSaving(true);
    try {
      await api.put('/system-settings/', values);
      setSettings(values);
      message.success('Настройки сохранены');
    } catch (e: any) { message.error(e?.response?.data?.detail || 'Ошибка сохранения'); }
    finally { setSaving(false); }
  };

  const checkUpdate = async () => {
    setChecking(true);
    setUpdateResult(null);
    try {
      const res = await api.get('/system-settings/check_update/');
      setUpdateResult(res.data);
      if (res.data.has_update) {
        message.info(`Доступно обновление! commit: ${res.data.remote}`);
      } else if (!res.data.error) {
        message.success('У вас актуальная версия');
      }
      fetchSettings();
    } catch (e: any) { message.error('Ошибка проверки'); }
    finally { setChecking(false); }
  };

  const doUpdate = async () => {
    setUpdating(true);
    try {
      const res = await api.post('/system-settings/update_now/');
      if (res.data.ok) {
        message.success('Система обновлена! Перезагрузите страницу.');
        setUpdateResult({ ...res.data, local: res.data.commit });
      } else {
        message.error(res.data.error || 'Ошибка обновления');
      }
    } catch (e: any) { message.error('Ошибка обновления'); }
    finally { setUpdating(false); }
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '40px auto' }} />;

  return (
    <div>
      <Title level={3}><CloudDownloadOutlined /> Обновление системы</Title>

      <Space style={{ marginBottom: 16 }}>
        <Tag color="blue">Текущая версия: {settings.current_version || '1.0.0'}</Tag>
        {settings.latest_commit && <Tag color="geekblue">Коммит: {settings.latest_commit}</Tag>}
        {settings.last_update_check && (
          <Tag color="default">Проверка: {new Date(settings.last_update_check).toLocaleString('ru')}</Tag>
        )}
      </Space>

      <Card title="Настройки GitHub" style={{ marginBottom: 16 }}>
        <Form form={form} layout="vertical" onFinish={saveSettings}>
          <Form.Item name="git_repo_url" label="URL репозитория" help="Поддерживает публичные и приватные репозитории GitHub">
            <Input prefix={<GithubOutlined />} placeholder="https://github.com/user/repo.git" />
          </Form.Item>
          <Form.Item name="git_branch" label="Ветка" initialValue="main">
            <Input placeholder="main" />
          </Form.Item>
          <Form.Item name="git_token" label="GitHub Token (для приватных репозиториев)" help="Создайте Personal Access Token в GitHub Settings → Developer settings">
            <Input.Password placeholder="ghp_..." />
          </Form.Item>
          <Form.Item name="current_version" label="Версия">
            <Input placeholder="1.0.0" />
          </Form.Item>
          <Form.Item name="auto_update_enabled" label="Автоматическое обновление" valuePropName="checked" help="ВНИМАНИЕ: автообновление может прервать активные сессии">
            <Switch checkedChildren="Вкл" unCheckedChildren="Выкл" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={saving}>Сохранить настройки</Button>
        </Form>
      </Card>

      <Card title="Действия" style={{ marginBottom: 16 }}>
        <Space size="large">
          <Button icon={<SyncOutlined />} onClick={checkUpdate} loading={checking} size="large">
            Проверить обновления
          </Button>
          <Button icon={<CloudDownloadOutlined />} type="primary" onClick={doUpdate} loading={updating} size="large" danger>
            Обновить сейчас
          </Button>
        </Space>

        {updateResult && (
          <Card size="small" style={{ marginTop: 16 }}>
            {updateResult.error ? (
              <Alert type="error" message="Ошибка" description={updateResult.error} showIcon />
            ) : updateResult.has_update ? (
              <>
                <Alert type="warning" message="Доступно обновление!" description={`Удалённый коммит: ${updateResult.remote} (локальный: ${updateResult.local})`} showIcon style={{ marginBottom: 12 }} />
                <Button type="primary" danger icon={<CloudDownloadOutlined />} onClick={doUpdate} loading={updating}>Обновить сейчас</Button>
              </>
            ) : (
              <Alert type="success" message="Система актуальна" description="У вас последняя версия из репозитория." showIcon />
            )}
            {updateResult.output && (
              <Card size="small" title="Результат git pull" style={{ marginTop: 12 }}>
                <pre style={{ fontSize: 11, maxHeight: 200, overflow: 'auto', whiteSpace: 'pre-wrap' }}>{updateResult.output}</pre>
              </Card>
            )}
          </Card>
        )}
      </Card>

      <Card title="Как это работает" size="small">
        <Paragraph>
          <Text strong>Ручное обновление:</Text> Укажите URL вашего GitHub-репозитория и ветку. При нажатии «Обновить сейчас» система выполнит <Text code>git pull</Text> и перезапустит веб-сервер.
        </Paragraph>
        <Paragraph>
          <Text strong>Приватный репозиторий:</Text> Создайте <a href="https://github.com/settings/tokens" target="_blank" rel="noreferrer">Personal Access Token</a> с правами <Text code>repo</Text> и вставьте его в поле GitHub Token. URL будет автоматически преобразован.
        </Paragraph>
        <Paragraph>
          <Text strong>Автообновление:</Text> Если включено — система будет проверять обновления раз в час и автоматически применять их.
        </Paragraph>
      </Card>
    </div>
  );
};

export default UpdatePage;
