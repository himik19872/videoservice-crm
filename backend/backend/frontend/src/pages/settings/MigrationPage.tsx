import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Card, Checkbox, Button, Typography, message, Space, Divider, Alert,
  Spin, Row, Col, Statistic, Upload, Table, Tag, Input, Progress, Tabs,
} from 'antd';
import {
  ExportOutlined, ImportOutlined, DownloadOutlined,
  UploadOutlined, InfoCircleOutlined, CheckCircleOutlined,
  WarningOutlined, CloudServerOutlined, SyncOutlined,
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
  const [activeTab, setActiveTab] = useState<string>('file');

  // ── Прямой перенос ──
  const [remoteHost, setRemoteHost] = useState('');
  const [remotePort, setRemotePort] = useState('8000');
  const [remoteUser, setRemoteUser] = useState('admin');
  const [remotePass, setRemotePass] = useState('admin123');
  const [migrating, setMigrating] = useState(false);
  const [migrateStatus, setMigrateStatus] = useState<any>(null);
  const pollRef = useRef<any>(null);

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
    return false;
  };

  // ── Прямой перенос ──
  const pollStatus = useCallback(async () => {
    try {
      const r = await api.get('/system/migrate/status/');
      setMigrateStatus(r.data);
      if (!r.data.running && r.data.finished) {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        setMigrating(false);
        message.success(`Перенос завершён: ${r.data.created} записей`);
      }
    } catch {}
  }, []);

  const handleStartMigration = async () => {
    if (!remoteHost.trim()) { message.warning('Введите IP-адрес сервера-источника'); return; }
    if (!remoteUser.trim()) { message.warning('Введите логин от сервера-источника'); return; }
    if (selectedSections.length === 0) { message.warning('Выберите хотя бы одну секцию'); return; }
    setMigrating(true);
    setMigrateStatus({ running: true, progress: 0, total: 0, current_step: 'Запуск...', created: 0, errors: [], log: [] });
    try {
      const r = await api.post('/system/migrate/start/', {
        host: remoteHost.trim(), port: remotePort,
        username: remoteUser.trim(), password: remotePass,
        sections: selectedSections,
      });
      if (r.data.success) {
        message.success('Перенос запущен');
        pollRef.current = setInterval(pollStatus, 800);
      } else {
        message.error(r.data.error || 'Ошибка запуска');
        setMigrating(false);
      }
    } catch (e: any) { message.error(e?.response?.data?.error || e.message); setMigrating(false); }
  };

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

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
        Перенос базы на другой сервер: через JSON-файл или напрямую по сети.
      </Paragraph>

      <Tabs activeKey={activeTab} onChange={setActiveTab} items={[
        // ── Вкладка: Прямой перенос ──
        {
          key: 'direct',
          label: <span><CloudServerOutlined /> Прямой перенос</span>,
          children: (
            <>
              <Alert type="info" showIcon style={{ marginBottom: 16 }}
                message="Перенос данных напрямую с другого сервера по HTTP. Оба сервера должны быть в одной сети." />

              <Card title="Сервер-источник" size="small" style={{ marginBottom: 16 }}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Space>
                    <Input
                      addonBefore="IP"
                      placeholder="192.168.1.100"
                      value={remoteHost}
                      onChange={e => setRemoteHost(e.target.value)}
                      style={{ width: 180 }}
                      disabled={migrating}
                    />
                    <Input
                      addonBefore="Порт"
                      value={remotePort}
                      onChange={e => setRemotePort(e.target.value)}
                      style={{ width: 120 }}
                      disabled={migrating}
                    />
                  </Space>
                  <Space>
                    <Input
                      addonBefore="Логин"
                      value={remoteUser}
                      onChange={e => setRemoteUser(e.target.value)}
                      style={{ width: 180 }}
                      disabled={migrating}
                    />
                    <Input.Password
                      addonBefore="Пароль"
                      value={remotePass}
                      onChange={e => setRemotePass(e.target.value)}
                      style={{ width: 200 }}
                      disabled={migrating}
                    />
                  </Space>
                </Space>
              </Card>

              <Card title="Выберите данные для переноса" size="small" style={{ marginBottom: 16 }}>
                <Row gutter={[16, 8]}>
                  {ALL_SECTIONS.map(s => (
                    <Col xs={24} sm={12} md={8} lg={6} key={s.key}>
                      <Checkbox
                        checked={selectedSections.includes(s.key)}
                        onChange={() => toggleSection(s.key)}
                        disabled={migrating}
                      >
                        <Text strong>{s.label}</Text><br />
                        <Text type="secondary" style={{ fontSize: 11 }}>{s.desc}</Text>
                      </Checkbox>
                    </Col>
                  ))}
                </Row>
                <Divider />
                <Button
                  type="primary"
                  size="large"
                  icon={<SyncOutlined spin={migrating} />}
                  onClick={handleStartMigration}
                  loading={migrating && !migrateStatus?.current_model}
                  disabled={migrating}
                >
                  {migrating ? 'Перенос...' : 'Начать перенос'}
                </Button>
              </Card>

              {migrateStatus && (
                <Card title="Прогресс переноса" style={{ marginBottom: 16 }}>
                  <Progress
                    percent={migrateStatus.total > 0
                      ? Math.round(migrateStatus.progress / migrateStatus.total * 100)
                      : 0}
                    status={migrateStatus.finished ? 'success' : migrateStatus.errors?.length > 0 ? 'exception' : 'active'}
                    format={p => `${p}% (${migrateStatus.progress || 0}/${migrateStatus.total || 0})`}
                  />
                  <Row gutter={16} style={{ marginTop: 12 }}>
                    <Col span={8}>
                      <Statistic title="Модель" value={migrateStatus.current_model || '—'} valueStyle={{ fontSize: 14 }} />
                    </Col>
                    <Col span={8}>
                      <Statistic title="Перенесено" value={migrateStatus.created || 0} valueStyle={{ color: '#52c41a', fontSize: 14 }} />
                    </Col>
                    <Col span={8}>
                      <Statistic title="Ошибок" value={(migrateStatus.errors || []).length}
                        valueStyle={{ color: migrateStatus.errors?.length > 0 ? '#ff4d4f' : '#52c41a', fontSize: 14 }} />
                    </Col>
                  </Row>

                  {migrateStatus.log?.length > 0 && (
                    <div style={{ marginTop: 12, maxHeight: 200, overflow: 'auto', background: '#fafafa', borderRadius: 6, padding: 8 }}>
                      {migrateStatus.log.map((line: string, i: number) => (
                        <div key={i} style={{ fontSize: 12, fontFamily: 'monospace', color: line.startsWith('✗') ? '#ff4d4f' : '#52c41a' }}>
                          {line}
                        </div>
                      ))}
                    </div>
                  )}

                  {migrateStatus.errors?.length > 0 && (
                    <div style={{ marginTop: 8, maxHeight: 150, overflow: 'auto' }}>
                      {migrateStatus.errors.slice(0, 20).map((err: string, idx: number) => (
                        <div key={idx} style={{ color: '#ff4d4f', fontSize: 11, fontFamily: 'monospace' }}>{err}</div>
                      ))}
                    </div>
                  )}
                </Card>
              )}
            </>
          ),
        },
        // ── Вкладка: JSON-файл ──
        {
          key: 'file',
          label: <span><ImportOutlined /> Импорт из файла</span>,
          children: (
            <>
              <Alert type="warning" showIcon icon={<WarningOutlined />} style={{ marginBottom: 24 }}
                message="Внимание"
                description={<div><Text>Импорт добавляет/обновляет записи. Сначала сделайте экспорт на старом сервере → скачайте JSON → загрузите здесь.</Text></div>} />

              <Card title={<><ExportOutlined /> Экспорт данных</>} style={{ marginBottom: 24 }}
                extra={dumpData && <Button icon={<DownloadOutlined />} onClick={handleDownload} type="primary" ghost>Скачать JSON</Button>}>
                <Row gutter={[16, 8]}>
                  {ALL_SECTIONS.map(s => (
                    <Col xs={24} sm={12} md={8} lg={6} key={s.key}>
                      <Checkbox checked={selectedSections.includes(s.key)} onChange={() => toggleSection(s.key)}>
                        <Text strong>{s.label}</Text><br /><Text type="secondary" style={{ fontSize: 12 }}>{s.desc}</Text>
                      </Checkbox>
                    </Col>
                  ))}
                </Row>
                <Divider />
                <Space>
                  <Button type="primary" icon={<ExportOutlined />} onClick={handleExport} loading={exporting} size="large">Экспортировать</Button>
                  <Button onClick={() => setSelectedSections(ALL_SECTIONS.map(s => s.key))}>Выбрать всё</Button>
                  <Button onClick={() => setSelectedSections([])}>Снять всё</Button>
                </Space>
                {exportInfo && <div style={{ marginTop: 16 }}><Statistic title="Размер дампа" value={exportInfo.size_kb} suffix="КБ" valueStyle={{ color: '#1890ff' }} /></div>}
                {previewData.length > 0 && (
                  <Table dataSource={previewData} columns={previewColumns} rowKey={r => `${r.section}-${r.model}`} size="small" pagination={false} style={{ marginTop: 16 }} />
                )}
              </Card>

              <Card title={<><ImportOutlined /> Импорт из файла</>}>
                <Upload accept=".json" showUploadList={false} beforeUpload={handleImport} disabled={importing}>
                  <Button icon={<UploadOutlined />} loading={importing} size="large" type="primary" danger>Выбрать JSON и импортировать</Button>
                </Upload>
                {importResult && (
                  <div style={{ marginTop: 16 }}>
                    {importResult.ok ? (
                      <Alert type="success" showIcon icon={<CheckCircleOutlined />} message="Импорт завершён"
                        description={<Row gutter={16}><Col><Statistic title="Создано" value={importResult.created || 0} valueStyle={{ color: '#52c41a' }} /></Col><Col><Statistic title="Обновлено" value={importResult.updated || 0} valueStyle={{ color: '#1890ff' }} /></Col><Col><Statistic title="Ошибок" value={(importResult.errors || []).length} valueStyle={{ color: importResult.errors?.length > 0 ? '#ff4d4f' : '#52c41a' }} /></Col></Row>} />
                    ) : (
                      <Alert type="error" showIcon message="Ошибка импорта" description={importResult.error || 'Неизвестная ошибка'} />
                    )}
                  </div>
                )}
              </Card>
            </>
          ),
        },
      ]} />
    </div>
  );
};

export default MigrationPage;
