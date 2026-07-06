import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Typography, Statistic, Tag, List, Table, Progress, Spin, Badge, Tooltip } from 'antd';
import {
  OrderedListOutlined, CheckCircleOutlined, ClockCircleOutlined,
  UsergroupAddOutlined, DollarOutlined, EnvironmentOutlined,
  DashboardOutlined,
} from '@ant-design/icons';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import MasterMapMulti from '../components/MasterMapMulti';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

interface MasterStats {
  master_id: number;
  master_name: string;
  region: string;
  is_on_shift: boolean;
  last_online: string | null;
  lat: number | null;
  lon: number | null;
  speed: number | null;
  active_orders: number;
  done_today: number;
  done_week: number;
  cash_on_hand: number;
  shift_started_at: string | null;
  is_online: boolean;
}

const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const [mastersData, setMastersData] = useState<MasterStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    totalOrders: 0, newOrders: 0, inProgress: 0, completedToday: 0,
    totalCashOnHand: 0, totalCashToday: 0, totalCashWeek: 0,
    mastersOnShift: 0, totalMasters: 0,
  });

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchDashboard = async () => {
    setLoading(true);
    try {
      const [dashRes, locRes, ordersRes, paymentsRes] = await Promise.all([
        api.get('/reports/dashboard/'),
        api.get('/masters/locations/'),
        api.get('/orders/?page_size=500'),
        api.get('/payments/?page_size=500'),
      ]);

      const dashboard = dashRes.data;
      const locations = locRes.data || [];
      const orders = ordersRes.data.results || ordersRes.data || [];
      const payments = paymentsRes.data.results || paymentsRes.data || [];

      const today = dayjs().startOf('day');
      const weekStart = dayjs().startOf('week');

      const masterStats: MasterStats[] = (dashboard.masters || []).map((m: any) => {
        const loc = Array.isArray(locations) ? locations.find((l: any) => l.master_id === m.master_id) : null;
        const masterOrders = orders.filter((o: any) => {
          const mid = o.master_info?.id || o.master?.id;
          return mid === m.master_id;
        });
        const masterPayments = payments.filter((p: any) => {
          const order = orders.find((o: any) => o.id === p.order);
          const mid = order?.master_info?.id || order?.master?.id;
          return mid === m.master_id && p.is_received && !p.is_submitted_to_office;
        });
        const cashOnHand = masterPayments.reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
        const todayOrders = masterOrders.filter((o: any) => dayjs(o.completed_at || o.created_at).isAfter(today));
        const weekOrders = masterOrders.filter((o: any) => dayjs(o.completed_at || o.created_at).isAfter(weekStart));

        return {
          master_id: m.master_id,
          master_name: m.master_name,
          region: m.region || m.region_name || '',
          is_on_shift: m.is_on_shift || false,
          last_online: loc?.last_update || null,
          lat: loc?.lat || null,
          lon: loc?.lon || null,
          speed: loc?.speed || null,
          active_orders: m.in_work || 0,
          done_today: todayOrders.filter((o: any) => ['completed', 'confirmed'].includes(o.status)).length,
          done_week: weekOrders.filter((o: any) => ['completed', 'confirmed'].includes(o.status)).length,
          cash_on_hand: cashOnHand,
          shift_started_at: m.shift_started_at || null,
          is_online: loc?.is_online !== false,
        };
      });

      const totalCashOnHand = masterStats.reduce((s, m) => s + m.cash_on_hand, 0);
      const todayPayments = payments.filter((p: any) => dayjs(p.paid_at).isAfter(today) && p.is_received);
      const weekPayments = payments.filter((p: any) => dayjs(p.paid_at).isAfter(weekStart) && p.is_received);

      setMastersData(masterStats);
      setSummary({
        totalOrders: orders.length,
        newOrders: orders.filter((o: any) => o.status === 'new').length,
        inProgress: orders.filter((o: any) => ['assigned', 'accepted', 'in_progress', 'paused', 'need_help'].includes(o.status)).length,
        completedToday: orders.filter((o: any) => ['completed', 'confirmed'].includes(o.status) && dayjs(o.completed_at || o.confirmed_at).isAfter(today)).length,
        totalCashOnHand,
        totalCashToday: todayPayments.reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0),
        totalCashWeek: weekPayments.reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0),
        mastersOnShift: masterStats.filter(m => m.is_on_shift).length,
        totalMasters: masterStats.length,
      });
    } catch (e) {
      console.error('Ошибка загрузки дашборда:', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 60 }}><Spin size="large" /></div>;

  const shiftMasters = mastersData.filter(m => m.is_on_shift);

  return (
    <div>
      <Title level={3}><DashboardOutlined /> Сводка ({dayjs().format('DD.MM.YYYY')})</Title>

      <Row gutter={12} style={{ marginBottom: 16 }}>
        <Col span={4}><Card size="small"><Statistic title="Всего заявок" value={summary.totalOrders} prefix={<OrderedListOutlined />} valueStyle={{ color: '#1677ff' }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Новых" value={summary.newOrders} valueStyle={{ color: '#fa8c16' }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="В работе" value={summary.inProgress} prefix={<ClockCircleOutlined />} valueStyle={{ color: '#1677ff' }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Выполнено сегодня" value={summary.completedToday} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col span={4}><Card size="small"><Statistic title="Наличные на руках" value={`${summary.totalCashOnHand.toLocaleString('ru-RU')} ₽`} prefix={<DollarOutlined />} valueStyle={{ color: summary.totalCashOnHand > 0 ? '#cf1322' : '#52c41a' }} /></Card></Col>
        <Col span={4}><Card size="small">
          <Statistic title="Оборот за сегодня" value={`${summary.totalCashToday.toLocaleString('ru-RU')} ₽`} valueStyle={{ color: '#52c41a' }} />
          <Text type="secondary" style={{ fontSize: 11 }}>Неделя: {summary.totalCashWeek.toLocaleString('ru-RU')} ₽</Text>
        </Card></Col>
      </Row>

      <Row gutter={12} style={{ marginBottom: 16 }}>
        <Col span={14}>
          <Card title={<span><EnvironmentOutlined /> Карта мастеров и монтажников</span>} extra={<Badge count={summary.mastersOnShift} style={{ backgroundColor: '#52c41a' }}><Text style={{ marginRight: 8 }}>на смене</Text></Badge>} bodyStyle={{ padding: 0 }}>
            <MasterMapMulti masters={mastersData.filter(m => m.lat != null && m.lon != null)} height="400px" />
          </Card>
        </Col>
        <Col span={10}>
          <Card title={<span><UsergroupAddOutlined /> Мастера на смене</span>} bodyStyle={{ padding: 0, maxHeight: 400, overflowY: 'auto' }}>
            {shiftMasters.length === 0 ? <div style={{ padding: 20, textAlign: 'center', color: '#999' }}>Нет мастеров на смене</div> : (
              <List dataSource={shiftMasters} renderItem={(m: MasterStats) => (
                <List.Item style={{ padding: '8px 16px' }}>
                  <List.Item.Meta
                    avatar={<Badge status={m.is_online ? 'success' : 'default'} />}
                    title={<span>{m.master_name}<Tag color="blue" style={{ marginLeft: 8 }}>{m.region}</Tag></span>}
                    description={<div>
                      <Text type="secondary" style={{ fontSize: 11 }}>🟢 Смена с {m.shift_started_at ? dayjs(m.shift_started_at).format('HH:mm') : '?'}{m.last_online ? ` · Был: ${dayjs(m.last_online).format('HH:mm')}` : ''}</Text><br />
                      <Text style={{ fontSize: 11 }}>📋 В работе: {m.active_orders} · ✅ Сегодня: {m.done_today} · 📅 Неделя: {m.done_week}</Text>
                      {m.cash_on_hand > 0 && <Text type="danger" style={{ fontSize: 11, display: 'block' }}>💰 На руках: {m.cash_on_hand.toLocaleString('ru-RU')} ₽</Text>}
                    </div>}
                  />
                </List.Item>
              )} />
            )}
          </Card>
        </Col>
      </Row>

      <Card title={<span>📊 Статистика по мастерам</span>} bodyStyle={{ padding: 0 }}>
        <Table dataSource={mastersData} rowKey="master_id" size="small" pagination={false}
          columns={[
            { title: 'Мастер', dataIndex: 'master_name', key: 'name', width: 180,
              render: (n: string, r: MasterStats) => <span><Badge status={r.is_online ? 'success' : 'default'} /> {n}{r.is_on_shift && <Tag color="green" style={{ marginLeft: 4 }}>смена</Tag>}</span> },
            { title: 'Район', dataIndex: 'region', key: 'region', width: 100 },
            { title: 'В работе', dataIndex: 'active_orders', key: 'active', width: 80, render: (v: number) => v > 0 ? <Tag color="orange">{v}</Tag> : <span style={{ color: '#ccc' }}>0</span> },
            { title: 'Сегодня', dataIndex: 'done_today', key: 'today', width: 80, render: (v: number) => <Text type={v > 0 ? 'success' : 'secondary'}>{v}</Text> },
            { title: 'Неделя', dataIndex: 'done_week', key: 'week', width: 100, render: (v: number) => <Progress percent={Math.min(v * 10, 100)} size="small" format={() => v} /> },
            { title: 'Наличные', dataIndex: 'cash_on_hand', key: 'cash', width: 130, render: (v: number) => v > 0 ? <Tooltip title="Не сдано в кассу"><Text type="danger" strong>{v.toLocaleString('ru-RU')} ₽</Text></Tooltip> : <Text type="secondary">—</Text> },
            { title: 'Онлайн', key: 'online', width: 120, render: (_: any, r: MasterStats) => r.last_online ? dayjs(r.last_online).format('DD.MM HH:mm') : '—' },
          ]}
        />
      </Card>
    </div>
  );
};

export default DashboardPage;
