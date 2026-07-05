import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Select, Typography, Card, message, Divider } from 'antd';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import type { MasterFormValues } from '../../types';

const { Title } = Typography;

const MastersCreatePage: React.FC = () => {
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

  const onFinish = async (values: MasterFormValues) => {
    setLoading(true);
    try {
      await api.post('/masters/', values);
      message.success('Мастер добавлен успешно');
      navigate('/masters');
    } catch (error: any) {
      const errMsg = error?.response?.data?.error || error?.response?.data?.detail || 'Ошибка добавления мастера';
      message.error(typeof errMsg === 'string' ? errMsg : 'Ошибка добавления мастера');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <Title level={3}>Добавить мастера</Title>

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
          name="is_available"
          label="Доступен"
          initialValue={true}
        >
          <Select>
            <Select.Option value={true}>Да</Select.Option>
            <Select.Option value={false}>Нет</Select.Option>
          </Select>
        </Form.Item>

        <Divider>Учетная запись для входа</Divider>

        <Form.Item
          name="username"
          label="Логин"
          rules={[{ required: true, message: 'Введите логин' }]}
        >
          <Input placeholder="Логин для входа в систему" />
        </Form.Item>

        <Form.Item
          name="password"
          label="Пароль"
          rules={[{ required: true, message: 'Введите пароль' }]}
        >
          <Input.Password placeholder="Пароль для входа в систему" />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block>
            Добавить мастера
          </Button>
        </Form.Item>

        <Form.Item>
          <Button type="default" onClick={() => navigate('/masters')} block>
            Отмена
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default MastersCreatePage;
