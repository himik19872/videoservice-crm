import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Select, Typography, Card, message } from 'antd';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import type { EquipmentFormValues } from '../../types';

const { Title } = Typography;

const EquipmentCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState([]);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      const response = await api.get('/clients/');
      setClients(response.data.results || response.data);
    } catch (error) {
      console.error('Ошибка загрузки клиентов:', error);
    }
  };

  const onFinish = async (values: EquipmentFormValues) => {
    setLoading(true);
    try {
      const response = await api.post('/equipment/', values);
      message.success('Оборудование добавлено успешно');
      navigate('/equipment');
    } catch (error) {
      message.error('Ошибка добавления оборудования');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <Title level={3}>Добавить оборудование</Title>

      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        style={{ maxWidth: 600 }}
      >
        <Form.Item
          name="name"
          label="Название"
          rules={[{ required: true, message: 'Введите название' }]}
        >
          <Input placeholder="Введите название" />
        </Form.Item>

        <Form.Item
          name="equipment_type"
          label="Тип"
          rules={[{ required: true, message: 'Выберите тип' }]}
        >
          <Select placeholder="Выберите тип">
            <Select.Option value="intercom">Домофон</Select.Option>
            <Select.Option value="camera">Камера</Select.Option>
            <Select.Option value="call_panel">Вызывная панель</Select.Option>
            <Select.Option value="door_lock">Дверной замок</Select.Option>
            <Select.Option value="other">Другое</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="serial_number"
          label="Серийный номер"
          rules={[{ required: true, message: 'Введите серийный номер' }]}
        >
          <Input placeholder="Введите серийный номер" />
        </Form.Item>

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
          name="status"
          label="Статус"
          initialValue="working"
        >
          <Select>
            <Select.Option value="working">Работает</Select.Option>
            <Select.Option value="broken">Не работает</Select.Option>
            <Select.Option value="under_repair">На ремонте</Select.Option>
            <Select.Option value="decommissioned">Выбыл</Select.Option>
          </Select>
        </Form.Item>

        <Form.Item
          name="warranty_until"
          label="Гарантия до"
        >
          <Input type="date" />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block>
            Добавить оборудование
          </Button>
        </Form.Item>

        <Form.Item>
          <Button type="default" onClick={() => navigate('/equipment')} block>
            Отмена
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default EquipmentCreatePage;
