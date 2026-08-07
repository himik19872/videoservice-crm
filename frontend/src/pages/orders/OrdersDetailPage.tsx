import React, { useState, useEffect } from 'react';
import { Card, Typography, Spin, Tag, Space, Descriptions, Button, Divider, message, Modal, Select, Row, Col, Tabs, Input, InputNumber, List, Avatar, Table, Checkbox, Popconfirm, DatePicker, TimePicker } from 'antd';
import { ArrowLeftOutlined, EditOutlined, PoweroffOutlined, PauseCircleOutlined, QuestionCircleOutlined, UndoOutlined, CheckOutlined, AimOutlined, EnvironmentOutlined, DollarOutlined, ToolOutlined, SendOutlined, PlusOutlined, MinusCircleOutlined, LinkOutlined, DisconnectOutlined, FileTextOutlined, CalendarOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import type { Order, Master } from '../../types';
import MasterMap from '../../components/MasterMap';
import dayjs from 'dayjs';

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
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [availableFrom, setAvailableFrom] = useState<string>('09:00');
  const [availableTo, setAvailableTo] = useState<string>('18:00');
  const [gpsHistory, setGpsHistory] = useState<any>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState('');
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [materialModalOpen, setMaterialModalOpen] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<any[]>([]);
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [materialForm, setMaterialForm] = useState<Record<number, { qty: number; needReturn: boolean; oldDesc: string }>>({});
  const [materialSaving, setMaterialSaving] = useState(false);
  // Объединение заявок
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [linkSearchText, setLinkSearchText] = useState('');
  const [linkSearchResults, setLinkSearchResults] = useState<any[]>([]);
  const [selectedLinkIds, setSelectedLinkIds] = useState<number[]>([]);
  // Сметы / КП
  const [estimates, setEstimates] = useState<any[]>([]);
  const [estimatesLoading, setEstimatesLoading] = useState(false);
  const [createEstimateModalOpen, setCreateEstimateModalOpen] = useState(false);
  const [linkEstimateModalOpen, setLinkEstimateModalOpen] = useState(false);
  const [allEstimates, setAllEstimates] = useState<any[]>([]);
  const [estimateForm, setEstimateForm] = useState({
    name: '', discount: 0, commission: 0, dealer_fee: 0,
    unexpected_costs: 0, delivery_type: 'client', delivery_cost: 0,
    tax_type: 'usn', tax_rate: 6, note: '',
    employee: '', employee_phone: '',
  });
  const [estimateItems, setEstimateItems] = useState<any[]>([]);
  const [createEstimateSaving, setCreateEstimateSaving] = useState(false);

  useEffect(() => {
    fetchOrder();
    fetchAssignableUsers();
  }, [id]);

  useEffect(() => {
    if (order) {
      fetchComments();
      fetchEstimates();
    }
  }, [order?.id]);

  const fetchEstimates = async () => {
    if (!order) return;
    setEstimatesLoading(true);
    try {
      const res = await api.get(`/estimates/?order=${order.id}&page_size=50`);
      setEstimates(res.data.results || res.data);
    } catch (e) { /* ignore */ }
    finally { setEstimatesLoading(false); }
  };

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
      const response = await api.post(`/orders/${order.id}/assign/`, {
        ...payload,
        scheduled_at: scheduledAt || undefined,
        client_available_from: availableFrom,
        client_available_to: availableTo,
      });
      setOrder(response.data);
      setAssignModalOpen(false);
      setSelectedMasterId(null);
      setSelectedUserId(null);
      setScheduledAt(null);
      setAvailableFrom('09:00');
      setAvailableTo('18:00');
      message.success('Сотрудник назначен');
    } catch (error) {
      message.error('Ошибка назначения');
    } finally {
      setUpdating(false);
    }
  };

  const handleNotifyMaster = async () => {
    if (!order) return;
    Modal.confirm({
      title: 'Отправить уведомление',
      content: `Мастер ${order.master_info?.full_name || ''} получит push-уведомление о заявке #${order.number}. Отправить?`,
      okText: '📣 Отправить',
      cancelText: 'Отмена',
      onOk: async () => {
        try {
          await api.post(`/orders/${order.id}/notify_master/`);
          message.success(`Уведомление отправлено мастеру`);
        } catch (e: any) {
          message.error(e?.response?.data?.error || 'Ошибка');
        }
      },
    });
  };

  const searchOrdersForLink = async (text: string) => {
    setLinkSearchText(text);
    if (text.length < 2) { setLinkSearchResults([]); return; }
    try {
      const res = await api.get(`/orders/?search=${text}&page_size=20`);
      const all = res.data.results || res.data || [];
      // Исключаем текущую и уже привязанные
      setLinkSearchResults(all.filter((o: any) => o.id !== order?.id && !o.parent_order));
    } catch {}
  };

  const handleLinkOrders = async () => {
    if (!order || selectedLinkIds.length === 0) return;
    try {
      const res = await api.post(`/orders/${order.id}/link_orders/`, { child_ids: selectedLinkIds });
      message.success(`Объединено заявок: ${res.data.linked_count}`);
      setLinkModalOpen(false);
      setSelectedLinkIds([]);
      setLinkSearchText('');
      fetchOrder();
    } catch (e: any) {
      message.error(e?.response?.data?.error || 'Ошибка');
    }
  };

  const handleUnlinkOrders = async () => {
    if (!order) return;
    Modal.confirm({
      title: 'Разъединить заявки',
      content: `Все дочерние заявки будут отвязаны от #${order.number}. Продолжить?`,
      onOk: async () => {
        try {
          const res = await api.post(`/orders/${order.id}/unlink_orders/`);
          message.success(`Отвязано заявок: ${res.data.unlinked_count}`);
          fetchOrder();
        } catch (e: any) {
          message.error(e?.response?.data?.error || 'Ошибка');
        }
      },
    });
  };

  const openAssignModal = () => {
    setSelectedMasterId(null);
    setSelectedUserId(null);
    setScheduledAt(order?.scheduled_at || null);
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
    setInventorySearch('');
    fetchInventory('');
  };

  const fetchInventory = async (search: string) => {
    setInventoryLoading(true);
    try {
      const params = new URLSearchParams({ page_size: '500', status: 'in_stock' });
      if (search.trim()) params.append('search', search.trim());
      const res = await api.get(`/inventory/?${params.toString()}`);
      setInventoryItems(res.data.results || res.data || []);
    } catch (e) {
      setInventoryItems([]);
    } finally {
      setInventoryLoading(false);
    }
  };

  const handleIssueMaterials = async () => {
    if (!order) return;
    const items = Object.entries(materialForm)
      .filter(([, v]) => v.qty > 0)
      .map(([invId, v]) => ({
        inventory_item_id: parseInt(invId),
        quantity_issued: v.qty,
        source: v.source || 'warehouse',
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

  const handleCreateEstimate = async () => {
    if (!order || !estimateForm.name.trim()) {
      message.warning('Введите название сметы');
      return;
    }
    setCreateEstimateSaving(true);
    try {
      // Создаём смету
      const res = await api.post('/estimates/', {
        ...estimateForm,
        client_id: order.client?.id,
        order_id: order.id,
        status: 'draft',
      });
      const estimateId = res.data.id;
      // Добавляем позиции, если есть
      for (const item of estimateItems) {
        await api.post(`/estimates/${estimateId}/add_item/`, item);
      }
      message.success('Смета создана и привязана к заявке');
      setCreateEstimateModalOpen(false);
      setEstimateForm({ name: '', discount: 0, commission: 0, dealer_fee: 0, unexpected_costs: 0, delivery_type: 'client', delivery_cost: 0, tax_type: 'usn', tax_rate: 6, note: '', employee: '', employee_phone: '' });
      setEstimateItems([]);
      fetchEstimates();
    } catch (e: any) {
      message.error(e?.response?.data?.error || 'Ошибка создания сметы');
    } finally {
      setCreateEstimateSaving(false);
    }
  };

  const handleLinkEstimate = async () => {
    if (!order || selectedLinkIds.length === 0) return;
    try {
      for (const estId of selectedLinkIds) {
        await api.patch(`/estimates/${estId}/`, { order: order.id });
      }
      message.success(`Привязано смет: ${selectedLinkIds.length}`);
      setLinkEstimateModalOpen(false);
      setSelectedLinkIds([]);
      fetchEstimates();
    } catch (e: any) {
      message.error(e?.response?.data?.error || 'Ошибка привязки сметы');
    }
  };

  const handleUnlinkEstimate = async (estimateId: number) => {
    try {
      await api.patch(`/estimates/${estimateId}/`, { order: null });
      message.success('Смета отвязана');
      fetchEstimates();
    } catch (e: any) {
      message.error(e?.response?.data?.error || 'Ошибка');
    }
  };

  const openCreateEstimateModal = () => {
    setEstimateForm({
      name: `Смета по заявке #${order?.number || ''}`,
      discount: 0, commission: 0, dealer_fee: 0,
      unexpected_costs: 0, delivery_type: 'client', delivery_cost: 0,
      tax_type: 'usn', tax_rate: 6, note: '',
      employee: '', employee_phone: '',
    });
    setEstimateItems([]);
    setCreateEstimateModalOpen(true);
  };

  const openLinkEstimateModal = async () => {
    setSelectedLinkIds([]);
    try {
      const res = await api.get('/estimates/?page_size=50&status=draft');
      const all = res.data.results || res.data;
      // Исключаем уже привязанные к этой заявке
      setAllEstimates(all.filter((e: any) => !e.order || e.order !== order?.id));
    } catch (e) { setAllEstimates([]); }
    setLinkEstimateModalOpen(true);
  };

  const addEstimateItem = () => {
    setEstimateItems(prev => [...prev, {
      item_type: 'custom_service',
      name: '', unit: 'шт', quantity: 1, cost_price: 0, sale_price: 0, discount: 0,
    }]);
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

  const statusLabels: Record<string, string> = {
    new: 'Новая', assigned: 'Назначена', accepted: 'Принята',
    in_progress: 'В работе', paused: 'На паузе', need_help: 'Нужна помощь',
    completed: 'Выполнена', confirmed: 'Подтверждена', cancelled: 'Отменена',
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
          {order.client?.id ? (
            <a onClick={() => navigate(`/clients/${order.client.id}`)} style={{ cursor: 'pointer', textDecoration: 'underline', color: '#1677ff' }}>
              {order.client_info?.full_name || '—'}
            </a>
          ) : (order.client_info?.full_name || '—')}
        </Descriptions.Item>
        <Descriptions.Item label="Телефон клиента">{order.client_info?.phone || '-'}</Descriptions.Item>
        <Descriptions.Item label="Адрес">{order.address}</Descriptions.Item>
        {/* Умный домофон: IP и коды */}
        {(order.entrance_ip || order.entrance_access_code || order.entrance_programming_code) && (
          <>
            <Descriptions.Item label="🔌 IP панели">
              {order.entrance_ip ? <Tag color="blue">{order.entrance_ip}</Tag> : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="🔑 Код доступа">
              {order.entrance_access_code ? <Tag color="green">{order.entrance_access_code}</Tag> : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="⚙️ Код программирования">
              {order.entrance_programming_code ? <Tag color="orange">{order.entrance_programming_code}</Tag> : '—'}
            </Descriptions.Item>
          </>
        )}
        <Descriptions.Item label="Район">{order.region_info?.name || '-'}</Descriptions.Item>
        <Descriptions.Item label="Исполнитель">
          <Space>
            <span>{order.master_info?.full_name || 'Не назначен'}</span>
            {order.master_info && isStaff && (
              <Button
                size="small"
                type="primary"
                ghost
                icon={<SendOutlined />}
                onClick={handleNotifyMaster}
              >
                Уведомить
              </Button>
            )}
          </Space>
        </Descriptions.Item>
        <Descriptions.Item label="Описание">{order.description}</Descriptions.Item>
        {order.cost != null && <Descriptions.Item label="Стоимость">{order.cost} ₽</Descriptions.Item>}
        {order.payment_type && <Descriptions.Item label="Тип оплаты">{order.payment_type_display}</Descriptions.Item>}
        {order.photo_report_required && <Descriptions.Item label="Фотоотчёт"><Tag color="orange">Требуется</Tag></Descriptions.Item>}
        {order.deadline && <Descriptions.Item label="Срок">{new Date(order.deadline).toLocaleDateString('ru-RU')}</Descriptions.Item>}
      </Descriptions>

      {/* Объединённые заявки */}
      {isStaff && (
        <>
          <Divider />
          <Space>
            <Text strong>🔗 Объединённые заявки:</Text>
            <Button size="small" icon={<LinkOutlined />} onClick={() => { setSelectedLinkIds([]); setLinkSearchText(''); setLinkSearchResults([]); setLinkModalOpen(true); }}>Объединить</Button>
            {order.linked_orders && order.linked_orders.length > 0 && (
              <Button size="small" icon={<DisconnectOutlined />} danger onClick={handleUnlinkOrders}>Разъединить</Button>
            )}
          </Space>
          {order.linked_orders && order.linked_orders.length > 0 ? (
            <Table
              size="small"
              pagination={false}
              style={{ marginTop: 8 }}
              dataSource={order.linked_orders}
              rowKey="id"
              columns={[
                { title: 'Номер', dataIndex: 'number', key: 'number', render: (v: string, r: any) => <a onClick={() => navigate(`/orders/${r.id}`)}>{v}</a> },
                { title: 'Адрес', dataIndex: 'address', key: 'address' },
                { title: 'Статус', dataIndex: 'status', key: 'status', render: (s: string) => <Tag>{statusLabels[s] || s}</Tag> },
              ]}
            />
          ) : (
            <Text type="secondary" style={{ marginLeft: 8 }}>Нет</Text>
          )}
          {order.parent_order && (
            <div style={{ marginTop: 4 }}>
              <Text type="secondary">↳ Входит в заявку: </Text>
              <a onClick={() => order.parent_order && navigate(`/orders/${order.parent_order.id}`)}>
                #{order.parent_order.number}
              </a>
            </div>
          )}
        </>
      )}

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
        title="Выдать материалы"
        open={materialModalOpen}
        onCancel={() => setMaterialModalOpen(false)}
        onOk={handleIssueMaterials}
        confirmLoading={materialSaving}
        okText="Выдать"
        cancelText="Отмена"
        width={750}
      >
        <div style={{ marginBottom: 12 }}>
          <Input
            placeholder="🔍 Поиск по названию, артикулу, штрихкоду..."
            value={inventorySearch}
            onChange={(e) => {
              setInventorySearch(e.target.value);
              fetchInventory(e.target.value);
            }}
            allowClear
            style={{ marginBottom: 8 }}
          />
        </div>
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          {inventoryLoading || inventoryItems.length === 0 ? (
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
                  title: 'Источник', key: 'source', width: 110,
                  render: (_: any, r: any) => (
                    <Select
                      size="small"
                      value={materialForm[r.id]?.source || 'warehouse'}
                      onChange={(v) => setMaterialForm(prev => ({ ...prev, [r.id]: { ...prev[r.id], source: v } }))}
                      style={{ width: 105 }}
                      options={[
                        { value: 'warehouse', label: '🏭 Склад' },
                        { value: 'master_zip', label: '🎒 ЗИП' },
                      ]}
                    />
                  ),
                },
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

      {/* Сметы / КП */}
      <Divider />
      <Space style={{ marginBottom: 8 }}>
        <Title level={5} style={{ margin: 0 }}>📋 Сметы / КП</Title>
        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={openCreateEstimateModal}>
          Создать смету
        </Button>
        <Button size="small" icon={<LinkOutlined />} onClick={openLinkEstimateModal}>
          Привязать существующую
        </Button>
      </Space>
      {estimatesLoading ? (
        <Spin size="small" />
      ) : estimates.length === 0 ? (
        <Text type="secondary" style={{ display: 'block', marginBottom: 12 }}>Нет привязанных смет</Text>
      ) : (
        <Table
          dataSource={estimates}
          rowKey="id"
          size="small"
          pagination={false}
          style={{ marginBottom: 12 }}
          columns={[
            {
              title: 'Номер', dataIndex: 'number', key: 'number',
              render: (v: string, r: any) => (
                <a onClick={() => navigate(`/estimates/${r.id}`)} style={{ cursor: 'pointer' }}>
                  {v}
                </a>
              ),
            },
            { title: 'Название', dataIndex: 'name', key: 'name' },
            {
              title: 'Статус', dataIndex: 'status_display', key: 'status',
              render: (v: string) => {
                const colors: Record<string, string> = { 'Черновик': 'default', 'Отправлено': 'blue', 'Согласовано': 'green', 'Отклонено': 'red', 'В работе': 'orange', 'Завершено': 'green' };
                return <Tag color={colors[v] || 'default'}>{v}</Tag>;
              },
            },
            { title: 'Сумма', dataIndex: 'total', key: 'total', render: (v: string) => `${Number(v).toLocaleString('ru-RU')} ₽` },
            {
              title: '', key: 'actions', width: 80,
              render: (_: any, r: any) => (
                <Popconfirm title="Отвязать смету от заявки?" onConfirm={() => handleUnlinkEstimate(r.id)}>
                  <Button size="small" danger icon={<DisconnectOutlined />} />
                </Popconfirm>
              ),
            },
          ]}
        />
      )}

      {/* Модалка: создать смету */}
      <Modal
        title="Создать смету / КП"
        open={createEstimateModalOpen}
        onCancel={() => setCreateEstimateModalOpen(false)}
        onOk={handleCreateEstimate}
        confirmLoading={createEstimateSaving}
        okText="Создать"
        cancelText="Отмена"
        width={700}
      >
        <Descriptions bordered size="small" column={2} style={{ marginBottom: 12 }}>
          <Descriptions.Item label="Название" span={2}>
            <Input value={estimateForm.name} onChange={e => setEstimateForm(f => ({ ...f, name: e.target.value }))} />
          </Descriptions.Item>
          <Descriptions.Item label="Скидка (%)">
            <InputNumber min={0} max={100} value={estimateForm.discount} onChange={v => setEstimateForm(f => ({ ...f, discount: v || 0 }))} style={{ width: '100%' }} />
          </Descriptions.Item>
          <Descriptions.Item label="Доставка (₽)">
            <InputNumber min={0} value={estimateForm.delivery_cost} onChange={v => setEstimateForm(f => ({ ...f, delivery_cost: v || 0 }))} style={{ width: '100%' }} />
          </Descriptions.Item>
          <Descriptions.Item label="Непредвиденные (₽)">
            <InputNumber min={0} value={estimateForm.unexpected_costs} onChange={v => setEstimateForm(f => ({ ...f, unexpected_costs: v || 0 }))} style={{ width: '100%' }} />
          </Descriptions.Item>
          <Descriptions.Item label="Примечание" span={2}>
            <Input.TextArea rows={2} value={estimateForm.note} onChange={e => setEstimateForm(f => ({ ...f, note: e.target.value }))} />
          </Descriptions.Item>
        </Descriptions>
        <Space style={{ marginBottom: 8 }}>
          <Text strong>Позиции сметы:</Text>
          <Button size="small" icon={<PlusOutlined />} onClick={addEstimateItem}>Добавить позицию</Button>
        </Space>
        {estimateItems.map((item, idx) => (
          <Card key={idx} size="small" style={{ marginBottom: 8 }}>
            <Row gutter={8} align="middle">
              <Col span={8}>
                <Input placeholder="Наименование" value={item.name} onChange={e => {
                  const newItems = [...estimateItems];
                  newItems[idx].name = e.target.value;
                  setEstimateItems(newItems);
                }} size="small" />
              </Col>
              <Col span={3}>
                <Input placeholder="Ед." value={item.unit} onChange={e => {
                  const newItems = [...estimateItems];
                  newItems[idx].unit = e.target.value;
                  setEstimateItems(newItems);
                }} size="small" />
              </Col>
              <Col span={2}>
                <InputNumber min={1} value={item.quantity} onChange={v => {
                  const newItems = [...estimateItems];
                  newItems[idx].quantity = v || 1;
                  setEstimateItems(newItems);
                }} size="small" style={{ width: '100%' }} />
              </Col>
              <Col span={3}>
                <InputNumber min={0} placeholder="Цена" value={item.sale_price} onChange={v => {
                  const newItems = [...estimateItems];
                  newItems[idx].sale_price = v || 0;
                  setEstimateItems(newItems);
                }} size="small" style={{ width: '100%' }} />
              </Col>
              <Col span={2}>
                <InputNumber min={0} placeholder="Себест." value={item.cost_price} onChange={v => {
                  const newItems = [...estimateItems];
                  newItems[idx].cost_price = v || 0;
                  setEstimateItems(newItems);
                }} size="small" style={{ width: '100%' }} />
              </Col>
              <Col span={3}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Сумма: {(item.sale_price * item.quantity).toLocaleString('ru-RU')} ₽
                </Text>
              </Col>
              <Col span={3}>
                <Button size="small" danger onClick={() => {
                  setEstimateItems(prev => prev.filter((_, i) => i !== idx));
                }}>✕</Button>
              </Col>
            </Row>
          </Card>
        ))}
        {estimateItems.length > 0 && (
          <div style={{ textAlign: 'right', marginTop: 8 }}>
            <Text strong>
              Итого позиций: {estimateItems.reduce((sum, i) => sum + (i.sale_price * i.quantity), 0).toLocaleString('ru-RU')} ₽
            </Text>
          </div>
        )}
      </Modal>

      {/* Модалка: привязать существующую смету */}
      <Modal
        title="Привязать существующую смету"
        open={linkEstimateModalOpen}
        onOk={handleLinkEstimate}
        onCancel={() => setLinkEstimateModalOpen(false)}
        okText="Привязать"
        cancelText="Отмена"
        okButtonProps={{ disabled: selectedLinkIds.length === 0 }}
        width={600}
      >
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          {allEstimates.length === 0 ? (
            <Text type="secondary">Нет доступных смет для привязки</Text>
          ) : (
            allEstimates.map((e: any) => (
              <div key={e.id} style={{ padding: '6px 0', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center' }}>
                <Checkbox
                  checked={selectedLinkIds.includes(e.id)}
                  onChange={ev => {
                    if (ev.target.checked) setSelectedLinkIds([...selectedLinkIds, e.id]);
                    else setSelectedLinkIds(selectedLinkIds.filter(x => x !== e.id));
                  }}
                />
                <span style={{ marginLeft: 8 }}>
                  <Text strong>{e.number}</Text> — {e.name} &nbsp;
                  {e.total && <Tag color="blue">{Number(e.total).toLocaleString('ru-RU')} ₽</Tag>}
                </span>
              </div>
            ))
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
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
              <CalendarOutlined /> Запланировать на дату и время
            </Text>
            <DatePicker
              showTime={{ format: 'HH:mm' }}
              format="DD.MM.YYYY HH:mm"
              placeholder="Выберите дату и время"
              style={{ width: '100%' }}
              value={scheduledAt ? dayjs(scheduledAt) : null}
              onChange={(d) => setScheduledAt(d ? d.toISOString() : null)}
            />
          </div>
          <div>
            <Text type="secondary" style={{ display: 'block', marginBottom: 4 }}>
              🏠 Клиент доступен (время визита)
            </Text>
            <Row gutter={12}>
              <Col span={12}>
                <TimePicker format="HH:mm" placeholder="С"
                  value={availableFrom ? dayjs(availableFrom, 'HH:mm') : null}
                  onChange={(t) => setAvailableFrom(t ? t.format('HH:mm') : '09:00')}
                  style={{ width: '100%' }} />
              </Col>
              <Col span={12}>
                <TimePicker format="HH:mm" placeholder="До"
                  value={availableTo ? dayjs(availableTo, 'HH:mm') : null}
                  onChange={(t) => setAvailableTo(t ? t.format('HH:mm') : '18:00')}
                  style={{ width: '100%' }} />
              </Col>
            </Row>
          </div>
          <Divider style={{ margin: '8px 0' }} />
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
        </Space>
      </Modal>

      {/* Модалка объединения заявок */}
      <Modal
        title="🔗 Объединение заявок"
        open={linkModalOpen}
        onOk={handleLinkOrders}
        onCancel={() => setLinkModalOpen(false)}
        okText="Объединить"
        cancelText="Отмена"
        okButtonProps={{ disabled: selectedLinkIds.length === 0 }}
        width={600}
      >
        <Text type="secondary">Главная заявка: <Text strong>#{order?.number}</Text> — {order?.address}</Text>
        <Divider style={{ margin: '12px 0' }} />
        <Input.Search
          placeholder="Поиск заявок по номеру или адресу..."
          value={linkSearchText}
          onChange={e => searchOrdersForLink(e.target.value)}
          style={{ marginBottom: 12 }}
        />
        <div style={{ maxHeight: 300, overflowY: 'auto' }}>
          {linkSearchResults.length === 0 && linkSearchText.length >= 2 && (
            <Text type="secondary">Ничего не найдено</Text>
          )}
          {linkSearchResults.map((o: any) => (
            <div key={o.id} style={{ padding: '6px 0', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center' }}>
              <Checkbox
                checked={selectedLinkIds.includes(o.id)}
                onChange={e => {
                  if (e.target.checked) setSelectedLinkIds([...selectedLinkIds, o.id]);
                  else setSelectedLinkIds(selectedLinkIds.filter(x => x !== o.id));
                }}
              />
              <span style={{ marginLeft: 8 }}>
                <Text strong>#{o.number}</Text> — {o.address} &nbsp;
                <Tag>{statusLabels[o.status] || o.status}</Tag>
              </span>
            </div>
          ))}
        </div>
      </Modal>
    </Card>
  );
};

export default OrdersDetailPage;
