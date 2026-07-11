import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Tabs, Table, Button, Modal, Form, Input, Select, Switch,
  Space, Tag, message, Popconfirm, Descriptions, Alert, Spin,
  InputNumber, Divider, Typography,
} from 'antd';
import {
  PhoneOutlined, UserOutlined, ApiOutlined, SettingOutlined,
  PlusOutlined, DeleteOutlined, EditOutlined, ReloadOutlined,
  NodeIndexOutlined, BranchesOutlined,
  MailOutlined, PlayCircleOutlined, SendOutlined, DashboardOutlined,
} from '@ant-design/icons';
import api from '../../services/api';

const { Text, Paragraph } = Typography;
const { TextArea } = Input;
const { Option } = Select;

const TRANSPORT_OPTIONS = [{ value: 'udp', label: 'UDP' }, { value: 'tcp', label: 'TCP' }, { value: 'tls', label: 'TLS' }];
const CODEC_OPTIONS = [
  { value: 'ulaw,alaw', label: 'G.711 (ulaw + alaw)' },
  { value: 'ulaw,alaw,g722', label: 'HD Voice (G.722)' },
  { value: 'ulaw,alaw,gsm', label: 'G.711 + GSM' },
  { value: 'opus,ulaw,alaw', label: 'Opus + G.711' },
];
const DIRECTION_OPTIONS = [
  { value: 'inbound', label: 'Входящий' }, { value: 'outbound', label: 'Исходящий' }, { value: 'internal', label: 'Внутренний' }
];
const MATCH_PATTERNS = [
  { value: '_X.', label: 'Любой номер' },
  { value: '_8XXXXXXXXXX', label: 'Местный (8XXXXXXXXXX)' },
  { value: '_+7XXXXXXXXXX', label: 'Мобильный (+7XXXXXXXXXX)' },
  { value: '_8XXXXXXXXXXX', label: 'Мобильный (8XXXXXXXXXXX)' },
  { value: '_XXXX', label: 'Внутренний (короткий)' },
];
const IVR_ACTIONS = [
  { value: 'extension', label: 'Внутренний номер' }, { value: 'queue', label: 'Очередь' },
  { value: 'ivr', label: 'Под-меню (IVR)' }, { value: 'playback', label: 'Проиграть аудио' },
  { value: 'voicemail', label: 'Голосовая почта' }, { value: 'hangup', label: 'Завершить звонок' },
  { value: 'dial', label: 'Набрать номер' },
];

const AsteriskSettingsPage: React.FC = () => {
  const [dashboard, setDashboard] = useState<any>(null);
  const [dashLoading, setDashLoading] = useState(false);
  const [sipPeers, setSipPeers] = useState<any[]>([]);
  const [trunks, setTrunks] = useState<any[]>([]);
  const [routes, setRoutes] = useState<any[]>([]);
  const [ivrs, setIvrs] = useState<any[]>([]);
  const [voicemails, setVoicemails] = useState<any[]>([]);
  const [recordings, setRecordings] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState<string>('');
  const [editingItem, setEditingItem] = useState<any>(null);
  const [form] = Form.useForm();
  const [ivrOptionModal, setIvrOptionModal] = useState(false);
  const [ivrOptionIvr, setIvrOptionIvr] = useState<any>(null);
  const [ivrOptionForm] = Form.useForm();
  const [configPreview, setConfigPreview] = useState<any>(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);

  // Настройки подключения к Asterisk (из SystemSettings)
  const [serverForm] = Form.useForm();
  const [serverSaving, setServerSaving] = useState(false);
  const [serverSettings, setServerSettings] = useState<any>(null);
  const [serverLoading, setServerLoading] = useState(false);

  // Загрузка настроек сервера из SystemSettings
  const loadServerSettings = useCallback(async () => {
    setServerLoading(true);
    try {
      const res = await api.get('/system-settings/');
      const s = res.data;
      setServerSettings(s);
      serverForm.setFieldsValue({
        asterisk_host: s.asterisk_host || '',
        asterisk_port: s.asterisk_port || 5038,
        asterisk_user: s.asterisk_user || '',
        asterisk_secret: s.asterisk_secret || '',
        asterisk_active: s.asterisk_active || false,
      });
    } catch (e) { console.error(e); }
    finally { setServerLoading(false); }
  }, [serverForm]);

  const handleSaveServer = async () => {
    try {
      const values = await serverForm.validateFields();
      setServerSaving(true);
      await api.patch('/system-settings/', values);
      message.success('Настройки подключения сохранены');
      loadServerSettings();
      loadDashboard();
    } catch (e: any) {
      message.error(e.response?.data?.detail || 'Ошибка сохранения');
    } finally { setServerSaving(false); }
  };

  const loadDashboard = useCallback(async () => {
    setDashLoading(true);
    try { const res = await api.get('/asterisk/dashboard/'); setDashboard(res.data); } catch (e) { console.error(e); }
    finally { setDashLoading(false); }
  }, []);

  const loadData = useCallback(async (endpoint: string, setter: Function) => {
    setLoading(true);
    try { const res = await api.get(endpoint); setter(res.data.results || res.data || []); } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  const loadAll = useCallback(() => {
    loadServerSettings();
    loadDashboard();
    loadData('/asterisk/sip-peers/', setSipPeers);
    loadData('/asterisk/trunks/', setTrunks);
    loadData('/asterisk/routes/', setRoutes);
    loadData('/asterisk/ivrs/', setIvrs);
    loadData('/asterisk/voicemails/', setVoicemails);
    loadData('/asterisk/recordings/', setRecordings);
  }, [loadServerSettings, loadDashboard, loadData]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const getEndpoint = (type: string): string => {
    const map: Record<string, string> = { sip: '/asterisk/sip-peers/', trunk: '/asterisk/trunks/', route: '/asterisk/routes/', ivr: '/asterisk/ivrs/', voicemail: '/asterisk/voicemails/' };
    return map[type] || '';
  };

  const openModal = (type: string, item?: any) => { setModalType(type); setEditingItem(item || null); form.resetFields(); if (item) form.setFieldsValue(item); setModalOpen(true); };

  const handleDelete = async (type: string, id: number) => {
    try { await api.delete(`${getEndpoint(type)}${id}/`); message.success('Удалено'); loadAll(); } catch (e: any) { message.error(e.response?.data?.detail || 'Ошибка'); }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      const endpoint = getEndpoint(modalType);
      if (editingItem?.id) { await api.patch(`${endpoint}${editingItem.id}/`, values); } else { await api.post(endpoint, values); }
      message.success('Сохранено'); setModalOpen(false); loadAll();
    } catch (e: any) { if (e.response) message.error(e.response?.data?.detail || 'Ошибка'); }
  };

  const openIvrOptionModal = (ivr: any) => { setIvrOptionIvr(ivr); ivrOptionForm.resetFields(); setIvrOptionModal(true); };

  const handleAddIvrOption = async () => {
    try {
      const values = await ivrOptionForm.validateFields();
      await api.post(`/asterisk/ivrs/${ivrOptionIvr.id}/add_option/`, values);
      message.success('Опция добавлена'); setIvrOptionModal(false); loadAll();
    } catch (e: any) { if (e.response) message.error(e.response?.data?.detail || 'Ошибка'); }
  };

  const handleRemoveIvrOption = async (ivrId: number, optionId: number) => {
    try { await api.delete(`/asterisk/ivrs/${ivrId}/remove-option/${optionId}/`); message.success('Опция удалена'); loadAll(); } catch { message.error('Ошибка'); }
  };

  const handleGenerateConfigs = async () => {
    setConfigLoading(true);
    try { const res = await api.post('/asterisk/generate-configs/'); setConfigPreview(res.data); } catch { message.error('Ошибка'); }
    finally { setConfigLoading(false); }
  };

  const handlePushConfigs = async () => {
    setPushLoading(true);
    try {
      const res = await api.post('/asterisk/push-configs/');
      if (res.data.success) { message.success('Конфиги отправлены и Asterisk перезагружен!'); } else { message.warning('Частично: ' + JSON.stringify(res.data.errors)); }
      setConfigPreview(null);
    } catch { message.error('Ошибка отправки'); }
    finally { setPushLoading(false); }
  };

  const renderModalTitle = () => {
    const titles: Record<string, string> = {
      sip: editingItem ? 'Редактировать SIP-аккаунт' : 'Новый SIP-аккаунт',
      trunk: editingItem ? 'Редактировать транк' : 'Новый транк',
      route: editingItem ? 'Редактировать маршрут' : 'Новый маршрут',
      ivr: editingItem ? 'Редактировать IVR' : 'Новое IVR-меню',
      voicemail: editingItem ? 'Редактировать автоответчик' : 'Новый автоответчик',
    };
    return titles[modalType] || '';
  };

  const renderModalContent = () => {
    switch (modalType) {
      case 'sip':
        return <>
          <Form.Item name="name" label="Номер" rules={[{ required: true }]}><Input placeholder="101" /></Form.Item>
          <Form.Item name="display_name" label="Имя"><Input placeholder="Иван Петров" /></Form.Item>
          <Form.Item name="secret" label="Пароль"><Input.Password placeholder="Автогенерация если пусто" /></Form.Item>
          <Form.Item name="caller_id" label="Caller ID"><Input placeholder="+74951112233" /></Form.Item>
          <Form.Item name="codecs" label="Кодеки" initialValue="ulaw,alaw"><Select options={CODEC_OPTIONS} /></Form.Item>
          <Form.Item name="context" label="Контекст" initialValue="internal"><Input /></Form.Item>
          <Form.Item name="mailbox" label="Голосовая почта"><Input placeholder="101@default" /></Form.Item>
          <Form.Item name="nat" label="NAT" valuePropName="checked" initialValue={true}><Switch /></Form.Item>
          <Form.Item name="is_active" label="Активен" valuePropName="checked" initialValue={true}><Switch /></Form.Item>
        </>;
      case 'trunk':
        return <>
          <Form.Item name="name" label="Название" rules={[{ required: true }]}><Input placeholder="rostel-sip" /></Form.Item>
          <Form.Item name="provider" label="Провайдер"><Input placeholder="Ростелеком" /></Form.Item>
          <Form.Item name="host" label="Сервер" rules={[{ required: true }]}><Input placeholder="sip.provider.ru" /></Form.Item>
          <Form.Item name="port" label="Порт" initialValue={5060}><InputNumber min={1} max={65535} /></Form.Item>
          <Form.Item name="username" label="Логин"><Input /></Form.Item>
          <Form.Item name="secret" label="Пароль"><Input.Password /></Form.Item>
          <Form.Item name="caller_id" label="Caller ID"><Input placeholder="+74951112233" /></Form.Item>
          <Form.Item name="context" label="Контекст" initialValue="inbound"><Input /></Form.Item>
          <Form.Item name="codecs" label="Кодеки" initialValue="ulaw,alaw"><Select options={CODEC_OPTIONS} /></Form.Item>
          <Form.Item name="max_channels" label="Макс. каналов" initialValue={10}><InputNumber min={1} max={120} /></Form.Item>
          <Form.Item name="register" label="Регистрироваться" valuePropName="checked" initialValue={true}><Switch /></Form.Item>
          <Form.Item name="is_active" label="Активен" valuePropName="checked" initialValue={true}><Switch /></Form.Item>
        </>;
      case 'route':
        return <>
          <Form.Item name="name" label="Название" rules={[{ required: true }]}><Input placeholder="Исходящие местные" /></Form.Item>
          <Form.Item name="direction" label="Направление" rules={[{ required: true }]}><Select options={DIRECTION_OPTIONS} /></Form.Item>
          <Form.Item name="match_pattern" label="Шаблон номера" rules={[{ required: true }]}><Select options={MATCH_PATTERNS} /></Form.Item>
          <Form.Item name="priority" label="Приоритет" initialValue={1}><InputNumber min={1} max={99} /></Form.Item>
          <Form.Item name="trunk" label="Транк">
            <Select allowClear placeholder="Выберите транк">
              {trunks.filter(t => t.is_active).map((t: any) => <Option key={t.id} value={t.id}>{t.name} ({t.provider || t.host})</Option>)}
            </Select>
          </Form.Item>
          <Form.Item name="prepend" label="Добавить перед номером"><Input placeholder="8" /></Form.Item>
          <Form.Item name="strip" label="Убрать цифр"><InputNumber min={0} max={20} /></Form.Item>
          <Form.Item name="destination" label="Цель"><Input placeholder="SIP/101, ivr-main, queue-support" /></Form.Item>
          <Form.Item name="caller_id_override" label="Подмена Caller ID"><Input placeholder="+74951112233" /></Form.Item>
          <Form.Item name="failover_destination" label="Резервная цель"><Input placeholder="SIP/102" /></Form.Item>
          <Form.Item name="is_active" label="Активен" valuePropName="checked" initialValue={true}><Switch /></Form.Item>
        </>;
      case 'ivr':
        return <>
          <Form.Item name="name" label="Название" rules={[{ required: true }]}><Input placeholder="Главное меню" /></Form.Item>
          <Form.Item name="description" label="Описание"><TextArea rows={2} /></Form.Item>
          <Form.Item name="greeting_audio" label="Аудио приветствия"><Input placeholder="/var/lib/asterisk/sounds/ivr/welcome" /></Form.Item>
          <Form.Item name="timeout" label="Таймаут (сек)" initialValue={5}><InputNumber min={1} max={30} /></Form.Item>
          <Form.Item name="max_attempts" label="Макс. попыток" initialValue={3}><InputNumber min={1} max={10} /></Form.Item>
          <Form.Item name="invalid_audio" label="Аудио при ошибке"><Input placeholder="invalid" /></Form.Item>
          <Form.Item name="exit_destination" label="При ошибке направить" initialValue="hangup"><Input placeholder="hangup, SIP/101" /></Form.Item>
          <Form.Item name="is_active" label="Активен" valuePropName="checked" initialValue={true}><Switch /></Form.Item>
        </>;
      case 'voicemail':
        return <>
          <Form.Item name="mailbox" label="Ящик" rules={[{ required: true }]}><Input placeholder="101@default" /></Form.Item>
          <Form.Item name="password" label="Пароль" initialValue="0000"><Input.Password /></Form.Item>
          <Form.Item name="display_name" label="Имя"><Input placeholder="Иван Петров" /></Form.Item>
          <Form.Item name="email" label="Email"><Input placeholder="ivan@example.com" /></Form.Item>
          <Form.Item name="email_attachment" label="На email" valuePropName="checked" initialValue={true}><Switch /></Form.Item>
          <Form.Item name="max_messages" label="Макс. сообщений" initialValue={100}><InputNumber min={1} max={1000} /></Form.Item>
          <Form.Item name="max_seconds" label="Макс. длит." initialValue={120}><InputNumber min={10} max={600} /></Form.Item>
          <Form.Item name="greeting" label="Приветствие"><Input placeholder="vm-intro" /></Form.Item>
          <Form.Item name="is_active" label="Активен" valuePropName="checked" initialValue={true}><Switch /></Form.Item>
        </>;
      default: return null;
    }
  };

  const sipColumns = [
    { title: 'Номер', dataIndex: 'name', key: 'name' },
    { title: 'Имя', dataIndex: 'display_name', key: 'dn' },
    { title: 'Caller ID', dataIndex: 'caller_id', key: 'cid' },
    { title: 'NAT', dataIndex: 'nat', key: 'nat', render: (v: boolean) => v ? <Tag color="blue">Да</Tag> : <Tag>Нет</Tag> },
    { title: '', dataIndex: 'is_active', key: 'st', render: (v: boolean) => v ? <Tag color="green">Активен</Tag> : <Tag color="red">Откл.</Tag> },
    { title: '', key: 'act', width: 100, render: (_: any, r: any) => (<Space size={0}><Button size="small" icon={<EditOutlined />} onClick={() => openModal('sip', r)} /><Popconfirm title="Удалить?" onConfirm={() => handleDelete('sip', r.id)}><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm></Space>) },
  ];
  const trunkColumns = [
    { title: 'Название', dataIndex: 'name', key: 'name' },
    { title: 'Провайдер', dataIndex: 'provider', key: 'prov' },
    { title: 'Сервер', dataIndex: 'host', key: 'host' },
    { title: '', dataIndex: 'is_active', key: 'st', render: (v: boolean) => v ? <Tag color="green">Активен</Tag> : <Tag color="red">Откл.</Tag> },
    { title: '', key: 'act', width: 100, render: (_: any, r: any) => (<Space size={0}><Button size="small" icon={<EditOutlined />} onClick={() => openModal('trunk', r)} /><Popconfirm title="Удалить?" onConfirm={() => handleDelete('trunk', r.id)}><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm></Space>) },
  ];
  const routeColumns = [
    { title: 'Название', dataIndex: 'name', key: 'name' },
    { title: 'Направление', dataIndex: 'direction', key: 'dir', render: (v: string) => DIRECTION_OPTIONS.find(d => d.value === v)?.label || v },
    { title: 'Шаблон', dataIndex: 'match_pattern', key: 'mp' },
    { title: 'Транк', dataIndex: 'trunk_name', key: 'tr' },
    { title: '', key: 'act', width: 100, render: (_: any, r: any) => (<Space size={0}><Button size="small" icon={<EditOutlined />} onClick={() => openModal('route', r)} /><Popconfirm title="Удалить?" onConfirm={() => handleDelete('route', r.id)}><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm></Space>) },
  ];
  const ivrColumns = [
    { title: 'Название', dataIndex: 'name', key: 'name' },
    { title: 'Опций', dataIndex: 'options', key: 'opts', render: (opts: any[]) => opts?.length || 0 },
    { title: '', dataIndex: 'is_active', key: 'st', render: (v: boolean) => v ? <Tag color="green">Активен</Tag> : <Tag color="red">Откл.</Tag> },
    { title: '', key: 'act', width: 160, render: (_: any, r: any) => (<Space size={0}><Button size="small" onClick={() => openIvrOptionModal(r)}>+Опции</Button><Button size="small" icon={<EditOutlined />} onClick={() => openModal('ivr', r)} /><Popconfirm title="Удалить?" onConfirm={() => handleDelete('ivr', r.id)}><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm></Space>) },
  ];
  const vmColumns = [
    { title: 'Ящик', dataIndex: 'mailbox', key: 'mb' },
    { title: 'Имя', dataIndex: 'display_name', key: 'dn' },
    { title: 'Email', dataIndex: 'email', key: 'em' },
    { title: '', dataIndex: 'is_active', key: 'st', render: (v: boolean) => v ? <Tag color="green">Активен</Tag> : <Tag color="red">Откл.</Tag> },
    { title: '', key: 'act', width: 100, render: (_: any, r: any) => (<Space size={0}><Button size="small" icon={<EditOutlined />} onClick={() => openModal('voicemail', r)} /><Popconfirm title="Удалить?" onConfirm={() => handleDelete('voicemail', r.id)}><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm></Space>) },
  ];
  const recColumns = [
    { title: 'Звонящий', dataIndex: 'caller', key: 'clr' },
    { title: 'Вызываемый', dataIndex: 'callee', key: 'cle' },
    { title: 'Дата', dataIndex: 'start_time', key: 'st', render: (v: string) => v ? new Date(v).toLocaleString('ru') : '-' },
    { title: 'Длит.', dataIndex: 'duration', key: 'dur', render: (v: number) => `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}` },
    { title: 'Направление', dataIndex: 'direction', key: 'dir' },
  ];

  // Dashboard tab content
  const dashboardContent = (
    <Spin spinning={dashLoading || serverLoading}>
      {/* ═══ Настройки подключения ═══ */}
      <Card size="small" title="Подключение к Asterisk серверу" style={{ marginBottom: 16 }}>
        <Form form={serverForm} layout="vertical">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
            <Form.Item name="asterisk_host" label="IP-адрес / хост" rules={[{ required: true, message: 'Введите IP-адрес сервера Asterisk' }]}>
              <Input placeholder="192.168.1.68" />
            </Form.Item>
            <Form.Item name="asterisk_port" label="AMI порт">
              <InputNumber min={1} max={65535} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="asterisk_user" label="AMI логин">
              <Input placeholder="crm_admin" />
            </Form.Item>
            <Form.Item name="asterisk_secret" label="AMI пароль">
              <Input.Password placeholder="Пароль AMI-пользователя" />
            </Form.Item>
          </div>
          <Form.Item name="asterisk_active" label="Интеграция активна" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Button type="primary" icon={<SettingOutlined />} loading={serverSaving} onClick={handleSaveServer}>
            Сохранить настройки подключения
          </Button>
        </Form>
      </Card>

      {/* ═══ Дашборд состояния ═══ */}
      {dashboard && (
        <>
          <Descriptions bordered column={2} size="small" style={{ marginBottom: 16 }}>
            <Descriptions.Item label="Версия Asterisk">{dashboard.version || '—'}</Descriptions.Item>
            <Descriptions.Item label="Подключение"><Tag color={dashboard.connected ? 'green' : 'red'}>{dashboard.connected ? 'Онлайн' : 'Офлайн'}</Tag></Descriptions.Item>
            <Descriptions.Item label="Активных каналов">{dashboard.active_channels}</Descriptions.Item>
            <Descriptions.Item label="SIP-аккаунтов">{dashboard.sip_peers_count}</Descriptions.Item>
            <Descriptions.Item label="Транков">{dashboard.trunks_count}</Descriptions.Item>
            <Descriptions.Item label="Маршрутов">{dashboard.routes_count}</Descriptions.Item>
            <Descriptions.Item label="IVR-меню">{dashboard.ivrs_count}</Descriptions.Item>
            <Descriptions.Item label="Записей звонков">{dashboard.recordings_count}</Descriptions.Item>
          </Descriptions>
        </>
      )}

      {/* ═══ Генерация и пуш конфигов ═══ */}
      <Divider>Конфигурация Asterisk</Divider>
      <Alert type="info" showIcon style={{ marginBottom: 16 }}
        message={<span>После изменения SIP-аккаунтов, транков, маршрутов или IVR — нажмите <strong>«Сгенерировать конфиги»</strong> для предпросмотра, затем <strong>«Отправить на сервер»</strong> для применения.</span>}
      />
      <Space>
        <Button type="primary" icon={<SettingOutlined />} loading={configLoading} onClick={handleGenerateConfigs}>Сгенерировать конфиги</Button>
        <Button type="primary" danger icon={<SendOutlined />} loading={pushLoading} onClick={handlePushConfigs} disabled={!configPreview}>Отправить и перезагрузить</Button>
      </Space>
      {configPreview && (
        <Card size="small" title="Предпросмотр" style={{ marginTop: 16 }}>
          <Tabs size="small" items={Object.entries(configPreview.configs || {}).map(([fname, content]) => ({
            key: fname, label: fname,
            children: <pre style={{ fontSize: 11, maxHeight: 400, overflow: 'auto', background: '#1e1e1e', color: '#d4d4d4', padding: 12, borderRadius: 4 }}>{String(content)}</pre>
          }))} />
          <Descriptions size="small" style={{ marginTop: 8 }}>
            <Descriptions.Item label="SIP">{configPreview.stats?.peers}</Descriptions.Item>
            <Descriptions.Item label="Транков">{configPreview.stats?.trunks}</Descriptions.Item>
            <Descriptions.Item label="Маршрутов">{configPreview.stats?.routes}</Descriptions.Item>
            <Descriptions.Item label="IVR">{configPreview.stats?.ivrs}</Descriptions.Item>
            <Descriptions.Item label="Автоответчиков">{configPreview.stats?.voicemails}</Descriptions.Item>
          </Descriptions>
        </Card>
      )}
    </Spin>
  );

  const tabItems = [
    { key: 'dashboard', label: <span><DashboardOutlined /> Сервер</span>, children: dashboardContent },
    { key: 'sip', label: <span><UserOutlined /> SIP ({sipPeers.length})</span>,
      children: <>
        <Button type="primary" icon={<PlusOutlined />} style={{ marginBottom: 12 }} onClick={() => openModal('sip')}>Добавить SIP</Button>
        <Table dataSource={sipPeers} columns={sipColumns} rowKey="id" size="small" loading={loading} />
      </>
    },
    { key: 'trunks', label: <span><ApiOutlined /> Транки ({trunks.length})</span>,
      children: <>
        <Button type="primary" icon={<PlusOutlined />} style={{ marginBottom: 12 }} onClick={() => openModal('trunk')}>Добавить транк</Button>
        <Table dataSource={trunks} columns={trunkColumns} rowKey="id" size="small" loading={loading} />
      </>
    },
    { key: 'routes', label: <span><BranchesOutlined /> Маршруты ({routes.length})</span>,
      children: <>
        <Button type="primary" icon={<PlusOutlined />} style={{ marginBottom: 12 }} onClick={() => openModal('route')}>Добавить маршрут</Button>
        <Table dataSource={routes} columns={routeColumns} rowKey="id" size="small" loading={loading} />
      </>
    },
    { key: 'ivr', label: <span><NodeIndexOutlined /> IVR ({ivrs.length})</span>,
      children: <>
        <Button type="primary" icon={<PlusOutlined />} style={{ marginBottom: 12 }} onClick={() => openModal('ivr')}>Добавить IVR</Button>
        <Table dataSource={ivrs} columns={ivrColumns} rowKey="id" size="small" loading={loading}
          expandable={{
            expandedRowRender: (ivr: any) => (
              <Table dataSource={ivr.options || []} rowKey="id" size="small" pagination={false}
                columns={[
                  { title: 'Цифра', dataIndex: 'digit', key: 'd', width: 60 },
                  { title: 'Действие', dataIndex: 'action', key: 'a', render: (v: string) => IVR_ACTIONS.find(x => x.value === v)?.label || v },
                  { title: 'Цель', dataIndex: 'destination', key: 'dst' },
                  { title: '', key: 'x', width: 50, render: (_: any, o: any) => (<Popconfirm title="Удалить?" onConfirm={() => handleRemoveIvrOption(ivr.id, o.id)}><Button size="small" danger icon={<DeleteOutlined />} /></Popconfirm>) },
                ]}
              />
            ),
          }}
        />
      </>
    },
    { key: 'voicemail', label: <span><MailOutlined /> Автоответчики ({voicemails.length})</span>,
      children: <>
        <Button type="primary" icon={<PlusOutlined />} style={{ marginBottom: 12 }} onClick={() => openModal('voicemail')}>Добавить</Button>
        <Table dataSource={voicemails} columns={vmColumns} rowKey="id" size="small" loading={loading} />
      </>
    },
    { key: 'recordings', label: <span><PlayCircleOutlined /> Записи ({recordings.length})</span>,
      children: <Table dataSource={recordings} columns={recColumns} rowKey="id" size="small" loading={loading} />
    },
  ];

  return (
    <Card title={<span><PhoneOutlined /> Asterisk PBX — Настройка телефонии</span>}
      extra={<Button icon={<ReloadOutlined />} onClick={loadAll}>Обновить</Button>}>
      <Tabs activeKey={activeTab} onChange={setActiveTab} type="card" items={tabItems} />
      <Modal title={renderModalTitle()} open={modalOpen} onOk={handleSave} onCancel={() => setModalOpen(false)} width={560} destroyOnClose>
        <Form form={form} layout="vertical">{renderModalContent()}</Form>
      </Modal>
      <Modal title={`Добавить опцию: ${ivrOptionIvr?.name || ''}`} open={ivrOptionModal} onOk={handleAddIvrOption} onCancel={() => setIvrOptionModal(false)} destroyOnClose>
        <Form form={ivrOptionForm} layout="vertical">
          <Form.Item name="digit" label="Цифра" rules={[{ required: true }]}>
            <Select>{['0','1','2','3','4','5','6','7','8','9','*','#','t','i'].map(d => <Option key={d} value={d}>{d === 't' ? 'Таймаут (t)' : d === 'i' ? 'Неверный ввод (i)' : d}</Option>)}</Select>
          </Form.Item>
          <Form.Item name="action" label="Действие" rules={[{ required: true }]}><Select options={IVR_ACTIONS} /></Form.Item>
          <Form.Item name="destination" label="Цель" rules={[{ required: true }]}><Input placeholder="SIP/101, hangup, queue-support" /></Form.Item>
          <Form.Item name="description" label="Описание"><Input /></Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default AsteriskSettingsPage;
