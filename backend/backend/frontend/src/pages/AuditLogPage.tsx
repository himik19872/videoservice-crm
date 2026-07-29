import React, { useState, useEffect } from 'react';
import { Typography, Card, Table, Tag, Space, Input, Select, DatePicker, Row, Col } from 'antd';
import { AuditOutlined, SearchOutlined, UserOutlined, FilterOutlined } from '@ant-design/icons';
import api from '../services/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

const actionColors: Record<string, string> = {
  create: 'green', update: 'blue', delete: 'red', login: 'cyan',
  logout: 'orange', import: 'purple', export: 'geekblue',
  migrate: 'magenta', other: 'default',
};

const AuditLogPage: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState<string | undefined>(undefined);
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const params: any = { page, page_size: 50 };
      if (search) params.search = search;
      if (actionFilter) params.action = actionFilter;
      if (dateRange) {
        params.created_at_after = dateRange[0].startOf('day').toISOString();
        params.created_at_before = dateRange[1].endOf('day').toISOString();
      }
      const res = await api.get('/audit-logs/', { params });
      setLogs(res.data.results || res.data);
      setTotal(res.data.count || 0);
    } catch (e) { console.error('Audit log error:', e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchLogs(); }, [page, actionFilter, dateRange]);

  const columns = [
    { title: 'Время', dataIndex: 'created_at', key: 'time', width: 170,
      render: (v: string) => <Text style={{ fontFamily: 'monospace', fontSize: 12 }}>{dayjs(v).format('DD.MM.YYYY HH:mm:ss')}</Text>,
    },
    { title: 'Сотрудник', dataIndex: 'user_name', key: 'user', width: 180,
      render: (v: string) => <Space><UserOutlined /><Text strong>{v}</Text></Space>,
    },
    { title: 'Действие', dataIndex: 'action_display', key: 'action', width: 130,
      render: (v: string, r: any) => <Tag color={actionColors[r.action] || 'default'}>{v}</Tag>,
    },
    { title: 'Объект', dataIndex: 'model_name', key: 'model', width: 140,
      render: (v: string) => v ? <Tag>{v}</Tag> : '—',
    },
    { title: 'Описание', dataIndex: 'object_repr', key: 'repr', ellipsis: true,
      render: (v: string, r: any) => {
        const detail = r.details || {};
        const extra = detail.number || detail.address || detail.street_name || '';
        return (
          <span>
            <Text>{v || '—'}</Text>
            {extra && <Text type="secondary" style={{ marginLeft: 8, fontSize: 11 }}>{String(extra).slice(0, 60)}</Text>}
          </span>
        );
      },
    },
    { title: 'IP', dataIndex: 'ip_address', key: 'ip', width: 130,
      render: (v: string) => v ? <Text code style={{ fontSize: 11 }}>{v}</Text> : '—',
    },
  ];

  return (
    <div>
      <Title level={3}><AuditOutlined /> Журнал действий</Title>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={[12, 8]} align="middle">
          <Col>
            <Input
              prefix={<SearchOutlined />}
              placeholder="Поиск по объекту или сотруднику..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onPressEnter={fetchLogs}
              style={{ width: 300 }}
              allowClear
            />
          </Col>
          <Col>
            <Select
              allowClear
              placeholder="Тип действия"
              value={actionFilter}
              onChange={v => { setActionFilter(v); setPage(1); }}
              style={{ width: 170 }}
              options={[
                { label: 'Создание', value: 'create' },
                { label: 'Изменение', value: 'update' },
                { label: 'Удаление', value: 'delete' },
                { label: 'Вход', value: 'login' },
                { label: 'Выход', value: 'logout' },
                { label: 'Импорт', value: 'import' },
                { label: 'Экспорт', value: 'export' },
                { label: 'Перенос', value: 'migrate' },
              ]}
            />
          </Col>
          <Col>
            <RangePicker
              value={dateRange}
              onChange={v => { setDateRange(v as any); setPage(1); }}
              format="DD.MM.YYYY"
              placeholder={['С', 'По']}
            />
          </Col>
        </Row>
      </Card>

      <Card>
        <Table
          columns={columns}
          dataSource={logs}
          rowKey="id"
          loading={loading}
          size="small"
          pagination={{
            current: page,
            total,
            pageSize: 50,
            showTotal: (t: number) => `Всего: ${t}`,
            onChange: (p) => setPage(p),
          }}
          locale={{ emptyText: 'Журнал пуст. Действия будут появляться здесь по мере работы сотрудников.' }}
        />
      </Card>
    </div>
  );
};

export default AuditLogPage;
