import React, { useState } from 'react';
import { Upload, Card, Typography, Space, Button, message, Table, Tag, Divider, Alert, Descriptions, Steps, Progress } from 'antd';
import {
  InboxOutlined, FileExcelOutlined, FileTextOutlined,
  DownloadOutlined, ImportOutlined, CheckCircleOutlined,
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

      {/* ── Steps ── */}
      <Steps
        current={step === 'upload' ? 0 : step === 'converted' ? 1 : 2}
        size="small"
        style={{ marginBottom: 20 }}
        items={[
          { title: 'Загрузка Excel', icon: <FileExcelOutlined /> },
          { title: 'Конвертация', icon: <FileTextOutlined /> },
          { title: 'Импорт в базу', icon: <ImportOutlined /> },
        ]}
      />

      {/* ── Выбор периода ── */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space>
          <Text strong>Период начислений (для ЕРЦ):</Text>
          <input
            type="month"
            value={period ? period.substring(0, 7) : ''}
            onChange={(e) => {
              if (e.target.value) setPeriod(e.target.value + '-01');
            }}
            style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid #d9d9d9' }}
          />
          <Text type="secondary">текущий: {period}</Text>
        </Space>
      </Card>

      {/* ── Шаг 1: Загрузка ── */}
      {step === 'upload' && (
        <Card style={{ marginBottom: 16 }}>
          <Dragger
            accept=".xlsx,.xls"
            beforeUpload={handleUpload}
            showUploadList={false}
            disabled={loading}
          >
            <p className="ant-upload-drag-icon">
              {loading ? <Progress type="circle" percent={99} size={48} /> : <InboxOutlined />}
            </p>
            <p className="ant-upload-text">
              {loading ? 'Конвертируем...' : 'Нажмите или перетащите Excel-файл (.xlsx)'}
            </p>
            <p className="ant-upload-hint">
              ТСЖ, ЕРЦ СПб, ЕРЦ ЛО, ЕРЦ Агалатово, Красное Село, Стр.6-3 — определяется автоматически
            </p>
          </Dragger>
        </Card>
      )}

      {/* ── Шаг 2: Конвертирован ── */}
      {step === 'converted' && convertResult && (
        <>
          <Card
            title={
              <Space>
                <CheckCircleOutlined style={{ color: '#52c41a' }} />
                <span>Файл сконвертирован</span>
                {fmtInfo && <Tag color={fmtInfo.color}>{fmtInfo.label}</Tag>}
              </Space>
            }
            style={{ marginBottom: 16 }}
            extra={<Button onClick={handleReset}>🔄 Загрузить другой</Button>}
          >
            <Descriptions size="small" column={4}>
              <Descriptions.Item label="Файл">{file?.name}</Descriptions.Item>
              <Descriptions.Item label="Формат">
                <Tag color={fmtInfo?.color}>{fmtInfo?.label}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Строк">
                <Text strong>{convertResult.total_rows.toLocaleString()}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Период">{period}</Descriptions.Item>
            </Descriptions>

            <Divider />

            <Space size="large">
              <Button
                type="primary"
                size="large"
                icon={<ImportOutlined />}
                onClick={handleImportToDb}
                loading={importing}
              >
                Импортировать в базу
              </Button>
              <Button
                size="large"
                icon={<DownloadOutlined />}
                onClick={handleDownloadCsv}
              >
                Скачать CSV
              </Button>
            </Space>
          </Card>

          {/* Предпросмотр */}
          <Card
            title={`Предпросмотр (первые ${Math.min(convertResult.total_rows, 200)} из ${convertResult.total_rows.toLocaleString()})`}
            size="small"
          >
            <Table
              dataSource={convertResult.converted_preview.map((row, i) => ({ ...row, key: i }))}
              columns={UNIFIED_COLUMNS.map(c => ({
                title: c.title,
                dataIndex: c.key,
                key: c.key,
                width: c.width,
                ellipsis: true,
                render: (v: string) => <span style={{ fontSize: 11 }}>{v}</span>,
              }))}
              size="small"
              scroll={{ x: 'max-content' }}
              pagination={{ pageSize: 15, size: 'small' }}
            />
          </Card>
        </>
      )}

      {/* ── Шаг 3: Импортировано ── */}
      {step === 'imported' && importResult && (
        <Card
          title={
            <Space>
              <CheckCircleOutlined style={{ color: '#52c41a' }} />
              <span>Импорт завершён!</span>
            </Space>
          }
          style={{ marginBottom: 16 }}
          extra={<Button onClick={handleReset}>🔄 Загрузить новый файл</Button>}
        >
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

          {importResult.errors && importResult.errors.length > 0 && (
            <>
              <Divider />
              <Alert
                type="warning"
                message={`Ошибок: ${importResult.errors.length}`}
                description={
                  <ul style={{ margin: '4px 0', paddingLeft: 20, maxHeight: 200, overflow: 'auto' }}>
                    {importResult.errors.slice(0, 30).map((e: string, i: number) => (
                      <li key={i} style={{ fontSize: 12 }}>{e}</li>
                    ))}
                    {importResult.errors.length > 30 && (
                      <li>...и ещё {importResult.errors.length - 30}</li>
                    )}
                  </ul>
                }
              />
            </>
          )}

          <Divider />
          <Space>
            {convertResult?.csv_content && (
              <Button icon={<DownloadOutlined />} onClick={handleDownloadCsv}>
                Скачать CSV ({convertResult.csv_filename})
              </Button>
            )}
            <Button onClick={handleReset}>🔄 Загрузить другой файл</Button>
          </Space>
        </Card>
      )}
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
