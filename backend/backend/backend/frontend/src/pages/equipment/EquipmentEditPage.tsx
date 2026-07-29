import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Select, Typography, Card, message, Spin } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';
import type { EquipmentFormValues, Equipment } from '../../types';

const { Title } = Typography;

const EquipmentEditPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState([]);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchEquipment();
    fetchClients();
  }, [id]);

  const fetchEquipment = async () => {
    try {
      const response = await api.get(`/equipment/${id}/`);
      const equipmentData = response.data;
      
      // Формируем начальные значения формы
      form.setFieldsValue({
        name: equipmentData.name,
        equipment_type: equipmentData.equipment_type,
        serial_number: equipmentData.serial_number || '',
        client_id: equipmentData.client_id || undefined,
        status: equipmentData.status,
        warranty_until: equipmentData.warranty_until || '',
      });
      setLoading(false);
    } catch (error) {
      message.error('Ошибка загрузки оборудования');
      navigate('/equipment');
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

  const onFinish = async (values: EquipmentFormValues) => {
    setSaving(true);
    try {
      await api.patch(`/equipment/${id}/`, values);
      message.success('Оборудование обновлено успешно');
      navigate(`/equipment/${id}`);
    } catch (error) {
      message.error('Ошибка обновления оборудования');
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
      <Title level={3}>Редактировать оборудование</Title>

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
          rules={[{ required: true, message: 'Выберите статус' }]}
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
          <Button type="primary" htmlType="submit" loading={saving} block>
            Сохранить изменения
          </Button>
        </Form.Item>

        <Form.Item>
          <Button type="default" onClick={() => navigate(`/equipment/${id}`)} block>
            Отмена
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default EquipmentEditPage;
