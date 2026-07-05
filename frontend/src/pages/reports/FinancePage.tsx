import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Typography, message, Tag, Card, Row, Col, Statistic, Modal, Select, DatePicker, InputNumber, Form, Input } from 'antd';
import { DollarOutlined, ReloadOutlined, CalculatorOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../services/api';
import type { Payment, MasterSalary } from '../../types';

const { Title } = Typography;

const methodColors: Record<string, string> = { cash: 'green', card: 'blue', transfer: 'purple', online: 'orange' };
const salaryStatusColors: Record<string, string> = { draft: 'default', approved: 'blue', paid: 'green' };

const FinancePage: React.FC = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [salaries, setSalaries] = useState<MasterSalary[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [salaryModal, setSalaryModal] = useState(false);
  const [tab, setTab] = useState<'payments' | 'salaries' | 'debts'>('payments');
  const [masters, setMasters] = useState<any[]>([]);
  const [debts, setDebts] = useState<any>({ cash_debts: [], inventory_debts: [] });

  useEffect(() => { fetchAll(); loadMasters(); fetchDebts(); }, []);

  const fetchDebts = async () => {
    try { const r = await api.get('/master-salaries/master_debts/'); setDebts(r.data); } catch {}
  };

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [pRes, sRes, salRes] = await Promise.all([
        api.get('/payments/'),
        api.get('/payments/summary/?days=365'),
        api.get('/master-salaries/'),
      ]);
      setPayments(pRes.data.results || pRes.data);
      setSummary(sRes.data);
      setSalaries(salRes.data.results || salRes.data);
    } catch (e) { message.error('Ошибка загрузки'); }
    finally { setLoading(false); }
  };

  const loadMasters = async () => {
    try { const r = await api.get('/masters/'); setMasters(r.data.results || r.data); } catch {}
  };

  const handleCalculateSalary = async (values: any) => {
    try {
      await api.post('/master-salaries/calculate/', {
        master_id: values.master_id,
        period_start: values.period[0].format('YYYY-MM-DD'),
        period_end: values.period[1].format('YYYY-MM-DD'),
        commission_percent: values.commission_percent || 30,
        bonus: values.bonus || 0,
        deduction: values.deduction || 0,
        notes: values.notes || '',
      });
      message.success('Зарплата рассчитана');
      setSalaryModal(false);
      fetchAll();
    } catch (e: any) { message.error(e.response?.data?.error || 'Ошибка'); }
  };

  const handleApproveSalary = async (id: number) => {
    try {
      await api.post(`/master-salaries/${id}/approve/`);
      message.success('Утверждено');
      fetchAll();
    } catch { message.error('Ошибка'); }
  };

  const paymentColumns = [
    { title: 'Дата', dataIndex: 'paid_at', key: 'date', width: 160, render: (v: string) => new Date(v).toLocaleString('ru') },
    { title: 'Заявка', dataIndex: 'order_number', key: 'order', width: 150 },
    { title: 'Сумма', dataIndex: 'amount', key: 'amount', width: 100, render: (v: number) => <b>{v} ₽</b> },
    { title: 'Способ', dataIndex: 'payment_method_display', key: 'method', width: 110, render: (_: any, r: Payment) => <Tag color={methodColors[r.payment_method]}>{r.payment_method_display}</Tag> },
    { title: 'Принял', dataIndex: 'received_by_name', key: 'by', width: 130 },
    { title: 'Примечание', dataIndex: 'notes', key: 'notes', ellipsis: true },
  ];

  const salaryColumns = [
    { title: 'Мастер', dataIndex: 'master_name', key: 'master', width: 150 },
    { title: 'Период', key: 'period', width: 200, render: (_: any, r: MasterSalary) => `${r.period_start} — ${r.period_end}` },
    { title: 'Заявок', dataIndex: 'orders_completed', key: 'orders', width: 70 },
    { title: 'Выручка', dataIndex: 'total_revenue', key: 'revenue', width: 110, render: (v: number) => `${v} ₽` },
    { title: '%', dataIndex: 'commission_percent', key: 'pct', width: 50, render: (v: number) => `${v}%` },
    { title: 'Премия', dataIndex: 'bonus', key: 'bonus', width: 80, render: (v: number) => `${v} ₽` },
    { title: 'Удержано', dataIndex: 'deduction', key: 'ded', width: 80, render: (v: number) => `${v} ₽` },
    { title: 'К выплате', dataIndex: 'total_salary', key: 'total', width: 110, render: (v: number) => <b style={{ color: '#3f8600' }}>{v} ₽</b> },
    {
      title: 'Статус', dataIndex: 'status_display', key: 'status', width: 110, render: (_: any, r: MasterSalary) => <Tag color={salaryStatusColors[r.status]}>{r.status_display}</Tag>
    },
    {
      title: '', key: 'actions', width: 100, render: (_: any, r: MasterSalary) => (
        r.status === 'draft' ? <Button size="small" type="primary" onClick={() => handleApproveSalary(r.id)}>Утвердить</Button> : null
      ),
    },
  ];

  return (
    <div>
      <Title level={3}>💰 Финансы</Title>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}><Card><Statistic title="Оплат за период" value={summary.count || 0} prefix={<DollarOutlined />} /></Card></Col>
        <Col span={8}><Card><Statistic title="Общая сумма" value={summary.total || 0} suffix="₽" valueStyle={{ color: '#3f8600' }} /></Card></Col>
        <Col span={8}><Card>
          <Statistic title="По способам" value="" />
          {summary.by_method && Object.entries(summary.by_method).map(([k, v]) => (
            <Tag key={k}>{k}: {Number(v).toLocaleString()} ₽</Tag>
          ))}
        </Card></Col>
      </Row>

      <Space style={{ marginBottom: 16 }}>
        <Button type={tab === 'payments' ? 'primary' : 'default'} onClick={() => setTab('payments')}>Оплаты</Button>
        <Button type={tab === 'salaries' ? 'primary' : 'default'} onClick={() => setTab('salaries')}>Зарплаты</Button>
        <Button type={tab === 'debts' ? 'primary' : 'default'} onClick={() => setTab('debts')}>Долги мастеров</Button>
        <Button icon={<ReloadOutlined />} onClick={() => { fetchAll(); fetchDebts(); }}>Обновить</Button>
        {tab === 'salaries' && <Button icon={<CalculatorOutlined />} type="primary" onClick={() => setSalaryModal(true)}>Рассчитать</Button>}
      </Space>

      {tab === 'payments' ? (
        <Table columns={paymentColumns} dataSource={payments} rowKey="id" loading={loading} pagination={{ pageSize: 20 }} size="middle" />
      ) : tab === 'salaries' ? (
        <Table columns={salaryColumns} dataSource={salaries} rowKey="id" loading={loading} pagination={{ pageSize: 20 }} size="middle" />
      ) : (
        <>
          <Title level={5}>💵 Наличные к сдаче</Title>
          <Table dataSource={debts.cash_debts || []} rowKey="id" pagination={false} size="small" columns={[
            { title: 'Мастер', dataIndex: 'master', key: 'm' },
            { title: 'Заявка', dataIndex: 'order', key: 'o' },
            { title: 'Сумма', dataIndex: 'amount', key: 'a', render: (v: number) => <b style={{color:'red'}}>{v} ₽</b> },
            { title: 'Статус', dataIndex: 'is_paid', key: 's', render: (v: boolean) => <Tag color={v?'green':'red'}>{v ? '✅ Сдано' : '❌ Не сдано'}</Tag> },
          ]} />
          <Title level={5} style={{ marginTop: 24 }}>🔧 Оборудование к возврату</Title>
          <Table dataSource={debts.inventory_debts || []} rowKey="id" pagination={false} size="small" columns={[
            { title: 'Мастер', dataIndex: 'master', key: 'm' },
            { title: 'Заявка', dataIndex: 'order', key: 'o' },
            { title: 'Описание', dataIndex: 'description', key: 'd' },
            { title: 'Состояние', dataIndex: 'condition', key: 'c' },
            { title: 'Статус', dataIndex: 'is_returned', key: 's', render: (v: boolean) => <Tag color={v?'green':'red'}>{v ? '✅ Возвращено' : '❌ Не возвращено'}</Tag> },
          ]} />
        </>
      )}

      <Modal title="Расчёт зарплаты" open={salaryModal} onCancel={() => setSalaryModal(false)} footer={null}>
        <Form layout="vertical" onFinish={handleCalculateSalary}>
          <Form.Item label="Мастер" name="master_id" rules={[{ required: true }]}>
            <Select placeholder="Выберите мастера" options={masters.map((m: any) => ({ value: m.id, label: m.full_name || m.user?.username }))} />
          </Form.Item>
          <Form.Item label="Период" name="period" rules={[{ required: true }]}>
            <DatePicker.RangePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item label="Комиссия (%)" name="commission_percent" initialValue={30}>
            <InputNumber min={0} max={100} style={{ width: '100%' }} />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}><Form.Item label="Премия" name="bonus" initialValue={0}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
            <Col span={12}><Form.Item label="Удержания" name="deduction" initialValue={0}><InputNumber min={0} style={{ width: '100%' }} /></Form.Item></Col>
          </Row>
          <Form.Item label="Примечание" name="notes"><Input.TextArea placeholder="Примечание" /></Form.Item>
          <Button type="primary" htmlType="submit" block>Рассчитать</Button>
        </Form>
      </Modal>
    </div>
  );
};

export default FinancePage;
