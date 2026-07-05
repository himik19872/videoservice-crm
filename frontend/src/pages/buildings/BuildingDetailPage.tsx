import React, { useState, useEffect } from 'react';
import { Typography, Card, Descriptions, Tag, Space, Button, Divider, Table, message, Spin } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';
import type { Building, BuildingOrder } from '../../types';
import dayjs from 'dayjs';

const { Title } = Typography;

const BuildingDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [building, setBuilding] = useState<Building | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBuilding();
  }, [id]);

  const fetchBuilding = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/buildings/${id}/`);
      setBuilding(response.data);
    } catch (error) {
      message.error('Ошибка загрузки дома');
      navigate('/buildings');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div>;
  }

  if (!building) return null;

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = { new: 'blue', assigned: 'purple', in_progress: 'orange', completed: 'green', cancelled: 'red' };
    return colors[status] || 'default';
  };

  const getTypeColor = (type: string) => {
    const colors: Record<string, string> = { repair: 'blue', connection: 'purple', sale: 'green' };
    return colors[type] || 'default';
  };

  const orderColumns = [
    { title: 'Номер', dataIndex: 'number', key: 'number', width: 140 },
    {
      title: 'Тип', dataIndex: 'order_type_display', key: 'order_type', width: 130,
      render: (text: string, record: BuildingOrder) => <Tag color={getTypeColor(record.order_type)}>{text}</Tag>,
    },
    {
      title: 'Статус', dataIndex: 'status_display', key: 'status', width: 120,
      render: (text: string, record: BuildingOrder) => <Tag color={getStatusColor(record.status)}>{text}</Tag>,
    },
    { title: 'Мастер', dataIndex: 'master_name', key: 'master', width: 180 },
    {
      title: 'Дата', dataIndex: 'created_at', key: 'created_at', width: 120,
      render: (date: string) => dayjs(date).format('DD.MM.YYYY'),
    },
  ];

  const orders: BuildingOrder[] = building.orders || [];

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/buildings')}>Назад</Button>
        <Title level={3} style={{ margin: 0 }}>
          {building.street_type_display} {building.street_name}, {building.house_number}
          {building.building_number ? ` корп.${building.building_number}` : ''}
        </Title>
      </Space>

      <Card>
        <Descriptions title="Информация о доме" column={2} size="small">
          <Descriptions.Item label="Город">{building.city}</Descriptions.Item>
          <Descriptions.Item label="Район">{building.region?.name || '-'}</Descriptions.Item>
          <Descriptions.Item label="Количество квартир">{building.apartments_count}</Descriptions.Item>
          <Descriptions.Item label="Количество подъездов">{building.entrances_count}</Descriptions.Item>
          <Descriptions.Item label="Тип оборудования">
            {building.equipment_type_display ? <Tag color="blue">{building.equipment_type_display}</Tag> : '-'}
          </Descriptions.Item>
          <Descriptions.Item label="Дата добавления">{dayjs(building.created_at).format('DD.MM.YYYY')}</Descriptions.Item>
          {building.notes && <Descriptions.Item label="Примечания" span={2}>{building.notes}</Descriptions.Item>}
        </Descriptions>
      </Card>

      <Divider />

      <Card title={`История заявок (${orders.length})`}>
        <Table
          columns={orderColumns}
          dataSource={orders}
          rowKey="id"
          pagination={{ pageSize: 10, showTotal: (total) => `Всего заявок: ${total}` }}
          locale={{ emptyText: 'Заявок по этому дому ещё нет' }}
        />
      </Card>
    </div>
  );
};

export default BuildingDetailPage;
