import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Typography, Modal, Form, Input, Select, AutoComplete, message, Tag } from 'antd';
import { PlusOutlined, EditOutlined, EyeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import type { Client, ClientFormValues, Region } from '../../types';
import type { TablePaginationConfig } from 'antd/es/table';
import type { SorterResult } from 'antd/es/table/interface';

const { Title } = Typography;

const sourceLabels: Record<string, { label: string; color: string }> = {
  manual: { label: 'Ручной ввод', color: 'default' },
  excel_import: { label: 'Импорт (ТСЖ/УК)', color: 'blue' },
  erc: { label: 'ЕРЦ', color: 'green' },
};

const ClientsPage: React.FC = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [regions, setRegions] = useState<Region[]>([]);
  const [searchText, setSearchText] = useState('');
  const [searchOptions, setSearchOptions] = useState<{ value: string; label: string; type: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [ordering, setOrdering] = useState<string>('');

  useEffect(() => {
    if (isAuthenticated) {
      fetchClients(page, searchText, pageSize, ordering);
      fetchRegions();
    }
  }, [isAuthenticated]);

  const fetchClients = async (pg: number, search: string, size: number, order?: string) => {
    setLoading(true);
    try {
      const params: any = { page: pg, page_size: size };
      if (search) params.search = search;
      if (order) params.ordering = order;
      const response = await api.get('/clients/', { params });
      setClients(response.data.results || response.data);
      setTotal(response.data.count || 0);
    } catch (error) {
      message.error('Ошибка загрузки клиентов');
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

  const handleTableChange = (pagination: TablePaginationConfig, _filters: any, sorter: SorterResult<Client> | SorterResult<Client>[]) => {
    const newPage = pagination.current || 1;
    const newSize = pagination.pageSize || 50;
    setPage(newPage);
    setPageSize(newSize);
    
    let newOrdering = '';
    const s = Array.isArray(sorter) ? sorter[0] : sorter;
    if (s.field && s.order) {
      newOrdering = s.order === 'ascend' ? s.field as string : `-${s.field}`;
    }
    setOrdering(newOrdering);
    fetchClients(newPage, searchText, newSize, newOrdering);
  };

  const handleSearch = (value: string) => {
    setSearchText(value);
    setPage(1);
    fetchClients(1, value, pageSize, ordering);
    setSearchOptions([]);
  };

  const handleSearchInput = async (value: string) => {
    setSearchText(value);
    if (!value || value.length < 2) { setSearchOptions([]); return; }
    setSearching(true);
    try {
      const [crmRes, streetRes, dadataRes] = await Promise.all([
        api.get('/clients/autocomplete/', { params: { q: value } }).then(r => r.data || []),
        api.get('/clients/street_autocomplete/', { params: { q: value } }).then(r => r.data || []).catch(() => []),
        api.get('/clients/address_suggest/', { params: { q: value } }).then(r => r.data || []).catch(() => []),
      ]);
      const opts: any[] = [];
      // Клиенты из CRM
      crmRes.forEach((c: any) => opts.push({ value: c.name, label: `👤 ${c.name} — ${c.address}`, type: 'client' }));
      // Улицы — зелёным
      if (streetRes.length > 0) {
        if (opts.length > 0) opts.push({ value: '---divider---', label: '── 🏠 Улицы в базе ──', disabled: true, type: 'divider' });
        streetRes.forEach((s: any) => opts.push({ value: s.street || s.label, label: `🏠 ${s.label} (${s.sub})`, type: 'street' }));
      }
      // Адресные подсказки
      if (dadataRes.length > 0) {
        if (opts.length > 0) opts.push({ value: '---divider2---', label: '── 📍 Адресные подсказки ──', disabled: true, type: 'divider' });
        dadataRes.forEach((d: any) => opts.push({ value: d.value, label: `📍 ${d.unrestricted_value || d.value}`, type: 'dadata' }));
      }
      setSearchOptions(opts);
    } catch { setSearchOptions([]); }
    finally { setSearching(false); }
  };

  const handleCreateClient = async (values: ClientFormValues) => {
    try {
      await api.post('/clients/', values);
      setIsModalOpen(false);
      form.resetFields();
      message.success('Клиент создан');
      fetchClients(page, searchText, pageSize, ordering);
    } catch (error) {
      message.error('Ошибка создания клиента');
    }
  };

  const handleViewClient = (client: Client) => {
    navigate(`/clients/${client.id}`);
  };

  const columns = [
    {
      title: 'Адрес',
      dataIndex: 'address',
      key: 'address',
      width: 280,
      ellipsis: true,
      sorter: true,
    },
    {
      title: 'ФИО',
      dataIndex: 'full_name',
      key: 'full_name',
      width: 180,
      sorter: true,
      render: (text: string) => text || 'Не определено',
    },
    {
      title: 'Л/счет',
      dataIndex: 'personal_account_number',
      key: 'personal_account_number',
      width: 130,
      sorter: true,
      render: (text: string) => text || '-',
    },
    {
      title: 'УК / ТСЖ',
      dataIndex: 'management_company',
      key: 'management_company',
      width: 180,
      ellipsis: true,
      sorter: true,
      render: (text: string) => text || '-',
    },
    {
      title: 'Источник',
      dataIndex: 'source',
      key: 'source',
      width: 140,
      render: (src: string) => {
        const info = sourceLabels[src] || sourceLabels.manual;
        return <Tag color={info.color}>{info.label}</Tag>;
      },
    },
    {
      title: 'Дата',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 110,
      sorter: true,
      render: (date: string) => date ? new Date(date).toLocaleDateString('ru-RU') : '-',
    },
    {
      title: '',
      key: 'actions',
      width: 50,
      render: (_: any, record: Client) => (
        <Button type="link" icon={<EyeOutlined />} onClick={() => handleViewClient(record)} />
      ),
    },
  ];

  return (
    <div>
      <Title level={3}>Клиенты</Title>

      <Space style={{ marginBottom: 16, width: '100%', justifyContent: 'space-between' }} wrap>
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>
            Новый клиент
          </Button>
        </Space>
      </Space>

      <AutoComplete
        style={{ marginBottom: 16, width: 450 }}
        value={searchText}
        options={searchOptions}
        onSearch={handleSearchInput}
        onSelect={(val: string) => { handleSearch(val); }}
        allowClear
      >
        <Input.Search
          placeholder="🔍 Поиск по адресу, ФИО, телефону, ИНН..."
          enterButton
          allowClear
          onSearch={handleSearch}
          onChange={(e) => !e.target.value && handleSearch('')}
        />
      </AutoComplete>

      <Table
        columns={columns}
        dataSource={clients}
        loading={loading}
        rowKey="id"
        onChange={handleTableChange}
        scroll={{ x: 1000 }}
        pagination={{
          current: page,
          pageSize: pageSize,
          total: total,
          showSizeChanger: true,
          pageSizeOptions: ['20', '50', '100'],
          showTotal: (t: number) => `Всего: ${t}`,
        }}
      />

      <Modal
        title="Создать нового клиента"
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        width={600}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateClient}>
          <Form.Item name="full_name" label="ФИО" rules={[{ required: true, message: 'Введите ФИО' }]}>
            <Input placeholder="Введите ФИО" />
          </Form.Item>
          <Form.Item name="phone" label="Телефон" rules={[{ required: true, message: 'Введите телефон' }]}>
            <Input placeholder="Введите телефон" />
          </Form.Item>
          <Form.Item name="address" label="Адрес" rules={[{ required: true, message: 'Введите адрес' }]}>
            <Input placeholder="Введите адрес" />
          </Form.Item>
          <Form.Item name="region_id" label="Район">
            <Select placeholder="Выберите район" allowClear>
              {regions.map((r) => (
                <Select.Option key={r.id} value={r.id}>{r.name}</Select.Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="management_company" label="УК / ТСЖ">
            <Input placeholder="Управляющая компания" />
          </Form.Item>
          <Form.Item name="notes" label="Примечания">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Button type="primary" htmlType="submit">Создать</Button>
        </Form>
      </Modal>
    </div>
  );
};

export default ClientsPage;
