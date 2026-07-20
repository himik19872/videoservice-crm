import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Select, Typography, Card, message, Spin, Divider, Row, Col } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';
import type { OrderFormValues, Master } from '../../types';

const { Title } = Typography;

const OrdersEditPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [regions, setRegions] = useState([]);
  const [clientOptions, setClientOptions] = useState<{ value: number; label: string }[]>([]);
  const [masters, setMasters] = useState<Master[]>([]);
  const [clientSearching, setClientSearching] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchOrder();
    fetchRegions();
    fetchMasters();
  }, [id]);

  const fetchMasters = async () => {
    try {
      const response = await api.get('/masters/');
      setMasters(response.data.results || response.data);
    } catch (e) {}
  };

  const fetchOrder = async () => {
    try {
      const response = await api.get(`/orders/${id}/`);
      const orderData = response.data;
      form.setFieldsValue({
        client_id: orderData.client_id || orderData.client?.id,
        region_id: orderData.region_id || orderData.region?.id,
        order_type: orderData.order_type,
        city: orderData.city, street_name: orderData.street_name,
        house_number: orderData.house_number, building_number: orderData.building_number,
        apartment: orderData.apartment, entrance: orderData.entrance,
        address: orderData.address, description: orderData.description,
        priority: orderData.priority, photo_report_required: orderData.photo_report_required,
        equipment_id: orderData.equipment?.id || orderData.equipment_id || undefined,
        master_id: orderData.master?.id || orderData.master_id || undefined,
      });
      // Подгружаем текущего клиента в опции
      if (orderData.client_id || orderData.client?.id) {
        const cid = orderData.client_id || orderData.client?.id;
        const c = orderData.client_info || { full_name: 'Загрузка...', phone: '', address: '' };
        setClientOptions([{ value: cid, label: `${c.full_name || '—'} — ${c.address || ''} (${c.phone || ''})` }]);
      }
      setLoading(false);
    } catch (error) {
      message.error('Ошибка загрузки заявки');
      navigate('/orders');
    }
  };

  const fetchRegions = async () => {
    try {
      const response = await api.get('/regions/');
      setRegions(response.data.results || response.data);
    } catch (e) {}
  };

  const handleClientSearch = async (value: string) => {
    if (!value || value.length < 2) return;
    setClientSearching(true);
    try {
      const res = await api.get('/clients/', { params: { search: value, page_size: 30 } });
      setClientOptions((res.data.results || []).map((c: any) => ({
        value: c.id,
        label: `${c.full_name} — ${c.address} (${c.phone || 'нет тел.'})`,
      })));
    } catch (e) { setClientOptions([]); }
    finally { setClientSearching(false); }
  };

  const onFinish = async (values: OrderFormValues) => {
    setSaving(true);
    try {
      await api.patch(`/orders/${id}/`, values);
      message.success('Заявка обновлена');
      navigate(`/orders/${id}`);
    } catch (error) {
      message.error('Ошибка обновления заявки');
    } finally { setSaving(false); }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div>;

  return (
    <Card>
      <Title level={3}>Редактировать заявку</Title>
      <Form form={form} layout="vertical" onFinish={onFinish} style={{ maxWidth: 600 }}>
        <Form.Item name="client_id" label="Клиент" rules={[{ required: true }]}>
          <Select
            showSearch
            placeholder="🔍 Введите адрес или ФИО для поиска..."
            filterOption={false}
            onSearch={handleClientSearch}
            options={clientOptions}
            loading={clientSearching}
            notFoundContent={clientSearching ? 'Поиск...' : 'Введите 2+ символа'}
          />
        </Form.Item>

        <Form.Item name="region_id" label="Район" rules={[{ required: true }]}>
          <Select placeholder="Выберите район"
            options={regions.map((r: any) => ({ value: r.id, label: r.name }))} />
        </Form.Item>

        <Form.Item name="order_type" label="Тип заявки" rules={[{ required: true }]}>
          <Select><Select.Option value="repair">Ремонт</Select.Option>
            <Select.Option value="connection">Подключение</Select.Option>
            <Select.Option value="sale">Продажа</Select.Option>
            <Select.Option value="installation">Монтаж</Select.Option>
            <Select.Option value="maintenance">ТО</Select.Option>
            <Select.Option value="inspection">Обследование</Select.Option></Select>
        </Form.Item>

        <Divider>Адрес</Divider>
        <Row gutter={12}>
          <Col span={12}><Form.Item name="city" label="Город"><Input /></Form.Item></Col>
          <Col span={12}><Form.Item name="street_name" label="Улица"><Input /></Form.Item></Col>
        </Row><Row gutter={12}>
          <Col span={8}><Form.Item name="house_number" label="Дом"><Input /></Form.Item></Col>
          <Col span={8}><Form.Item name="building_number" label="Корпус"><Input /></Form.Item></Col>
          <Col span={8}><Form.Item name="apartment" label="Кв."><Input /></Form.Item></Col>
        </Row>
        <Form.Item name="entrance" label="Подъезд"><Input /></Form.Item>

        <Divider>Описание</Divider>
        <Form.Item name="description" label="Описание" rules={[{ required: true }]}>
          <Input.TextArea rows={4} /></Form.Item>
        <Form.Item name="priority" label="Приоритет">
          <Select><Select.Option value="low">Низкий</Select.Option><Select.Option value="medium">Средний</Select.Option>
            <Select.Option value="high">Высокий</Select.Option><Select.Option value="urgent">Срочный</Select.Option></Select>
        </Form.Item>
        <Form.Item name="photo_report_required" label="Фото/видео отчёт">
          <Select><Select.Option value={false}>Не требуется</Select.Option><Select.Option value={true}>Обязателен</Select.Option></Select>
        </Form.Item>

        <Divider>Мастер</Divider>
        <Form.Item name="master_id" label="Мастер">
          <Select showSearch placeholder="Выберите мастера" allowClear optionFilterProp="label"
            filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
            options={masters.map((m: any) => ({
              value: m.id,
              label: `${m.full_name || m.user?.first_name} — ${m.region?.name || 'без района'} (${m.phone})`,
            }))} />
        </Form.Item>

        <Button type="primary" htmlType="submit" loading={saving} block>Сохранить изменения</Button>
        <Button type="default" onClick={() => navigate(`/orders/${id}`)} block style={{ marginTop: 8 }}>Отмена</Button>
      </Form>
    </Card>
  );
};

export default OrdersEditPage;
