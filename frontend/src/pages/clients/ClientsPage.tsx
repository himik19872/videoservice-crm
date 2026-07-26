import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Typography, Modal, Form, Input, Select, AutoComplete, message, Tag, Row, Col } from 'antd';
import { PlusOutlined, EditOutlined, EyeOutlined, SearchOutlined } from '@ant-design/icons';
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
  const [managementCompanies, setManagementCompanies] = useState<any[]>([]);
  const [searchText, setSearchText] = useState('');
  const [searchOptions, setSearchOptions] = useState<{ value: string; label: string }[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedStreet, setSelectedStreet] = useState('');
  const [selectedHouse, setSelectedHouse] = useState('');
  const [selectedBuildingId, setSelectedBuildingId] = useState<number | null>(null);
  const [selectedFlat, setSelectedFlat] = useState('');
  const [houseOptions, setHouseOptions] = useState<{ value: string; label: string; buildingId?: number }[]>([]);
  const [houseSearching, setHouseSearching] = useState(false);
  const [flatOptions, setFlatOptions] = useState<{ value: string; label: string }[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [ordering, setOrdering] = useState<string>('');
  const [filterSource, setFilterSource] = useState<string>('');
  const [filterRegionId, setFilterRegionId] = useState<string>('');
  const [filterMcId, setFilterMcId] = useState<string>('');
  const [filterPersonalAccount, setFilterPersonalAccount] = useState<string>('');
  const [filterNoBuilding, setFilterNoBuilding] = useState<boolean>(false);

  useEffect(() => {
    if (isAuthenticated) {
      fetchClients(page, pageSize);
      fetchRegions();
      fetchManagementCompanies();
    }
  }, [isAuthenticated]);

  const buildParams = (pg: number, size: number) => {
    const params: any = { page: pg, page_size: size };
    if (selectedBuildingId) {
      params.building_id = selectedBuildingId;
    } else if (searchText) {
      params.search = searchText;
    }
    if (ordering) params.ordering = ordering;
    if (filterSource) params.source = filterSource;
    if (filterRegionId) params.region_id = filterRegionId;
    if (filterMcId) params.management_company_id = filterMcId;
    if (filterPersonalAccount) params.personal_account = filterPersonalAccount;
    if (filterNoBuilding) params.no_building = 'true';
    return params;
  };

  const fetchClients = async (pg: number, size: number) => {
    setLoading(true);
    try {
      const params = buildParams(pg, size);
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

  const fetchManagementCompanies = async () => {
    try {
      const response = await api.get('/management-companies/');
      setManagementCompanies(response.data.results || response.data);
    } catch (error) {
      console.error('Ошибка загрузки УК:', error);
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
    
    const params = buildParams(newPage, newSize);
    if (newOrdering) params.ordering = newOrdering;
    
    setLoading(true);
    api.get('/clients/', { params })
      .then(r => { setClients(r.data.results || r.data); setTotal(r.data.count || 0); })
      .catch(() => message.error('Ошибка загрузки'))
      .finally(() => setLoading(false));
  };

  // Поиск по улицам из базы (автокомплит)
  const handleStreetSearch = async (value: string) => {
    setSearchText(value);
    if (!value || value.length < 2) { setSearchOptions([]); return; }
    setSearching(true);
    try {
      const streetRes = await api.get('/clients/street_autocomplete/', { params: { q: value } })
        .then(r => r.data || []).catch(() => []);
      const opts = streetRes.map((s: any) => ({
        value: s.street || s.label,
        label: `🏠 ${s.label} (${s.sub})`,
      }));
      setSearchOptions(opts);
    } catch { setSearchOptions([]); }
    finally { setSearching(false); }
  };

  // При выборе улицы — подгружаем дома
  const handleStreetSelect = (value: string) => {
    setSearchText(value);
    setSelectedStreet(value);
    setSelectedHouse('');
    setSelectedBuildingId(null);
    setSelectedFlat('');
    setHouseOptions([]);
    setFlatOptions([]);
    // Загружаем дома для этой улицы
    setHouseSearching(true);
    api.get('/clients/house_autocomplete/', { params: { street: value } })
      .then(r => {
        const opts = (r.data || []).map((h: any) => ({
          value: h.label,
          label: `🏡 ${h.label}`,
          buildingId: h.id,
        }));
        setHouseOptions(opts);
        if (opts.length === 0) {
          // Если домов нет — ищем сразу по улице
          doSearch(value, '', '');
        }
      })
      .catch(() => { setHouseOptions([]); })
      .finally(() => setHouseSearching(false));
  };

  // При выборе дома — подгружаем квартиры
  const handleHouseSelect = (value: string, option: any) => {
    setSelectedHouse(value);
    setSelectedBuildingId(option.buildingId || null);
    setSelectedFlat('');
    setFlatOptions([]);

    if (option.buildingId) {
      api.get('/clients/flat_autocomplete/', { params: { building_id: option.buildingId } })
        .then(r => {
          const opts = (r.data || []).map((f: any) => ({
            value: f.label,
            label: `🚪 кв. ${f.label}` + (f.sub ? ` (${f.sub})` : ''),
          }));
          setFlatOptions(opts);
          if (opts.length === 0) {
            // Квартир нет — ищем сразу по улице+дому
            doSearch(selectedStreet, value, '');
          }
        })
        .catch(() => setFlatOptions([]));
    }
  };

  // При выборе квартиры — ищем
  const handleFlatSelect = (value: string) => {
    setSelectedFlat(value);
    doSearch(selectedStreet, selectedHouse, value);
  };

  // Общая функция поиска
  const doSearch = (street: string, house: string, flat: string) => {
    setPage(1);
    setSearchOptions([]);
    setHouseOptions([]);
    setFlatOptions([]);
    
    // Формируем текст для отображения в поле поиска
    let q = street;
    if (house) q += `, ${house}`;
    if (flat) q += `, кв. ${flat}`;
    setSearchText(q);

    setLoading(true);
    const params = buildParams(1, pageSize);
    // Если выбран дом — ищем через building_id (точный поиск), не через текст
    // Текстовый поиск ищет по всем корпусам, что даёт ложные совпадения
    api.get('/clients/', { params })
      .then(r => { setClients(r.data.results || r.data); setTotal(r.data.count || 0); })
      .catch(() => message.error('Ошибка поиска'))
      .finally(() => setLoading(false));
  };

  // Поиск по Enter
  const handleStreetEnter = () => {
    const val = searchText.trim();
    if (val) {
      if (selectedStreet && selectedStreet === val) {
        // уже выбрана улица — ищем по ней
        doSearch(selectedStreet, selectedHouse, selectedFlat);
      } else {
        handleStreetSelect(val);
      }
    }
  };

  // Сброс всех фильтров
  const handleResetFilters = () => {
    setSearchText('');
    setSelectedStreet('');
    setSelectedHouse('');
    setSelectedBuildingId(null);
    setSelectedFlat('');
    setHouseOptions([]);
    setFlatOptions([]);
    setFilterSource('');
    setFilterRegionId('');
    setFilterMcId('');
    setFilterPersonalAccount('');
    setFilterNoBuilding(false);
    setPage(1);
    setOrdering('');
    const params = { page: 1, page_size: pageSize };
    setLoading(true);
    api.get('/clients/', { params })
      .then(r => { setClients(r.data.results || r.data); setTotal(r.data.count || 0); })
      .catch(() => message.error('Ошибка загрузки'))
      .finally(() => setLoading(false));
  };

  // Применение фильтров через кнопку
  const applyFilters = () => {
    setPage(1);
    fetchClients(1, pageSize);
  };

  const handleCreateClient = async (values: ClientFormValues) => {
    try {
      await api.post('/clients/', values);
      setIsModalOpen(false);
      form.resetFields();
      message.success('Клиент создан');
      fetchClients(page, pageSize);
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
      width: 350,
      sorter: true,
      render: (text: string) => <div style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{text}</div>,
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
      render: (text: string) => text ? <Tag color="blue">{text}</Tag> : '-',
    },
    {
      title: 'УК / ТСЖ',
      dataIndex: 'management_company_name',
      key: 'management_company_name',
      width: 180,
      sorter: true,
      render: (text: string) => <div style={{ whiteSpace: 'normal', wordBreak: 'break-word' }}>{text || '-'}</div>,
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

      {/* Фильтры */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col xs={24} md={5}>
          <AutoComplete
            style={{ width: '100%' }}
            value={searchText}
            options={searchOptions}
            onSearch={handleStreetSearch}
            onSelect={handleStreetSelect}
            allowClear
            onClear={() => { setSearchText(''); setSelectedStreet(''); setSelectedHouse(''); setSelectedBuildingId(null); setSelectedFlat(''); setHouseOptions([]); setFlatOptions([]); setPage(1); fetchClients(1, pageSize); }}
          >
            <Input
              placeholder="🏠 Улица..."
              onPressEnter={handleStreetEnter}
              allowClear
            />
          </AutoComplete>
        </Col>
        <Col xs={12} md={3}>
          <Select
            style={{ width: '100%' }}
            value={selectedHouse || undefined}
            placeholder={selectedStreet ? (houseSearching ? 'Загрузка...' : '🏡 Дом...') : 'Сначала улицу'}
            disabled={!selectedStreet}
            showSearch
            loading={houseSearching}
            filterOption={(input, option) => (option?.label as string || '').toLowerCase().includes(input.toLowerCase())}
            onSelect={handleHouseSelect}
            onChange={(v) => { if (!v) { setSelectedHouse(''); setSelectedBuildingId(null); setSelectedFlat(''); setFlatOptions([]); } }}
            allowClear
            onClear={() => { setSelectedHouse(''); setSelectedBuildingId(null); setSelectedFlat(''); setFlatOptions([]); if (selectedStreet) doSearch(selectedStreet, '', ''); }}
            options={houseOptions}
            notFoundContent={houseSearching ? 'Загрузка...' : 'Нет домов'}
          />
        </Col>
        <Col xs={12} md={3}>
          <AutoComplete
            style={{ width: '100%' }}
            value={selectedFlat}
            options={flatOptions}
            disabled={!selectedHouse}
            onSearch={(v) => setSelectedFlat(v)}
            onSelect={handleFlatSelect}
            onClear={() => { setSelectedFlat(''); if (selectedStreet && selectedHouse) doSearch(selectedStreet, selectedHouse, ''); }}
            allowClear
          >
            <Input
              placeholder={selectedHouse ? '🚪 Квартира...' : 'Сначала дом'}
              disabled={!selectedHouse}
              onPressEnter={() => { if (selectedFlat && selectedStreet && selectedHouse) doSearch(selectedStreet, selectedHouse, selectedFlat); }}
              allowClear
            />
          </AutoComplete>
        </Col>
        <Col xs={12} md={4}>
          <Select
            style={{ width: '100%' }}
            placeholder="🏛️ Район"
            allowClear
            value={filterRegionId || undefined}
            onChange={(v) => { setFilterRegionId(v || ''); }}
            showSearch
            filterOption={(input, option) => (option?.label as string || '').toLowerCase().includes(input.toLowerCase())}
            options={regions.map((r: any) => ({ value: String(r.id), label: r.name }))}
          />
        </Col>
        <Col xs={12} md={4}>
          <Select
            style={{ width: '100%' }}
            placeholder="🏢 УК / ТСЖ"
            allowClear
            value={filterMcId || undefined}
            onChange={(v) => { setFilterMcId(v || ''); }}
            showSearch
            filterOption={(input, option) => (option?.label as string || '').toLowerCase().includes(input.toLowerCase())}
            options={managementCompanies.map((mc: any) => ({ value: String(mc.id), label: mc.short_name || mc.name }))}
          />
        </Col>
        <Col xs={12} md={3}>
          <Input
            placeholder="🔢 Лицевой счёт"
            value={filterPersonalAccount}
            onChange={(e) => setFilterPersonalAccount(e.target.value)}
            onPressEnter={applyFilters}
            allowClear
            prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
          />
        </Col>
        <Col xs={12} md={2}>
          <Button type="primary" onClick={applyFilters} block>🔍 Искать</Button>
        </Col>
      </Row>

      <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <Col>
          <Space>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>
              Новый клиент
            </Button>
            <Select
              style={{ width: 160 }}
              placeholder="Источник"
              allowClear
              value={filterSource || undefined}
              onChange={(v) => { setFilterSource(v || ''); }}
            >
              <Select.Option value="erc">ЕРЦ</Select.Option>
              <Select.Option value="excel_import">ТСЖ/УК</Select.Option>
              <Select.Option value="manual">Ручной ввод</Select.Option>
            </Select>
            <Button
              type={filterNoBuilding ? 'primary' : 'default'}
              danger={filterNoBuilding}
              onClick={() => { setFilterNoBuilding(!filterNoBuilding); }}
            >
              🏚️ Без дома
            </Button>
            <Button onClick={handleResetFilters}>🔄 Сбросить</Button>
          </Space>
        </Col>
      </Row>

      <Table
        columns={columns}
        dataSource={clients}
        loading={loading}
        rowKey="id"
        onChange={handleTableChange}
        scroll={{ x: 1100 }}
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
