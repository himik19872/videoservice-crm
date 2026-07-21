import React, { useState } from 'react';
import { Upload, Card, Typography, Button, message, Alert, Progress, Tabs, Table, DatePicker } from 'antd';
import { InboxOutlined, ImportOutlined } from '@ant-design/icons';
import api from '../services/api';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

const StatBox: React.FC<{ label: string; value: number | string; color: string }> = ({ label, value, color }) => (
  <div style={{ background: '#fafafa', borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
    <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
    <div style={{ fontSize: 11, color: '#666', marginTop: 2 }}>{label}</div>
  </div>
);

interface ImportTabPreset {
  key: string; label: string; description: string; hint: string; endpoint: string; accept?: string;
}

const TABS: ImportTabPreset[] = [
  { key: 'agalatovo', label: '🏘️ ЕРЦ Агалатово', description: 'Оборотная ведомость ЕРЦ: № л/с, ФИО, нас.пункт, улица, дом, кв., сальдо.', hint: '05_ЕИРЦ Агалатово_май 2026.xlsx', endpoint: 'import/agalatovo/' },
  { key: 'kommunar', label: '🏙️ ЕРЦ Коммунар', description: 'Адрес в строке «Коммунар г, Бумажников ул, 2, 2». Автоопределение.', hint: '05_ЕИРЦ Коммунар_май 2026.xlsx', endpoint: 'import/kommunar/' },
  { key: 'lo', label: '🌲 ЕРЦ ЛО', description: 'Дебет/кредит. Адрес в строке. Всеволожский, Гатчинский, Ломоносовский р-ны.', hint: '05_ЕИРЦ ЛО_май 2026.xlsx', endpoint: 'import/lo/' },
  { key: 'spb', label: '🏛️ ЕРЦ СПб', description: 'Адрес «д..1 лит. А». 36 тыс. строк. Импорт ~10 мин.', hint: '05_ЕИРЦ СПб_май 2026.xlsx', endpoint: 'import/spb/' },
  { key: 'krasnoe', label: '🏘️ Красное Село', description: 'Квартира в кол.1, ФИО в кол.4, дом в заголовке.', hint: '05_Красное Село_май 2026.xlsx', endpoint: 'import/krasnoe/' },
  { key: 'str63', label: '📋 Стр.6-3', description: 'л/счет, ФИО, Адрес, начислено, оплачено, сальдо.', hint: '05_Стр.6-3.xlsx', endpoint: 'import/str63/' },
  { key: 'tszh', label: '🏢 ТСЖ Битрикс', description: '№ л/с, ФИО, Адрес, № парадной, ТСЖ. 24 тыс. строк.', hint: 'ТСЖ 2026 для Битрикс.xlsx', endpoint: 'import/tszh/' },
  { key: 'beward-ip', label: '🔌 Beward IP', description: 'Справочник IP: Район, Адрес, Подъезд, IP панели.', hint: 'адрес панели-ipвсе.xlsx', endpoint: 'import/beward-ip/' },
  { key: 'beward-codes', label: '🔑 Beward Коды', description: 'Коды доступа и программирования ключей.', hint: 'Все коды Бевард-Спутник-Рубитек.xlsx', endpoint: 'import/beward-codes/' },
  { key: 'erc-update', label: '🔄 Обновление ЕРЦ', description: 'Обновление сальдо, начислений и оплат по номеру лицевого счёта (без адреса). Выберите период.', hint: 'Любой файл ЕРЦ', endpoint: 'import/erc-update/' },
  { key: 'universal', label: '📋 Универсальный CSV', description: '19 колонок: city, region, district, street_name, house_number, building_number, apartment, entrance_number, full_name, personal_account, phone, source, source_file, period, balance_start, charged, paid, balance_end.', hint: 'CSV через внешний конвертер (dadata)', endpoint: 'import/clients-csv/', accept: '.csv' },
];

const ImportTab: React.FC<{ preset: ImportTabPreset }> = ({ preset }) => {
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [preview, setPreview] = useState<any[] | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [period, setPeriod] = useState<string>(dayjs().format('YYYY-MM-01'));
  const isCSV = preset.accept === '.csv';
  const isBeward = preset.key === 'beward-ip' || preset.key === 'beward-codes';
  const isErcUpdate = preset.key === 'erc-update';

  // Шаг 1: предпросмотр (или прямой импорт для Beward/CSV/ERC-update)
  const handlePreview = async (f: File) => {
    setFile(f); setLoading(true); setResult(null); setPreview(null);
    const fd = new FormData(); fd.append('file', f);
    if (isErcUpdate) {
      fd.append('period', period);
    }
    try {
      if (isBeward || isCSV || isErcUpdate) {
        // Прямой импорт без предпросмотра
        const res = await api.post(`/${preset.endpoint}`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' }, timeout: 600000,
        });
        if (res.data.success) {
          setResult(res.data);
          message.success(`Готово: +${res.data.created || res.data.clients_created || res.data.erc_created || 0}`);
        } else message.error(res.data.error || 'Ошибка');
      } else {
        const res = await api.post('/import/xlsx-preview/', fd, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        if (res.data.success) {
          setPreview(res.data.preview || []);
          message.success(`Предпросмотр: ${res.data.preview?.length || 0} строк. Проверьте и нажмите «Импортировать».`);
        } else message.error(res.data.error || 'Ошибка');
      }
    } catch (e: any) { message.error(e?.response?.data?.error || e?.message || 'Ошибка'); }
    setLoading(false); return false;
  };

  // Шаг 2: импорт в базу
  const handleImport = async () => {
    if (!file) return;
    setImporting(true); setResult(null);
    const fd = new FormData(); fd.append('file', file);
    try {
      const res = await api.post(`/${preset.endpoint}`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' }, timeout: 600000,
      });
      if (res.data.success) {
        setResult(res.data);
        message.success(`Импорт: +${res.data.clients_created || res.data.created || 0} создано, ~${res.data.clients_updated || 0} обновлено`);
      } else message.error(res.data.error || 'Ошибка');
    } catch (e: any) { message.error(e?.response?.data?.error || e?.message || 'Ошибка'); }
    setImporting(false);
  };

  return (
    <div>
      <Alert type="info" showIcon style={{ marginBottom: 16 }}
        message={<div style={{ fontSize: 13 }}>{preset.description}<br/><Text type="secondary">{preset.hint}</Text></div>} />
      {isErcUpdate && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Text strong>Период начислений:</Text>
            <DatePicker
              picker="month"
              value={dayjs(period)}
              onChange={(d) => d && setPeriod(d.format('YYYY-MM-01'))}
              format="MMMM YYYY"
              allowClear={false}
            />
            <Text type="secondary">Все записи будут обновлены на 1-е число выбранного месяца</Text>
          </div>
        </Card>
      )}
      <Card>
        <Upload.Dragger accept={preset.accept || '.xlsx,.xls'} beforeUpload={handlePreview} showUploadList={false} disabled={loading}>
          <p className="ant-upload-drag-icon">{loading ? <Progress type="circle" percent={99} size={48} /> : <InboxOutlined />}</p>
          <p className="ant-upload-text">{loading ? 'Анализируем...' : preview ? 'Загрузите файл снова чтобы обновить' : 'Нажмите или перетащите файл'}</p>
          {preset.key === 'universal' && <Button type="link" size="small" onClick={() => window.open('/api/import/sample-csv/', '_blank')}>📥 Образец CSV</Button>}
        </Upload.Dragger>
      </Card>
      {preview && preview.length > 0 && (
        <Card title={`Предпросмотр (${preview.length} строк)`} size="small" style={{ marginTop: 16 }}
          extra={!isCSV && <Button type="primary" size="large" icon={<ImportOutlined />} onClick={handleImport} loading={importing}>Импортировать в базу</Button>}>
          <Table dataSource={preview.map((r: any, i: number) => ({ ...r, _k: i }))}
            columns={Object.keys(preview[0] || {}).filter(k => !k.startsWith('_')).map(k => ({ title: k, dataIndex: k, key: k, ellipsis: true, render: (v: any) => <span style={{ fontSize: 11 }}>{String(v ?? '')}</span> }))}
            size="small" scroll={{ x: 'max-content' }} pagination={{ pageSize: 10, size: 'small' }} rowKey="_k" />
        </Card>
      )}
      {result && (
        <Card style={{ marginTop: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(135px, 1fr))', gap: 10 }}>
            {result.total_rows != null && <StatBox label="Всего строк" value={result.total_rows} color="#1677ff" />}
            {result.clients_created != null && <StatBox label="Клиентов +" value={result.clients_created} color="#52c41a" />}
            {result.clients_updated != null && <StatBox label="Клиентов ~" value={result.clients_updated} color="#1677ff" />}
            {result.buildings_created != null && <StatBox label="Домов +" value={result.buildings_created} color="#722ed1" />}
            {result.entrances_created != null && <StatBox label="Подъездов +" value={result.entrances_created} color="#13c2c2" />}
            {result.dormitories != null && <StatBox label="Общежитий" value={result.dormitories} color="#eb2f96" />}
            {result.erc_created != null && <StatBox label="ЕРЦ +" value={result.erc_created} color="#fa8c16" />}
            {result.erc_updated != null && <StatBox label="ЕРЦ ~" value={result.erc_updated} color="#fa8c16" />}
            {result.created != null && <StatBox label="Создано" value={result.created} color="#52c41a" />}
            {result.skipped != null && <StatBox label="Пропущено" value={result.skipped} color="#faad14" />}
            {result.no_building != null && <StatBox label="Без дома" value={result.no_building} color="#ff4d4f" />}
          </div>
          {result.errors?.length > 0 && <Alert type="warning" style={{ marginTop: 12 }} message={`Ошибок: ${result.errors.length}`}
            description={<ul style={{ margin: 0, paddingLeft: 20, maxHeight: 150, overflow: 'auto' }}>{result.errors.slice(0, 15).map((e: string, i: number) => <li key={i} style={{ fontSize: 12 }}>{e}</li>)}</ul>} />}
        </Card>
      )}
    </div>
  );
};

const ImportPage: React.FC = () => (
  <div style={{ maxWidth: 1050, margin: '0 auto' }}>
    <Title level={3}><ImportOutlined /> Импорт данных</Title>
    <Tabs defaultActiveKey="agalatovo" tabPosition="left" style={{ minHeight: 400 }}
      items={TABS.map(p => ({ key: p.key, label: <span style={{ fontSize: 13 }}>{p.label}</span>, children: <ImportTab preset={p} /> }))}
    />
  </div>
);

export default ImportPage;
