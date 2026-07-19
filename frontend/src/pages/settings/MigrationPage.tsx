import React, { useState, useEffect } from 'react';
import {
  Card, Checkbox, Button, Typography, message, Space, Divider, Alert,
  Spin, Row, Col, Statistic, Upload, Table, Tag,
} from 'antd';
import {
  ExportOutlined, ImportOutlined, DownloadOutlined,
  UploadOutlined, InfoCircleOutlined, CheckCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import api from '../../services/api';

const { Title, Text, Paragraph } = Typography;

const ALL_SECTIONS = [
  { key: 'clients', label: 'Клиенты и дома', desc: 'Client, Building' },
  { key: 'orders', label: 'Заявки и платежи', desc: 'Order, OrderHistory, Payment, ...' },
  { key: 'users', label: 'Пользователи и мастера', desc: 'User, Master, WorkShift' },
  { key: 'buildings', label: 'УК и подъезды', desc: 'ManagementCompany, BuildingEntrance' },
  { key: 'tariffs', label: 'Тарифы и внутр. платежи', desc: 'Tariff, PaymentRecord' },
  { key: 'erc', label: 'ЕРЦ', desc: 'ErcAccount, ErcBillingRecord' },
  { key: 'equipment', label: 'Оборудование и склад', desc: 'InventoryItem, Movement, Supplier...' },
  { key: 'settings', label: 'Системные настройки', desc: 'SystemSettings, Asterisk, Traccar...' },
];

const MigrationPage: React.FC = () => {
  const [selectedSections, setSelectedSections] = useState<string[]>(['clients', 'orders', 'users', 'buildings', 'tariffs', 'erc', 'equipment', 'settings']);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);
  const [exportInfo, setExportInfo] = useState<{ size_kb: number; sections_exported: string[] } | null>(null);
  const [dumpData, setDumpData] = useState<any>(null);
  const [previewData, setPreviewData] = useState<Array<{ section: string; model: string; count: number }>>([]);

  const toggleSection = (key: string) => {
    setSelectedSections(prev =>
      prev.includes(key) ? prev.filter(s => s !== key) : [...prev, key]
    );
  };

  const handleExport = async () => {
    if (selectedSections.length === 0) {
      message.warning('Выберите хотя бы одну секцию для экспорта');
      return;
    }
    setExporting(true);
    setImportResult(null);
    try {
      const res = await api.get('/system-settings/export_data/', {
        params: { sections: selectedSections.join(',') },
      });
      const data = res.data;
      setDumpData(data.dump);
      setExportInfo({ size_kb: data.size_kb, sections_exported: data.sections_exported });

      // Подготовка превью
      const preview: Array<{ section: string; model: string; count: number }> = [];
      const sections = data.dump.sections || {};
      for (const [secKey, models] of Object.entries(sections)) {
        for (const [modelName, rows] of Object.entries(models as Record<string, any[]>)) {
          preview.push({ section: secKey, model: modelName, count: rows.length });
        }
      }
      setPreviewData(preview);

      message.success(`Экспортировано ${data.size_kb} КБ, ${preview.reduce((s, p) => s + p.count, 0)} записей`);
    } catch (e: any) {
      message.error(`Ошибка экспорта: ${e?.response?.data?.error || e.message}`);
    } finally {
      setExporting(false);
    }
  };

  const handleDownload = () => {
    if (!dumpData) return;
    const blob = new Blob([JSON.stringify(dumpData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.href = url;
    a.download = `crm-dump-${ts}.json`;
    a.click();
    URL.revokeObjectURL(url);
    message.success('Файл скачан');
  };

  const handleImport = async (file: File) => {
    setImporting(true);
    setImportResult(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await api.post('/system-settings/import_data/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportResult(res.data);
      message.success(res.data.message || 'Импорт завершён');
    } catch (e: any) {
      const errMsg = e?.response?.data?.error || e.message;
      message.error(`Ошибка импорта: ${errMsg}`);
      setImportResult({ ok: false, error: errMsg });
    } finally {
      setImporting(false);
    }
    return false; // отменяем авто-загрузку antd Upload
  };

  // Настройки колонок для таблицы превью
  const previewColumns = [
    { title: 'Секция', dataIndex: 'section', key: 'section', width: 130,
      render: (s: string) => {
        const item = ALL_SECTIONS.find(x => x.key === s);
        return item ? item.label : s;
      }
    },
    { title: 'Модель', dataIndex: 'model', key: 'model', width: 220 },
    { title: 'Записей', dataIndex: 'count', key: 'count', width: 100,
      render: (c: number) => <Tag color={c > 0 ? 'blue' : 'default'}>{c}</Tag>
    },
  ];

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <Title level={3}>
        <ExportOutlined style={{ marginRight: 8 }} />
        Миграция данных
      </Title>
      <Paragraph type="secondary">
        Экспорт базы в JSON для переноса на другой сервер и импорт из JSON-дампа.
        Это позволяет «переехать» с сервера на сервер без потери данных.
      </Paragraph>

      <Alert
        type="warning"
        showIcon
        icon={<WarningOutlined />}
        style={{ marginBottom: 24 }}
        message="Внимание"
        description={
          <div>
            <Text>Импорт добавляет записи. Существующие записи (по уникальным ключам: username, account_number, name УК) обновляются. </Text>
            <Text strong>Рекомендуется:</Text>
            <ol style={{ margin: '8px 0 0 16px', paddingLeft: 0 }}>
              <li>Сначала сделайте экспорт на старом сервере → скачайте JSON.</li>
              <li>На новом сервере загрузите JSON через кнопку «Импорт».</li>
              <li>После импорта проверьте количество записей через Статистику.</li>
            </ol>
          </div>
        }
      />

      {/* Экспорт */}
      <Card
        title={<><ExportOutlined /> Экспорт данных</>}
        style={{ marginBottom: 24 }}
        extra={
          dumpData && (
            <Button icon={<DownloadOutlined />} onClick={handleDownload} type="primary" ghost>
              Скачать JSON
            </Button>
          )
        }
      >
        <Row gutter={[16, 8]}>
          {ALL_SECTIONS.map(s => (
            <Col xs={24} sm={12} md={8} lg={6} key={s.key}>
              <Checkbox
                checked={selectedSections.includes(s.key)}
                onChange={() => toggleSection(s.key)}
              >
                <Text strong>{s.label}</Text>
                <br />
                <Text type="secondary" style={{ fontSize: 12 }}>{s.desc}</Text>
              </Checkbox>
            </Col>
          ))}
        </Row>
        <Divider />
        <Space>
          <Button
            type="primary"
            icon={<ExportOutlined />}
            onClick={handleExport}
            loading={exporting}
            size="large"
          >
            Экспортировать выбранные секции
          </Button>
          <Button onClick={() => setSelectedSections(ALL_SECTIONS.map(s => s.key))}>
            Выбрать всё
          </Button>
          <Button onClick={() => setSelectedSections([])}>
            Снять всё
          </Button>
        </Space>

        {exportInfo && (
          <div style={{ marginTop: 16 }}>
            <Statistic
              title="Размер дампа"
              value={exportInfo.size_kb}
              suffix="КБ"
              valueStyle={{ color: '#1890ff' }}
            />
          </div>
        )}

        {previewData.length > 0 && (
          <Table
            dataSource={previewData}
            columns={previewColumns}
            rowKey={r => `${r.section}-${r.model}`}
            size="small"
            pagination={false}
            style={{ marginTop: 16 }}
            locale={{ emptyText: 'Нет данных' }}
          />
        )}
      </Card>

      {/* Импорт */}
      <Card title={<><ImportOutlined /> Импорт данных</>}>
        <Paragraph type="secondary">
          Загрузите JSON-файл, полученный при экспорте с другого сервера.
        </Paragraph>

        <Upload
          accept=".json"
          showUploadList={false}
          beforeUpload={handleImport}
          disabled={importing}
        >
          <Button
            icon={<UploadOutlined />}
            loading={importing}
            size="large"
            type="primary"
            danger
          >
            Выбрать JSON и импортировать
          </Button>
        </Upload>

        {importResult && (
          <div style={{ marginTop: 16 }}>
            {importResult.ok ? (
              <Alert
                type="success"
                showIcon
                icon={<CheckCircleOutlined />}
                message="Импорт завершён"
                description={
                  <Row gutter={16}>
                    <Col><Statistic title="Создано" value={importResult.created || 0} valueStyle={{ color: '#52c41a' }} /></Col>
                    <Col><Statistic title="Обновлено" value={importResult.updated || 0} valueStyle={{ color: '#1890ff' }} /></Col>
                    <Col><Statistic title="Ошибок" value={(importResult.errors || []).length} valueStyle={{ color: importResult.errors?.length > 0 ? '#ff4d4f' : '#52c41a' }} /></Col>
                  </Row>
                }
              />
            ) : (
              <Alert
                type="error"
                showIcon
                message="Ошибка импорта"
                description={importResult.error || 'Неизвестная ошибка'}
              />
            )}

            {importResult.errors?.length > 0 && (
              <div style={{ marginTop: 8, maxHeight: 200, overflow: 'auto' }}>
                {importResult.errors.slice(0, 20).map((err: string, idx: number) => (
                  <div key={idx} style={{ color: '#ff4d4f', fontSize: 12, fontFamily: 'monospace' }}>
                    {err}
                  </div>
                ))}
                {importResult.errors.length > 20 && (
                  <Text type="secondary">... и ещё {importResult.errors.length - 20} ошибок</Text>
                )}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};

export default MigrationPage;
