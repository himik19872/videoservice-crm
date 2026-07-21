import React, { useState, useEffect } from 'react';
import {
  Card, Table, Button, Space, Typography, Tag, message, Modal, DatePicker, Row, Col, Statistic,
  Tabs, Progress, Spin,
} from 'antd';
import {
  BarChartOutlined, ReloadOutlined, FileTextOutlined, TeamOutlined, UsergroupAddOutlined,
  DollarOutlined,
} from '@ant-design/icons';
import api from '../../services/api';
import type { Report } from '../../types';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const ReportsPage: React.FC = () => {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(false);
  const [generatingDaily, setGeneratingDaily] = useState(false);
  const [generatingMaster, setGeneratingMaster] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<string>('reports');

  // ЕРЦ-отчёт
  const [ercData, setErcData] = useState<any>(null);
  const [ercLoading, setErcLoading] = useState(false);

  useEffect(() => {
    fetchReports();
    fetchStats();
    fetchErcReport();
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const response = await api.get('/reports/');
      setReports(response.data.results || response.data);
    } catch (error) {
      message.error('Ошибка загрузки отчётов');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await api.get('/reports/dashboard/');
      const data = response.data;
      const masters = data.masters || [];
      const dispatchers = data.dispatchers || [];
      const totalCompleted = masters.reduce((s: number, m: any) => s + m.completed, 0);
      const totalInWork = masters.reduce((s: number, m: any) => s + m.in_work, 0);

      setStats({
        masters,
        dispatchers,
        totalCompleted,
        totalInWork,
        totalToday: masters.reduce((s: number, m: any) => s + m.total_month, 0),
      });
    } catch (error) {
      console.error('Stats error:', error);
    }
  };

  const fetchErcReport = async () => {
    setErcLoading(true);
    try {
      const res = await api.get('/reports/erc-summary/');
      setErcData(res.data);
    } catch (error) {
      console.error('ERC report error:', error);
    } finally {
      setErcLoading(false);
    }
  };

  const handleGenerateDaily = async () => {
    setGeneratingDaily(true);
    try {
      const response = await api.post('/reports/generate_daily/');
      setReports([response.data, ...reports]);
      message.success('Ежедневный отчёт сгенерирован');
    } catch (error) {
      message.error('Ошибка генерации отчёта');
    } finally {
      setGeneratingDaily(false);
    }
  };

  const handleGenerateMasterPerformance = async () => {
    setGeneratingMaster(true);
    try {
      const today = dayjs().format('YYYY-MM-DD');
      const monthAgo = dayjs().subtract(30, 'day').format('YYYY-MM-DD');
      const response = await api.post('/reports/generate_master_performance/', {
        period_start: monthAgo,
        period_end: today,
      });
      setReports([response.data, ...reports]);
      message.success('Отчёт по мастерам сгенерирован');
    } catch (error) {
      message.error('Ошибка генерации отчёта');
    } finally {
      setGeneratingMaster(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'blue',
      generated: 'green',
      sent: 'purple',
    };
    return colors[status] || 'default';
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      daily: 'Ежедневный',
      weekly: 'Еженедельный',
      monthly: 'Ежемесячный',
      custom: 'Пользовательский',
    };
    return labels[type] || type;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      draft: 'Черновик',
      generated: 'Сгенерирован',
      sent: 'Отправлен',
    };
    return labels[status] || status;
  };

  const columns = [
    {
      title: 'Название',
      dataIndex: 'title',
      key: 'title',
      render: (text: string, record: Report) => (
        <Space>
          <FileTextOutlined />
          <span>{text}</span>
        </Space>
      ),
    },
    {
      title: 'Тип',
      dataIndex: 'report_type',
      key: 'report_type',
      width: 140,
      render: (type: string) => <Tag>{getTypeLabel(type)}</Tag>,
    },
    {
      title: 'Период',
      key: 'period',
      width: 220,
      render: (_: any, record: Report) =>
        `${dayjs(record.period_start).format('DD.MM.YYYY')} — ${dayjs(record.period_end).format('DD.MM.YYYY')}`,
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>{getStatusLabel(status)}</Tag>
      ),
    },
    {
      title: 'Создан',
      dataIndex: 'generated_at',
      key: 'generated_at',
      width: 180,
      render: (date: string) => dayjs(date).format('DD.MM.YYYY HH:mm'),
    },
    {
      title: 'Создал',
      key: 'created_by',
      width: 150,
      render: (_: any, record: Report) => record.created_by?.username || '-',
    },
  ];

  return (
    <div>
      <Row justify="space-between" align="middle" style={{ marginBottom: 16 }}>
        <Col>
          <Title level={3} style={{ margin: 0 }}>
            <BarChartOutlined /> Отчёты
          </Title>
        </Col>
        <Col>
          <Space>
            <Button
              icon={<ReloadOutlined />}
              onClick={handleGenerateDaily}
              loading={generatingDaily}
            >
              Ежедневный отчёт
            </Button>
            <Button
              type="primary"
              icon={<TeamOutlined />}
              onClick={handleGenerateMasterPerformance}
              loading={generatingMaster}
            >
              Отчёт по мастерам
            </Button>
          </Space>
        </Col>
      </Row>

      <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
        {
          key: 'reports',
          label: '📊 Заявки и мастера',
          children: (
            <>
              {stats && (
                <>
                  <Row gutter={16} style={{ marginBottom: 16 }}>
                    <Col span={6}><Card><Statistic title="Заявок за месяц" value={stats.totalToday} /></Card></Col>
                    <Col span={6}><Card><Statistic title="Выполнено" value={stats.totalCompleted} valueStyle={{ color: '#3f8600' }} /></Card></Col>
                    <Col span={6}><Card><Statistic title="В работе" value={stats.totalInWork} valueStyle={{ color: '#faad14' }} /></Card></Col>
                  </Row>

                  <Title level={4}><TeamOutlined /> Мастера</Title>
                  <Table
                    dataSource={stats.masters || []}
                    rowKey="master_id"
                    pagination={false}
                    size="small"
                    style={{ marginBottom: 24 }}
                    columns={[
                      { title: 'Мастер', dataIndex: 'master_name', key: 'name' },
                      { title: 'Всего', dataIndex: 'total_month', key: 'total' },
                      { title: 'Принято', dataIndex: 'accepted', key: 'accepted' },
                      { title: 'Выполнено', dataIndex: 'completed', key: 'completed', render: (v: number) => <Tag color="green">{v}</Tag> },
                      { title: 'В работе', dataIndex: 'in_work', key: 'in_work', render: (v: number) => <Tag color="orange">{v}</Tag> },
                      { title: '%', dataIndex: 'completion_rate', key: 'rate', render: (v: number) => v + '%' },
                      { title: 'Пробег, км', dataIndex: 'mileage_km', key: 'mileage' },
                    ]}
                  />

                  <Title level={4}><UsergroupAddOutlined /> Диспетчеры</Title>
                  <Table
                    dataSource={stats.dispatchers || []}
                    rowKey="dispatcher_id"
                    pagination={false}
                    size="small"
                    columns={[
                      { title: 'Диспетчер', dataIndex: 'name', key: 'name' },
                      { title: 'Создано заявок', dataIndex: 'created_orders', key: 'created' },
                      { title: 'Подтверждено', dataIndex: 'confirmed_orders', key: 'confirmed', render: (v: number) => <Tag color="green">{v}</Tag> },
                    ]}
                  />
                </>
              )}

              <Card>
                <Table
                  columns={columns}
                  dataSource={reports}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                  locale={{ emptyText: 'Отчётов пока нет. Нажмите кнопку выше, чтобы сгенерировать.' }}
                />
              </Card>
            </>
          ),
        },
        {
          key: 'erc',
          label: '💰 ЕРЦ Начисления',
          children: (
            <>
              {ercData ? (
                <>
                  <Row gutter={16} style={{ marginBottom: 16 }}>
                    <Col span={4}>
                      <Card><Statistic title="Лицевых счетов" value={ercData.accounts_count} /></Card>
                    </Col>
                    <Col span={4}>
                      <Card><Statistic title="Клиентов с ЕРЦ" value={ercData.clients_with_erc} /></Card>
                    </Col>
                    <Col span={4}>
                      <Card><Statistic title="Всего записей" value={ercData.totals.records_count} /></Card>
                    </Col>
                    <Col span={4}>
                      <Card><Statistic title="Начислено (всего)" value={`${ercData.totals.charged_total.toLocaleString()} ₽`} valueStyle={{ color: '#1677ff' }} /></Card>
                    </Col>
                    <Col span={4}>
                      <Card><Statistic title="Оплачено (всего)" value={`${ercData.totals.paid_total.toLocaleString()} ₽`} valueStyle={{ color: '#52c41a' }} /></Card>
                    </Col>
                    <Col span={4}>
                      <Card>
                        <Statistic
                          title="Собираемость"
                          value={ercData.totals.paid_percent}
                          suffix="%"
                          valueStyle={{ color: ercData.totals.paid_percent >= 80 ? '#52c41a' : '#faad14' }}
                        />
                      </Card>
                    </Col>
                  </Row>

                  <Title level={4}><DollarOutlined /> По месяцам</Title>
                  <Table
                    dataSource={ercData.months.map((m: any, i: number) => ({ ...m, _k: i }))}
                    rowKey="_k"
                    loading={ercLoading}
                    size="small"
                    pagination={{ pageSize: 24 }}
                    columns={[
                      { 
                        title: 'Месяц', dataIndex: 'period_label', key: 'period', width: 150,
                        render: (v: string) => <Text strong>{v}</Text>,
                      },
                      { 
                        title: 'Записей', dataIndex: 'records_count', key: 'cnt', width: 90,
                        align: 'right' as const,
                      },
                      { 
                        title: 'Начислено', dataIndex: 'charged_total', key: 'ch', width: 160,
                        align: 'right' as const,
                        render: (v: number) => <Text style={{ color: '#1677ff' }}>{v.toLocaleString()} ₽</Text>,
                      },
                      { 
                        title: 'Оплачено', dataIndex: 'paid_total', key: 'pd', width: 160,
                        align: 'right' as const,
                        render: (v: number) => <Text style={{ color: '#52c41a' }}>{v.toLocaleString()} ₽</Text>,
                      },
                      { 
                        title: 'Сальдо нач.', dataIndex: 'balance_start_total', key: 'bs', width: 150,
                        align: 'right' as const,
                        render: (v: number) => <Text type={v >= 0 ? 'secondary' : 'danger'}>{v.toLocaleString()} ₽</Text>,
                      },
                      { 
                        title: 'Сальдо кон.', dataIndex: 'balance_end_total', key: 'be', width: 150,
                        align: 'right' as const,
                        render: (v: number) => <Text type={v >= 0 ? 'secondary' : 'danger'}>{v.toLocaleString()} ₽</Text>,
                      },
                      {
                        title: '% оплаты', dataIndex: 'paid_percent', key: 'pp', width: 200,
                        render: (v: number) => (
                          <Progress
                            percent={v}
                            size="small"
                            strokeColor={v >= 80 ? '#52c41a' : v >= 50 ? '#faad14' : '#ff4d4f'}
                            format={(p) => `${p}%`}
                          />
                        ),
                      },
                    ]}
                  />
                </>
              ) : (
                <Card><Spin />{ercLoading && ' Загрузка данных ЕРЦ...'}</Card>
              )}
            </>
          ),
        },
      ]} />
    </div>
  );
};

export default ReportsPage;
