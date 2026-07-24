import React, { useState } from 'react';
import {
  Typography, Card, Button, Space, message, Form, Input, Select, InputNumber,
  Steps, Row, Col, Checkbox, Divider,
} from 'antd';
import { PlusOutlined, DeleteOutlined, CheckCircleOutlined, SearchOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const { Title, Text } = Typography;

const CompanyCreatePage: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const [companyData, setCompanyData] = useState<any>({});

  const [buildings, setBuildings] = useState<Array<{
    key: number;
    city: string; street_name: string; house_number: string; building_number: string;
    entrances: Array<{ number: number; apartments_from: number; apartments_to: number; create_clients: boolean }>;
  }>>([]);

  const addBuilding = () => {
    setBuildings([...buildings, {
      key: Date.now(),
      city: 'Санкт-Петербург', street_name: '', house_number: '', building_number: '',
      entrances: [{ number: 1, apartments_from: 1, apartments_to: 40, create_clients: true }],
    }]);
  };
  const removeBuilding = (key: number) => setBuildings(buildings.filter(b => b.key !== key));
  const updateBuilding = (key: number, field: string, value: any) => {
    setBuildings(buildings.map(b => b.key === key ? { ...b, [field]: value } : b));
  };
  const addEntrance = (bldKey: number) => {
    setBuildings(buildings.map(b => {
      if (b.key !== bldKey) return b;
      const last = b.entrances[b.entrances.length - 1];
      return { ...b, entrances: [...b.entrances, {
        number: last ? last.number + 1 : 1,
        apartments_from: last ? last.apartments_to + 1 : 1,
        apartments_to: last ? last.apartments_to + 40 : 40,
        create_clients: true,
      }]};
    }));
  };
  const updateEntrance = (bldKey: number, idx: number, field: string, value: any) => {
    setBuildings(buildings.map(b => {
      if (b.key !== bldKey) return b;
      const entrances = [...b.entrances];
      entrances[idx] = { ...entrances[idx], [field]: value };
      return { ...b, entrances };
    }));
  };
  const removeEntrance = (bldKey: number, idx: number) => {
    setBuildings(buildings.map(b => {
      if (b.key !== bldKey) return b;
      return { ...b, entrances: b.entrances.filter((_, i) => i !== idx) };
    }));
  };

  const goToStep2 = (values: any) => {
    setCompanyData(values);
    setStep(1);
  };

  const handleSubmit = async () => {
    if (buildings.length === 0) { message.warning('Добавьте хотя бы один дом'); return; }
    setSaving(true);
    try {
      const payload = {
        company: companyData,
        buildings: buildings.map(b => ({
          city: b.city, street_name: b.street_name,
          house_number: b.house_number, building_number: b.building_number,
          apartments_count: b.entrances.reduce((s, e) => s + e.apartments_to - e.apartments_from + 1, 0),
          entrances_count: b.entrances.length,
          entrances: b.entrances.map(e => ({
            number: e.number, apartments_from: e.apartments_from,
            apartments_to: e.apartments_to, create_clients: e.create_clients,
          })),
        })),
      };

      const res = await api.post('/management-companies/create_with_buildings/', payload);
      const stats = res.data.stats;
      message.success(`УК создана! Домов: ${stats.buildings}, подъездов: ${stats.entrances}, клиентов: ${stats.clients}`);
      setStep(2);
    } catch (e: any) {
      const err = e.response?.data;
      message.error(typeof err === 'string' ? err : JSON.stringify(err).substring(0, 300));
    } finally { setSaving(false); }
  };

  const totalApartments = buildings.reduce((s, b) =>
    s + b.entrances.reduce((ss, e) => ss + e.apartments_to - e.apartments_from + 1, 0), 0);
  const totalEntrances = buildings.reduce((s, b) => s + b.entrances.length, 0);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <Title level={3}>🏢 Новая управляющая компания / ТСЖ</Title>
      <Steps current={step} size="small" style={{ marginBottom: 24 }}
        items={[{ title: 'Реквизиты УК' }, { title: 'Дома и подъезды' }, { title: 'Готово' }]} />

      {step === 0 && (
        <Card title="Реквизиты компании">
          <Form form={form} layout="vertical" onFinish={goToStep2}>
            <Form.Item name="name" label="Полное название" rules={[{ required: true }]}><Input /></Form.Item>
            <Form.Item label="ИНН">
              <Input.Search
                name="inn"
                maxLength={12}
                placeholder="Введите ИНН и нажмите поиск..."
                enterButton={<SearchOutlined />}
                onSearch={async (value) => {
                  if (!value || value.length < 8) { message.warning('Введите корректный ИНН (минимум 8 цифр)'); return; }
                  try {
                    const res = await api.get('/management-companies/lookup_inn/', { params: { inn: value } });
                    if (res.data.success) {
                      form.setFieldsValue({
                        name: res.data.name,
                        short_name: res.data.short_name,
                        inn: res.data.inn,
                      });
                      message.success('Данные найдены');
                    } else {
                      message.error(res.data.error || 'Организация не найдена');
                    }
                  } catch (e) { message.error('Ошибка поиска'); }
                }}
              />
            </Form.Item>
            <Row gutter={16}>
              <Col span={12}><Form.Item name="short_name" label="Короткое название"><Input /></Form.Item></Col>
              <Col span={12}><Form.Item name="inn" label="ИНН (скрыто)" hidden><Input /></Form.Item></Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}><Form.Item name="phone" label="Телефон"><Input /></Form.Item></Col>
              <Col span={12}><Form.Item name="email" label="Email"><Input /></Form.Item></Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="payment_method" label="Способ оплаты" initialValue="contract">
                  <Select options={[
                    { label: 'По договору с УК/ТСЖ', value: 'contract' },
                    { label: 'Через ЕРЦ', value: 'erc' },
                    { label: 'Смешанная', value: 'mixed' },
                  ]} />
                </Form.Item>
              </Col>
              <Col span={12}><Form.Item name="contract_number" label="№ договора"><Input /></Form.Item></Col>
            </Row>
            <Row gutter={16}>
              <Col span={12}><Form.Item name="contract_date" label="Дата договора"><Input type="date" /></Form.Item></Col>
              <Col span={12}><Form.Item name="contract_amount" label="Сумма/мес (₽)"><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
            </Row>
            <Form.Item name="notes" label="Примечания"><Input.TextArea rows={3} /></Form.Item>
            <Button type="primary" htmlType="submit" size="large">Далее: дома и подъезды</Button>
          </Form>
        </Card>
      )}

      {step === 1 && (
        <div>
          <Space style={{ marginBottom: 16 }}>
            <Button onClick={() => setStep(0)}>← Назад</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={addBuilding}>Добавить дом</Button>
          </Space>

          {buildings.length === 0 && (
            <Card><Text type="secondary">Нажмите «Добавить дом» чтобы добавить обслуживаемые адреса.</Text></Card>
          )}

          {buildings.map((bld, bi) => (
            <Card key={bld.key} style={{ marginBottom: 16 }}
              title={`Дом ${bi + 1}`}
              extra={<Button danger icon={<DeleteOutlined />} onClick={() => removeBuilding(bld.key)}>Удалить дом</Button>}
            >
              <Row gutter={12} style={{ marginBottom: 12 }}>
                <Col span={6}><Form.Item label="Город" style={{ margin: 0 }}><Input value={bld.city} onChange={e => updateBuilding(bld.key, 'city', e.target.value)} /></Form.Item></Col>
                <Col span={8}><Form.Item label="Улица" style={{ margin: 0 }}><Input value={bld.street_name} onChange={e => updateBuilding(bld.key, 'street_name', e.target.value)} /></Form.Item></Col>
                <Col span={4}><Form.Item label="Дом" style={{ margin: 0 }}><Input value={bld.house_number} onChange={e => updateBuilding(bld.key, 'house_number', e.target.value)} /></Form.Item></Col>
                <Col span={4}><Form.Item label="Корпус" style={{ margin: 0 }}><Input value={bld.building_number} onChange={e => updateBuilding(bld.key, 'building_number', e.target.value)} /></Form.Item></Col>
              </Row>

              <Divider style={{ margin: '8px 0' }}>Подъезды</Divider>
              {bld.entrances.map((ent, ei) => (
                <Row key={ei} gutter={8} align="middle" style={{ marginBottom: 8 }}>
                  <Col span={3}><Text strong>Под. {ent.number}</Text></Col>
                  <Col span={3}><InputNumber size="small" placeholder="с" value={ent.apartments_from} onChange={v => v && updateEntrance(bld.key, ei, 'apartments_from', v)} style={{ width: '100%' }} /></Col>
                  <Col span={1} style={{ textAlign: 'center' }}>–</Col>
                  <Col span={3}><InputNumber size="small" placeholder="по" value={ent.apartments_to} onChange={v => v && updateEntrance(bld.key, ei, 'apartments_to', v)} style={{ width: '100%' }} /></Col>
                  <Col span={8}>
                    <Checkbox checked={ent.create_clients} onChange={v => updateEntrance(bld.key, ei, 'create_clients', v.target.checked)}>
                      Клиенты
                    </Checkbox>
                    <Text type="secondary">({ent.apartments_to - ent.apartments_from + 1} кв.)</Text>
                  </Col>
                  <Col span={4}>
                    {bld.entrances.length > 1 && (
                      <Button size="small" danger icon={<DeleteOutlined />} onClick={() => removeEntrance(bld.key, ei)} />
                    )}
                  </Col>
                </Row>
              ))}
              <Button size="small" icon={<PlusOutlined />} onClick={() => addEntrance(bld.key)}>Добавить подъезд</Button>
            </Card>
          ))}

          {buildings.length > 0 && (
            <Card size="small" style={{ background: '#f6ffed', marginBottom: 16 }}>
              <Space>
                <Text>🏠 <strong>{buildings.length}</strong> домов</Text>
                <Text>🚪 <strong>{totalEntrances}</strong> подъездов</Text>
                <Text>👥 <strong>{totalApartments}</strong> квартир</Text>
              </Space>
            </Card>
          )}

          <Space>
            <Button onClick={() => setStep(0)}>← Назад</Button>
            <Button type="primary" size="large" loading={saving} disabled={buildings.length === 0}
              onClick={handleSubmit}>
              Создать УК и дома
            </Button>
          </Space>
        </div>
      )}

      {step === 2 && (
        <Card>
          <div style={{ textAlign: 'center', padding: 40 }}>
            <CheckCircleOutlined style={{ fontSize: 64, color: '#52c41a' }} />
            <Title level={4}>УК успешно создана!</Title>
            <Space>
              <Button type="primary" onClick={() => navigate('/management-companies')}>К списку УК</Button>
              <Button onClick={() => { setStep(0); setBuildings([]); setCompanyData({}); form.resetFields(); }}>Создать ещё</Button>
            </Space>
          </div>
        </Card>
      )}
    </div>
  );
};

export default CompanyCreatePage;
