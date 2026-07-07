import React, { useState } from 'react';
import { Form, Input, Button, Select, Typography, Card, message, Divider, Row, Col, InputNumber, Radio, Tabs } from 'antd';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import AddressSuggest from '../../components/AddressSuggest';
import InnSuggest from '../../components/InnSuggest';
import type { OrderFormValues } from '../../types';

const { Title } = Typography;

const OrdersCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [regions, setRegions] = useState([]);
  const [clients, setClients] = useState([]);
  const [users, setUsers] = useState([]);
  const [form] = Form.useForm();

  // Тип выбора клиента: existing — из списка, new — быстрое создание
  const [clientMode, setClientMode] = useState<'existing' | 'new'>('existing');
  // Тип клиента: individual — физлицо, legal — юрлицо
  const [clientType, setClientType] = useState<'individual' | 'legal'>('individual');
  // Создаём нового клиента
  const [creatingClient, setCreatingClient] = useState(false);

  React.useEffect(() => {
    fetchRegions();
    fetchClients();
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const response = await api.get('/users/');
      setUsers((response.data.results || response.data).map((u: any) => ({...u, full_name: u.user?.first_name ? `${u.user.last_name} ${u.user.first_name}`.trim() : u.user?.username, role: u.role})));
    } catch (error) {
      console.error('Ошибка загрузки пользователей:', error);
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

  const fetchClients = async () => {
    try {
      const response = await api.get('/clients/');
      setClients(response.data.results || response.data);
    } catch (error) {
      console.error('Ошибка загрузки клиентов:', error);
    }
  };

  // Автозаполнение юрлица по ИНН при быстром создании
  const handleInnFound = (company: any) => {
    form.setFieldsValue({
      new_client_name: company.name || company.short_name,
      new_client_inn: company.inn,
      new_client_kpp: company.kpp,
      new_client_ogrn: company.ogrn,
      new_client_address: company.legal_address,
      new_client_director: company.director,
    });
    message.success(company.short_name || company.name);
  };

  // Фильтрация клиентов по типу (физлицо / юрлицо)
  const filteredClients = clients.filter((c: any) => {
    if (clientType === 'legal') return c.is_legal;
    return !c.is_legal;
  });

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      let clientId = values.client_id;

      // Если создаём нового клиента
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
        message.success(`Клиент «${clientPayload.name}» создан`);
        setCreatingClient(false);
      }

      // Создаём заявку
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
      message.success('Заявка создана успешно');
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

      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        style={{ maxWidth: 700 }}
        initialValues={{ clientMode: 'existing', clientType: 'individual', priority: 'medium' }}
      >

        <Divider>👤 Клиент</Divider>

        {/* Тип клиента: физлицо / юрлицо */}
        <Form.Item label="Тип клиента">
          <Radio.Group
            value={clientType}
            onChange={e => {
              setClientType(e.target.value);
              form.setFieldValue('client_id', undefined);
            }}
          >
            <Radio.Button value="individual">👤 Частное лицо</Radio.Button>
            <Radio.Button value="legal">🏢 Юридическое лицо</Radio.Button>
          </Radio.Group>
        </Form.Item>

        {/* Режим: выбрать существующего или создать нового */}
        <Form.Item label="Клиент">
          <Radio.Group
            value={clientMode}
            onChange={e => {
              setClientMode(e.target.value);
              form.setFieldValue('client_id', undefined);
            }}
            style={{ marginBottom: 12 }}
          >
            <Radio.Button value="existing">Из списка</Radio.Button>
            <Radio.Button value="new">➕ Быстрое создание</Radio.Button>
          </Radio.Group>
        </Form.Item>

        {clientMode === 'existing' ? (
          /* Выбор существующего клиента */
          <Form.Item
            name="client_id"
            rules={[{ required: true, message: 'Выберите клиента' }]}
          >
            <Select
              showSearch
              placeholder={clientType === 'legal' ? 'Выберите организацию' : 'Выберите клиента'}
              optionFilterProp="children"
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={filteredClients.map((client: any) => ({
                value: client.id,
                label: client.is_legal
                  ? `${client.name} (ИНН: ${client.inn || '—'})`
                  : `${client.name} (${client.phone})`,
              }))}
              notFoundContent={
                <span>
                  Нет подходящих клиентов.{' '}
                  <Button type="link" size="small" onClick={() => setClientMode('new')}>
                    Создать нового
                  </Button>
                </span>
              }
            />
          </Form.Item>
        ) : (
          /* Быстрое создание клиента */
          <Card size="small" title={clientType === 'legal' ? 'Новое юридическое лицо' : 'Новый клиент'} style={{ marginBottom: 16 }}>
            <Form.Item
              name="new_client_name"
              label={clientType === 'legal' ? 'Название организации' : 'ФИО'}
              rules={[{ required: true, message: 'Введите название / ФИО' }]}
            >
              <Input placeholder={clientType === 'legal' ? 'ООО «Компания»' : 'Иванов Иван Иванович'} />
            </Form.Item>

            <Form.Item
              name="new_client_phone"
              label="Телефон"
              rules={[{ required: true, message: 'Введите телефон' }]}
            >
              <Input placeholder="+7 (999) 123-45-67" />
            </Form.Item>

            {clientType === 'legal' && (
              <>
                <Form.Item name="new_client_inn" label="ИНН" style={{ marginBottom: 8 }}>
                  <InnSuggest onFound={handleInnFound} placeholder="ИНН для автозаполнения" />
                </Form.Item>
                <Row gutter={12}>
                  <Col span={12}>
                    <Form.Item name="new_client_kpp" label="КПП"><Input maxLength={9} /></Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="new_client_ogrn" label="ОГРН"><Input maxLength={15} /></Form.Item>
                  </Col>
                </Row>
                <Form.Item name="new_client_director" label="Руководитель"><Input placeholder="ФИО директора" /></Form.Item>
              </>
            )}

            <Form.Item name="new_client_address" label="Адрес">
              <Input placeholder="г. Москва, ул. Тверская, д. 1" />
            </Form.Item>
          </Card>
        )}

        <Form.Item
          name="region_id"
          label="Район"
          rules={[{ required: true, message: 'Выберите район' }]}
        >
          <Select
            placeholder="Выберите район"
            options={regions.map((region: any) => ({
              value: region.id,
              label: region.name,
            }))}
          />
        </Form.Item>

        <Form.Item
          name="order_type"
          label="Тип заявки"
          rules={[{ required: true, message: 'Выберите тип заявки' }]}
        >
          <Select placeholder="Выберите тип">
            <Select.Option value="repair">🔧 Ремонт</Select.Option>
            <Select.Option value="sale">💰 Продажа оборудования</Select.Option>
            <Select.Option value="installation">🏗️ Монтаж оборудования</Select.Option>
            <Select.Option value="maintenance">🔄 Сервисное ТО</Select.Option>
            <Select.Option value="inspection">🔍 Обследование</Select.Option>
            <Select.Option value="contract_install">📝 Договор на монтаж</Select.Option>
            <Select.Option value="contract_service">📋 Договор на обслуживание</Select.Option>
            <Select.Option value="connection">🔌 Подключение</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item name="helper_ids" label="👥 Помощники">
          <Select mode="multiple" placeholder="Выберите сотрудников в помощь" allowClear>
            {users.map((u: any) => (
              <Select.Option key={u.id} value={u.id}>{u.full_name || u.username} ({u.role})</Select.Option>
            ))}
          </Select>
        </Form.Item>

        <Divider>Адрес</Divider>

        <Form.Item label="Быстрый ввод адреса" help="Начните вводить — адрес подставится из DaData">
          <AddressSuggest
            onSelect={(addr) => {
              form.setFieldsValue({
                city: addr.city,
                street_name: addr.street_name,
                house_number: addr.house_number,
                building_number: addr.building_number,
                apartment: addr.apartment,
                entrance: addr.entrance,
              });
            }}
            placeholder="г. Пушкин, ул. Архитектора Данини, д. 21..."
          />
        </Form.Item>

        <Row gutter={12} style={{ marginTop: 16 }}>
          <Col span={12}>
            <Form.Item name="city" label="Город">
              <Input placeholder="Например: Москва" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="street_name" label="Улица">
              <Input placeholder="Например: Ленина" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={12}>
          <Col span={8}>
            <Form.Item name="house_number" label="Дом">
              <Input placeholder="10" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="building_number" label="Корпус">
              <Input placeholder="2" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="apartment" label="Квартира">
              <Input placeholder="42" />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="entrance" label="Подъезд">
          <Input placeholder="3" />
        </Form.Item>

        <Divider>Описание</Divider>

        <Form.Item
          name="description"
          label="Описание"
          rules={[{ required: true, message: 'Опишите проблему' }]}
        >
          <Input.TextArea rows={4} placeholder="Опишите проблему" />
        </Form.Item>

        <Form.Item name="priority" label="Приоритет" initialValue="medium">
          <Select>
            <Select.Option value="low">Низкий</Select.Option>
            <Select.Option value="medium">Средний</Select.Option>
            <Select.Option value="high">Высокий</Select.Option>
            <Select.Option value="urgent">Срочный</Select.Option>
          </Select>
        </Form.Item>

        <Divider>💰 Стоимость и оплата</Divider>
        <Row gutter={12}>
          <Col span={8}>
            <Form.Item name="cost" label="Стоимость (₽)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="payment_type" label="Тип оплаты">
              <Select placeholder="Выберите" allowClear>
                <Select.Option value="cash">💵 Наличные</Select.Option>
                <Select.Option value="cashless">🏦 Безналичные</Select.Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="is_warranty" label="Гарантия">
              <Select placeholder="Нет">
                <Select.Option value={false}>Нет</Select.Option>
                <Select.Option value={true}>Да (бесплатно)</Select.Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="photo_report_required" label="Требуется фото/видео отчёт">
          <Select placeholder="Обязательность отчёта">
            <Select.Option value={false}>Не требуется</Select.Option>
            <Select.Option value={true}>Обязателен</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading || creatingClient} block>
            {creatingClient ? 'Создаю клиента...' : 'Создать заявку'}
          </Button>
        </Form.Item>

        <Form.Item>
          <Button type="default" onClick={() => navigate('/orders')} block>
            Отмена
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default OrdersCreatePage;
