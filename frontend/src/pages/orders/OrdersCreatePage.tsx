import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Select, Typography, Card, message, Divider, Row, Col, Radio } from 'antd';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import AddressSuggest from '../../components/AddressSuggest';
import InnSuggest from '../../components/InnSuggest';

const { Title } = Typography;

const OrdersCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedClientId = searchParams.get('client_id');
  const [loading, setLoading] = useState(false);
  const [regions, setRegions] = useState([]);
  const [clientOptions, setClientOptions] = useState<{ value: number; label: string; client: any }[]>([]);
  const [users, setUsers] = useState([]);
  const [form] = Form.useForm();
  const [clientMode, setClientMode] = useState<'existing' | 'new'>(preselectedClientId ? 'existing' : 'existing');
  const [clientType, setClientType] = useState<'individual' | 'legal'>('individual');
  const [creatingClient, setCreatingClient] = useState(false);
  const [clientSearching, setClientSearching] = useState(false);

  useEffect(() => {
    fetchRegions();
    fetchUsers();
    // Если пришли из карточки клиента — загружаем его данные
    if (preselectedClientId) {
      loadPreselectedClient();
    }
  }, []);

  const loadPreselectedClient = async () => {
    try {
      const res = await api.get(`/clients/${preselectedClientId}/`);
      const c = res.data;
      setClientOptions([{ value: c.id, label: `${c.full_name} — ${c.address}`, client: c }]);
      form.setFieldsValue({ client_id: c.id });
      // Заполняем адрес из клиента
      form.setFieldsValue({ client_address: c.address, client_phone: c.phone });
    } catch (e) {}
  };

  const fetchUsers = async () => {
    try {
      const response = await api.get('/users/');
      setUsers((response.data.results || response.data).map((u: any) => ({
        ...u, full_name: u.user?.first_name ? `${u.user.last_name} ${u.user.first_name}`.trim() : u.user?.username, role: u.role
      })));
    } catch (error) {}
  };

  const fetchRegions = async () => {
    try {
      const response = await api.get('/regions/');
      setRegions(response.data.results || response.data);
    } catch (error) {}
  };

  // Поиск клиентов через API (серверный)
  const handleClientSearch = async (value: string) => {
    if (!value || value.length < 2) {
      if (!preselectedClientId) setClientOptions([]);
      return;
    }
    setClientSearching(true);
    try {
      const res = await api.get('/clients/', { params: { search: value, page_size: 50 } });
      const results = (res.data.results || []);
      setClientOptions(results.map((c: any) => ({
        value: c.id,
        label: c.is_legal
          ? `${c.full_name} (ИНН: ${c.inn || '—'}) — ${c.address}`
          : `${c.full_name} — ${c.address} (${c.phone || 'нет тел.'})`,
        client: c,
      })));
    } catch (e) { setClientOptions([]); }
    finally { setClientSearching(false); }
  };

  const handleClientSelect = (clientId: number) => {
    const found = clientOptions.find(c => c.value === clientId);
    if (found?.client) {
      const c = found.client;
      form.setFieldsValue({
        client_address: c.address,
        client_phone: c.phone,
        management_company: c.management_company || '',
      });
    }
  };

  const handleInnFound = (company: any) => {
    form.setFieldsValue({
      new_client_name: company.name || company.short_name,
      new_client_inn: company.inn,
      new_client_kpp: company.kpp,
      new_client_ogrn: company.ogrn,
      new_client_address: company.legal_address,
      new_client_director: company.director,
    });
  };

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      let clientId = values.client_id;

      if (clientMode === 'new') {
        setCreatingClient(true);
        const clientPayload: any = {
          full_name: values.new_client_name,
          phone: values.new_client_phone,
          address: values.new_client_address || '',
          region_id: values.region_id,
          is_legal: clientType === 'legal',
        };
        if (clientType === 'legal') {
          clientPayload.inn = values.new_client_inn || '';
          clientPayload.kpp = values.new_client_kpp || '';
          clientPayload.ogrn = values.new_client_ogrn || '';
          clientPayload.legal_address = values.new_client_address || '';
          clientPayload.director_name = values.new_client_director || '';
        }
        const clientRes = await api.post('/clients/', clientPayload);
        clientId = clientRes.data.id;
        message.success('Клиент создан');
        setCreatingClient(false);
      }

      const orderPayload: any = {
        client_id: clientId,
        region_id: values.region_id,
        order_type: values.order_type,
        description: values.description,
        priority: values.priority || 'medium',
        city: values.city || '',
        street_name: values.street_name || '',
        house_number: values.house_number || '',
        building_number: values.building_number || '',
        apartment: values.apartment || '',
        entrance: values.entrance || '',
        cost: values.cost || undefined,
        payment_type: values.payment_type || undefined,
        is_warranty: values.is_warranty ?? false,
        photo_report_required: values.photo_report_required ?? false,
        helper_ids: values.helper_ids || [],
        scheduled_at: values.scheduled_at || undefined,
        deadline: values.deadline || undefined,
      };

      await api.post('/orders/', orderPayload);
      message.success('Заявка создана');
      navigate('/orders');
    } catch (error: any) {
      message.error(error.response?.data?.detail || error.response?.data?.error || 'Ошибка создания заявки');
    } finally {
      setLoading(false);
      setCreatingClient(false);
    }
  };

  return (
    <Card>
      <Title level={3}>Создать новую заявку</Title>

      <Form form={form} layout="vertical" onFinish={onFinish} style={{ maxWidth: 700 }}
        initialValues={{ priority: 'medium' }}>

        <Divider>👤 Клиент</Divider>

        <Form.Item label="Тип клиента">
          <Radio.Group value={clientType} onChange={e => { setClientType(e.target.value); form.setFieldValue('client_id', undefined); }}>
            <Radio.Button value="individual">👤 Частное лицо</Radio.Button>
            <Radio.Button value="legal">🏢 Юридическое лицо</Radio.Button>
          </Radio.Group>
        </Form.Item>

        <Form.Item label="Клиент">
          <Radio.Group value={clientMode} onChange={e => { setClientMode(e.target.value); form.setFieldValue('client_id', undefined); }}
            style={{ marginBottom: 12 }}>
            <Radio.Button value="existing">Из списка</Radio.Button>
            <Radio.Button value="new">➕ Быстрое создание</Radio.Button>
          </Radio.Group>
        </Form.Item>

        {clientMode === 'existing' ? (
          <Form.Item name="client_id" rules={[{ required: true, message: 'Выберите клиента' }]}>
            <Select
              showSearch
              placeholder="🔍 Введите адрес, ФИО или телефон для поиска..."
              filterOption={false}
              onSearch={handleClientSearch}
              onSelect={handleClientSelect}
              options={clientOptions}
              loading={clientSearching}
              notFoundContent={clientSearching ? 'Поиск...' : 'Начните вводить адрес или ФИО (мин. 2 символа)'}
            />
          </Form.Item>
        ) : (
          <Card size="small" title={clientType === 'legal' ? 'Новое юридическое лицо' : 'Новый клиент'} style={{ marginBottom: 16 }}>
            <Form.Item name="new_client_name" label={clientType === 'legal' ? 'Название' : 'ФИО'}
              rules={[{ required: true, message: 'Введите' }]}>
              <Input />
            </Form.Item>
            <Form.Item name="new_client_phone" label="Телефон" rules={[{ required: true, message: 'Введите телефон' }]}>
              <Input placeholder="+7 (999) 123-45-67" />
            </Form.Item>
            {clientType === 'legal' && (
              <>
                <Form.Item name="new_client_inn" label="ИНН"><InnSuggest onFound={handleInnFound} /></Form.Item>
                <Row gutter={12}>
                  <Col span={12}><Form.Item name="new_client_kpp" label="КПП"><Input maxLength={9} /></Form.Item></Col>
                  <Col span={12}><Form.Item name="new_client_ogrn" label="ОГРН"><Input maxLength={15} /></Form.Item></Col>
                </Row>
                <Form.Item name="new_client_director" label="Руководитель"><Input /></Form.Item>
              </>
            )}
            <Form.Item name="new_client_address" label="Адрес"><Input /></Form.Item>
          </Card>
        )}

        {/* Адрес клиента (автозаполняется при выборе) */}
        <Form.Item name="client_address" label="Адрес клиента (авто)">
          <Input placeholder="Заполнится при выборе клиента" readOnly style={{ background: '#f5f5f5' }} />
        </Form.Item>

        <Form.Item name="region_id" label="Район" rules={[{ required: true, message: 'Выберите район' }]}>
          <Select placeholder="Выберите район"
            options={regions.map((r: any) => ({ value: r.id, label: r.name }))} />
        </Form.Item>

        <Form.Item name="order_type" label="Тип заявки" rules={[{ required: true }]}>
          <Select placeholder="Выберите тип">
            <Select.Option value="repair">🔧 Ремонт</Select.Option>
            <Select.Option value="sale">💰 Продажа</Select.Option>
            <Select.Option value="installation">🏗️ Монтаж</Select.Option>
            <Select.Option value="maintenance">🔄 ТО</Select.Option>
            <Select.Option value="inspection">🔍 Обследование</Select.Option>
            <Select.Option value="connection">🔌 Подключение</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item name="helper_ids" label="👥 Помощники">
          <Select mode="multiple" placeholder="Выберите сотрудников" allowClear>
            {users.map((u: any) => (
              <Select.Option key={u.id} value={u.id}>{u.full_name || u.username} ({u.role})</Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Divider>📍 Адрес заявки</Divider>

        <Form.Item label="Быстрый ввод" help="Подстановка из DaData">
          <AddressSuggest onSelect={(addr: any) => {
            form.setFieldsValue({ city: addr.city, street_name: addr.street_name,
              house_number: addr.house_number, building_number: addr.building_number,
              apartment: addr.apartment, entrance: addr.entrance });
          }} />
        </Form.Item>

        <Row gutter={12}>
          <Col span={12}><Form.Item name="city" label="Город"><Input /></Form.Item></Col>
          <Col span={12}><Form.Item name="street_name" label="Улица"><Input /></Form.Item></Col>
        </Row>
        <Row gutter={12}>
          <Col span={6}><Form.Item name="house_number" label="Дом"><Input /></Form.Item></Col>
          <Col span={6}><Form.Item name="building_number" label="Корпус"><Input /></Form.Item></Col>
          <Col span={6}><Form.Item name="apartment" label="Квартира"><Input /></Form.Item></Col>
          <Col span={6}><Form.Item name="entrance" label="Подъезд"><Input /></Form.Item></Col>
        </Row>

        <Divider>📝 Описание</Divider>

        <Form.Item name="description" label="Описание проблемы" rules={[{ required: true }]}>
          <Input.TextArea rows={4} placeholder="Опишите проблему" />
        </Form.Item>

        <Row gutter={12}>
          <Col span={12}><Form.Item name="priority" label="Приоритет">
            <Select><Select.Option value="low">Низкий</Select.Option><Select.Option value="medium">Средний</Select.Option>
              <Select.Option value="high">Высокий</Select.Option><Select.Option value="urgent">Срочный</Select.Option></Select>
          </Form.Item></Col>
          <Col span={12}><Form.Item name="cost" label="Стоимость"><Input placeholder="₽" /></Form.Item></Col>
        </Row>

        <Row gutter={12}>
          <Col span={12}><Form.Item name="payment_type" label="Тип оплаты">
            <Select allowClear placeholder="Не указан"><Select.Option value="cash">Наличные</Select.Option><Select.Option value="cashless">Безналичные</Select.Option></Select>
          </Form.Item></Col>
          <Col span={12}><Form.Item name="is_warranty" label="Гарантия" valuePropName="checked">
            <Radio.Group><Radio value={true}>Гарантийная</Radio><Radio value={false}>Платная</Radio></Radio.Group>
          </Form.Item></Col>
        </Row>

        <Button type="primary" htmlType="submit" loading={loading} block>
          Создать заявку
        </Button>
      </Form>
    </Card>
  );
};


export default OrdersCreatePage;
