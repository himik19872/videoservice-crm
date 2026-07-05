import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Select, Typography, Card, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import type { ClientFormValues } from '../../types';

const { Title } = Typography;

const ClientsCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [regions, setRegions] = useState([]);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchRegions();
  }, []);

  const fetchRegions = async () => {
    try {
      const response = await api.get('/regions/');
      setRegions(response.data.results || response.data);
    } catch (error) {
      console.error('Ошибка загрузки районов:', error);
    }
  };

  const onFinish = async (values: ClientFormValues) => {
    setLoading(true);
    try {
      const response = await api.post('/clients/', values);
      message.success('Клиент создан успешно');
      navigate('/clients');
    } catch (error) {
      message.error('Ошибка создания клиента');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <Title level={3}>Создать нового клиента</Title>

      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        style={{ maxWidth: 600 }}
      >
        <Form.Item
          name="full_name"
          label="ФИО"
          rules={[{ required: true, message: 'Введите ФИО' }]}
        >
          <Input placeholder="Введите ФИО" />
        </Form.Item>

        <Form.Item
          name="phone"
          label="Телефон"
          rules={[{ required: true, message: 'Введите телефон' }]}
        >
          <Input placeholder="Введите телефон" />
        </Form.Item>

        <Form.Item
          name="email"
          label="Email"
        >
          <Input placeholder="Введите email" />
        </Form.Item>

        <Form.Item
          name="address"
          label="Адрес"
          rules={[{ required: true, message: 'Введите адрес' }]}
        >
          <Input placeholder="Введите адрес" />
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
          name="notes"
          label="Примечания"
        >
          <Input.TextArea rows={4} placeholder="Дополнительная информация" />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block>
            Создать клиента
          </Button>
        </Form.Item>

        <Form.Item>
          <Button type="default" onClick={() => navigate('/clients')} block>
            Отмена
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default ClientsCreatePage;
