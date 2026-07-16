import React, { useState, useMemo } from 'react';
import { Upload, Card, Typography, Space, Button, message, Table, Tag, Divider, Radio, Alert, Select, Descriptions } from 'antd';
import { UploadOutlined, InboxOutlined, FileExcelOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import dayjs from 'dayjs';
import api from '../services/api';
import type { ImportResult } from '../types';

const { Title, Text } = Typography;
const { Dragger } = Upload;
const { Option } = Select;

type ImportType = 'clients' | 'erc';

// Поля для маппинга (клиенты)
const CLIENT_FIELDS = [
  { key: 'name', label: '👤 ФИО' },
  { key: 'address', label: '📍 Адрес' },
  { key: 'personal_account', label: '🔢 № лицевого счёта' },
  { key: 'entrance', label: '🚪 № парадной' },
  { key: 'management_company', label: '🏢 ТСЖ / УК' },
];

const ImportPage: React.FC = () => {
  const [importType, setImportType] = useState<ImportType>('clients');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [previewData, setPreviewData] = useState<{ headers: string[]; rows: string[][]; total_rows: number; total_columns: number } | null>(null);
  const [file, setFile] = useState<File | null>(null);

  // Маппинг колонок: {field_name: column_index}
  const [columnMap, setColumnMap] = useState<Record<string, number>>({});

  // Автоопределение маппинга по заголовкам
  const autoDetectMap = (headers: string[]) => {
    const map: Record<string, number> = {};
    headers.forEach((h, i) => {
      const hl = h.toLowerCase();
      if (/фио|ф\.и\.о|наименование|владелец|абонент|житель|собственник/.test(hl)) map['name'] = i;
      else if (/адрес|место|прожива/.test(hl)) map['address'] = i;
      else if (/лицево|счёт|счет|л\/с|лс/.test(hl)) map['personal_account'] = i;
      else if (/парадн|подъезд|под\./.test(hl)) map['entrance'] = i;
      else if (/тсж|ук|жск|управляющ|компани/.test(hl)) map['management_company'] = i;
    });
    // Если не определили — ставим дефолтные индексы
    if (!map['name']) map['name'] = 2;
    if (!map['address']) map['address'] = 3;
    if (!map['personal_account']) map['personal_account'] = 1;
    if (!map['entrance']) map['entrance'] = 4;
    if (!map['management_company']) map['management_company'] = 5;
    return map;
  };

  const handlePreview: UploadProps['beforeUpload'] = (file) => {
    setFile(file);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);

    api.post('/import/preview/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
      .then((res) => {
        setPreviewData(res.data);
        // Автоопределяем колонки
        if (res.data.headers) {
          setColumnMap(autoDetectMap(res.data.headers));
        }
      })
      .catch(() => message.error('Ошибка чтения файла'));

    return false;
  };

  const handleImport = async () => {
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    // Для клиентов — передаём column_map
    if (importType === 'clients') {
      formData.append('column_map', JSON.stringify(columnMap));
    }

    if (importType === 'erc') {
      const period = dayjs().subtract(1, 'month').startOf('month').format('YYYY-MM-DD');
      formData.append('period', period);
    }

    try {
      const url = importType === 'clients' ? '/import/clients/' : '/import/erc/';
      const res = await api.post(url, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(res.data);
      if (res.data.success) {
        message.success(`Импорт завершён!`);
      } else {
        message.error(res.data.error || 'Ошибка импорта');
      }
    } catch (err: any) {
      message.error(err.response?.data?.error || 'Ошибка импорта');
    } finally {
      setLoading(false);
    }
  };

  // Строим колонки таблицы предпросмотра с заголовками из columnMap
  const previewColumns = useMemo(() => {
    if (!previewData?.headers) return [];
    const cols = previewData.headers.map((h, i) => {
      const mapped = CLIENT_FIELDS.find(f => columnMap[f.key] === i);
      return {
        title: mapped ? `${mapped.label}: ${h}` : h,
        dataIndex: String(i),
        key: i,
        ellipsis: true,
        width: 160,
        render: (v: string) => <span style={{ fontSize: 12 }}>{v}</span>,
      };
    });
    return cols;
  }, [previewData, columnMap]);

  // Отображаемые строки для селектора (индекс: заголовок)
  const columnOptions = useMemo(() => {
    if (!previewData?.headers) return [];
    return previewData.headers.map((h, i) => ({
      value: i,
      label: `${String.fromCharCode(65 + i)}: ${h}`,
    }));
  }, [previewData]);

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <Title level={3}>
        <FileExcelOutlined /> Импорт данных из Excel
      </Title>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text strong>Тип импорта:</Text>
          <Radio.Group
            value={importType}
            onChange={(e) => {
              setImportType(e.target.value);
              setResult(null);
              setPreviewData(null);
              setFile(null);
            }}
            optionType="button" buttonStyle="solid"
          >
            <Radio.Button value="clients">📋 База клиентов (лицевые счета + ТСЖ)</Radio.Button>
            <Radio.Button value="erc">🏦 ЕРЦ (оборотная ведомость)</Radio.Button>
          </Radio.Group>
        </Space>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <Dragger accept=".xlsx,.xls" beforeUpload={handlePreview} showUploadList={false} disabled={loading}>
          <p className="ant-upload-drag-icon"><InboxOutlined /></p>
          <p className="ant-upload-text">Нажмите или перетащите Excel-файл (.xlsx)</p>
          <p className="ant-upload-hint">Файл будет проверен перед импортом</p>
        </Dragger>
        {file && (
          <div style={{ marginTop: 12 }}>
            <Tag color="blue">{file.name}</Tag>
            <Text type="secondary"> ({(file.size / 1024).toFixed(1)} КБ)</Text>
            {previewData && <Text type="secondary"> — строк: {previewData.total_rows}</Text>}
          </div>
        )}
      </Card>

      {/* ── Маппинг колонок ── */}
      {previewData && importType === 'clients' && (
        <Card title="🔧 Настройка колонок" size="small" style={{ marginBottom: 16 }}>
          <Alert
            type="info" showIcon style={{ marginBottom: 12 }}
            message="Укажите, в каком столбце какие данные. Заголовки определяются автоматически."
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
            {CLIENT_FIELDS.map(f => (
              <div key={f.key}>
                <Text strong style={{ display: 'block', marginBottom: 4 }}>{f.label}</Text>
                <Select
                  style={{ width: '100%' }}
                  value={columnMap[f.key] !== undefined ? columnMap[f.key] : undefined}
                  onChange={(val: number) => setColumnMap(prev => ({ ...prev, [f.key]: val }))}
                  placeholder="— не выбрано —"
                  allowClear
                >
                  {columnOptions.map(opt => (
                    <Option key={opt.value} value={opt.value}>{opt.label}</Option>
                  ))}
                </Select>
              </div>
            ))}
          </div>
          <Divider />
          <Button type="primary" size="large" icon={<UploadOutlined />} onClick={handleImport} loading={loading}>
            Импортировать {previewData.total_rows} строк
          </Button>
        </Card>
      )}

      {/* Для ЕРЦ — просто кнопка импорта */}
      {previewData && importType === 'erc' && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <Descriptions size="small" column={3}>
            <Descriptions.Item label="Всего строк">{previewData.total_rows}</Descriptions.Item>
            <Descriptions.Item label="Колонок">{previewData.total_columns}</Descriptions.Item>
          </Descriptions>
          <Divider />
          <Button type="primary" size="large" icon={<UploadOutlined />} onClick={handleImport} loading={loading}>
            Импортировать данные ЕРЦ
          </Button>
        </Card>
      )}

      {/* ── Предпросмотр ── */}
      {previewData && (
        <Card title="Предпросмотр данных" size="small" style={{ marginBottom: 16 }}>
          <Table
            dataSource={previewData.rows.map((row, i) => ({ key: i, ...Object.fromEntries(row.map((v, j) => [String(j), v])) }))}
            columns={previewColumns}
            size="small"
            scroll={{ x: 'max-content' }}
            pagination={{ pageSize: 10 }}
          />
        </Card>
      )}

      {/* ── Результат ── */}
      {result && (
        <Card title="Результат импорта" style={{ marginBottom: 16 }}>
          {result.success ? (
            <Space direction="vertical" style={{ width: '100%' }}>
              {importType === 'clients' ? (
                <>
                  <Text>📊 Всего строк: <strong>{result.total}</strong></Text>
                  <Text>🆕 Создано: <strong style={{ color: '#52c41a' }}>{result.created}</strong></Text>
                  <Text>🔄 Обновлено: <strong style={{ color: '#1677ff' }}>{result.updated}</strong></Text>
                </>
              ) : (
                <>
                  <Text>📊 Всего строк: <strong>{result.total}</strong></Text>
                  <Text>🆕 Создано: <strong style={{ color: '#52c41a' }}>{result.created}</strong></Text>
                </>
              )}

              {result.errors && result.errors.length > 0 && (
                <>
                  <Divider />
                  <Text type="danger">⚠️ Ошибки ({result.errors.length}):</Text>
                  <ul style={{ margin: '4px 0', paddingLeft: 20, maxHeight: 200, overflow: 'auto' }}>
                    {result.errors.slice(0, 20).map((e, i) => <li key={i}><Text type="danger">{e}</Text></li>)}
                    {result.errors.length > 20 && <li>...и ещё {result.errors.length - 20}</li>}
                  </ul>
                </>
              )}
            </Space>
          ) : (
            <Alert type="error" message={result.error || 'Неизвестная ошибка'} />
          )}
        </Card>
      )}
    </div>
  );
};

export default ImportPage;
