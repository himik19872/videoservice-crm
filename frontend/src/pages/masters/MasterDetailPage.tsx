import React, { useState, useEffect } from 'react';
import { Typography, Card, Descriptions, Tag, Space, Button, Divider, Form, Input, Select, Switch, message, Spin, Popconfirm, Row, Col, Statistic } from 'antd';
import { ArrowLeftOutlined, EditOutlined, DeleteOutlined, SaveOutlined, CloseOutlined, BarChartOutlined, ReloadOutlined, AimOutlined } from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';
import type { Master, Region, MasterStats } from '../../types';
import MasterMap from '../../components/MasterMap';
import dayjs from 'dayjs';

const { Title } = Typography;

const MasterDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [master, setMaster] = useState<Master | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [regions, setRegions] = useState<Region[]>([]);
  const [stats, setStats] = useState<MasterStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [gpsData, setGpsData] = useState<any>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchMaster();
    fetchRegions();
  }, [id]);

  const fetchMaster = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/masters/${id}/`);
      setMaster(response.data);
    } catch (error) {
      message.error('Ошибка загрузки мастера');
      navigate('/masters');
    } finally {
      setLoading(false);
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

  const fetchStats = async () => {
    setStatsLoading(true);
    try {
      const response = await api.get(`/masters/${id}/stats/`);
      setStats(response.data);
    } catch (error) {
      message.error('Ошибка загрузки статистики');
    } finally {
      setStatsLoading(false);
    }
  };

  const handleUpdateGps = async () => {
    setGpsLoading(true);
    try {
      const response = await api.post(`/masters/${id}/update_gps/`);
      setGpsData(response.data);
      if (response.data.ok) {
        message.success('GPS-данные обновлены');
      }
    } catch (error: any) {
      const errData = error?.response?.data;
      setGpsData(errData || { ok: false, error: 'Ошибка' });
      message.error(errData?.error || 'Ошибка запроса GPS');
    } finally {
      setGpsLoading(false);
    }
  };

  const handleEdit = () => {
    if (!master) return;
    form.setFieldsValue({
      first_name: master.user?.first_name || '',
      last_name: master.user?.last_name || '',
      email: master.user?.email || '',
      phone: master.phone,
      region_id: master.region?.id || master.region_id,
      is_available: master.is_available,
      username: master.user?.username || '',
    });
    setEditing(true);
  };

  const handleSave = async (values: any) => {
    setSaving(true);
    try {
      const payload: any = {
        phone: values.phone,
        region_id: values.region_id,
        is_available: values.is_available,
        first_name: values.first_name,
        last_name: values.last_name,
        email: values.email || '',
        username: values.username,
      };
      if (values.password) {
        payload.password = values.password;
      }
      const response = await api.put(`/masters/${id}/`, payload);
      setMaster(response.data);
      setEditing(false);
      message.success('Данные мастера обновлены');
    } catch (error) {
      message.error('Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/masters/${id}/`);
      message.success('Мастер удалён');
      navigate('/masters');
    } catch (error) {
      message.error('Ошибка удаления мастера');
    }
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 40 }}><Spin size="large" /></div>;
  }

  if (!master) return null;

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/masters')}>Назад</Button>
        <Title level={3} style={{ margin: 0 }}>{master.full_name || master.user?.username}</Title>
      </Space>

      <Row gutter={16}>
        <Col span={14}>
          <Card
            title="Профиль мастера"
            extra={
              <Space>
                {!editing ? (
                  <>
                    <Button icon={<EditOutlined />} onClick={handleEdit}>Редактировать</Button>
                    <Button icon={<BarChartOutlined />} onClick={fetchStats} loading={statsLoading}>Статистика</Button>
                    <Popconfirm title="Удалить мастера?" onConfirm={handleDelete} okText="Да" cancelText="Нет">
                      <Button danger icon={<DeleteOutlined />}>Удалить</Button>
                    </Popconfirm>
                  </>
                ) : (
                  <>
                    <Button icon={<CloseOutlined />} onClick={() => setEditing(false)}>Отмена</Button>
                    <Button type="primary" icon={<SaveOutlined />} onClick={() => form.submit()} loading={saving}>Сохранить</Button>
                  </>
                )}
              </Space>
            }
          >
            {!editing ? (
              <Descriptions column={2} size="small">
                <Descriptions.Item label="Логин">{master.user?.username || '-'}</Descriptions.Item>
                <Descriptions.Item label="Email">{master.user?.email || '-'}</Descriptions.Item>
                <Descriptions.Item label="Имя">{master.user?.first_name || '-'}</Descriptions.Item>
                <Descriptions.Item label="Фамилия">{master.user?.last_name || '-'}</Descriptions.Item>
                <Descriptions.Item label="Телефон">{master.phone}</Descriptions.Item>
                <Descriptions.Item label="Район">{master.region?.name || '-'}</Descriptions.Item>
                <Descriptions.Item label="Доступен">
                  <Tag color={master.is_available ? 'green' : 'red'}>{master.is_available ? 'Да' : 'Нет'}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Дата регистрации">{dayjs(master.created_at).format('DD.MM.YYYY')}</Descriptions.Item>
              </Descriptions>
            ) : (
              <Form form={form} layout="vertical" onFinish={handleSave}>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="username" label="Логин" rules={[{ required: true }]}>
                      <Input />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="password" label="Пароль (оставьте пустым, чтобы не менять)">
                      <Input.Password placeholder="Новый пароль" />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="first_name" label="Имя"><Input /></Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="last_name" label="Фамилия"><Input /></Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="email" label="Email"><Input /></Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="phone" label="Телефон" rules={[{ required: true }]}>
                      <Input />
                    </Form.Item>
                  </Col>
                </Row>
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item name="region_id" label="Район">
                      <Select placeholder="Выберите район" options={regions.map((r) => ({ value: r.id, label: r.name }))} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item name="is_available" label="Доступен" valuePropName="checked">
                      <Switch />
                    </Form.Item>
                  </Col>
                </Row>
              </Form>
            )}

            {/* Карта GPS */}
            {master.traccar_device && (
              <>
                <Divider />
                <Card title="GPS-местоположение" size="small"
                  extra={
                    <Button icon={<ReloadOutlined />} loading={gpsLoading} size="small" onClick={handleUpdateGps}>
                      Обновить GPS
                    </Button>
                  }
                >
                  {(gpsData?.ok || master.traccar_device.last_latitude != null) ? (
                    <MasterMap
                      latitude={gpsData?.latitude ?? master.traccar_device.last_latitude}
                      longitude={gpsData?.longitude ?? master.traccar_device.last_longitude}
                      masterName={master.full_name || master.user?.username}
                      speed={gpsData?.speed ?? master.traccar_device.last_speed}
                      height="300px"
                    />
                  ) : (
                    <div style={{ textAlign: 'center', padding: 20, color: '#999' }}>Нет данных о местоположении</div>
                  )}
                  {gpsData?.error && (
                    <div style={{ marginTop: 8, color: '#ff4d4f', fontSize: 12 }}>{gpsData.error}</div>
                  )}
                  {master.traccar_device.last_update && (
                    <div style={{ marginTop: 8, color: '#888', fontSize: 12 }}>
                      Обновлено: {new Date(master.traccar_device.last_update).toLocaleString('ru-RU')}
                      {' · '}
                      {master.traccar_device.is_online ? '🟢 Онлайн' : '🔴 Офлайн'}
                    </div>
                  )}
                </Card>
              </>
            )}
          </Card>
        </Col>

        {/* Статистика */}
        <Col span={10}>
          {stats && (
            <Card title={`Статистика за ${stats.month}`}>
              <Row gutter={[12, 16]}>
                <Col span={12}>
                  <Statistic title="Всего заявок" value={stats.total_orders} />
                </Col>
                <Col span={12}>
                  <Statistic title="Выполнено" value={stats.completed_orders} valueStyle={{ color: '#3f8600' }} />
                </Col>
                <Col span={12}>
                  <Statistic title="Просрочено" value={stats.overdue_orders} valueStyle={{ color: stats.overdue_orders > 0 ? '#cf1322' : undefined }} />
                </Col>
                <Col span={12}>
                  <Statistic title="Среднее время" value={stats.avg_completion_hours} suffix="ч" precision={1} />
                </Col>
                <Col span={24}>
                  <Statistic title="Общая стоимость" value={stats.total_cost} suffix="₽" precision={2} valueStyle={{ color: '#1890ff' }} />
                </Col>
              </Row>
              <Divider />
              <Descriptions title="По типам" size="small" column={1}>
                <Descriptions.Item label="Ремонт">{stats.by_type.repair}</Descriptions.Item>
                <Descriptions.Item label="Подключение">{stats.by_type.connection}</Descriptions.Item>
                <Descriptions.Item label="Продажа">{stats.by_type.sale}</Descriptions.Item>
              </Descriptions>
            </Card>
          )}
        </Col>
      </Row>
    </div>
  );
};

export default MasterDetailPage;
