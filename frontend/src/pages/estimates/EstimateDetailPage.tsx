import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Table, Button, Modal, Input, Select, InputNumber, Space, Popconfirm, Tag, message, Row, Col, Statistic, Divider, Spin, Descriptions, Switch, Steps, Timeline, Alert, Checkbox, Dropdown } from 'antd';
import { PlusOutlined, DeleteOutlined, CalculatorOutlined, EditOutlined, ArrowLeftOutlined, FireOutlined, FileTextOutlined, DownOutlined } from '@ant-design/icons';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { can } from '../../utils/access';

const ITEM_TYPES = [
  { value: 'material', label: '📦 Со склада' },
  { value: 'service', label: '🔧 Услуга (справочник)' },
  { value: 'custom_material', label: '✏️ Произвольный материал' },
  { value: 'custom_service', label: '✏️ Произвольная услуга/работа' },
];

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  draft: { color: 'default', label: 'Черновик' },
  on_approval: { color: 'gold', label: 'На согласовании у ГД' },
  approved_internal: { color: 'cyan', label: 'Согласовано ГД' },
  sent: { color: 'blue', label: 'У клиента' },
  approved: { color: 'green', label: 'Согласовано клиентом' },
  invoiced: { color: 'geekblue', label: 'Счёт выставлен' },
  paid: { color: 'lime', label: 'Оплачено' },
  in_work: { color: 'orange', label: 'В работе' },
  completed: { color: 'green', label: 'Завершено' },
  rejected: { color: 'red', label: 'Отклонено' },
};

const TAX_LABELS: Record<string, string> = {
  usn: 'УСН (доходы)',
  usn_dr: 'УСН (доходы-расходы)',
  osno: 'ОСНО (с НДС)',
  patent: 'Патент',
  none: 'Без налога',
};

const EstimateDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [estimate, setEstimate] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [legalEntities, setLegalEntities] = useState<any[]>([]);

  // Модалка редактирования параметров сметы
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsForm, setSettingsForm] = useState<any>({});

  // ── Жизненный цикл сметы ──
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  // Расчётные счета юрлица (для счёта и УПД)
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [bankAccountId, setBankAccountId] = useState<number | undefined>(undefined);
  const [useStamp, setUseStamp] = useState(false);
  const [commentModal, setCommentModal] = useState<{ open: boolean; action: string; title: string; okText: string }>(
    { open: false, action: '', title: '', okText: 'Подтвердить' },
  );
  const [commentText, setCommentText] = useState('');
  const [paidAmount, setPaidAmount] = useState<number | undefined>(undefined);

  // Модалка добавления позиции
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [itemForm, setItemForm] = useState({
    item_type: 'material', inventory_item_id: undefined as number | undefined,
    service_id: undefined as number | undefined,
    name: '', unit: 'шт', quantity: 1, cost_price: 0, sale_price: 0, discount: 0,
    ugol_applied: false,
  });

  const fetchEstimate = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/estimates/${id}/`);
      setEstimate(res.data);
      setSettingsForm({
        discount: res.data.discount, commission: res.data.commission,
        dealer_fee: res.data.dealer_fee, unexpected_costs: res.data.unexpected_costs,
        delivery_type: res.data.delivery_type, delivery_cost: res.data.delivery_cost,
        tax_type: res.data.tax_type, tax_rate: res.data.tax_rate,
        status: res.data.status,
        ugol_enabled: res.data.ugol_enabled, ugol_percent: res.data.ugol_percent,
        ugol_apply_to: res.data.ugol_apply_to || 'all',
        client: res.data.client ?? null,
        legal_entity: res.data.legal_entity ?? null,
      });
    } catch (e) { message.error('Смета не найдена'); navigate('/estimates'); }
    finally { setLoading(false); }
  };

  const fetchRefs = async () => {
    try {
      const [iRes, sRes, lRes, cRes] = await Promise.all([
        api.get('/inventory/?page_size=500&status=in_stock'),
        api.get('/estimate-services/?page_size=200'),
        api.get('/legal-entities/').catch(() => ({ data: [] })),
        api.get('/clients/?page_size=50').catch(() => ({ data: [] })),
      ]);
      setInventory(iRes.data.results || iRes.data || []);
      setServices(sRes.data.results || sRes.data || []);
      setLegalEntities(lRes.data.results || lRes.data || []);
      setClients(cRes.data.results || cRes.data || []);
    } catch (e) {}
  };

  /** Поиск клиента для смены контрагента в смете */
  const searchClients = (term: string) => {
    setClientsLoading(true);
    api.get('/clients/', { params: { search: term || '', page_size: 50 } })
      .then(res => setClients(res.data.results || res.data || []))
      .catch(() => {})
      .finally(() => setClientsLoading(false));
  };

  const clientLabel = (c: any) => {
    const name = c.full_name || c.name || `Клиент #${c.id}`;
    const parts = [name];
    if (c.phone) parts.push(c.phone);
    if (c.address) parts.push(c.address);
    if (c.personal_account_number) parts.push(`л/с ${c.personal_account_number}`);
    return parts.join(' · ');
  };

  useEffect(() => { fetchEstimate(); fetchRefs(); }, [id]);

  // Счета юрлица для печати счёта/УПД (по умолчанию — основной)
  useEffect(() => {
    const leId = estimate?.legal_entity;
    if (!leId) { setBankAccounts([]); setBankAccountId(undefined); return; }
    api.get('/bank-accounts/', { params: { legal_entity: leId, page_size: 50 } })
      .then(res => {
        const list = res.data.results || res.data || [];
        setBankAccounts(list);
        const def = list.find((a: any) => a.is_default) || list[0];
        setBankAccountId(def ? def.id : undefined);
      })
      .catch(() => { setBankAccounts([]); setBankAccountId(undefined); });
  }, [estimate?.legal_entity]);

  // Добавление позиции
  const openAddItem = () => {
    setEditingItem(null);
    setItemForm({
      item_type: 'material', inventory_item_id: undefined, service_id: undefined,
      name: '', unit: 'шт', quantity: 1, cost_price: 0, sale_price: 0, discount: 0,
      ugol_applied: false,
    });
    setItemModalOpen(true);
  };

  const openEditItem = (record: any) => {
    setEditingItem(record);
    setItemForm({
      item_type: record.item_type,
      inventory_item_id: record.inventory_item || undefined,
      service_id: record.service || undefined,
      name: record.name, unit: record.unit,
      quantity: record.quantity, cost_price: record.cost_price,
      sale_price: record.sale_price, discount: record.discount,
      ugol_applied: record.ugol_applied || false,
    });
    setItemModalOpen(true);
  };

  const handleItemTypeChange = (v: string) => {
    setItemForm({ ...itemForm, item_type: v, inventory_item_id: undefined, service_id: undefined, name: '', unit: 'шт', cost_price: 0, sale_price: 0 });
    if (v === 'material') setItemForm(prev => ({ ...prev, item_type: v }));
    if (v === 'service') setItemForm(prev => ({ ...prev, item_type: v }));
  };

  const handleInventorySelect = (invId: number | undefined) => {
    if (!invId) return;
    const inv = inventory.find((i: any) => i.id === invId);
    if (inv) {
      setItemForm(prev => ({
        ...prev, inventory_item_id: invId,
        name: inv.name, unit: inv.unit || 'шт',
        cost_price: Number(inv.cost_price || 0), sale_price: Number(inv.sale_price || 0),
      }));
    }
  };

  const handleServiceSelect = (svcId: number | undefined) => {
    if (!svcId) return;
    const svc = services.find((s: any) => s.id === svcId);
    if (svc) {
      setItemForm(prev => ({
        ...prev, service_id: svcId, name: svc.name, unit: svc.unit || 'шт',
        cost_price: Number(svc.cost_price || 0), sale_price: Number(svc.sale_price || 0),
      }));
    }
  };

  const saveItem = async () => {
    if (!itemForm.name.trim()) { message.error('Введите название позиции'); return; }
    try {
      if (editingItem) {
        await api.post(`/estimates/${id}/update_item/`, {
          item_id: editingItem.id,
          name: itemForm.name, unit: itemForm.unit,
          quantity: itemForm.quantity, cost_price: itemForm.cost_price,
          sale_price: itemForm.sale_price, discount: itemForm.discount,
          ugol_applied: itemForm.ugol_applied,
        });
        message.success('Позиция обновлена');
      } else {
        await api.post(`/estimates/${id}/add_item/`, {
          item_type: itemForm.item_type,
          inventory_item_id: itemForm.inventory_item_id,
          service_id: itemForm.service_id,
          name: itemForm.name, unit: itemForm.unit,
          quantity: itemForm.quantity, cost_price: itemForm.cost_price,
          sale_price: itemForm.sale_price, discount: itemForm.discount,
          ugol_applied: itemForm.ugol_applied,
        });
        message.success('Позиция добавлена');
      }
      setItemModalOpen(false);
      fetchEstimate();
    } catch (e: any) {
      message.error(e?.response?.data?.error || 'Ошибка сохранения');
    }
  };

  const removeItem = async (itemId: number) => {
    try {
      await api.post(`/estimates/${id}/remove_item/`, { item_id: itemId });
      message.success('Позиция удалена');
      fetchEstimate();
    } catch (e) { message.error('Ошибка удаления'); }
  };

  const updateSettings = async () => {
    try {
      await api.patch(`/estimates/${id}/`, {
        ...settingsForm,
        client: settingsForm.client ?? null,
        legal_entity: settingsForm.legal_entity ?? null,
      });
      message.success('Обновлено');
      setSettingsOpen(false);
      fetchEstimate();
    } catch (e: any) {
      const data = e?.response?.data;
      const text = data && typeof data === 'object'
        ? Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v[0] : v}`).join('; ')
        : null;
      message.error(text || 'Ошибка сохранения');
    }
  };

  const recalc = async () => {
    try {
      await api.post(`/estimates/${id}/recalc/`);
      message.success('Пересчитано');
      fetchEstimate();
    } catch (e) { message.error('Ошибка пересчёта'); }
  };

  const handlePrintPdf = async (withPhotos = false) => {
    try {
      const token = localStorage.getItem('token');
      const url = `/api/estimates/${id}/pdf/` + (withPhotos ? '?photos=1' : '');
      const response = await fetch(url, {
        headers: { 'Authorization': `Token ${token}` },
      });
      if (!response.ok) throw new Error('Ошибка загрузки');
      const html = await response.text();
      const w = window.open('', '_blank');
      if (w) {
        w.document.write(html);
        w.document.close();
      }
    } catch (e) {
      message.error('Ошибка генерации печатной формы');
    }
  };

  /** Открыть печатную форму документа (счёт / акт / УПД) в новом окне */
  const openDocument = async (kind: 'invoice' | 'act' | 'upd') => {
    try {
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({ kind });
      if (kind !== 'act' && bankAccountId) params.set('account', String(bankAccountId));
      if (useStamp) params.set('stamp', '1');
      const response = await fetch(`/api/estimates/${id}/document/?${params.toString()}`, {
        headers: { 'Authorization': `Token ${token}` },
      });
      const html = await response.text();
      if (!response.ok) {
        let msg = 'Ошибка формирования документа';
        try { msg = JSON.parse(html).error || msg; } catch (err) { /* html */ }
        message.error(msg);
        return;
      }
      const w = window.open('', '_blank');
      if (w) { w.document.write(html); w.document.close(); }
    } catch (e) {
      message.error('Ошибка формирования документа');
    }
  };

  /** Выполнить действие жизненного цикла сметы */
  const runAction = async (action: string, payload: any = {}) => {
    setBusy(true);
    try {
      await api.post(`/estimates/${id}/${action}/`, payload);
      message.success('Готово');
      await fetchEstimate();
    } catch (e: any) {
      message.error(e?.response?.data?.error || 'Ошибка выполнения действия');
    } finally {
      setBusy(false);
    }
  };

  const askComment = (action: string, title: string, okText: string) => {
    setCommentText('');
    setPaidAmount(Number(estimate?.invoice_amount || estimate?.total || 0));
    setCommentModal({ open: true, action, title, okText });
  };

  const submitComment = async () => {
    const { action } = commentModal;
    setCommentModal(m => ({ ...m, open: false }));
    const payload: any = { comment: commentText };
    if (action === 'confirm_payment') payload.amount = paidAmount;
    if (action === 'client_approve') payload.approved_by = commentText;
    await runAction(action, payload);
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>;
  if (!estimate) return null;
  const itemColumns = [
    { title: '#', key: 'idx', width: 40, render: (_: any, __: any, i: number) => i + 1 },
    { title: 'Наименование', dataIndex: 'name', key: 'name', ellipsis: true },
    { title: 'Тип', dataIndex: 'item_type_display', key: 'type', width: 130 },
    { title: 'Ед.', dataIndex: 'unit', key: 'unit', width: 50 },
    { title: 'Кол-во', dataIndex: 'quantity', key: 'qty', width: 80, render: (v: any) => Number(v).toFixed(1) },
    { title: 'Себест.', dataIndex: 'cost_price', key: 'cost', width: 100, render: (v: any) => `${Number(v).toLocaleString()} ₽` },
    { title: 'Цена', dataIndex: 'sale_price', key: 'price', width: 100, render: (v: any) => `${Number(v).toLocaleString()} ₽` },
    { title: 'Скидка', dataIndex: 'discount', key: 'disc', width: 70, render: (v: any) => v ? `${v}%` : '—' },
    { title: 'Сумма', dataIndex: 'total_price', key: 'total', width: 110, render: (v: any) => <strong>{Number(v).toLocaleString()} ₽</strong> },
    {
      title: '', key: 'actions', width: 80,
      render: (_: any, record: any) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEditItem(record)} />
          <Popconfirm title="Удалить позицию?" onConfirm={() => removeItem(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const STATUS_STEP: Record<string, number> = {
    draft: 0, on_approval: 1, approved_internal: 1, sent: 2,
    approved: 2, invoiced: 3, paid: 4, in_work: 5, completed: 6,
  };
  const stepIndex = estimate.status === 'rejected' ? 0 : (STATUS_STEP[estimate.status] ?? 0);
  const canApprove = can(user, 'estimates_approve');
  const canInvoice = can(user, 'estimates_invoice');
  const canPayment = can(user, 'estimates_payment');
  const canWork = can(user, 'estimates_work');
  const approvalLimit = 50000;
  const currentEntity = (legalEntities || []).find((l: any) => l.id === estimate.legal_entity);
  const hasStamp = !!(currentEntity && currentEntity.stamp_file);

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/estimates')}>Назад</Button>
          <h2 style={{ margin: 0 }}>📊 {estimate.number} — {estimate.name}</h2>
          <Tag color={STATUS_MAP[estimate.status]?.color}>{STATUS_MAP[estimate.status]?.label}</Tag>
        </Space>
        <Space>
          <Button onClick={() => setSettingsOpen(true)}>⚙️ Параметры</Button>
          <Dropdown
            menu={{
              items: [
                { key: 'plain', label: '🖨️ Печать без фото' },
                { key: 'photos', label: '🖼 Печать с фото товаров' },
              ],
              onClick: ({ key }) => handlePrintPdf(key === 'photos'),
            }}
            trigger={['click']}
          >
            <Button>🖨️ Печать КП <DownOutlined /></Button>
          </Dropdown>
          <Button icon={<CalculatorOutlined />} onClick={recalc}>🔄 Пересчитать</Button>
        </Space>
      </div>

      {/* Клиент и юрлицо */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={24}>
          <Col span={8}><strong>Клиент:</strong> {estimate.client_name || '—'}</Col>
          <Col span={8}><strong>Наше юрлицо:</strong> {estimate.legal_entity_name || '—'}</Col>
          <Col span={8}><strong>Заявка:</strong> {estimate.order ? `#${estimate.order}` : '—'}</Col>
        </Row>
      </Card>

      {/* Жизненный цикл сметы */}
      <Card
        size="small"
        title="🔄 Жизненный цикл: согласование → счёт → оплата → работы"
        style={{ marginBottom: 16 }}
      >
        <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
          <div style={{ minWidth: 820 }}>
            <Steps
              size="small"
              current={stepIndex}
              status={estimate.status === 'rejected' ? 'error' : 'process'}
              items={[
                { title: 'Черновик' },
                { title: 'Согласование', description: estimate.needs_director_approval ? 'ГД (> 50 000 ₽)' : 'не требуется' },
                { title: 'Клиент' },
                { title: 'Счёт' },
                { title: 'Оплата' },
                { title: 'В работе' },
                { title: 'Завершено' },
              ]}
            />
          </div>
        </div>

        <Alert
          style={{ marginTop: 12 }}
          type={estimate.needs_director_approval ? 'warning' : 'info'}
          showIcon
          message={
            estimate.is_legal_client
              ? `Клиент — юрлицо. Согласование генерального директора ${
                  estimate.needs_director_approval
                    ? `требуется: ${Number(estimate.total).toLocaleString()} ₽ > ${approvalLimit.toLocaleString()} ₽`
                    : `не требуется: ${Number(estimate.total).toLocaleString()} ₽ ≤ ${approvalLimit.toLocaleString()} ₽`
                }`
              : 'Клиент — физическое лицо: смета уходит клиенту без согласования директора'
          }
        />

        <Space wrap style={{ marginTop: 12 }}>
          {(estimate.status === 'draft' || estimate.status === 'rejected') && (
            <Button type="primary" loading={busy} onClick={() => runAction('submit')}>
              📤 {estimate.needs_director_approval ? 'На согласование ГД' : 'Отправить клиенту'}
            </Button>
          )}

          {estimate.status === 'on_approval' && (
            <>
              {canApprove ? (
                <>
                  <Button type="primary" loading={busy} onClick={() => askComment('director_approve', 'Согласовать смету (ген. директор)', 'Согласовать')}>
                    ✅ Согласовать
                  </Button>
                  <Button danger loading={busy} onClick={() => askComment('director_reject', 'Отклонить смету (ген. директор)', 'Отклонить')}>
                    ❌ Отклонить
                  </Button>
                </>
              ) : (
                <Tag color="gold">Ожидает согласования генерального директора</Tag>
              )}
            </>
          )}

          {estimate.status === 'approved_internal' && (
            <Button type="primary" loading={busy} onClick={() => runAction('send_to_client')}>📤 Отправить клиенту</Button>
          )}

          {estimate.status === 'sent' && (
            <>
              <Button type="primary" loading={busy} onClick={() => askComment('client_approve', 'Клиент согласовал смету', 'Согласовано')}>
                ✅ Клиент согласовал
              </Button>
              <Button danger loading={busy} onClick={() => askComment('client_reject', 'Клиент отклонил смету', 'Отклонить')}>
                ❌ Клиент отказался
              </Button>
            </>
          )}

          {estimate.status === 'approved' && (
            canInvoice
              ? <Button type="primary" loading={busy} onClick={() => runAction('create_invoice')}>🧾 Выставить счёт на оплату</Button>
              : <Tag color="green">Согласовано клиентом — ожидает выставления счёта бухгалтером</Tag>
          )}

          {estimate.status === 'invoiced' && (
            canPayment
              ? <Button type="primary" loading={busy} onClick={() => askComment('confirm_payment', 'Подтвердить поступление оплаты', 'Оплата получена')}>💰 Оплата получена</Button>
              : <Tag color="geekblue">Счёт №{estimate.invoice_number} выставлен — ожидает подтверждения оплаты бухгалтером</Tag>
          )}

          {estimate.status === 'paid' && (
            canWork
              ? <Button type="primary" loading={busy} onClick={() => runAction('start_work')}>🚀 Запустить в работу</Button>
              : <Tag color="lime">Оплачено — ожидает запуска в работу</Tag>
          )}

          {estimate.status === 'in_work' && (
            <Button type="primary" loading={busy} onClick={() => runAction('complete')}>🏁 Завершить работы (акт + УПД)</Button>
          )}

          {estimate.status === 'completed' && <Tag color="green">Работы завершены, документы сформированы</Tag>}

          <Divider type="vertical" />
          <Button onClick={handlePrintPdf}>🖨️ КП</Button>
          <Checkbox
            checked={useStamp}
            disabled={!hasStamp}
            onChange={e => setUseStamp(e.target.checked)}
            title={hasStamp ? 'Поставить печать организации' : 'У юрлица не загружена печать'}
          >
            🏵️ Печать
          </Checkbox>
          {bankAccounts.length > 1 && (
            <Select
              size="small"
              style={{ minWidth: 240 }}
              value={bankAccountId}
              onChange={v => setBankAccountId(v)}
              placeholder="Счёт для документов"
              options={bankAccounts.map((a: any) => ({
                value: a.id,
                label: `${a.is_default ? '★ ' : ''}${a.title} — ${a.bank_name || ''}`,
              }))}
            />
          )}
          <Button icon={<FileTextOutlined />} disabled={!estimate.invoice_number} onClick={() => openDocument('invoice')}>
            🧾 Счёт{estimate.invoice_number ? ` №${estimate.invoice_number}` : ''}
          </Button>
          <Button icon={<FileTextOutlined />} disabled={!estimate.act_number} onClick={() => openDocument('act')}>
            📄 Акт{estimate.act_number ? ` №${estimate.act_number}` : ''}
          </Button>
          <Button icon={<FileTextOutlined />} disabled={!estimate.upd_number} onClick={() => openDocument('upd')}>
            📑 УПД{estimate.upd_number ? ` №${estimate.upd_number}` : ''}
          </Button>
        </Space>

        <Row gutter={16} style={{ marginTop: 12 }}>
          {estimate.director_approved_at && (
            <Col span={8}><span style={{ fontSize: 12, color: '#888' }}>Согласовал ГД:</span> {estimate.director_approved_by_name} · {new Date(estimate.director_approved_at).toLocaleString('ru')}</Col>
          )}
          {estimate.client_approved_at && (
            <Col span={8}><span style={{ fontSize: 12, color: '#888' }}>Клиент согласовал:</span> {estimate.client_approved_name || '—'} · {new Date(estimate.client_approved_at).toLocaleString('ru')}</Col>
          )}
          {estimate.invoice_number && (
            <Col span={8}><span style={{ fontSize: 12, color: '#888' }}>Счёт:</span> №{estimate.invoice_number} от {estimate.invoice_date} на {Number(estimate.invoice_amount).toLocaleString()} ₽</Col>
          )}
          {estimate.payment_confirmed_at && (
            <Col span={8}><span style={{ fontSize: 12, color: '#888' }}>Оплата подтверждена:</span> {estimate.payment_confirmed_by_name} · {Number(estimate.paid_amount).toLocaleString()} ₽</Col>
          )}
          {estimate.director_comment && (
            <Col span={24} style={{ marginTop: 6 }}><span style={{ fontSize: 12, color: '#888' }}>Комментарий ГД:</span> {estimate.director_comment}</Col>
          )}
        </Row>
      </Card>

      {/* Позиции сметы */}
      <Card title="📋 Позиции сметы"
        extra={<Button type="primary" icon={<PlusOutlined />} onClick={openAddItem}>Добавить позицию</Button>}
        style={{ marginBottom: 16 }}>
        <Table dataSource={estimate.items || []} columns={itemColumns} rowKey="id" size="middle"
          pagination={false} locale={{ emptyText: 'Смета пуста. Добавьте позиции выше.' }} />
      </Card>

      {/* Итоги */}
      <Row gutter={16}>
        <Col span={8}>
          <Card size="small" title="💰 Итоги для клиента">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Материалы">{Number(estimate.total_materials).toLocaleString()} ₽</Descriptions.Item>
              <Descriptions.Item label="Услуги">{Number(estimate.total_services).toLocaleString()} ₽</Descriptions.Item>
              <Descriptions.Item label="Подытог"><strong>{Number(estimate.subtotal).toLocaleString()} ₽</strong></Descriptions.Item>
              {estimate.discount > 0 && <Descriptions.Item label="Скидка">-{estimate.discount}%</Descriptions.Item>}
              {estimate.commission > 0 && <Descriptions.Item label="Комиссионные">+{estimate.commission}%</Descriptions.Item>}
              {estimate.dealer_fee > 0 && <Descriptions.Item label="Дилерская наценка">+{estimate.dealer_fee}%</Descriptions.Item>}
              {estimate.unexpected_costs > 0 && <Descriptions.Item label="Непредв. расходы">{Number(estimate.unexpected_costs).toLocaleString()} ₽</Descriptions.Item>}
              {estimate.delivery_cost > 0 && <Descriptions.Item label="Доставка">{Number(estimate.delivery_cost).toLocaleString()} ₽</Descriptions.Item>}
              {estimate.total_ugol > 0 && <Descriptions.Item label="🔥 Уголь (откат)">{Number(estimate.total_ugol).toLocaleString()} ₽</Descriptions.Item>}
              <Descriptions.Item label={<strong>ИТОГО</strong>}><strong style={{ fontSize: 18, color: '#1677ff' }}>{Number(estimate.total).toLocaleString()} ₽</strong></Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" title="📈 Маржинальность">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Выручка">{Number(estimate.total).toLocaleString()} ₽</Descriptions.Item>
              <Descriptions.Item label="Себестоимость общая">{Number(estimate.total_cost).toLocaleString()} ₽</Descriptions.Item>
              <Descriptions.Item label={<strong>Прибыль</strong>}>
                <strong style={{ fontSize: 18, color: Number(estimate.profit) > 0 ? '#52c41a' : '#ff4d4f' }}>
                  {Number(estimate.profit).toLocaleString()} ₽
                </strong>
              </Descriptions.Item>
              <Descriptions.Item label="Рентабельность">
                {estimate.total > 0 ? ((Number(estimate.profit) / Number(estimate.total)) * 100).toFixed(1) : 0}%
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small" title="🔍 Внутренний расчёт">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Себест. материалов">{Number(estimate.cost_materials || 0).toLocaleString()} ₽</Descriptions.Item>
              <Descriptions.Item label="Себест. работ/услуг">{Number(estimate.cost_services || 0).toLocaleString()} ₽</Descriptions.Item>
              <Descriptions.Item label="Себест. общая">{Number(estimate.total_cost || 0).toLocaleString()} ₽</Descriptions.Item>
              {estimate.dealer_amount > 0 && <Descriptions.Item label="Дилерская наценка (₽)">{Number(estimate.dealer_amount).toLocaleString()} ₽</Descriptions.Item>}
              {estimate.commission_amount > 0 && <Descriptions.Item label="Комиссионные (₽)">{Number(estimate.commission_amount).toLocaleString()} ₽</Descriptions.Item>}
              {estimate.total_ugol > 0 && <Descriptions.Item label="Уголь (себест.)">{Number(estimate.total_ugol).toLocaleString()} ₽</Descriptions.Item>}
              {estimate.total_vat > 0 && <Descriptions.Item label="НДС">{Number(estimate.total_vat).toLocaleString()} ₽</Descriptions.Item>}
              <Descriptions.Item label="Прибыль чистая">
                <strong style={{ color: Number(estimate.profit) > 0 ? '#52c41a' : '#ff4d4f' }}>{Number(estimate.profit).toLocaleString()} ₽</strong>
              </Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
      </Row>

      {/* История сметы */}
      <Card size="small" title="🕘 История согласования и оплаты" style={{ marginTop: 16 }}>
        {estimate.events && estimate.events.length > 0 ? (
          <Timeline
            items={estimate.events.map((ev: any) => ({
              color: ev.event_type.includes('reject') ? 'red'
                : (ev.event_type === 'paid' || ev.event_type === 'completed' || ev.event_type === 'client_approved') ? 'green'
                  : 'blue',
              children: (
                <div>
                  <strong>{ev.event_type_display}</strong>
                  <span style={{ color: '#888', marginLeft: 8, fontSize: 12 }}>
                    {new Date(ev.created_at).toLocaleString('ru')}{ev.user_name ? ` · ${ev.user_name}` : ''}
                  </span>
                  {ev.comment && <div style={{ fontSize: 12, color: '#555' }}>{ev.comment}</div>}
                </div>
              ),
            }))}
          />
        ) : <span style={{ color: '#999' }}>Событий пока нет</span>}
      </Card>

      {/* Модалка: комментарий к действию / сумма оплаты */}
      <Modal
        title={commentModal.title}
        open={commentModal.open}
        okText={commentModal.okText}
        cancelText="Отмена"
        onOk={submitComment}
        onCancel={() => setCommentModal(m => ({ ...m, open: false }))}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          {commentModal.action === 'confirm_payment' && (
            <div>
              <label>Поступившая сумма (₽)</label>
              <InputNumber
                style={{ width: '100%' }}
                value={paidAmount}
                min={0}
                onChange={v => setPaidAmount(v || 0)}
              />
            </div>
          )}
          <div>
            <label>
              {commentModal.action === 'client_approve' ? 'Кто согласовал со стороны клиента'
                : commentModal.action === 'confirm_payment' ? 'Комментарий (номер п/п, дата)'
                  : 'Комментарий'}
            </label>
            <Input.TextArea rows={3} value={commentText} onChange={e => setCommentText(e.target.value)} />
          </div>
        </Space>
      </Modal>

      {/* Модалка: параметры сметы */}
      <Modal title="⚙️ Параметры сметы" open={settingsOpen} onOk={updateSettings} onCancel={() => setSettingsOpen(false)} width={520}>
        <Space direction="vertical" style={{ width: '100%' }} size="small">
          <div>
            <label>Клиент</label>
            <Select
              allowClear
              showSearch
              style={{ width: '100%' }}
              placeholder="Имя, телефон, адрес, л/с..."
              value={settingsForm.client ?? undefined}
              onChange={v => setSettingsForm({ ...settingsForm, client: v ?? null })}
              filterOption={false}
              onSearch={searchClients}
              notFoundContent={clientsLoading ? <Spin size="small" /> : 'Ничего не найдено'}
              options={clients.map((c: any) => ({ value: c.id, label: clientLabel(c) }))}
            />
          </div>
          <div>
            <label>Наше юрлицо</label>
            <Select
              allowClear
              style={{ width: '100%' }}
              placeholder="Выберите юрлицо"
              value={settingsForm.legal_entity ?? undefined}
              onChange={(v) => {
                const entity = legalEntities.find((l: any) => l.id === v);
                setSettingsForm((prev: any) => ({
                  ...prev,
                  legal_entity: v ?? null,
                  // Налоги берём из выбранного юрлица: у ОСНО есть НДС, у УСН — нет
                  ...(entity ? {
                    tax_type: entity.tax_system || prev.tax_type,
                    ...(Number(entity.vat_rate) > 0 ? { tax_rate: Number(entity.vat_rate) } : {}),
                  } : {}),
                }));
              }}
              options={legalEntities.map((l: any) => ({ value: l.id, label: l.short_name || l.name }))}
            />
            {settingsForm.legal_entity && (
              <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                Система налогообложения:{' '}
                {TAX_LABELS[settingsForm.tax_type] || settingsForm.tax_type}
                {Number(settingsForm.tax_rate) > 0 && settingsForm.tax_type === 'osno'
                  ? ` · НДС ${settingsForm.tax_rate}%`
                  : ''}
                {' '}— итоги пересчитаются после сохранения
              </div>
            )}
          </div>
          <Divider style={{ margin: '4px 0' }} />
          <Row gutter={12}>
            <Col span={12}><label>Скидка (%)</label><InputNumber value={settingsForm.discount} onChange={v => setSettingsForm({ ...settingsForm, discount: v || 0 })} min={0} style={{ width: '100%' }} /></Col>
            <Col span={12}><label>Комиссионные (%)</label><InputNumber value={settingsForm.commission} onChange={v => setSettingsForm({ ...settingsForm, commission: v || 0 })} min={0} style={{ width: '100%' }} /></Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}><label>Дилер. наценка (%)</label><InputNumber value={settingsForm.dealer_fee} onChange={v => setSettingsForm({ ...settingsForm, dealer_fee: v || 0 })} min={0} style={{ width: '100%' }} /></Col>
            <Col span={12}><label>Непредв. расходы (₽)</label><InputNumber value={settingsForm.unexpected_costs} onChange={v => setSettingsForm({ ...settingsForm, unexpected_costs: v || 0 })} min={0} style={{ width: '100%' }} /></Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}><label>Доставка (₽)</label><InputNumber value={settingsForm.delivery_cost} onChange={v => setSettingsForm({ ...settingsForm, delivery_cost: v || 0 })} min={0} style={{ width: '100%' }} /></Col>
            <Col span={12}><label>Статус</label><Select value={settingsForm.status} onChange={v => setSettingsForm({ ...settingsForm, status: v })} style={{ width: '100%' }}
              options={Object.entries(STATUS_MAP).map(([k, v]) => ({ value: k, label: v.label }))} /></Col>
          </Row>
          <Divider orientation="left" style={{ fontSize: 12, margin: '4px 0' }}>🔥 «Уголь» (откат клиенту)</Divider>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <Switch checked={settingsForm.ugol_enabled} onChange={v => setSettingsForm({ ...settingsForm, ugol_enabled: v })} />
            <span>Включить уголь</span>
          </div>
          {settingsForm.ugol_enabled && (
            <>
              <Row gutter={12}>
                <Col span={12}><label>Процент (%)</label><InputNumber value={settingsForm.ugol_percent} onChange={v => setSettingsForm({ ...settingsForm, ugol_percent: v || 0 })} min={0} max={100} style={{ width: '100%' }} /></Col>
                <Col span={12}><label>Применять</label><Select value={settingsForm.ugol_apply_to} onChange={v => setSettingsForm({ ...settingsForm, ugol_apply_to: v })} style={{ width: '100%' }}
                  options={[{ value: 'all', label: 'На все позиции' }, { value: 'selected', label: 'Только выбранные' }]} /></Col>
              </Row>
            </>
          )}
        </Space>
      </Modal>

      {/* Модалка: добавление/редактирование позиции */}
      <Modal title={editingItem ? 'Редактировать позицию' : 'Добавить позицию'} open={itemModalOpen}
        onOk={saveItem} onCancel={() => setItemModalOpen(false)} width={550} okText="Сохранить" cancelText="Отмена">
        <Space direction="vertical" style={{ width: '100%' }} size="small">
          <div>
            <label>Тип позиции</label>
            <Select value={itemForm.item_type} onChange={handleItemTypeChange} style={{ width: '100%' }} options={ITEM_TYPES} />
          </div>

          {itemForm.item_type === 'material' && (
            <div>
              <label>Выберите со склада</label>
              <Select allowClear showSearch placeholder="Поиск по названию..." value={itemForm.inventory_item_id}
                onChange={handleInventorySelect} style={{ width: '100%' }}
                options={inventory.map((inv: any) => ({ value: inv.id, label: `📦 ${inv.name} — ${Number(inv.sale_price || 0).toLocaleString()} ₽/${inv.unit || 'шт'} (на складе: ${inv.quantity})` }))}
                filterOption={(input, option) => (option?.label || '').toLowerCase().includes(input.toLowerCase())} />
            </div>
          )}

          {itemForm.item_type === 'service' && (
            <div>
              <label>Выберите услугу</label>
              <Select allowClear showSearch placeholder="Поиск услуги..." value={itemForm.service_id}
                onChange={handleServiceSelect} style={{ width: '100%' }}
                options={services.map((s: any) => ({ value: s.id, label: `🔧 ${s.name} — ${Number(s.sale_price).toLocaleString()} ₽/${s.unit}` }))}
                filterOption={(input, option) => (option?.label || '').toLowerCase().includes(input.toLowerCase())} />
            </div>
          )}

          <div>
            <label>Наименование *</label>
            <Input value={itemForm.name} onChange={e => setItemForm({ ...itemForm, name: e.target.value })} />
          </div>

          <Row gutter={12}>
            <Col span={6}><label>Кол-во</label><InputNumber value={itemForm.quantity} onChange={v => setItemForm({ ...itemForm, quantity: v || 1 })} min={0.01} step={0.5} style={{ width: '100%' }} /></Col>
            <Col span={6}><label>Ед.</label><Input value={itemForm.unit} onChange={e => setItemForm({ ...itemForm, unit: e.target.value })} /></Col>
            <Col span={6}><label>Себест. (₽)</label><InputNumber value={itemForm.cost_price} onChange={v => setItemForm({ ...itemForm, cost_price: v || 0 })} min={0} style={{ width: '100%' }} /></Col>
            <Col span={6}><label>Цена (₽)</label><InputNumber value={itemForm.sale_price} onChange={v => setItemForm({ ...itemForm, sale_price: v || 0 })} min={0} style={{ width: '100%' }} /></Col>
          </Row>

          <div>
            <label>Скидка на позицию (%)</label>
            <InputNumber value={itemForm.discount} onChange={v => setItemForm({ ...itemForm, discount: v || 0 })} min={0} max={100} style={{ width: 120 }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Switch size="small" checked={itemForm.ugol_applied} onChange={v => setItemForm({ ...itemForm, ugol_applied: v })} />
            <span style={{ fontSize: 12 }}>🔥 Применить уголь к этой позиции</span>
          </div>
        </Space>
      </Modal>
    </div>
  );
};

export default EstimateDetailPage;
