import React, { useState, useEffect } from 'react';
import { Typography, Card, Descriptions, Tag, Space, Button, Divider, message, Spin } from 'antd';
import { ArrowLeftOutlined, EditOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';
import type { Equipment, Order } from '../../types';

const { Title, Text } = Typography;

const EquipmentDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [equipment, setEquipment] = useState<Equipment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEquipment();
  }, [id]);

  const fetchEquipment = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/equipment/${id}/`);
      setEquipment(response.data);
    } catch (error) {
      message.error('Ошибка загрузки оборудования');
      navigate('/equipment');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!equipment) {
    return null;
  }

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      intercom: 'blue',
      camera: 'green',
      call_panel: 'orange',
      door_lock: 'purple',
      other: 'default',
    };
    return colors[type] || 'default';
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      working: 'green',
      broken: 'red',
      under_repair: 'orange',
      decommissioned: 'gray',
    };
    return colors[status] || 'default';
  };

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/equipment')}>
          Назад
        </Button>
        <Title level={3} style={{ margin: 0 }}>
          {equipment.name}
        </Title>
      </Space>

      <Card>
        <Descriptions title="Информация об оборудовании" column={2} size="small">
          <Descriptions.Item label="Название">{equipment.name}</Descriptions.Item>
          <Descriptions.Item label="Тип">
            <Tag color={getTypeColor(equipment.equipment_type)}>
              {equipment.equipment_type === 'intercom' ? 'Домофон' : equipment.equipment_type === 'camera' ? 'Камера' : equipment.equipment_type === 'call_panel' ? 'Вызывная панель' : equipment.equipment_type === 'door_lock' ? 'Дверной замок' : 'Другое'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Серийный номер">{equipment.serial_number}</Descriptions.Item>
          <Descriptions.Item label="Клиент">{equipment.client?.full_name || '-'}</Descriptions.Item>
          <Descriptions.Item label="Статус">
            <Tag color={getStatusColor(equipment.status)}>
              {equipment.status === 'working' ? 'Работает' : equipment.status === 'broken' ? 'Не работает' : equipment.status === 'under_repair' ? 'На ремонте' : 'Выбыл'}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label="Гарантия до">
            {equipment.warranty_until ? new Date(equipment.warranty_until).toLocaleDateString('ru-RU') : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Дата добавления">
            {new Date(equipment.created_at).toLocaleDateString('ru-RU')}
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  );
};

export default EquipmentDetailPage;
