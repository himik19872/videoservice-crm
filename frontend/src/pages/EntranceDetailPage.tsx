import React, { useState, useEffect } from 'react';
import { Typography, Card, Descriptions, Tag, Space, Button, Divider, Table, message, Spin, List } from 'antd';
import { ArrowLeftOutlined, HomeOutlined, UserOutlined, EditOutlined } from '@ant-design/icons';
import { useNavigate, useParams, Link } from 'react-router-dom';
import api from '../services/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const EntranceDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [entrance, setEntrance] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [apartments, setApartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, [id]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [eRes, oRes, aRes] = await Promise.all([
        api.get(`/entrances/${id}/`),
        api.get(`/entrances/${id}/orders/`),
        api.get(`/entrances/${id}/apartments/`),
      ]);
      setEntrance(eRes.data);
      setOrders(oRes.data);
      setApartments(aRes.data);
    } catch (e) { message.error('Ошибка загрузки'); navigate('/entrances'); }
    finally { setLoading(false); }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div>;
  if (!entrance) return null;

  const bld = entrance.building_address || `Дом #${entrance.building}`;

  const orderCols = [
    { title: 'Номер', dataIndex: 'number', key: 'number', width: 140,
      render: (n: string, rec: any) => <Link to={`/orders/${rec.id}`}>#{n}</Link> },
    { title: 'Тип', dataIndex: 'order_type_display', key: 'type', width: 130, render: (t: string) => <Tag>{t}</Tag> },
    { title: 'Статус', dataIndex: 'status_display', key: 'status', width: 120, render: (t: string) => <Tag>{t}</Tag> },
    { title: 'Мастер', dataIndex: 'master_name', key: 'master', width: 180 },
    { title: 'Дата', dataIndex: 'created_at', key: 'date', width: 120, render: (d: string) => dayjs(d).format('DD.MM.YYYY') },
  ];

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/entrances')}>Назад</Button>
        <Title level={3} style={{ margin: 0 }}>🚪 {bld}, подъезд №{entrance.number}</Title>
        <Link to={`/buildings/${entrance.building}`}><Button icon={<HomeOutlined />}>Карточка дома</Button></Link>
      </Space>

      <Card>
        <Descriptions column={3} size="small">
          <Descriptions.Item label="Дом">
            <Link to={`/buildings/${entrance.building}`}>{bld}</Link>
          </Descriptions.Item>
          <Descriptions.Item label="Подъезд №">{entrance.number}</Descriptions.Item>
          <Descriptions.Item label="Квартиры">{entrance.apartment_from && entrance.apartment_to ? `${entrance.apartment_from}–${entrance.apartment_to}` : `${entrance.apartments_count} кв.`}</Descriptions.Item>
          <Descriptions.Item label="IP-адрес">{entrance.ip_address || '—'}</Descriptions.Item>
          <Descriptions.Item label="Код доступа">{entrance.access_code ? <Tag color="green">{entrance.access_code}</Tag> : '—'}</Descriptions.Item>
          <Descriptions.Item label="Код программирования">{entrance.programming_code ? <Tag color="orange">{entrance.programming_code}</Tag> : '—'}</Descriptions.Item>
          {entrance.notes && <Descriptions.Item label="Примечания" span={3}>{entrance.notes}</Descriptions.Item>}
        </Descriptions>
      </Card>

      {/* Квартиры */}
      {apartments.length > 0 && (
        <>
          <Divider />
          <Card title={`🏠 Квартиры (${apartments.length})`}>
            <List size="small" dataSource={apartments}
              renderItem={(c: any) => (
                <List.Item style={{ padding: '4px 0' }}>
                  <Space>
                    <Text strong>кв. {c.apartment}</Text>
                    <Link to={`/clients/${c.id}`}><UserOutlined /> {c.name}</Link>
                    {c.phone && <Text type="secondary">{c.phone}</Text>}
                    {c.personal_account_number && <Tag>{c.personal_account_number}</Tag>}
                  </Space>
                </List.Item>
              )}
            />
          </Card>
        </>
      )}

      {/* История заявок */}
      <Divider />
      <Card title={`📋 История заявок (${orders.length})`}>
        <Table columns={orderCols} dataSource={orders} rowKey="id" size="small"
          pagination={{ pageSize: 10 }} locale={{ emptyText: 'Заявок нет' }} />
      </Card>
    </div>
  );
};

export default EntranceDetailPage;
