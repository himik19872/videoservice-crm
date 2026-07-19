import React, { useState } from 'react';
import { Upload, Card, Typography, Space, Button, message, Table, Tag, Divider, Alert, Descriptions, Steps, Progress, Tabs, Popover } from 'antd';
import {
  InboxOutlined, FileExcelOutlined, FileTextOutlined, EyeOutlined,
  DownloadOutlined, ImportOutlined, CheckCircleOutlined, QuestionCircleOutlined,
} from '@ant-design/icons';
import type { UploadProps } from 'antd';
import dayjs from 'dayjs';
import api from '../services/api';
import type { ImportResult } from '../types';

const { Title, Text } = Typography;
const { Dragger } = Upload;

// Форматы и их читаемые названия
const FORMAT_LABELS: Record<string, { label: string; color: string }> = {
  tszh: { label: '🏢 База клиентов (ТСЖ)', color: 'blue' },
  erc_spb: { label: '🏦 ЕРЦ Санкт-Петербург', color: 'green' },
  erc_lo: { label: '🏦 ЕРЦ Ленинградская область', color: 'cyan' },
  erc_agalatovo: { label: '🏦 ЕРЦ Агалатово', color: 'geekblue' },
  krasnoe_selo: { label: '🏘️ Красное Село (оборотная)', color: 'purple' },
  str63: { label: '📋 Стр.6-3 (домофоны)', color: 'orange' },
};

// Унифицированные колонки для таблицы предпросмотра
const UNIFIED_COLUMNS = [
  { key: 'type', title: 'Тип', width: 70 },
  { key: 'personal_account', title: 'Лиц. счёт', width: 130 },
  { key: 'full_name', title: 'ФИО', width: 160 },
  { key: 'city', title: 'Город', width: 120 },
  { key: 'street', title: 'Улица', width: 180 },
  { key: 'house', title: 'Дом', width: 60 },
  { key: 'building', title: 'Корп/лит', width: 90 },
  { key: 'apartment', title: 'Кв.', width: 50 },
  { key: 'entrance', title: 'Подъезд', width: 70 },
  { key: 'management_company', title: 'ТСЖ/УК', width: 140 },
  { key: 'period', title: 'Период', width: 90 },
  { key: 'charged', title: 'Начислено', width: 90 },
  { key: 'paid', title: 'Оплачено', width: 90 },
  { key: 'balance_end', title: 'Сальдо', width: 90 },
];

interface ConvertResult {
  success: boolean;
  format: string;
  total_rows: number;
  converted_preview: Record<string, string>[];
  csv_content: string;
  csv_filename: string;
  error?: string;
}

type Step = 'upload' | 'converted' | 'imported';

const ImportPage: React.FC = () => {
  const [step, setStep] = useState<Step>('upload');
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [convertResult, setConvertResult] = useState<ConvertResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [period, setPeriod] = useState<string>(
    dayjs().subtract(1, 'month').startOf('month').format('YYYY-MM-DD')
  );
  const [tab, setTab] = useState<string>('clients');

  // ── Импорт Beward: IP-адреса ──
  const [bewardIpResult, setBewardIpResult] = useState<any>(null);
  const [bewardIpLoading, setBewardIpLoading] = useState(false);

  const handleBewardIpUpload: UploadProps['beforeUpload'] = (file) => {
    setBewardIpLoading(true);
    setBewardIpResult(null);
    const fd = new FormData();
    fd.append('file', file);
    api.post('/import/beward-ip/', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then(res => { setBewardIpResult(res.data); message.success(res.data.message); })
      .catch(err => message.error(err.response?.data?.error || 'Ошибка'))
      .finally(() => setBewardIpLoading(false));
    return false;
  };

  // ── Импорт Beward: коды ──
  const [bewardCodesResult, setBewardCodesResult] = useState<any>(null);
  const [bewardCodesLoading, setBewardCodesLoading] = useState(false);

  const handleBewardCodesUpload: UploadProps['beforeUpload'] = (file) => {
    setBewardCodesLoading(true);
    setBewardCodesResult(null);
    const fd = new FormData();
    fd.append('file', file);
    api.post('/import/beward-codes/', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then(res => { setBewardCodesResult(res.data); message.success(res.data.message); })
      .catch(err => message.error(err.response?.data?.error || 'Ошибка'))
      .finally(() => setBewardCodesLoading(false));
    return false;
  };

  // ── Шаг 1: Загрузка и конвертация ──
  const handleUpload: UploadProps['beforeUpload'] = (file) => {
    setFile(file);
    setConvertResult(null);
    setImportResult(null);
    setStep('upload');
    setLoading(true);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('period', period);

    api.post('/import/convert/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
      .then((res) => {
        if (res.data.success) {
          setConvertResult(res.data);
          setStep('converted');
          message.success(`Сконвертировано: ${res.data.total_rows.toLocaleString()} строк (${res.data.format})`);
        } else {
          message.error(res.data.error || 'Ошибка конвертации');
        }
      })
      .catch((err) => {
        message.error(err.response?.data?.error || 'Ошибка сервера');
      })
      .finally(() => setLoading(false));

    return false;
  };

  // ── Скачать CSV ──
  const handleDownloadCsv = () => {
    if (!convertResult?.csv_content) return;
    const blob = new Blob(['\uFEFF' + convertResult.csv_content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = convertResult.csv_filename || 'converted.csv';
    a.click();
    URL.revokeObjectURL(url);
    message.success('CSV скачан');
  };

  // ── Импортировать в базу ──
  const handleImportToDb = async () => {
    if (!convertResult?.csv_content) return;
    setImporting(true);
    try {
      // Отправляем CSV как файл (FormData), а не как JSON (слишком большой для 36K строк)
      const blob = new Blob([convertResult.csv_content], { type: 'text/csv;charset=utf-8;' });
      const formData = new FormData();
      formData.append('file', blob, convertResult.csv_filename || 'data.csv');

      const res = await api.post('/import/unified/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      if (res.data.success) {
        setImportResult(res.data);
        setStep('imported');
        message.success(`Импортировано: ${res.data.total_rows.toLocaleString()} строк`);
      } else {
        message.error(res.data.error || 'Ошибка импорта');
      }
    } catch (err: any) {
      message.error(err.response?.data?.error || 'Ошибка импорта');
    } finally {
      setImporting(false);
    }
  };

  // ── Сброс ──
  const handleReset = () => {
    setStep('upload');
    setFile(null);
    setConvertResult(null);
    setImportResult(null);
  };

  const fmtInfo = convertResult ? FORMAT_LABELS[convertResult.format] : null;

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto' }}>
      <Title level={3}>
        <FileExcelOutlined /> Импорт данных
      </Title>

      <Tabs activeKey={tab} onChange={setTab} items={[
        // ═══ Вкладка 1: Клиенты/ЕРЦ ═══
        {
          key: 'clients',
          label: '📊 Клиенты и ЕРЦ',
          children: <div>
            <Steps
              current={step === 'upload' ? 0 : step === 'converted' ? 1 : 2}
              size="small" style={{ marginBottom: 20 }}
              items={[
                { title: 'Загрузка Excel', icon: <FileExcelOutlined /> },
                { title: 'Конвертация', icon: <FileTextOutlined /> },
                { title: 'Импорт в базу', icon: <ImportOutlined /> },
              ]}
            />
            <Card size="small" style={{ marginBottom: 16 }}>
              <Space>
                <Text strong>Период начислений (для ЕРЦ):</Text>
                <input type="month" value={period ? period.substring(0, 7) : ''}
                  onChange={(e) => { if (e.target.value) setPeriod(e.target.value + '-01'); }}
                  style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #d9d9d9' }} />
                <Text type="secondary">текущий: {period}</Text>
                <Popover title="Формат Excel-файла" content={<div style={{ maxWidth: 400, fontSize: 12 }}>
                  <p><b>ТСЖ:</b> Колонки: Адрес, ФИО, № лицевого счета, ...</p>
                  <p><b>ЕРЦ СПб/ЛО/Агалатово:</b> Оборотная ведомость ЕРЦ</p>
                  <p><b>Красное Село:</b> Оборотная ведомость</p>
                  <p><b>Стр.6-3:</b> Сводная таблица домофонов</p>
                  <p>Формат определяется автоматически.</p>
                </div>}>
                  <Button size="small" icon={<QuestionCircleOutlined />}>Образец</Button>
                </Popover>
              </Space>
            </Card>

            {step === 'upload' && (
              <Card><Dragger accept=".xlsx,.xls" beforeUpload={handleUpload} showUploadList={false} disabled={loading}>
                <p className="ant-upload-drag-icon">{loading ? <Progress type="circle" percent={99} size={48} /> : <InboxOutlined />}</p>
                <p className="ant-upload-text">{loading ? 'Конвертируем...' : 'Нажмите или перетащите Excel-файл (.xlsx)'}</p>
                <p className="ant-upload-hint">ТСЖ, ЕРЦ СПб, ЕРЦ ЛО, ЕРЦ Агалатово, Красное Село, Стр.6-3 — определяется автоматически</p>
              </Dragger></Card>
            )}

            {step === 'converted' && convertResult && (
              <Card title={<Space><CheckCircleOutlined style={{ color: '#52c41a' }} /><span>Файл сконвертирован</span>{fmtInfo && <Tag color={fmtInfo.color}>{fmtInfo.label}</Tag>}</Space>}
                extra={<Button onClick={handleReset}>🔄 Загрузить другой</Button>}>
                <Descriptions size="small" column={4}>
                  <Descriptions.Item label="Файл">{file?.name}</Descriptions.Item>
                  <Descriptions.Item label="Формат"><Tag color={fmtInfo?.color}>{fmtInfo?.label}</Tag></Descriptions.Item>
                  <Descriptions.Item label="Строк"><Text strong>{convertResult.total_rows.toLocaleString()}</Text></Descriptions.Item>
                  <Descriptions.Item label="Период">{period}</Descriptions.Item>
                </Descriptions>
                <Divider />
                <Space size="large">
                  <Button type="primary" size="large" icon={<ImportOutlined />} onClick={handleImportToDb} loading={importing}>Импортировать в базу</Button>
                  <Button size="large" icon={<DownloadOutlined />} onClick={handleDownloadCsv}>Скачать CSV</Button>
                </Space>
              </Card>
            )}

            {step === 'imported' && importResult && (
              <Card title={<Space><CheckCircleOutlined style={{ color: '#52c41a' }} /><span>Импорт завершён!</span></Space>}
                extra={<Button onClick={handleReset}>🔄 Загрузить новый файл</Button>}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12 }}>
                  <StatBox label="Всего строк" value={importResult.total_rows} color="#1677ff" />
                  <StatBox label="Клиентов создано" value={importResult.clients_created || 0} color="#52c41a" />
                  <StatBox label="Клиентов обновлено" value={importResult.clients_updated || 0} color="#1677ff" />
                  <StatBox label="Домов создано" value={importResult.buildings_created || 0} color="#722ed1" />
                  <StatBox label="ЕРЦ аккаунтов" value={importResult.erc_accounts_created || 0} color="#13c2c2" />
                  <StatBox label="ЕРЦ записей (нов.)" value={importResult.erc_records_created || 0} color="#52c41a" />
                  <StatBox label="ЕРЦ записей (обн.)" value={importResult.erc_records_updated || 0} color="#1677ff" />
                  <StatBox label="Пропущено" value={importResult.skipped || 0} color="#faad14" />
                </div>
                {importResult.errors?.length > 0 && (
                  <Alert type="warning" message={`Ошибок: ${importResult.errors.length}`}
                    description={<ul style={{ margin: '4px 0', paddingLeft: 20, maxHeight: 200, overflow: 'auto' }}>
                      {importResult.errors.slice(0, 30).map((e: string, i: number) => <li key={i} style={{ fontSize: 12 }}>{e}</li>)}
                    </ul>} />
                )}
              </Card>
            )}

            {/* Предпросмотр */}
            {convertResult?.converted_preview && (
              <Card title={`Предпросмотр (первые ${Math.min(convertResult.total_rows, 200)} из ${convertResult.total_rows.toLocaleString()})`} size="small" style={{ marginTop: 16 }}>
                <Table dataSource={convertResult.converted_preview.map((row: any, i: number) => ({ ...row, key: i }))}
                  columns={UNIFIED_COLUMNS.map(c => ({ title: c.title, dataIndex: c.key, key: c.key, width: c.width, ellipsis: true,
                    render: (v: string) => <span style={{ fontSize: 11 }}>{v}</span> }))}
                  size="small" scroll={{ x: 'max-content' }} pagination={{ pageSize: 15, size: 'small' }} />
              </Card>
            )}
          </div>
        },

        // ═══ Вкладка 2: IP-адреса Beward ═══
        {
          key: 'beward-ip',
          label: '🔌 Beward: IP-адреса',
          children: <div>
            <Alert type="info" showIcon style={{ marginBottom: 16 }}
              message="Справочник IP-адресов панелей Beward"
              description={
                <div style={{ fontSize: 12 }}>
                  <b>Формат Excel:</b> Район | Адрес | Подъезд | IP панели<br />
                  <b>Пример:</b> Колпино | Санкт-Петербург, город Колпино, улица Анисимова, дом 2 | 1 | 10.80.0.20<br />
                  <b>Что делает:</b> создаёт/обновляет записи в справочнике «Beward IP» и привязывает к домам из базы.
                </div>
              } />
            <Card>
              <Dragger accept=".xlsx,.xls" beforeUpload={handleBewardIpUpload} showUploadList={false} disabled={bewardIpLoading}>
                <p className="ant-upload-drag-icon">{bewardIpLoading ? <Progress type="circle" percent={99} size={48} /> : <InboxOutlined />}</p>
                <p className="ant-upload-text">{bewardIpLoading ? 'Импортируем...' : 'Нажмите или перетащите Excel (.xlsx)'}</p>
                <p className="ant-upload-hint">Файл с колонками: Район, Адрес, Подъезд, IP панели</p>
              </Dragger>
            </Card>
            {bewardIpResult && (
              <Card style={{ marginTop: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
                  <StatBox label="Всего строк" value={bewardIpResult.total_rows} color="#1677ff" />
                  <StatBox label="Создано" value={bewardIpResult.created} color="#52c41a" />
                  <StatBox label="Привязано к домам" value={bewardIpResult.with_building} color="#722ed1" />
                  <StatBox label="Пропущено" value={bewardIpResult.skipped} color="#faad14" />
                </div>
              </Card>
            )}
          </div>
        },

        // ═══ Вкладка 3: Коды Beward ═══
        {
          key: 'beward-codes',
          label: '🔑 Beward: Коды доступа',
          children: <div>
            <Alert type="info" showIcon style={{ marginBottom: 16 }}
              message="Коды доступа и программирования панелей Beward"
              description={
                <div style={{ fontSize: 12 }}>
                  <b>Формат Excel:</b> № п/п | Дата выдачи | Район | АДРЕС | № под. | Нумерация квартир | Код доступа | IP | код для программирования ключей | примечание<br />
                  <b>Пример:</b> 1 | 13.12.2021 | Пушкинский | Санкт-Петербург, пос. Шушары, Ленсоветовский, д. 21, к. 1, лит. А | 1 | 1-36 | 77780 | 10.125.35.66 | 18684 | примечание<br />
                  <b>Что делает:</b> записывает IP, коды доступа и программирования в подъезды домов и обновляет справочник Beward.
                </div>
              } />
            <Card>
              <Dragger accept=".xlsx,.xls" beforeUpload={handleBewardCodesUpload} showUploadList={false} disabled={bewardCodesLoading}>
                <p className="ant-upload-drag-icon">{bewardCodesLoading ? <Progress type="circle" percent={99} size={48} /> : <InboxOutlined />}</p>
                <p className="ant-upload-text">{bewardCodesLoading ? 'Импортируем...' : 'Нажмите или перетащите Excel (.xlsx)'}</p>
                <p className="ant-upload-hint">Файл с кодами доступа и программирования</p>
              </Dragger>
            </Card>
            {bewardCodesResult && (
              <Card style={{ marginTop: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
                  <StatBox label="Всего строк" value={bewardCodesResult.total_rows} color="#1677ff" />
                  <StatBox label="Подъездов создано" value={bewardCodesResult.entrances_created} color="#52c41a" />
                  <StatBox label="Подъездов обновлено" value={bewardCodesResult.entrances_updated} color="#1677ff" />
                  <StatBox label="Устройств дополнено" value={bewardCodesResult.devices_updated} color="#722ed1" />
                  <StatBox label="Не найдено домов" value={bewardCodesResult.no_building} color="#faad14" />
                  <StatBox label="Пропущено" value={bewardCodesResult.skipped} color="#ff4d4f" />
                </div>
              </Card>
            )}
          </div>
        },
      ]} />
    </div>
  );
};

/** Маленькая коробочка со статистикой */
const StatBox: React.FC<{ label: string; value: number | string; color: string }> = ({ label, value, color }) => (
  <div style={{
    background: '#fafafa', borderRadius: 8, padding: '12px 16px',
    borderLeft: `3px solid ${color}`, textAlign: 'center',
  }}>
    <div style={{ fontSize: 24, fontWeight: 700, color }}>{value}</div>
    <div style={{ fontSize: 12, color: '#888' }}>{label}</div>
  </div>
);

export default ImportPage;
