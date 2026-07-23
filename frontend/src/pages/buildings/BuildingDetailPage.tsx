import React, { useState, useEffect } from 'react';
import {
  Typography, Card, Descriptions, Tag, Space, Button, Divider, Table,
  message, Spin, Modal, Form, Input, InputNumber, Select, Popconfirm,
} from 'antd';
import {
  ArrowLeftOutlined, EditOutlined, PlusOutlined, DeleteOutlined,
  ApartmentOutlined, LinkOutlined, DollarOutlined, EnvironmentOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api from '../../services/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const SYSTEM_TYPES: Record<string, string> = {
  intercom: 'Домофон', cctv: 'Видеонаблюдение', access_control: 'СКУД',
  dispatch: 'Диспетчеризация', auskue: 'АУСКУЭ', gate: 'Ворота',
  barrier: 'Шлагбаум', fire_alarm: 'Пож.сигнализация',
  elevator_dispatch: 'Лифты', other: 'Другое',
};

const BuildingDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [building, setBuilding] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const [regions, setRegions] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [tariffs, setTariffs] = useState<any[]>([]);
  const [apartmentsList, setApartmentsList] = useState<any[]>([]);

  // Модалка системы
  const [sysModalOpen, setSysModalOpen] = useState(false);
  const [sysForm] = Form.useForm();

  // Модалка смены УК
  const [mcModalOpen, setMcModalOpen] = useState(false);
  const [mcForm] = Form.useForm();

  // Модалка редактирования подъезда
  const [entModalOpen, setEntModalOpen] = useState(false);
  const [editingEntrance, setEditingEntrance] = useState<any>(null);
  const [entForm] = Form.useForm();

  // 2GIS ссылка
  const gisUrl = building
    ? `https://2gis.ru/spb/search/${encodeURIComponent(`${building.street_name}, ${building.house_number}${building.building_number ? ' корпус ' + building.building_number : ''}, ${building.city}`)}`
    : '#';

  useEffect(() => { fetchAll(); }, [id]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [bRes, rRes, cRes, tRes] = await Promise.all([
        api.get(`/buildings/${id}/`),
        api.get('/regions/'),
        api.get('/management-companies/'),
        api.get('/tariffs/'),
      ]);
      setBuilding(bRes.data);
      setRegions(rRes.data.results || rRes.data);
      setCompanies(cRes.data.results || cRes.data || []);
      setTariffs(tRes.data.results || tRes.data || []);
      // Загружаем квартиры
      try {
        const aptRes = await api.get('/apartments/', { params: { building: id } });
        setApartmentsList(aptRes.data.results || aptRes.data || []);
      } catch {}
    } catch (e) { message.error('Ошибка загрузки'); navigate('/buildings'); }
    finally { setLoading(false); }
  };

  const openEdit = () => {
    form.setFieldsValue({
      city: building.city,
      region_id: building.region_id,
      district: building.district,
      street_type: building.street_type,
      street_name: building.street_name,
      house_number: building.house_number,
      building_number: building.building_number,
      liter: building.liter,
      apartments_count: building.apartments_count,
      entrances_count: building.entrances_count,
      equipment_type: building.equipment_type,
      equipment_list: building.equipment_list,
      programming_code: building.programming_code,
      is_dormitory: building.is_dormitory,
      notes: building.notes,
    });
    setEditModalOpen(true);
  };

  const handleSave = async (values: any) => {
    setSaving(true);
    try {
      const res = await api.patch(`/buildings/${id}/`, values);
      message.success('Дом обновлён');
      // Заменяем building-объект свежими данными, чтобы регион/район обновились в карточке
      setBuilding((prev: any) => ({ ...prev, ...res.data }));
      setEditModalOpen(false);
      fetchAll();
    }
    catch { message.error('Ошибка сохранения'); }
    finally { setSaving(false); }
  };

  // Применить адрес дома ко всем квартирам
  const [applyLoading, setApplyLoading] = useState(false);
  const handleApplyToResidents = async () => {
    setApplyLoading(true);
    try {
      const res = await api.post(`/buildings/${id}/apply_to_residents/`);
      message.success(`Обновлено жителей: ${res.data.residents_updated} из ${res.data.total_residents}`);
    } catch { message.error('Ошибка'); }
    finally { setApplyLoading(false); }
  };

  // Dadata-нормализация адреса дома
  const [dadataLoading, setDadataLoading] = useState(false);
  const handleDadataVerify = async () => {
    setDadataLoading(true);
    try {
      const res = await api.post(`/buildings/${id}/dadata_verify/`);
      if (res.data.success) {
        const d = res.data.dadata;
        const b = res.data.building;
        form.setFieldsValue({
          city: d.city || b.city,
          region_id: b.region?.id || b.region_id,
          district: d.district || b.district,
          street_type: d.street_type || b.street_type,
          street_name: d.street_name || b.street_name,
          house_number: d.house_number || b.house_number,
          building_number: d.building_number || b.building_number,
        });
        setBuilding(res.data.building);
        message.success(`Адрес проверен: ${d.full_address}`);
      } else {
        message.warning(res.data.error || 'Не удалось нормализовать');
      }
    } catch { message.error('Ошибка Dadata'); }
    finally { setDadataLoading(false); }
  };

  // Смена УК
  const openMcChange = () => { mcForm.setFieldsValue({ management_company_fk: building.management_company_fk }); setMcModalOpen(true); };
  const handleMcChange = async (v: any) => {
    try { await api.post(`/buildings/${id}/set_management_company/`, v); message.success('УК изменена'); setMcModalOpen(false); fetchAll(); }
    catch { message.error('Ошибка'); }
  };

  // Системы
  const openSysAdd = () => { sysForm.resetFields(); setSysModalOpen(true); };
  const openSysEdit = (sys: any) => {
    sysForm.setFieldsValue({
      id: sys.id, system_type: sys.system_type,
      tariff: sys.tariff_id, monthly_amount: parseFloat(sys.monthly_amount) || 0,
      notes: sys.notes,
    });
    setSysModalOpen(true);
  };
  const handleSysAdd = async (v: any) => {
    try {
      await api.post(`/buildings/${id}/systems/`, v);
      message.success(v.id ? 'Система обновлена' : 'Система добавлена');
      setSysModalOpen(false); fetchAll();
    } catch { message.error('Ошибка'); }
  };
  const handleSysDelete = async (sysId: number) => {
    try { await api.delete(`/buildings/${id}/systems/${sysId}/`); message.success('Удалена'); fetchAll(); }
    catch { message.error('Ошибка'); }
  };

  const handleTariffChange = (tariffId: number) => {
    const t = tariffs.find((x: any) => x.id === tariffId);
    if (t && building) {
      sysForm.setFieldValue('monthly_amount', parseFloat(t.amount) * building.apartments_count);
    }
  };

  // Подъезды
  const openEntEdit = (ent: any) => { setEditingEntrance(ent); entForm.setFieldsValue(ent); setEntModalOpen(true); };
  const openEntCreate = () => { setEditingEntrance(null); entForm.resetFields(); setEntModalOpen(true); };
  const handleEntSave = async (v: any) => {
    try {
      v.building = parseInt(id!);
      if (editingEntrance) { await api.patch(`/entrances/${editingEntrance.id}/`, v); }
      else { await api.post('/entrances/', v); }
      message.success(editingEntrance ? 'Обновлён' : 'Создан'); setEntModalOpen(false); fetchAll();
    } catch { message.error('Ошибка'); }
  };
  const handleEntDelete = async (eid: number) => {
    try { await api.delete(`/entrances/${eid}/`); message.success('Удалён'); fetchAll(); }
    catch { message.error('Ошибка'); }
  };
  const handleAutoEntrances = async () => {
    try {
      await api.post(`/buildings/${id}/auto_entrances/`, { entrances_count: building.entrances_count, apartments_count: building.apartments_count });
      message.success('Подъезды созданы автоматически'); fetchAll();
    } catch { message.error('Ошибка'); }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div>;
  if (!building) return null;

  const orders = building.orders || [];
  const entrances = building.entrances || [];
  const systems = building.systems || [];
  const mcName = building.management_company_name || building.management_company || '—';

  const orderCols = [
    { title: 'Номер', dataIndex: 'number', key: 'number', width: 140,
      render: (n: string, r: any) => <Link to={`/orders/${r.id}`}>#{n}</Link> },
    { title: 'Тип', dataIndex: 'order_type_display', key: 'type', width: 130, render: (t: string) => <Tag>{t}</Tag> },
    { title: 'Статус', dataIndex: 'status_display', key: 'st', width: 120, render: (t: string) => <Tag>{t}</Tag> },
    { title: 'Мастер', dataIndex: 'master_name', key: 'm', width: 160 },
    { title: 'Дата', dataIndex: 'created_at', key: 'd', width: 110, render: (d: string) => dayjs(d).format('DD.MM.YYYY') },
  ];

  const entrCols = [
    { title: 'Под.', dataIndex: 'number', key: 'n', width: 60 },
    { title: 'IP', dataIndex: 'ip_address', key: 'ip', width: 130, render: (v: string) => v || '—' },
    { title: 'Доступ', dataIndex: 'access_code', key: 'ac', width: 90, render: (v: string) => v ? <Tag color="green">{v}</Tag> : '—' },
    { title: 'Прогр.', dataIndex: 'programming_code', key: 'pc', width: 90, render: (v: string) => v ? <Tag color="orange">{v}</Tag> : '—' },
    { title: 'Квартиры', key: 'kv', width: 100, render: (_: any, r: any) => r.apartment_from && r.apartment_to ? `${r.apartment_from}–${r.apartment_to}` : '—' },
    { title: 'Прим.', dataIndex: 'notes', key: 'nt', ellipsis: true, width: 120 },
    {
      title: '', key: 'act', width: 120,
      render: (_: any, r: any) => (
        <Space size="small">
          <Button size="small" icon={<EditOutlined />} onClick={() => openEntEdit(r)} />
          <Popconfirm title="Удалить?" onConfirm={() => handleEntDelete(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
          <Link to={`/entrances/${r.id}`}><Button size="small" icon={<LinkOutlined />} /></Link>
        </Space>
      ),
    },
  ];

  const sysCols = [
    { title: 'Система', dataIndex: 'system_type_display', key: 't', width: 180,
      render: (t: string) => <Tag color="blue">{t}</Tag> },
    { title: 'Тариф', dataIndex: 'tariff_name', key: 'tar', width: 150 },
    { title: 'Сумма/мес', dataIndex: 'monthly_amount', key: 'am', width: 130,
      render: (v: string) => <Text strong style={{ color: '#1677ff' }}>{v} ₽</Text> },
    { title: 'Прим.', dataIndex: 'notes', key: 'n', ellipsis: true },
    {
      title: '', key: 'act', width: 80,
      render: (_: any, r: any) => (
        <Space size="small">
          <Button size="small" icon={<EditOutlined />} onClick={() => openSysEdit(r)} />
          <Popconfirm title="Удалить систему?" onConfirm={() => handleSysDelete(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/buildings')}>Назад</Button>
        <Title level={3} style={{ margin: 0 }}>
          {building.street_name}, д. {building.house_number}
          {building.building_number ? ` корп. ${building.building_number}` : ''}
        </Title>
        <Button type="primary" icon={<EditOutlined />} onClick={openEdit}>Редактировать</Button>
        <Button icon={<EnvironmentOutlined />} onClick={() => window.open(gisUrl, '_blank')}>2GIS</Button>
        {building.dadata_verified && <Tag color="green" icon={<EnvironmentOutlined />}>Dadata ✓</Tag>}
      </Space>

      {/* Основная информация */}
      <Card>
        <Descriptions column={3} size="small">
          <Descriptions.Item label="Город">{building.city}</Descriptions.Item>
          <Descriptions.Item label="Район">{building.district || building.region?.name || '—'}</Descriptions.Item>
          <Descriptions.Item label="Регион">{building.region?.name || '—'}</Descriptions.Item>
          <Descriptions.Item label="Квартир / Подъездов">{building.apartments_count} / {building.entrances_count}</Descriptions.Item>
          <Descriptions.Item label="Тип оборудования">{building.equipment_type_display ? <Tag>{building.equipment_type_display}</Tag> : '—'}</Descriptions.Item>
          <Descriptions.Item label="Добавлен">{dayjs(building.created_at).format('DD.MM.YYYY')}</Descriptions.Item>
          <Descriptions.Item label="УК/ТСЖ">
            <Space>
              {building.management_company_fk ? (
                <Link to={`/management-companies`}><Tag color="purple">{mcName}</Tag></Link>
              ) : <Text>{mcName}</Text>}
              <Button size="small" icon={<EditOutlined />} onClick={openMcChange}>Сменить</Button>
            </Space>
          </Descriptions.Item>
        </Descriptions>

        {/* Примечания — всегда показываем */}
        <Divider style={{ margin: '12px 0' }} />
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
          <Text strong style={{ whiteSpace: 'nowrap' }}>📝 Примечания:</Text>
          <Text style={{ flex: 1, whiteSpace: 'pre-wrap' }}>{building.notes || '—'}</Text>
        </div>
      </Card>

      {/* Системы и тарифы */}
      <Divider />
      <Card
        title="⚙️ Системы и тарифы"
        extra={<Button size="small" icon={<PlusOutlined />} onClick={openSysAdd}>Добавить</Button>}
      >
        {systems.length === 0 ? (
          <Text type="secondary">Нет добавленных систем. Нажмите «Добавить» чтобы указать домофон, видеонаблюдение и т.д.</Text>
        ) : (
          <Table dataSource={systems} columns={sysCols} rowKey="id" size="small" pagination={false} />
        )}
      </Card>

      {/* Подъезды */}
      <Divider />
      <Card
        title={`🔐 Подъезды (${entrances.length})`}
        extra={
          <Space>
            {entrances.length === 0 && (
              <Button size="small" type="dashed" onClick={handleAutoEntrances}>
                Авто-создать из {building.entrances_count} подъездов
              </Button>
            )}
            <Button size="small" icon={<PlusOutlined />} onClick={openEntCreate}>Добавить</Button>
          </Space>
        }
      >
        {entrances.length === 0 ? (
          <Text type="secondary">Нет подъездов. Нажмите «Авто-создать» чтобы разбить {building.apartments_count} квартир на {building.entrances_count} подъездов поровну.</Text>
        ) : (
          <Table dataSource={entrances} columns={entrCols} rowKey="id" size="small" pagination={false} />
        )}
      </Card>

      {/* Квартиры */}
      {apartmentsList && apartmentsList.length > 0 && (
        <>
          <Divider />
          <Card title={`🚪 Квартиры (${apartmentsList.length})`}>
            <Table
              dataSource={apartmentsList}
              rowKey="id"
              size="small"
              pagination={{ pageSize: 20, showTotal: (t: number) => `Всего: ${t}` }}
              columns={[
                { title: 'Кв.', dataIndex: 'number', key: 'num', width: 80 },
                { title: 'Жителей', dataIndex: 'residents_count', key: 'rc', width: 100,
                  render: (v: number, r: any) => (
                    <Space>
                      <Text>{v}</Text>
                      {r.active_residents_count < v && <Tag color="orange" style={{ fontSize: 10 }}>—{v - r.active_residents_count} неакт.</Tag>}
                    </Space>
                  ),
                },
                { title: 'Активных', dataIndex: 'active_residents_count', key: 'ac', width: 100,
                  render: (v: number) => <Tag color={v > 0 ? 'green' : 'default'}>{v}</Tag>,
                },
                {
                  title: '', key: 'act', width: 80,
                  render: (_: any, r: any) => (
                    <Link to={`/apartments/${r.id}`}>
                      <Button size="small" icon={<ApartmentOutlined />}>Открыть</Button>
                    </Link>
                  ),
                },
              ]}
            />
          </Card>
        </>
      )}

      {/* История заявок */}
      <Divider />
      <Card title={`📋 История заявок (${orders.length})`}>
        <Table dataSource={orders} columns={orderCols} rowKey="id" size="small"
          pagination={{ pageSize: 15, showTotal: (t: number) => `Всего: ${t}` }}
          locale={{ emptyText: 'Заявок по этому дому ещё нет' }} />
      </Card>

      {/* Модалка редактирования дома */}
      <Modal title="Редактировать дом" open={editModalOpen} onCancel={() => setEditModalOpen(false)} footer={null} width={550}>
        <Form form={form} layout="vertical" onFinish={handleSave}>
          <Form.Item name="city" label="Город"><Input /></Form.Item>
          <Form.Item name="region_id" label="Регион">
            <Select showSearch allowClear placeholder="Регион" filterOption={(input, option) => (option?.label as string || '').toLowerCase().includes(input.toLowerCase())}
              options={regions.map((r: any) => ({ label: r.name, value: r.id }))} />
          </Form.Item>
          <Form.Item name="district" label="Район / пригород"><Input placeholder="Например: Всеволожский р-н" /></Form.Item>
          <Form.Item name="street_type" label="Тип улицы">
            <Select options={[
              { label: 'Улица', value: 'street' }, { label: 'Проспект', value: 'avenue' },
              { label: 'Переулок', value: 'lane' }, { label: 'Бульвар', value: 'boulevard' },
              { label: 'Шоссе', value: 'highway' }, { label: 'Площадь', value: 'square' },
              { label: 'Набережная', value: 'embankment' }, { label: 'Проезд', value: 'passage' },
              { label: 'Аллея', value: 'alley' }, { label: 'Микрорайон', value: 'microdistrict' },
              { label: 'Другое', value: 'other' },
            ]} />
          </Form.Item>
          <Form.Item name="street_name" label="Улица"><Input /></Form.Item>
          <Space>
            <Form.Item name="house_number" label="Дом"><Input style={{ width: 100 }} /></Form.Item>
            <Form.Item name="building_number" label="Корпус"><Input style={{ width: 100 }} /></Form.Item>
            <Form.Item name="liter" label="Литера"><Input style={{ width: 80 }} /></Form.Item>
          </Space>
          <Space>
            <Form.Item name="apartments_count" label="Квартир"><InputNumber min={0} style={{ width: 120 }} /></Form.Item>
            <Form.Item name="entrances_count" label="Подъездов"><InputNumber min={0} style={{ width: 120 }} /></Form.Item>
          </Space>
          <Form.Item name="equipment_type" label="Тип оборудования">
            <Select allowClear options={[
              { label: 'Без оборудования', value: '' },
              { label: 'Домофон', value: 'intercom' },
              { label: 'Видеодомофон', value: 'video_intercom' },
              { label: 'Камера', value: 'camera' },
              { label: 'Вызывная панель', value: 'call_panel' },
              { label: 'Дверной замок', value: 'door_lock' },
              { label: 'Многоквартирная система', value: 'multi_apartment' },
              { label: 'Другое', value: 'other' },
            ]} />
          </Form.Item>
          <Form.Item name="equipment_list" label="Список оборудования"><Input.TextArea rows={2} /></Form.Item>
          <Form.Item name="programming_code" label="Код программирования"><Input /></Form.Item>
          <Form.Item name="is_dormitory" label="Общежитие" valuePropName="checked">
            <Select options={[{ label: 'Да (несколько л/с в квартире)', value: true }, { label: 'Нет', value: false }]} />
          </Form.Item>
          <Form.Item name="notes" label="Примечания"><Input.TextArea rows={4} /></Form.Item>
          <Space style={{ width: '100%', justifyContent: 'space-between' }}>
            <Space>
              <Button type="primary" htmlType="submit" loading={saving}>Сохранить</Button>
              <Button onClick={handleDadataVerify} loading={dadataLoading} icon={<EnvironmentOutlined />}>
                Проверить через Dadata
              </Button>
            </Space>
            <Button onClick={handleApplyToResidents} loading={applyLoading} icon={<ApartmentOutlined />}>
              Применить ко всем квартирам
            </Button>
          </Space>
        </Form>
      </Modal>

      {/* Модалка смены УК */}
      <Modal title="Сменить УК/ТСЖ" open={mcModalOpen} onCancel={() => setMcModalOpen(false)} footer={null} width={400}>
        <Form form={mcForm} layout="vertical" onFinish={handleMcChange}>
          <Form.Item name="management_company_fk" label="Управляющая компания">
            <Select showSearch allowClear placeholder="Выберите УК" filterOption={(input, option) => (option?.label as string || '').toLowerCase().includes(input.toLowerCase())}
              options={companies.map((c: any) => ({ label: c.name, value: c.id }))} />
          </Form.Item>
          <Button type="primary" htmlType="submit" block>Сохранить</Button>
        </Form>
      </Modal>

      {/* Модалка добавления системы */}
      <Modal title={sysForm.getFieldValue('id') ? 'Изменить тариф' : 'Добавить систему'}
        open={sysModalOpen} onCancel={() => setSysModalOpen(false)} footer={null} width={400}>
        <Form form={sysForm} layout="vertical" onFinish={handleSysAdd}>
          <Form.Item name="id" hidden><Input /></Form.Item>
          <Form.Item name="system_type" label="Тип системы" rules={[{ required: true, message: 'Обязательно' }]}>
            <Select options={Object.entries(SYSTEM_TYPES).map(([k, v]) => ({ label: v, value: k }))}
              disabled={!!sysForm.getFieldValue('id')} />
          </Form.Item>
          <Form.Item name="tariff" label="Тариф">
            <Select allowClear placeholder="Без тарифа"
              onChange={handleTariffChange}
              options={tariffs.map((t: any) => ({ label: `${t.name} (${t.amount}₽)`, value: t.id }))} />
          </Form.Item>
          <Form.Item name="monthly_amount" label="Сумма в месяц (₽)">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="notes" label="Примечания"><Input.TextArea rows={2} /></Form.Item>
          <Button type="primary" htmlType="submit" block>
            {sysForm.getFieldValue('id') ? 'Сохранить' : 'Добавить'}
          </Button>
        </Form>
      </Modal>

      {/* Модалка создания/редактирования подъезда */}
      <Modal title={editingEntrance ? 'Редактировать подъезд' : 'Новый подъезд'} open={entModalOpen}
        onCancel={() => setEntModalOpen(false)} footer={null} width={450}>
        <Form form={entForm} layout="vertical" onFinish={handleEntSave}>
          <Form.Item name="number" label="Номер подъезда" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Space>
            <Form.Item name="apartment_from" label="Квартиры с"><InputNumber min={1} /></Form.Item>
            <Form.Item name="apartment_to" label="по"><InputNumber min={1} /></Form.Item>
          </Space>
          <Form.Item name="apartments_count" label="Кол-во квартир"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="ip_address" label="IP-адрес"><Input /></Form.Item>
          <Form.Item name="access_code" label="Код доступа"><Input /></Form.Item>
          <Form.Item name="programming_code" label="Код программирования"><Input /></Form.Item>
          <Form.Item name="notes" label="Примечания"><Input.TextArea rows={2} /></Form.Item>
          <Button type="primary" htmlType="submit" block>{editingEntrance ? 'Сохранить' : 'Создать'}</Button>
        </Form>
      </Modal>
    </div>
  );
};

export default BuildingDetailPage;
