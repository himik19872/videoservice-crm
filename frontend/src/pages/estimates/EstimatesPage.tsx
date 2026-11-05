import React, { useState, useEffect, useCallback } from 'react';
import { Card, Table, Button, Modal, Input, Select, InputNumber, Space, Popconfirm, Tag, message, Row, Col, Statistic, Divider, Tabs, Spin } from 'antd';
import { PlusOutlined, DeleteOutlined, CalculatorOutlined, FilePdfOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import EstimateServicesPage from './EstimateServicesPage';
import EstimateSettingsPage from '../settings/EstimateSettingsPage';
import LegalEntitiesManager from './LegalEntitiesManager';

const ITEM_TYPES = [
  { value: 'material', label: '📦 Со склада' },
  { value: 'service', label: '🔧 Услуга (справочник)' },
  { value: 'custom_material', label: '✏️ Произвольный материал' },
  { value: 'custom_service', label: '✏️ Произвольная услуга' },
];

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  draft: { color: 'default', label: 'Черновик' },
  on_approval: { color: 'gold', label: 'На согласовании у ГД' },
  approved_internal: { color: 'cyan', label: 'Согласовано ГД' },
  sent: { color: 'blue', label: 'У клиента' },
  approved: { color: 'green', label: 'Согласовано клиентом' },
  invoiced: { color: 'geekblue', label: 'Счёт выставлен' },
  paid: { color: 'lime', label: 'Оплачено' },
  in_work: { color: 'orange', label: 'В работе' },
  completed: { color: 'green', label: 'Завершено' },
  rejected: { color: 'red', label: 'Отклонено' },
};

const EstimatesPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [estimates, setEstimates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [clients, setClients] = useState<any[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [filterClients, setFilterClients] = useState<any[]>([]);
  const [clientFilter, setClientFilter] = useState<number | undefined>(undefined);
  const [legalEntities, setLegalEntities] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);

  // Форма создания/редактирования
  const [formData, setFormData] = useState({
    name: '', client_id: undefined as number | undefined,
    legal_entity_id: undefined as number | undefined, order_id: undefined as number | undefined,
    discount: 0, commission: 0, dealer_fee: 0,
    unexpected_costs: 0, delivery_type: 'client', delivery_cost: 0,
    tax_type: 'usn', tax_rate: 6,
    employee: '', employee_phone: '', note: '', status: 'draft',
  });

  const fetchEstimates = async (clientId?: number) => {
    setLoading(true);
    try {
      const params: any = { page_size: 50 };
      if (clientId) params.client = clientId;
      const res = await api.get('/estimates/', { params });
      setEstimates(res.data.results || res.data);
    } catch (e) { message.error('Ошибка загрузки смет'); }
    finally { setLoading(false); }
  };

  const fetchRefs = async () => {
    try {
      const [cRes, lRes, iRes, sRes] = await Promise.all([
        api.get('/clients/?page_size=50'),
        api.get('/legal-entities/'),
        api.get('/inventory/?page_size=500&status=in_stock'),
        api.get('/estimate-services/?page_size=200'),
      ]);
      setClients(cRes.data.results || cRes.data || []);
      setLegalEntities(lRes.data.results || lRes.data || []);
      setInventory(iRes.data.results || iRes.data || []);
      setServices(sRes.data.results || sRes.data || []);
    } catch (e) {}
  };

  /** Поиск клиента по имени, телефону, адресу, лицевому счёту, ИНН */
  const searchClients = (term: string) => {
    setClientsLoading(true);
    api.get('/clients/', { params: { search: term || '', page_size: 50 } })
      .then(res => setClients(res.data.results || res.data || []))
      .catch(() => {})
      .finally(() => setClientsLoading(false));
  };

  /** Подпись клиента в списке: имя · телефон · адрес · лицевой счёт */
  const clientLabel = (c: any) => {
    const name = c.full_name || c.name || `Клиент #${c.id}`;
    const parts = [name];
    if (c.phone) parts.push(c.phone);
    if (c.address) parts.push(c.address);
    if (c.personal_account_number) parts.push(`л/с ${c.personal_account_number}`);
    return parts.join(' · ');
  };

  /** Поиск клиента для фильтра списка смет */
  const searchFilterClients = (term: string) => {
    api.get('/clients/', { params: { search: term || '', page_size: 50 } })
      .then(res => setFilterClients(res.data.results || res.data || []))
      .catch(() => {});
  };

  useEffect(() => { fetchEstimates(clientFilter); }, [clientFilter]);

  useEffect(() => { fetchRefs(); searchFilterClients(''); }, []);

  const openCreate = (clientId?: number) => {
    setEditing(null);
    setFormData({
      name: `Смета от ${new Date().toLocaleDateString('ru')}`,
      client_id: clientId, legal_entity_id: undefined, order_id: undefined,
      discount: 0, commission: 0, dealer_fee: 0,
      unexpected_costs: 0, delivery_type: 'client', delivery_cost: 0,
      tax_type: 'usn', tax_rate: 6,
      employee: '', employee_phone: '', note: '', status: 'draft',
    });
    setModalOpen(true);
  };

  // Открытие формы из карточки клиента: /estimates?new=1&client=<id>
  useEffect(() => {
    if (searchParams.get('new') !== '1') return;
    const clientId = Number(searchParams.get('client'));
    openCreate(Number.isFinite(clientId) && clientId > 0 ? clientId : undefined);

    // Чтобы в поле клиента отображалось имя, а не id — подгружаем его
    if (clientId && Number.isFinite(clientId)) {
      api.get(`/clients/${clientId}/`)
        .then(res => setClients(prev => {
          const exists = prev.some((c: any) => c.id === res.data.id);
          return exists ? prev.map((c: any) => (c.id === res.data.id ? res.data : c)) : [res.data, ...prev];
        }))
        .catch(() => {});
    }

    const next = new URLSearchParams(searchParams);
    next.delete('new');
    next.delete('client');
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async () => {
    if (!formData.name.trim()) { message.error('Введите название'); return; }
    try {
      const payload: any = {
        name: formData.name, discount: formData.discount,
        commission: formData.commission, dealer_fee: formData.dealer_fee,
        unexpected_costs: formData.unexpected_costs, delivery_type: formData.delivery_type,
        delivery_cost: formData.delivery_cost, tax_type: formData.tax_type,
        tax_rate: formData.tax_rate, employee: formData.employee,
        employee_phone: formData.employee_phone, note: formData.note,
      };
      if (formData.client_id) payload.client = formData.client_id;
      if (formData.legal_entity_id) payload.legal_entity = formData.legal_entity_id;
      if (formData.order_id) payload.order = formData.order_id;

      let estimate: any;
      if (editing) {
        const res = await api.patch(`/estimates/${editing.id}/`, payload);
        estimate = res.data;
        message.success('Смета обновлена');
      } else {
        const res = await api.post('/estimates/', payload);
        estimate = res.data;
        message.success('Смета создана');
      }
      setModalOpen(false);
      navigate(`/estimates/${estimate.id}`);
    } catch (e: any) {
      message.error(e?.response?.data?.detail || Object.values(e?.response?.data || {})[0] || 'Ошибка');
    }
  };

  const handleDelete = async (id: number) => {
    try { await api.delete(`/estimates/${id}/`); message.success('Удалено'); fetchEstimates(clientFilter); }
    catch (e) { message.error('Ошибка удаления'); }
  };

  const columns = [
    { title: 'Номер', dataIndex: 'number', key: 'number', width: 130, render: (t: string) => <strong>{t}</strong> },
    { title: 'Название', dataIndex: 'name', key: 'name', ellipsis: true },
    {
      title: 'Клиент', dataIndex: 'client_name', key: 'client', width: 240, ellipsis: true,
      render: (v: any, record: any) => (
        v
          ? <a onClick={() => navigate(`/clients/${record.client}`)} title="Открыть карточку клиента">{v}</a>
          : <span style={{ color: '#bbb' }}>—</span>
      ),
    },
    {
      title: 'Статус', dataIndex: 'status', key: 'status', width: 120,
      render: (s: string) => <Tag color={STATUS_MAP[s]?.color}>{STATUS_MAP[s]?.label || s}</Tag>,
    },
    { title: 'Итого', dataIndex: 'total', key: 'total', width: 130, render: (v: any) => <strong>{Number(v).toLocaleString()} ₽</strong> },
    { title: 'Прибыль', dataIndex: 'profit', key: 'profit', width: 120, render: (v: any) => <span style={{ color: Number(v) > 0 ? '#52c41a' : '#ff4d4f' }}>{Number(v).toLocaleString()} ₽</span> },
    {
      title: '', key: 'actions', width: 130,
      render: (_: any, record: any) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/estimates/${record.id}`)}>Открыть</Button>
          <Popconfirm title="Удалить смету?" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <>
      <Tabs defaultActiveKey="estimates" items={[
        {
          key: 'estimates',
          label: '📊 Сметы и КП',
          children: (
            <Card extra={
              <Space wrap>
                <Select
                  allowClear
                  showSearch
                  style={{ width: 340 }}
                  placeholder="Фильтр по клиенту: имя, телефон, адрес, л/с"
                  value={clientFilter}
                  onChange={v => setClientFilter(v)}
                  filterOption={false}
                  onSearch={searchFilterClients}
                  notFoundContent="Ничего не найдено"
                  options={filterClients.map((c: any) => ({ value: c.id, label: clientLabel(c) }))}
                />
                <Button type="primary" icon={<PlusOutlined />} onClick={() => openCreate()}>Создать смету</Button>
              </Space>
            }>
              <Table dataSource={estimates} columns={columns} rowKey="id" loading={loading} size="middle"
                pagination={{ pageSize: 20 }}
                onRow={(record) => ({ style: { cursor: 'pointer' }, onDoubleClick: () => navigate(`/estimates/${record.id}`) })} />
            </Card>
          ),
        },
        {
          key: 'services',
          label: '🔧 Справочник услуг',
          children: <EstimateServicesPage />,
        },
        {
          key: 'settings',
          label: '⚙️ Настройки шаблона',
          children: <EstimateSettingsPage />,
        },
        {
          key: 'legal',
          label: '🏢 Юрлица',
          children: <LegalEntitiesManager />,
        },
      ]} />

      <Modal title={editing ? 'Редактировать смету' : 'Новая смета'} open={modalOpen}
        onOk={handleSave} onCancel={() => setModalOpen(false)} width={600} okText="Сохранить" cancelText="Отмена">
        <Space direction="vertical" style={{ width: '100%' }} size="small">
          <div>
            <label>Название *</label>
            <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
          </div>
          <Row gutter={12}>
            <Col span={12}>
              <label>Клиент</label>
              <Select
                allowClear
                showSearch
                placeholder="Имя, телефон, адрес, л/с..."
                value={formData.client_id}
                onChange={v => setFormData({ ...formData, client_id: v })}
                style={{ width: '100%' }}
                filterOption={false}
                onSearch={searchClients}
                notFoundContent={clientsLoading ? <Spin size="small" /> : 'Ничего не найдено'}
                options={clients.map((c: any) => ({ value: c.id, label: clientLabel(c) }))}
              />
            </Col>
            <Col span={12}>
              <label>Наше юрлицо</label>
              <Select allowClear placeholder="Выберите юрлицо" value={formData.legal_entity_id}
                onChange={v => setFormData({ ...formData, legal_entity_id: v })} style={{ width: '100%' }}
                options={legalEntities.map((l: any) => ({ value: l.id, label: l.short_name || l.name }))} />
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={8}><label>Скидка (%)</label><InputNumber value={formData.discount} onChange={v => setFormData({ ...formData, discount: v || 0 })} min={0} max={100} style={{ width: '100%' }} /></Col>
            <Col span={8}><label>Комиссионные (%)</label><InputNumber value={formData.commission} onChange={v => setFormData({ ...formData, commission: v || 0 })} min={0} max={100} style={{ width: '100%' }} /></Col>
            <Col span={8}><label>Дилер. наценка (%)</label><InputNumber value={formData.dealer_fee} onChange={v => setFormData({ ...formData, dealer_fee: v || 0 })} min={0} max={100} style={{ width: '100%' }} /></Col>
          </Row>
        </Space>
      </Modal>
    </>
  );
};

export default EstimatesPage;
