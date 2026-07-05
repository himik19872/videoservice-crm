import React, { useState } from 'react';
import { Form, Input, Button, Select, Typography, Card, message, Divider, Row, Col } from 'antd';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import AddressSuggest from '../../components/AddressSuggest';
import type { OrderFormValues } from '../../types';

const { Title } = Typography;

const OrdersCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [regions, setRegions] = useState([]);
  const [clients, setClients] = useState([]);
  const [form] = Form.useForm();

  React.useEffect(() => {
    fetchRegions();
    fetchClients();
  }, []);

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
    setLoading(true);
    try {
      const response = await api.post('/orders/', values);
      message.success('Заявка создана успешно');
      navigate('/orders');
    } catch (error) {
      message.error('Ошибка создания заявки');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <Title level={3}>Создать новую заявку</Title>

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

        <Form.Item
          name="priority"
          label="Приоритет"
          initialValue="medium"
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

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block>
            Создать заявку
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
