import React, { useState, useEffect } from 'react';
import { Card, Typography, Spin, Tag, Space, Descriptions, Button, Divider, message, Modal, Select, Row, Col, Tabs, Input, InputNumber, List, Avatar, Table, Checkbox } from 'antd';
import { ArrowLeftOutlined, EditOutlined, PoweroffOutlined, PauseCircleOutlined, QuestionCircleOutlined, UndoOutlined, CheckOutlined, AimOutlined, EnvironmentOutlined, DollarOutlined, ToolOutlined, SendOutlined, PlusOutlined, MinusCircleOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import type { Order, Master } from '../../types';
import MasterMap from '../../components/MasterMap';

const { Title, Text } = Typography;

const OrdersDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isStaff = user?.role === 'admin' || user?.role === 'dispatcher';
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [masters, setMasters] = useState<Master[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);  // Все сотрудники для назначения
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedMasterId, setSelectedMasterId] = useState<number | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [gpsHistory, setGpsHistory] = useState<any>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState('');
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [materialModalOpen, setMaterialModalOpen] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [materialForm, setMaterialForm] = useState<Record<number, { qty: number; needReturn: boolean; oldDesc: string }>>({});
  const [materialSaving, setMaterialSaving] = useState(false);

  useEffect(() => {
    fetchOrder();
    fetchAssignableUsers();
  }, [id]);

  useEffect(() => {
    if (order) fetchComments();
  }, [order?.id]);

  const fetchAssignableUsers = async () => {
    if (!isStaff) return;
    try {
      // Загружаем и мастеров, и всех пользователей
      const [mastersRes, usersRes] = await Promise.all([
        api.get('/masters/?page_size=100'),
        api.get('/users/?page_size=200'),
      ]);
      setMasters(mastersRes.data.results || mastersRes.data || []);
      setAllUsers(usersRes.data.results || usersRes.data || []);
    } catch (error) {
      console.error('Ошибка загрузки:', error);
    }
  };

  const fetchOrder = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/orders/${id}/`);
      setOrder(response.data);
    } catch (error) {
      message.error('Ошибка загрузки заявки');
      navigate('/orders');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (newStatus: string, notes?: string, extra?: Record<string, any>) => {
    if (!order) return;
    setUpdating(true);
    try {
      const response = await api.patch(`/orders/${order.id}/`, {
        status: newStatus,
        notes: notes || '',
        ...(extra || {}),
      });
      setOrder(response.data);
      message.success(`Статус изменён: ${newStatus}`);
    } catch (error: any) {
      message.error(error?.response?.data?.error || 'Ошибка изменения статуса');
    } finally {
      setUpdating(false);
    }
  };

  const handleReceivePayment = async () => {
    const amount = prompt('Сумма оплаты (₽):', String(order?.cost || ''));
    if (!amount || !Number(amount)) return;
    const method = prompt('Способ оплаты: cash/card/transfer/online', 'cash') || 'cash';
    setUpdating(true);
    try {
      await api.post(`/orders/${order!.id}/receive_payment/`, { amount: Number(amount), payment_method: method });
      message.success('Оплата принята');
      fetchOrder();
    } catch (e: any) { message.error(e?.response?.data?.error || 'Ошибка'); }
    finally { setUpdating(false); }
  };

  const handleSubmitCash = async () => {
    setUpdating(true);
    try {
      await api.post(`/orders/${order!.id}/submit_cash/`);
      message.success('Наличные сданы в кассу');
      fetchOrder();
    } catch (e: any) { message.error(e?.response?.data?.error || 'Ошибка'); }
    finally { setUpdating(false); }
  };

  const handleAssignMaster = async () => {
    if (!order) return;
    const payload: any = {};
    if (selectedUserId) {
      payload.user_id = selectedUserId;
    } else if (selectedMasterId) {
      payload.master_id = selectedMasterId;
    } else {
      message.warning('Выберите сотрудника');
      return;
    }
    setUpdating(true);
    try {
      const response = await api.post(`/orders/${order.id}/assign/`, payload);
      setOrder(response.data);
      setAssignModalOpen(false);
      setSelectedMasterId(null);
      setSelectedUserId(null);
      message.success('Сотрудник назначен');
    } catch (error) {
      message.error('Ошибка назначения');
    } finally {
      setUpdating(false);
    }
  };

  const openAssignModal = () => {
    setSelectedMasterId(null);
    setSelectedUserId(null);
    setAssignModalOpen(true);
  };

  const handleRework = () => {
    const notes = prompt('Опишите причину возврата в работу (что нужно доделать):');
    if (!notes || !notes.trim()) {
      message.warning('Необходимо указать причину возврата');
      return;
    }
    handleStatusChange('in_progress', notes);
  };

  const fetchComments = async () => {
    if (!order) return;
    setCommentsLoading(true);
    try {
      const res = await api.get(`/orders/${order.id}/comments/`);
      setComments(res.data);
    } catch (e) { /* ignore */ }
    finally { setCommentsLoading(false); }
  };

  const handleSendComment = async () => {
    if (!order || !commentText.trim()) return;
    try {
      await api.post(`/orders/${order.id}/comments/`, { text: commentText.trim() });
      setCommentText('');
      fetchComments();
    } catch (e: any) {
      message.error(e?.response?.data?.error || 'Ошибка отправки');
    }
  };

  const openMaterialModal = async () => {
    setMaterialModalOpen(true);
    setMaterialForm({});
    try {
      const res = await api.get('/inventory/?page_size=500&status=in_stock');
      setInventoryItems(res.data.results || res.data || []);
    } catch (e) {
      setInventoryItems([]);
    }
  };

  const handleIssueMaterials = async () => {
    if (!order) return;
    const items = Object.entries(materialForm)
      .filter(([, v]) => v.qty > 0)
      .map(([invId, v]) => ({
        inventory_item_id: parseInt(invId),
        quantity_issued: v.qty,
        need_return_old: v.needReturn,
        old_item_description: v.oldDesc,
      }));
    if (items.length === 0) { message.warning('Выберите хотя бы один материал'); return; }

    // Ищем мастера — либо назначенный, либо текущий сотрудник
    let masterId = order.master?.id;
    if (!masterId) {
      try {
        const usersRes = await api.get('/masters/?page_size=100');
        const mastersList = usersRes.data.results || usersRes.data || [];
        // Ищем мастера текущего пользователя
        const me = mastersList.find((m: any) => m.user?.id === user?.id);
        if (me) masterId = me.id;
      } catch (e) { /* ignore */ }
    }
    if (!masterId) { message.warning('У заявки нет исполнителя. Сначала назначьте сотрудника.'); return; }

    setMaterialSaving(true);
    try {
      await api.post('/issue-orders/', {
        order_id: order.id,
        master_id: masterId,
        notes: `Выдача материалов по заявке #${order.number}`,
        items,
      });
      message.success('Материалы выданы!');
      setMaterialModalOpen(false);
      fetchOrder();
    } catch (e: any) {
      message.error(e?.response?.data?.error || 'Ошибка выдачи материалов');
    } finally {
      setMaterialSaving(false);
    }
  };

  const fetchGpsHistory = async () => {
    if (!order) return;
    setGpsLoading(true);
    try {
      const response = await api.get(`/orders/${order.id}/gps_history/`);
      setGpsHistory(response.data);
    } catch (error) {
      setGpsHistory(null);
    } finally {
      setGpsLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!order) return;
    setUpdating(true);
    try {
      const response = await api.post(`/orders/${order.id}/confirm/`, { notes: 'Заявка подтверждена' });
      setOrder(response.data);
      message.success('Заявка подтверждена');
    } catch (error: any) {
      message.error(error?.response?.data?.error || 'Ошибка подтверждения');
    } finally {
      setUpdating(false);
    }
  };
  const handleAccept = () => handleStatusChange('accepted', 'Заявка принята');
  const handleStart = () => handleStatusChange('in_progress', 'Начато выполнение');
  const handleComplete = () => {
    const notes = prompt('Опишите, что сделано по заявке (обязательно):');
    if (!notes || !notes.trim()) {
      message.warning('Необходимо описать проделанную работу');
      return;
    }
    handleStatusChange('completed', notes);
  };
  const handleCancel = () => handleStatusChange('cancelled', 'Заявка отменена');
  const handlePause = () => {
    const notes = prompt('Укажите причину паузы (обязательно):');
    if (notes) handleStatusChange('paused', notes);
  };
  const handleNeedHelp = () => {
    const notes = prompt('Опишите, какая помощь требуется:');
    if (notes) handleStatusChange('need_help', notes);
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!order) {
    return null;
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      new: 'Новая', assigned: 'Назначена', accepted: 'Принята',
      in_progress: 'В работе', paused: 'На паузе', need_help: 'Требуется помощь',
      completed: 'Выполнена', confirmed: 'Подтверждена', cancelled: 'Отменена',
    };
    return labels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      new: 'blue', assigned: 'purple', accepted: 'cyan',
      in_progress: 'orange', paused: 'gold', need_help: 'red',
      completed: 'green', confirmed: 'green', cancelled: 'default',
    };
    return colors[status] || 'default';
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      repair: 'blue',
      connection: 'purple',
      sale: 'green',
    };
    return colors[type] || 'default';
  };

  const priorities: Record<string, string> = {
    low: 'Низкий',
    medium: 'Средний',
    high: 'Высокий',
    urgent: 'Срочный',
  };

  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Card>
      <Space style={{ marginBottom: 16 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/orders')}
        >
          Назад
        </Button>
        <Title level={3} style={{ margin: 0 }}>
          Заявка #{order.number}
        </Title>
      </Space>

      <Descriptions bordered column={3} size="small">
        <Descriptions.Item label="Статус" span={1}>
          <Tag color={getStatusColor(order.status)}>
            {getStatusLabel(order.status)}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Тип" span={1}>
          <Tag color={getTypeColor(order.order_type)}>
            {order.order_type === 'repair' ? 'Ремонт' : order.order_type === 'connection' ? 'Подключение' : 'Продажа'}
          </Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Приоритет" span={1}>
          <Text>
            {priorities[order.priority] || order.priority}
          </Text>
        </Descriptions.Item>
      </Descriptions>

      <Divider />

      <Descriptions title="Информация о заявке" column={2} size="small">
        <Descriptions.Item label="Номер">{order.number}</Descriptions.Item>
        <Descriptions.Item label="Клиент">
          {order.client_id ? (
            <a onClick={() => navigate(`/clients/${order.client_id}`)} style={{ cursor: 'pointer', textDecoration: 'underline' }}>
              {order.client_info?.full_name || '—'}
            </a>
          ) : (order.client_info?.full_name || '—')}
        </Descriptions.Item>
        <Descriptions.Item label="Телефон клиента">{order.client_info?.phone || '-'}</Descriptions.Item>
        <Descriptions.Item label="Адрес">{order.address}</Descriptions.Item>
        <Descriptions.Item label="Район">{order.region_info?.name || '-'}</Descriptions.Item>
        <Descriptions.Item label="Исполнитель">{order.master_info?.full_name || 'Не назначен'}</Descriptions.Item>
        <Descriptions.Item label="Описание">{order.description}</Descriptions.Item>
        {order.cost != null && <Descriptions.Item label="Стоимость">{order.cost} ₽</Descriptions.Item>}
        {order.payment_type && <Descriptions.Item label="Тип оплаты">{order.payment_type_display}</Descriptions.Item>}
        {order.photo_report_required && <Descriptions.Item label="Фотоотчёт"><Tag color="orange">Требуется</Tag></Descriptions.Item>}
        {order.deadline && <Descriptions.Item label="Срок">{new Date(order.deadline).toLocaleDateString('ru-RU')}</Descriptions.Item>}
      </Descriptions>

      {/* Диалог / комментарии внутри заявки */}
      <Divider />
      <Title level={5}>💬 Обсуждение заявки</Title>
      <div style={{ maxHeight: 400, overflowY: 'auto', marginBottom: 12, background: '#fafafa', borderRadius: 8, padding: 12 }}>
        {commentsLoading ? (
          <Spin size="small" />
        ) : comments.length === 0 ? (
          <Text type="secondary">Пока нет комментариев. Начните обсуждение.</Text>
        ) : (
          <List
            dataSource={comments}
            renderItem={(c: any) => (
              <List.Item style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                <List.Item.Meta
                  avatar={<Avatar style={{ backgroundColor: c.event_type === 'status_changed' ? '#1677ff' : '#52c41a' }}>{c.author_name?.[0]?.toUpperCase()}</Avatar>}
                  title={
                    <Space>
                      <Text strong>{c.author_name}</Text>
                      <Text type="secondary" style={{ fontSize: 11 }}>{new Date(c.created_at).toLocaleString('ru-RU')}</Text>
                      {c.event_type !== 'comment' && <Tag color="blue" style={{ fontSize: 10 }}>{c.event_type}</Tag>}
                    </Space>
                  }
                  description={<Text style={{ whiteSpace: 'pre-wrap' }}>{c.text}</Text>}
                />
              </List.Item>
            )}
          />
        )}
      </div>
      <Space.Compact style={{ width: '100%' }}>
        <Input
          placeholder="Напишите комментарий..."
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          onPressEnter={handleSendComment}
        />
        <Button type="primary" icon={<SendOutlined />} onClick={handleSendComment} loading={commentsLoading}>
          Отправить
        </Button>
      </Space.Compact>

      {/* Материалы со склада */}
      <Divider />
      <Space style={{ marginBottom: 8 }}>
        <Title level={5} style={{ margin: 0 }}>📦 Материалы со склада</Title>
        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={openMaterialModal}>
          Выдать материалы
        </Button>
      </Space>
      {order.issue_orders && order.issue_orders.length > 0 ? (
        order.issue_orders.map((io: any) => (
          <Card key={io.id} size="small" style={{ marginBottom: 8 }} title={
            <Space>
              <Text strong>Ордер №{io.id}</Text>
              <Tag>{io.status_display}</Tag>
              <Text type="secondary">{io.master_name} · {new Date(io.issued_at).toLocaleDateString('ru-RU')}</Text>
            </Space>
          }>
            <Table
              dataSource={io.items}
              rowKey="id"
              size="small"
              pagination={false}
              columns={[
                { title: 'Материал', dataIndex: 'item_name', key: 'item_name' },
                { title: 'Штрихкод', dataIndex: 'barcode', key: 'barcode', render: (v: string) => v || '—' },
                { title: 'Выдано', dataIndex: 'quantity_issued', key: 'quantity_issued' },
                { title: 'Исп.', dataIndex: 'quantity_used', key: 'quantity_used' },
                { title: 'Возвр.', dataIndex: 'quantity_returned', key: 'quantity_returned' },
                { title: 'Остаток', dataIndex: 'remaining', key: 'remaining', render: (v: number) => v > 0 ? <Tag color="orange">{v}</Tag> : <Tag color="green">0</Tag> },
                { title: 'Возврат старого', dataIndex: 'old_item_description', key: 'old', render: (v: string, r: any) => r.need_return_old ? (r.old_item_returned ? <Tag color="green">✓ {v}</Tag> : <Tag color="red">Ожидает: {v || '?'}</Tag>) : '—' },
              ]}
            />
          </Card>
        ))
      ) : (
        <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>Материалы ещё не выдавались</Text>
      )}

      {/* Модалка: выдать материалы со склада */}
      <Modal
        title="Выдать материалы со склада"
        open={materialModalOpen}
        onCancel={() => setMaterialModalOpen(false)}
        onOk={handleIssueMaterials}
        confirmLoading={materialSaving}
        okText="Выдать"
        cancelText="Отмена"
        width={700}
      >
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          {inventoryItems.length === 0 ? (
            <Spin />
          ) : (
            <Table
              dataSource={inventoryItems}
              rowKey="id"
              size="small"
              pagination={false}
              columns={[
                { title: 'Материал', dataIndex: 'name', key: 'name' },
                { title: 'Штрихкод', dataIndex: 'barcode', key: 'barcode', render: (v: string) => v || '—' },
                { title: 'На складе', dataIndex: 'quantity', key: 'quantity', render: (v: number) => <Tag color={v > 0 ? 'green' : 'red'}>{v}</Tag> },
                {
                  title: 'Кол-во', key: 'qty', width: 80,
                  render: (_: any, r: any) => (
                    <InputNumber
                      min={0}
                      max={r.quantity}
                      value={materialForm[r.id]?.qty || 0}
                      onChange={(v) => setMaterialForm(prev => ({ ...prev, [r.id]: { ...prev[r.id], qty: v || 0 } }))}
                      style={{ width: 60 }}
                      size="small"
                    />
                  ),
                },
                {
                  title: 'Возврат старого', key: 'needReturn', width: 140,
                  render: (_: any, r: any) => (
                    <Space size={4}>
                      <Checkbox
                        checked={materialForm[r.id]?.needReturn || false}
                        onChange={(e) => setMaterialForm(prev => ({ ...prev, [r.id]: { ...prev[r.id], needReturn: e.target.checked } }))}
                      />
                      <Input
                        size="small"
                        placeholder="Что вернуть?"
                        value={materialForm[r.id]?.oldDesc || ''}
                        onChange={(e) => setMaterialForm(prev => ({ ...prev, [r.id]: { ...prev[r.id], oldDesc: e.target.value } }))}
                        style={{ width: 110 }}
                        disabled={!materialForm[r.id]?.needReturn}
                      />
                    </Space>
                  ),
                },
                { title: 'Ед.', dataIndex: 'unit', key: 'unit', width: 50, render: (v: string) => v || 'шт.' },
              ]}
            />
          )}
        </div>
      </Modal>

      {order.media && order.media.length > 0 && (
        <>
          <Divider />
          <Title level={5}>Фото/видео отчёты мастера</Title>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16 }}>
            {order.media.map((mediaItem) => {
              const fileUrl = mediaItem.file;
              return (
                <Card key={mediaItem.id} size="small" style={{ width: 220 }} hoverable>
                  {mediaItem.file_type === 'image' ? (
                    <img
                      src={fileUrl}
                      alt={mediaItem.notes || 'Фото'}
                      style={{ width: '100%', height: 150, objectFit: 'cover', borderRadius: 4, cursor: 'pointer' }}
                      onClick={() => window.open(fileUrl, '_blank')}
                    />
                  ) : (
                    <video
                      src={fileUrl}
                      controls
                      style={{ width: '100%', height: 150, borderRadius: 4 }}
                    />
                  )}
                  <div style={{ marginTop: 6, fontSize: 11, color: '#888' }}>
                    <div>{mediaItem.file_type === 'image' ? '📷 Фото' : '🎬 Видео'}</div>
                    <div>{new Date(mediaItem.uploaded_at).toLocaleString('ru-RU')}</div>
                    {mediaItem.uploaded_by && <div>Загрузил: {mediaItem.uploaded_by.username}</div>}
                    {mediaItem.notes && <div style={{ color: '#555', marginTop: 2 }}>{mediaItem.notes}</div>}
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {order.history && order.history.length > 0 && (
        <>
          <Divider />
          <Title level={5}>История изменений</Title>
          {order.history.map((historyItem, index) => (
            <Card key={index} size="small" title={`Изменение ${index + 1}`} style={{ marginBottom: 8 }}>
              <Descriptions size="small" column={2}>
                <Descriptions.Item label="Статус">
                  {historyItem.old_status && historyItem.new_status ? (
                    <Space>
                      <Tag color="red">{getStatusLabel(historyItem.old_status)}</Tag>
                      →
                      <Tag color="green">{getStatusLabel(historyItem.new_status)}</Tag>
                    </Space>
                  ) : (
                    <Tag color="green">{getStatusLabel(historyItem.new_status)}</Tag>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Время">
                  {formatDateTime(historyItem.changed_at)}
                </Descriptions.Item>
                <Descriptions.Item label="Изменил">
                  {historyItem.changed_by?.username || '-'}
                </Descriptions.Item>
                {historyItem.notes && (
                  <Descriptions.Item label="Примечания" span={2}>
                    {historyItem.notes}
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Card>
          ))}
        </>
      )}

      {order.master && (
        <>
          <Divider />
          <Space align="center" style={{ marginBottom: 8 }}>
            <Button icon={<AimOutlined />} onClick={fetchGpsHistory} loading={gpsLoading} size="small">
              GPS-история
            </Button>
            <Text type="secondary">Показать где был мастер при смене статусов</Text>
          </Space>

          {gpsHistory && gpsHistory.history && (
            <Card size="small" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={14}>
                  <MasterMap
                    latitude={gpsHistory.current?.lat || 0}
                    longitude={gpsHistory.current?.lon || 0}
                    masterName={order.master_info?.full_name || order.master?.full_name || ''}
                    speed={gpsHistory.current?.speed}
                    height="280px"
                  />
                  {gpsHistory.current?.last_update && (
                    <div style={{ marginTop: 4, color: '#888', fontSize: 11 }}>
                      Текущая позиция: {new Date(gpsHistory.current.last_update).toLocaleString('ru-RU')}
                      {' · '}{gpsHistory.current.is_online ? '🟢 Онлайн' : '🔴 Офлайн'}
                    </div>
                  )}
                </Col>
                <Col span={10}>
                  <div style={{ fontSize: 12, maxHeight: 280, overflowY: 'auto' }}>
                    <Text strong>Точки по статусам:</Text>
                    {gpsHistory.history.filter((h: any) => h.lat && h.lon).map((h: any, i: number) => (
                      <div key={i} style={{ marginTop: 8, padding: '4px 0', borderBottom: '1px solid #f0f0f0' }}>
                        <Tag>{getStatusLabel(h.status)}{h.lat && h.lon ? ' 📍' : ''}</Tag>
                        <div style={{ color: '#888' }}>{formatDateTime(h.changed_at)}</div>
                        {h.lat && (
                          <a
                            href={`https://yandex.ru/maps/?pt=${h.lon},${h.lat}&z=16`}
                            target="_blank"
                            rel="noreferrer"
                            style={{ color: '#1677ff', cursor: 'pointer', fontSize: 12 }}
                          >
                            🗺️ {h.lat.toFixed(5)}, {h.lon.toFixed(5)} — открыть на карте
                          </a>
                        )}
                      </div>
                    ))}
                    {gpsHistory.history.filter((h: any) => h.lat && h.lon).length === 0 && (
                      <div style={{ color: '#999', marginTop: 8 }}>
                        <EnvironmentOutlined /> Нет записанных GPS-координат для этой заявки.
                        Координаты фиксируются при смене статуса мастером.
                      </div>
                    )}
                  </div>
                </Col>
              </Row>
            </Card>
          )}

          {gpsHistory && gpsHistory.error && (
            <div style={{ marginBottom: 16, color: '#ff4d4f', fontSize: 13 }}>{gpsHistory.error}</div>
          )}
        </>
      )}

      <Divider />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {order.status === 'new' && isStaff && (
          <Button type="primary" onClick={openAssignModal} loading={updating}>
            Назначить сотрудника
          </Button>
        )}
        {['assigned', 'accepted', 'in_progress', 'paused', 'need_help'].includes(order.status) && isStaff && (
          <Button onClick={openAssignModal} loading={updating}>
            Переназначить сотрудника
          </Button>
        )}
        {order.status === 'assigned' && (
          <Button type="primary" onClick={handleAccept} loading={updating}>
            Принять заявку
          </Button>
        )}
        {order.status === 'accepted' && (
          <Button type="primary" icon={<PoweroffOutlined />} onClick={handleStart} loading={updating}>
            Начать выполнение
          </Button>
        )}
        {order.status === 'in_progress' && (
          <>
            <Button type="primary" icon={<PoweroffOutlined />} onClick={handleComplete} loading={updating}>
              Выполнено
            </Button>
            <Button icon={<PauseCircleOutlined />} onClick={handlePause} loading={updating}>
              На паузу
            </Button>
            <Button danger icon={<QuestionCircleOutlined />} onClick={handleNeedHelp} loading={updating}>
              Требуется помощь
            </Button>
          </>
        )}
        {order.status === 'paused' && (
          <Button type="primary" icon={<PoweroffOutlined />} onClick={handleStart} loading={updating}>
            Продолжить
          </Button>
        )}
        {order.status === 'need_help' && (
          <Button type="primary" icon={<PoweroffOutlined />} onClick={handleStart} loading={updating}>
            Продолжить
          </Button>
        )}
        {order.status === 'completed' && isStaff && (
          <>
            <Button type="primary" icon={<CheckOutlined />} onClick={handleConfirm} loading={updating}>
              Подтвердить
            </Button>
            <Button icon={<UndoOutlined />} onClick={handleRework} loading={updating}>
              Вернуть в работу
            </Button>
          </>
        )}
        {order.status === 'completed' && !isStaff && (
          <Tag color="orange">Ожидает подтверждения диспетчера</Tag>
        )}
        <Divider />
        <Space>
          <Button icon={<DollarOutlined />} onClick={handleReceivePayment} loading={updating}>
            💰 Принять оплату
          </Button>
          <Button onClick={handleSubmitCash} loading={updating}>
            🏦 Сдать в кассу
          </Button>
        </Space>
        {!['completed', 'cancelled', 'confirmed'].includes(order.status) && (
          <Button danger onClick={handleCancel} loading={updating}>
            Отменить
          </Button>
        )}
        {!['completed', 'confirmed'].includes(order.status) && isStaff && (
          <Button onClick={() => navigate(`/orders/${order.id}/edit`)}>
            <EditOutlined /> Редактировать
          </Button>
        )}
      </div>

      <Modal
        title="Назначить сотрудника"
        open={assignModalOpen}
        onOk={handleAssignMaster}
        onCancel={() => setAssignModalOpen(false)}
        confirmLoading={updating}
        okText="Назначить"
        cancelText="Отмена"
        okButtonProps={{ disabled: !selectedMasterId && !selectedUserId }}
        width={450}
      >
        <Tabs
          items={[
            {
              key: 'masters',
              label: '👨‍🔧 Мастера',
              children: (
                <Select
                  style={{ width: '100%' }}
                  placeholder="Выберите мастера"
                  value={selectedMasterId}
                  onChange={(v) => { setSelectedMasterId(v); setSelectedUserId(null); }}
                  showSearch
                  optionFilterProp="label"
                  options={masters
                    .filter(m => true) // все мастера
                    .map(m => ({
                      value: m.id,
                      label: `${m.full_name || m.user?.first_name} — ${m.region?.name || 'без района'} (${m.phone})`,
                    }))}
                />
              ),
            },
            {
              key: 'all',
              label: '👥 Все сотрудники',
              children: (
                <Select
                  style={{ width: '100%' }}
                  placeholder="Любой сотрудник (инженер, монтажник...)"
                  value={selectedUserId}
                  onChange={(v) => { setSelectedUserId(v); setSelectedMasterId(null); }}
                  showSearch
                  optionFilterProp="label"
                  options={allUsers
                    .filter(u => u.user?.id && u.role) // все с ролью
                    .map(u => ({
                      value: u.user.id,
                      label: `${u.user.first_name} ${u.user.last_name} (${u.user.username}) — ${u.role}`,
                    }))}
                />
              ),
            },
          ]}
        />
      </Modal>
    </Card>
  );
};

export default OrdersDetailPage;
