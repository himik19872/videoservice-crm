import React, { useState, useEffect } from 'react';
import { Typography, Card, Descriptions, Tag, Space, Button, Divider, Form, Input, Select, Switch, message, Spin, Popconfirm, Row, Col, Statistic, Table, Modal, InputNumber, Tabs } from 'antd';
import { ArrowLeftOutlined, EditOutlined, DeleteOutlined, SaveOutlined, CloseOutlined, BarChartOutlined, ReloadOutlined, AimOutlined, ToolOutlined, ShopOutlined, ExportOutlined, ImportOutlined, CheckCircleOutlined, WarningOutlined, SendOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';
import type { Master, Region, MasterStats } from '../../types';
import MasterMap from '../../components/MasterMap';
import dayjs from 'dayjs';

const { Title } = Typography;

const MasterDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [master, setMaster] = useState<Master | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [regions, setRegions] = useState<Region[]>([]);
  const [stats, setStats] = useState<MasterStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsData, setGpsData] = useState<any>(null);
  const [form] = Form.useForm();

  // Данные карточки
  const [card, setCard] = useState<any>(null);
  const [cardLoading, setCardLoading] = useState(false);

  // Выдача материала
  const [issueModal, setIssueModal] = useState(false);
  const [warehouseItems, setWarehouseItems] = useState<any[]>([]);
  const [issueQty, setIssueQty] = useState<Record<number, number>>({});

  // Запрос возврата материала
  const [reqReturnModal, setReqReturnModal] = useState(false);
  const [reqReturnItem, setReqReturnItem] = useState<any>(null);
  const [reqReturnQty, setReqReturnQty] = useState(1);

  // Запрос возврата инструмента
  const [reqToolReturnModal, setReqToolReturnModal] = useState(false);
  const [reqToolReturnItem, setReqToolReturnItem] = useState<any>(null);

  // Ордер приёмки
  const [acceptModal, setAcceptModal] = useState(false);
  const [acceptOrder, setAcceptOrder] = useState<any>(null);

  useEffect(() => {
    fetchMaster();
    fetchRegions();
    fetchCard();
  }, [id]);

  const fetchCard = async () => {
    setCardLoading(true);
    try {
      const res = await api.get(`/masters/${id}/card/`);
      setCard(res.data);
    } catch (e) { /* ignore */ }
    finally { setCardLoading(false); }
  };

  const fetchMaster = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/masters/${id}/`);
      setMaster(response.data);
    } catch (error) {
      message.error('Ошибка загрузки мастера');
      navigate('/masters');
    } finally {
      setLoading(false);
    }
  };

  const fetchRegions = async () => {
    try {
      const response = await api.get('/regions/');
      setRegions(response.data.results || response.data);
    } catch (error) {
      console.error('Ошибка загрузки районов:', error);
    }
  };

  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const response = await api.get(`/masters/${id}/stats/`);
      setStats(response.data);
    } catch (error) {
      message.error('Ошибка загрузки статистики');
    } finally {
      setStatsLoading(false);
    }
  };

  const handleUpdateGps = async () => {
    setGpsLoading(true);
    try {
      const response = await api.post(`/masters/${id}/update_gps/`);
      setGpsData(response.data);
      if (response.data.ok) {
        message.success('GPS-данные обновлены');
      }
    } catch (error: any) {
      const errData = error?.response?.data;
      setGpsData(errData || { ok: false, error: 'Ошибка' });
      message.error(errData?.error || 'Ошибка запроса GPS');
    } finally {
      setGpsLoading(false);
    }
  };

  const handleEdit = () => {
    if (!master) return;
    form.setFieldsValue({
      first_name: master.user?.first_name || '',
      last_name: master.user?.last_name || '',
      email: master.user?.email || '',
      phone: master.phone,
      region_id: master.region?.id || master.region_id,
      is_available: master.is_available,
      username: master.user?.username || '',
    });
    setEditing(true);
  };

  const handleSave = async (values: any) => {
    setSaving(true);
    try {
      const payload: any = {
        phone: values.phone,
        region_id: values.region_id,
        is_available: values.is_available,
        first_name: values.first_name,
        last_name: values.last_name,
        email: values.email || '',
        username: values.username,
      };
      if (values.password) {
        payload.password = values.password;
      }
      const response = await api.put(`/masters/${id}/`, payload);
      setMaster(response.data);
      setEditing(false);
      message.success('Данные мастера обновлены');
    } catch (error) {
      message.error('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/masters/${id}/`);
      message.success('Мастер удалён');
      navigate('/masters');
    } catch (error) {
      message.error('Ошибка удаления мастера');
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div>;
  }

  if (!master) return null;

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/masters')}>Назад</Button>
        <Title level={3} style={{ margin: 0 }}>{master.full_name || master.user?.username}</Title>
      </Space>

      <Row gutter={16}>
        <Col span={14}>
          <Card
            title="Профиль мастера"
            extra={
              <Space>
                {!editing ? (
                  <>
                    <Button icon={<EditOutlined />} onClick={handleEdit}>Редактировать</Button>
                    <Button icon={<BarChartOutlined />} onClick={fetchStats} loading={statsLoading}>Статистика</Button>
                    <Popconfirm title="Удалить мастера?" onConfirm={handleDelete} okText="Да" cancelText="Нет">
                      <Button danger icon={<DeleteOutlined />}>Удалить</Button>
                    </Popconfirm>
                  </>
                ) : (
                  <>
                    <Button icon={<CloseOutlined />} onClick={() => setEditing(false)}>Отмена</Button>
                    <Button type="primary" icon={<SaveOutlined />} onClick={() => form.submit()} loading={saving}>Сохранить</Button>
                  </>
                )}
              </Space>
            }
          >
            {!editing ? (
              <Descriptions column={2} size="small">
                <Descriptions.Item label="Логин">{master.user?.username || '-'}</Descriptions.Item>
                <Descriptions.Item label="Email">{master.user?.email || '-'}</Descriptions.Item>
                <Descriptions.Item label="Имя">{master.user?.first_name || '-'}</Descriptions.Item>
                <Descriptions.Item label="Фамилия">{master.user?.last_name || '-'}</Descriptions.Item>
                <Descriptions.Item label="Телефон">{master.phone}</Descriptions.Item>
                <Descriptions.Item label="Район">{master.region?.name || '-'}</Descriptions.Item>
                <Descriptions.Item label="Доступен">
                  <Tag color={master.is_available ? 'green' : 'red'}>{master.is_available ? 'Да' : 'Нет'}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Дата регистрации">{dayjs(master.created_at).format('DD.MM.YYYY')}</Descriptions.Item>
              </Descriptions>
            ) : (
              <Form form={form} layout="vertical" onFinish={handleSave}>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="username" label="Логин" rules={[{ required: true }]}>
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="password" label="Пароль (оставьте пустым, чтобы не менять)">
                      <Input.Password placeholder="Новый пароль" />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="first_name" label="Имя"><Input /></Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="last_name" label="Фамилия"><Input /></Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="email" label="Email"><Input /></Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="phone" label="Телефон" rules={[{ required: true }]}>
                      <Input />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="region_id" label="Район">
                      <Select placeholder="Выберите район" options={regions.map((r) => ({ value: r.id, label: r.name }))} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="is_available" label="Доступен" valuePropName="checked">
                      <Switch />
                    </Form.Item>
                  </Col>
                </Row>
              </Form>
            )}

            {/* Карта GPS */}
            {master.traccar_device && (
              <>
                <Divider />
                <Card title="GPS-местоположение" size="small"
                  extra={
                    <Button icon={<ReloadOutlined />} loading={gpsLoading} size="small" onClick={handleUpdateGps}>
                      Обновить GPS
                    </Button>
                  }
                >
                  {(gpsData?.ok || master.traccar_device.last_latitude != null) ? (
                    <MasterMap
                      latitude={gpsData?.latitude ?? master.traccar_device.last_latitude}
                      longitude={gpsData?.longitude ?? master.traccar_device.last_longitude}
                      masterName={master.full_name || master.user?.username}
                      speed={gpsData?.speed ?? master.traccar_device.last_speed}
                      height="300px"
                    />
                  ) : (
                    <div style={{ textAlign: 'center', padding: 20, color: '#999' }}>Нет данных о местоположении</div>
                  )}
                  {gpsData?.error && (
                    <div style={{ marginTop: 8, color: '#ff4d4f', fontSize: 12 }}>{gpsData.error}</div>
                  )}
                  {master.traccar_device.last_update && (
                    <div style={{ marginTop: 8, color: '#888', fontSize: 12 }}>
                      Обновлено: {new Date(master.traccar_device.last_update).toLocaleString('ru-RU')}
                      {' · '}
                      {master.traccar_device.is_online ? '🟢 Онлайн' : '🔴 Офлайн'}
                    </div>
                  )}
                </Card>
              </>
            )}
          </Card>
        </Col>

        {/* Статистика */}
        <Col span={10}>
          {stats && (
            <Card title={`Статистика за ${stats.month}`}>
              <Row gutter={[12, 16]}>
                <Col span={12}>
                  <Statistic title="Всего заявок" value={stats.total_orders} />
                </Col>
                <Col span={12}>
                  <Statistic title="Выполнено" value={stats.completed_orders} valueStyle={{ color: '#3f8600' }} />
                </Col>
                <Col span={12}>
                  <Statistic title="Просрочено" value={stats.overdue_orders} valueStyle={{ color: stats.overdue_orders > 0 ? '#cf1322' : undefined }} />
                </Col>
                <Col span={12}>
                  <Statistic title="Среднее время" value={stats.avg_completion_hours} suffix="ч" precision={1} />
                </Col>
                <Col span={24}>
                  <Statistic title="Общая стоимость" value={stats.total_cost} suffix="₽" precision={2} valueStyle={{ color: '#1890ff' }} />
                </Col>
              </Row>
              <Divider />
              <Descriptions title="По типам" size="small" column={1}>
                <Descriptions.Item label="Ремонт">{stats.by_type.repair}</Descriptions.Item>
                <Descriptions.Item label="Подключение">{stats.by_type.connection}</Descriptions.Item>
                <Descriptions.Item label="Продажа">{stats.by_type.sale}</Descriptions.Item>
              </Descriptions>
            </Card>
          )}          <Divider />
          <Title level={5}><ToolOutlined /> Оборудование и инструменты мастера</Title>
          <Tabs
            defaultActiveKey="materials"
            items={[
              {
                key: 'materials',
                label: `📦 Материалы (${(card?.materials || []).length})`,
                children: (
                  <Table
                    dataSource={card?.materials || []}
                    loading={cardLoading}
                    rowKey={(r, i) => `mat-${r.inventory_item_id || i}`}
                    size="small"
                    pagination={false}
                    columns={[
                      { title: 'Номенклатура', dataIndex: 'name', key: 'name' },
                      { title: 'Выдано', dataIndex: 'issued', key: 'issued' },
                      { title: 'Использовано', dataIndex: 'used', key: 'used' },
                      { title: 'Остаток', dataIndex: 'remaining', key: 'remaining',
                        render: (v: number) => <Tag color={v > 0 ? 'orange' : 'green'}>{v}</Tag>
                      },
                      {
                        title: '', key: 'actions', width: 140,
                        render: (_: any, r: any) => r.remaining > 0 ? (
                          <Button size="small" danger icon={<SendOutlined />}
                            onClick={() => { setReqReturnItem(r); setReqReturnQty(1); setReqReturnModal(true); }}>
                            Запросить сдачу
                          </Button>
                        ) : null,
                      },
                    ]}
                    locale={{ emptyText: 'Материалов нет' }}
                  />
                ),
              },
              {
                key: 'tools',
                label: `🔧 Инструменты (${(card?.tools || []).length})`,
                children: (
                  <Table
                    dataSource={card?.tools || []}
                    loading={cardLoading}
                    rowKey={(r) => `tool-${r.id}`}
                    size="small"
                    pagination={false}
                    columns={[
                      { title: 'Инструмент', dataIndex: 'name', key: 'name' },
                      { title: 'Тип', dataIndex: 'tool_type', key: 'type' },
                      { title: 'Инв. №', dataIndex: 'serial_number', key: 'sn', render: (v: string) => v || '—' },
                      {
                        title: '', key: 'actions', width: 140,
                        render: (_: any, r: any) => (
                          <Button size="small" danger icon={<SendOutlined />}
                            onClick={() => { setReqToolReturnItem(r); setReqToolReturnModal(true); }}>
                            Запросить сдачу
                          </Button>
                        ),
                      },
                    ]}
                    locale={{ emptyText: 'Инструментов нет' }}
                  />
                ),
              },
              {
                key: 'requests',
                label: `↩ Запросы возврата (${(card?.return_requests || []).length})`,
                children: (
                  <Table
                    dataSource={card?.return_requests || []}
                    loading={cardLoading}
                    rowKey={(r) => `req-${r.id}`}
                    size="small"
                    pagination={false}
                    columns={[
                      { title: 'Позиция', dataIndex: 'item_name', key: 'name' },
                      { title: 'Тип', dataIndex: 'item_type_display', key: 'type' },
                      { title: 'Кол-во', dataIndex: 'quantity', key: 'qty' },
                      { title: 'Серийник', dataIndex: 'serial_number', key: 'sn', render: (v: string) => v || '—' },
                      {
                        title: 'Статус', dataIndex: 'status_display', key: 'status',
                        render: (s: string, r: any) => {
                          const color = r.status === 'pending' ? 'orange' : r.status === 'submitted' ? 'blue' : 'green';
                          return <Tag color={color}>{s}</Tag>;
                        },
                      },
                      { title: 'Дата', dataIndex: 'created_at', key: 'date',
                        render: (v: string) => v ? new Date(v).toLocaleDateString('ru-RU') : '—'
                      },
                      {
                        title: '', key: 'actions', width: 120,
                        render: (_: any, r: any) => r.status === 'submitted' ? (
                          <Button size="small" type="primary" icon={<CheckCircleOutlined />}
                            onClick={async () => {
                              await api.post(`/return-requests/${r.id}/accept/`);
                              message.success('Позиция принята на склад');
                              fetchCard();
                            }}>
                            Принять
                          </Button>
                        ) : r.status === 'pending' ? (
                          <Popconfirm title="Удалить запрос?" onConfirm={async () => {
                            await api.delete(`/return-requests/${r.id}/`);
                            message.success('Запрос удалён');
                            fetchCard();
                          }}>
                            <Button size="small" danger>Удалить</Button>
                          </Popconfirm>
                        ) : null,
                      },
                    ]}
                    locale={{ emptyText: 'Запросов нет' }}
                  />
                ),
              },
              {
                key: 'orders',
                label: `📋 Ордера приёмки (${(card?.return_orders || []).length})`,
                children: (
                  <Table
                    dataSource={card?.return_orders || []}
                    loading={cardLoading}
                    rowKey={(r) => `ro-${r.id}`}
                    size="small"
                    pagination={false}
                    columns={[
                      { title: '№', dataIndex: 'id', key: 'id' },
                      {
                        title: 'Статус', dataIndex: 'status_display', key: 'status',
                        render: (s: string, r: any) => {
                          const color = r.status === 'pending' ? 'blue' : r.status === 'completed' ? 'green' : 'default';
                          return <Tag color={color}>{s}</Tag>;
                        },
                      },
                      { title: 'Позиций', key: 'cnt', render: (_: any, r: any) => (r.items || []).length },
                      { title: 'Создан', dataIndex: 'created_at', key: 'date',
                        render: (v: string) => v ? new Date(v).toLocaleString('ru-RU') : '—'
                      },
                      {
                        title: '', key: 'actions', width: 120,
                        render: (_: any, r: any) => (
                          <Button size="small" type="primary" icon={<ImportOutlined />}
                            onClick={() => { setAcceptOrder(r); setAcceptModal(true); }}>
                            Приёмка
                          </Button>
                        ),
                      },
                    ]}
                    locale={{ emptyText: 'Ордеров нет' }}
                  />
                ),
              },
            ]}
          />

          <Divider />
          <Button type="primary" icon={<ShopOutlined />} onClick={async () => {
            const res = await api.get('/inventory/', { params: { page_size: 300, status: 'in_stock' } });
            setWarehouseItems(res.data.results || res.data);
            setIssueQty({});
            setIssueModal(true);
          }}>
            Выдать материал / ЗИП
          </Button>
        </Col>
      </Row>

      {/* Модал: выдача материала */}
      <Modal title="Выдать материал мастеру" open={issueModal} onCancel={() => setIssueModal(false)} width={650} footer={null}>
        <Table
          dataSource={warehouseItems}
          rowKey="id"
          pagination={false}
          size="small"
          columns={[
            { title: 'Номенклатура', dataIndex: 'name', key: 'name' },
            { title: 'На складе', dataIndex: 'quantity', key: 'qty' },
            {
              title: 'Выдать', key: 'issue', width: 120,
              render: (_: any, item: any) => (
                <InputNumber min={0} max={item.quantity} value={issueQty[item.id] || 0}
                  onChange={v => setIssueQty(prev => ({ ...prev, [item.id]: v || 0 }))} style={{ width: 70 }} />
              ),
            },
          ]}
        />
        <Button type="primary" block style={{ marginTop: 12 }} onClick={async () => {
          const items = Object.entries(issueQty).filter(([, q]) => q > 0);
          if (items.length === 0) { message.warning('Выберите материалы'); return; }
          try {
            await api.post('/issue-orders/', {
              order_id: null, master_id: parseInt(id || '0'),
              items: items.map(([invId, qty]) => ({ inventory_item_id: parseInt(invId), quantity_issued: qty, source: 'warehouse' })),
              notes: 'Выдача со склада',
            });
            message.success('Материалы выданы');
            setIssueModal(false);
            setIssueQty({});
            fetchCard();
          } catch (e: any) { message.error(e?.response?.data?.error || 'Ошибка'); }
        }}>
          Выдать
        </Button>
      </Modal>

      {/* Модал: запрос возврата материала */}
      <Modal title="Запрос возврата материала" open={reqReturnModal}
        onCancel={() => setReqReturnModal(false)} onOk={async () => {
          try {
            await api.post('/return-requests/', {
              master_id: parseInt(id || '0'),
              item_type: 'material',
              inventory_item_id: reqReturnItem?.inventory_item_id,
              quantity: reqReturnQty,
              notes: 'Склад запросил возврат',
            });
            message.success('Запрос отправлен мастеру');
            setReqReturnModal(false);
            fetchCard();
          } catch (e: any) { message.error(e?.response?.data?.error || 'Ошибка'); }
        }} okText="Запросить" cancelText="Отмена">
        <p>Материал: <b>{reqReturnItem?.name}</b></p>
        <p>Количество к сдаче:</p>
        <InputNumber min={1} max={reqReturnItem?.remaining || 1} value={reqReturnQty}
          onChange={v => setReqReturnQty(v || 1)} style={{ width: 120 }} />
      </Modal>

      {/* Модал: запрос возврата инструмента */}
      <Modal title="Запрос возврата инструмента" open={reqToolReturnModal}
        onCancel={() => setReqToolReturnModal(false)} onOk={async () => {
          try {
            await api.post('/return-requests/', {
              master_id: parseInt(id || '0'),
              item_type: 'tool',
              tool_id: reqToolReturnItem?.id,
              quantity: 1,
              notes: 'Склад запросил возврат инструмента',
            });
            message.success('Запрос отправлен мастеру');
            setReqToolReturnModal(false);
            fetchCard();
          } catch (e: any) { message.error(e?.response?.data?.error || 'Ошибка'); }
        }} okText="Запросить" cancelText="Отмена">
        <p>Инструмент: <b>{reqToolReturnItem?.name}</b></p>
        <p>Инв. номер: {reqToolReturnItem?.serial_number || '—'}</p>
      </Modal>

      {/* Модал: приёмка ордера */}
      <Modal title={`Приёмка от мастера — ордер №${acceptOrder?.id}`} open={acceptModal}
        onCancel={() => setAcceptModal(false)} width={700} footer={[
          <Button key="close" onClick={() => { setAcceptModal(false); fetchCard(); }}>Закрыть</Button>,
          <Button key="complete" type="primary" icon={<CheckCircleOutlined />}
            onClick={async () => {
              try {
                await api.post(`/return-orders/${acceptOrder?.id}/complete/`);
                message.success('Приёмка завершена');
                setAcceptModal(false);
                fetchCard();
              } catch (e: any) { message.error(e?.response?.data?.error || 'Ошибка'); }
            }}>
            Завершить приёмку
          </Button>,
        ]}>
        <Table
          dataSource={acceptOrder?.items || []}
          rowKey={(r) => `roi-${r.id}`}
          pagination={false}
          size="small"
          columns={[
            { title: 'Позиция', dataIndex: 'name', key: 'name' },
            { title: 'К сдаче', dataIndex: 'quantity', key: 'qty' },
            { title: 'Серийник', dataIndex: 'serial_number', key: 'sn', render: (v: string) => v || '—' },
            {
              title: 'Принято', key: 'acc', width: 100,
              render: (_: any, r: any) => (
                <InputNumber min={0} max={r.quantity} value={r.quantity_accepted}
                  onChange={async (v) => {
                    await api.post(`/return-orders/${acceptOrder?.id}/accept_item/`, {
                      item_id: r.id, quantity_accepted: v || 0,
                    });
                    fetchCard();
                    const updated = acceptOrder?.items?.map((it: any) => it.id === r.id ? { ...it, quantity_accepted: v || 0 } : it);
                    setAcceptOrder({ ...acceptOrder, items: updated });
                  }} style={{ width: 70 }} />
              ),
            },
            {
              title: 'Состояние', key: 'cond', width: 170,
              render: (_: any, r: any) => (
                <Select
                  value={r.condition}
                  style={{ width: 150 }}
                  onChange={async (v) => {
                    await api.post(`/return-orders/${acceptOrder?.id}/accept_item/`, {
                      item_id: r.id, condition: v,
                    });
                    const updated = acceptOrder?.items?.map((it: any) => it.id === r.id ? { ...it, condition: v } : it);
                    setAcceptOrder({ ...acceptOrder, items: updated });
                  }}
                  options={[
                    { value: 'working', label: 'Рабочее' },
                    { value: 'broken', label: 'Сломанное' },
                    { value: 'repairable', label: 'Ремонтопригодное' },
                    { value: 'missing', label: 'Отсутствует' },
                  ]}
                />
              ),
            },
            {
              title: 'Примечание', key: 'notes', width: 150,
              render: (_: any, r: any) => (
                <Input size="small" defaultValue={r.notes} placeholder="Комментарий"
                  onBlur={async (e) => {
                    await api.post(`/return-orders/${acceptOrder?.id}/accept_item/`, {
                      item_id: r.id, notes: e.target.value,
                    });
                  }} />
              ),
            },
          ]}
          locale={{ emptyText: 'Позиций нет — мастер ещё ничего не сдал' }}
        />
      </Modal>
    </div>
  );
};

export default MasterDetailPage;
