import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Select, Typography, Card, message, Spin, Divider, Row, Col } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';
import type { OrderFormValues, Order, Master } from '../../types';

const { Title } = Typography;

const OrdersEditPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [regions, setRegions] = useState([]);
  const [clients, setClients] = useState([]);
  const [masters, setMasters] = useState<Master[]>([]);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchOrder();
    fetchRegions();
    fetchClients();
    fetchMasters();
  }, [id]);

  const fetchMasters = async () => {
    try {
      const response = await api.get('/masters/');
      setMasters(response.data.results || response.data);
    } catch (error) {
      console.error('Ошибка загрузки мастеров:', error);
    }
  };

  const fetchOrder = async () => {
    try {
      const response = await api.get(`/orders/${id}/`);
      const orderData = response.data;
      
      // Формируем начальные значения формы
      form.setFieldsValue({
        client_id: orderData.client_id || orderData.client?.id,
        region_id: orderData.region_id || orderData.region?.id,
        order_type: orderData.order_type,
        city: orderData.city,
        street_name: orderData.street_name,
        house_number: orderData.house_number,
        building_number: orderData.building_number,
        apartment: orderData.apartment,
        entrance: orderData.entrance,
        address: orderData.address,
        description: orderData.description,
        priority: orderData.priority,
        photo_report_required: orderData.photo_report_required,
        equipment_id: orderData.equipment?.id || orderData.equipment_id || undefined,
        master_id: orderData.master?.id || orderData.master_id || undefined,
      });
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

  const onFinish = async (values: OrderFormValues) => {
    setSaving(true);
    try {
      await api.patch(`/orders/${id}/`, values);
      message.success('Заявка обновлена успешно');
      navigate(`/orders/${id}`);
    } catch (error) {
      message.error('Ошибка обновления заявки');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <Card>
      <Title level={3}>Редактировать заявку</Title>

      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        style={{ maxWidth: 600 }}
      >
        <Form.Item
          name="client_id"
          label="Клиент"
          rules={[{ required: true, message: 'Выберите клиента' }]}
        >
          <Select
            showSearch
            placeholder="Выберите клиента"
            optionFilterProp="children"
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            options={clients.map((client: any) => ({
              value: client.id,
              label: `${client.full_name} (${client.phone})`,
            }))}
          />
        </Form.Item>

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
            <Select.Option value="repair">Ремонт</Select.Option>
            <Select.Option value="connection">Подключение</Select.Option>
            <Select.Option value="sale">Продажа</Select.Option>
          </Select>
        </Form.Item>

        <Divider>Адрес</Divider>

        <Row gutter={12}>
          <Col span={12}>
            <Form.Item name="city" label="Город">
              <Input placeholder="Москва" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="street_name" label="Улица">
              <Input placeholder="Ленина" />
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

        <Form.Item
          name="priority"
          label="Приоритет"
        >
          <Select>
            <Select.Option value="low">Низкий</Select.Option>
            <Select.Option value="medium">Средний</Select.Option>
            <Select.Option value="high">Высокий</Select.Option>
            <Select.Option value="urgent">Срочный</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="photo_report_required"
          label="Требуется фото/видео отчёт"
          valuePropName="checked"
        >
          <Select placeholder="Обязательность отчёта">
            <Select.Option value={false}>Не требуется</Select.Option>
            <Select.Option value={true}>Обязателен</Select.Option>
          </Select>
        </Form.Item>

        <Divider>Мастер</Divider>

        <Form.Item
          name="master_id"
          label="Мастер"
        >
          <Select
            showSearch
            placeholder="Выберите мастера (опционально)"
            allowClear
            optionFilterProp="label"
            filterOption={(input, option) =>
              (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
            }
            options={masters.map((master: any) => ({
              value: master.id,
              label: `${master.full_name || master.user?.first_name} — ${master.region?.name || 'без района'} (${master.phone})`,
            }))}
          />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={saving} block>
            Сохранить изменения
          </Button>
        </Form.Item>

        <Form.Item>
          <Button type="default" onClick={() => navigate(`/orders/${id}`)} block>
            Отмена
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default OrdersEditPage;
