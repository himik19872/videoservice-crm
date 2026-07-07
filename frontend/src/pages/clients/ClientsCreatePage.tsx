import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Select, Typography, Card, message, Checkbox, Row, Col } from 'antd';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import InnSuggest from '../../components/InnSuggest';
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

  const handleInnFound = (company: any) => {
    // Заполняем поля юрлица
    form.setFieldsValue({
      full_name: company.name || company.short_name,
      inn: company.inn,
      kpp: company.kpp,
      ogrn: company.ogrn,
      legal_address: company.legal_address,
      director_name: company.director,
    });
    message.success(company.short_name || company.name);
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

        {/* Блок для юридического лица */}
        <Card title="🏢 Юридическое лицо (если клиент — организация)" size="small" style={{ marginBottom: 16 }}>
          <Form.Item name="is_legal" valuePropName="checked" style={{ marginBottom: 8 }}>
            <Checkbox>Клиент является юридическим лицом</Checkbox>
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.is_legal !== cur.is_legal}>
            {({ getFieldValue }) => {
              const isLegal = getFieldValue('is_legal');
              if (!isLegal) return null;
              return (
                <>
                  <Form.Item name="inn" label="ИНН" style={{ marginBottom: 8 }}>
                    <InnSuggest onFound={handleInnFound} placeholder="ИНН для автозаполнения реквизитов" />
                  </Form.Item>
                  <Row gutter={12}>
                    <Col span={12}>
                      <Form.Item name="kpp" label="КПП"><Input maxLength={9} /></Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="ogrn" label="ОГРН"><Input maxLength={15} /></Form.Item>
                    </Col>
                  </Row>
                  <Form.Item name="legal_address" label="Юридический адрес"><Input /></Form.Item>
                  <Form.Item name="director_name" label="ФИО руководителя"><Input /></Form.Item>
                </>
              );
            }}
          </Form.Item>
        </Card>

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
