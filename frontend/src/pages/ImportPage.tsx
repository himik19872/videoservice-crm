import React, { useState } from 'react';
import { Upload, Card, Typography, Space, Button, message, Table, Tag, Divider, Radio, Alert } from 'antd';
import { UploadOutlined, InboxOutlined, FileExcelOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import dayjs from 'dayjs';
import api from '../services/api';
import type { ImportResult } from '../types';

const { Title, Text } = Typography;
const { Dragger } = Upload;

type ImportType = 'clients' | 'erc';

const ImportPage: React.FC = () => {
  const [importType, setImportType] = useState<ImportType>('clients');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [previewData, setPreviewData] = useState<{ headers: string[]; rows: string[][]; total_rows: number } | null>(null);
  const [file, setFile] = useState<File | null>(null);

  const handlePreview: UploadProps['beforeUpload'] = (file) => {
    setFile(file);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);

    api.post('/import/preview/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
      .then((res) => setPreviewData(res.data))
      .catch(() => message.error('Ошибка чтения файла'));

    return false; // prevent auto upload
  };

  const handleImport = async () => {
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    // Для ЕРЦ добавляем период
    if (importType === 'erc') {
      // По умолчанию — первый день предыдущего месяца
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

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <Title level={3}>
        <FileExcelOutlined /> Импорт данных из Excel
      </Title>

      {/* Выбор типа импорта */}
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
            optionType="button"
            buttonStyle="solid"
          >
            <Radio.Button value="clients">
              📋 База клиентов (лицевые счета + ТСЖ)
            </Radio.Button>
            <Radio.Button value="erc">
              🏦 ЕРЦ (оборотная ведомость, форма № 30.01.01)
            </Radio.Button>
          </Radio.Group>
        </Space>
      </Card>

      {/* Описание формата */}
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
        message={
          importType === 'clients'
            ? 'Формат: № п/п | № лицевого счета | ФИО | Адрес | № парадной | ТСЖ'
            : 'Формат: № п/п | № лиц. счета | ФИО | Адрес | Кол-во жильцов | Сальдо нач. | Начислено б/л | Начислено факт | Оплачено | % | Сальдо кон. | Кредит'
        }
      />

      {/* Загрузка файла */}
      <Card style={{ marginBottom: 16 }}>
        <Dragger
          accept=".xlsx,.xls"
          beforeUpload={handlePreview}
          showUploadList={false}
          disabled={loading}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">Нажмите или перетащите Excel-файл (.xlsx)</p>
          <p className="ant-upload-hint">Файл будет предварительно проверен перед импортом</p>
        </Dragger>

        {file && (
          <div style={{ marginTop: 12 }}>
            <Tag color="blue">{file.name}</Tag>
            <Text type="secondary"> ({(file.size / 1024).toFixed(1)} КБ)</Text>
          </div>
        )}
      </Card>

      {/* Предпросмотр */}
      {previewData && (
        <Card title={`Предпросмотр (всего строк: ${previewData.total_rows})`} style={{ marginBottom: 16 }}>
          <Table
            dataSource={previewData.rows.map((row, i) => ({ key: i, ...Object.fromEntries(row.map((v, j) => [j, v])) }))}
            columns={previewData.headers.map((h, i) => ({
              title: h,
              dataIndex: String(i),
              key: i,
              ellipsis: true,
              width: i <= 1 ? 80 : 200,
            }))}
            size="small"
            scroll={{ x: 'max-content' }}
            pagination={false}
          />

          <Divider />
          <Button
            type="primary"
            size="large"
            icon={<UploadOutlined />}
            onClick={handleImport}
            loading={loading}
          >
            {importType === 'clients' ? 'Импортировать клиентов' : 'Импортировать данные ЕРЦ'}
          </Button>
        </Card>
      )}

      {/* Результат */}
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
                  {result.period && <Text>📅 Период: <strong>{result.period}</strong></Text>}
                  <Text>📊 Всего строк: <strong>{result.total}</strong></Text>
                  <Text>🆕 Счетов создано: <strong style={{ color: '#52c41a' }}>{result.accounts?.created}</strong></Text>
                  <Text>🔄 Счетов обновлено: <strong style={{ color: '#1677ff' }}>{result.accounts?.updated}</strong></Text>
                  <Text>🆕 Записей создано: <strong style={{ color: '#52c41a' }}>{result.billing_records?.created}</strong></Text>
                  <Text>🔄 Записей обновлено: <strong style={{ color: '#1677ff' }}>{result.billing_records?.updated}</strong></Text>
                  {result.column_mapping && Object.keys(result.column_mapping).length > 0 && (
                    <>
                      <Divider />
                      <Text type="secondary">🗂️ Определены колонки (column_mapping):</Text>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                        {Object.entries(result.column_mapping).map(([field, idx]) => (
                          <Tag key={field} color="geekblue">{field} → колонка {String(idx)}</Tag>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )}

              {result.errors && result.errors.length > 0 && (
                <>
                  <Divider />
                  <Text type="danger">⚠️ Ошибки ({result.errors.length}):</Text>
                  <ul style={{ margin: '4px 0', paddingLeft: 20, maxHeight: 200, overflow: 'auto' }}>
                    {result.errors.slice(0, 20).map((e, i) => (
                      <li key={i}><Text type="danger">{e}</Text></li>
                    ))}
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
