import React, { useState, useEffect } from 'react';
import { Table, Card, Typography, Input, Tag, Space, message, Spin } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import api from '../services/api';
import type { ErcBillingRecord } from '../types';

const { Title, Text } = Typography;

const ErcPaymentsPage: React.FC = () => {
  const [data, setData] = useState<ErcBillingRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [searched, setSearched] = useState(false);

  const handleSearch = async (value: string) => {
    if (!value.trim()) return;
    setSearch(value);
    setLoading(true);
    setSearched(true);
    try {
      // Ищем по номеру счёта или адресу
      const res = await api.get('/erc-billing/', {
        params: { search: value, page_size: 100 },
      });
      setData(res.data.results || []);
      if ((res.data.results || []).length === 0) {
        message.info('Ничего не найдено');
      }
    } catch (err) {
      message.error('Ошибка поиска');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { title: 'Л/счёт', dataIndex: 'account_number', key: 'account', width: 160 },
    { title: 'ФИО', dataIndex: 'account_name', key: 'name', width: 200, ellipsis: true },
    { title: 'Период', dataIndex: 'period', key: 'period', width: 100,
      render: (d: string) => { const [y, m] = d.split('-'); return `${m}.${y}`; },
    },
    { title: 'Начислено', dataIndex: 'charged', key: 'charged', align: 'right' as const, width: 120,
      render: (v: string) => `${parseFloat(v).toFixed(2)} ₽`,
    },
    { title: 'Оплачено', dataIndex: 'paid', key: 'paid', align: 'right' as const, width: 120,
      render: (v: string) => {
        const n = parseFloat(v);
        return <Text strong style={{ color: n > 0 ? '#52c41a' : '#ff4d4f' }}>{n.toFixed(2)} ₽</Text>;
      },
    },
    {
      title: '%', dataIndex: 'paid_percent', key: 'pct', align: 'right' as const, width: 70,
      render: (v: string) => {
        const p = parseFloat(v);
        return <Tag color={p >= 100 ? 'green' : p >= 50 ? 'orange' : 'red'}>{p.toFixed(1)}%</Tag>;
      },
    },
    { title: 'Сальдо кон.', dataIndex: 'balance_end', key: 'balance', align: 'right' as const, width: 120,
      render: (v: string) => `${parseFloat(v).toFixed(2)} ₽`,
    },
  ];

  return (
    <div style={{ maxWidth: 1100 }}>
      <Title level={3}>🏦 Платежи ЕРЦ</Title>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Text type="secondary">
          Поиск по номеру лицевого счёта или ФИО абонента. Показывает последние начисления и факт оплаты.
        </Text>
      </Card>

      <Input.Search
        placeholder="Введите № лицевого счёта или ФИО..."
        enterButton={<><SearchOutlined /> Найти</>}
        size="large"
        onSearch={handleSearch}
        style={{ marginBottom: 16 }}
        allowClear
      />

      {searched && (
        <Table
          columns={columns}
          dataSource={data}
          rowKey="id"
          loading={loading}
          pagination={false}
          size="small"
          scroll={{ x: 900 }}
          locale={{ emptyText: 'Ничего не найдено' }}
        />
      )}
    </div>
  );
};

export default ErcPaymentsPage;
