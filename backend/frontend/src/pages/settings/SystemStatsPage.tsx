import React, { useState, useEffect } from 'react';
import { Card, Typography, Button, Space, Divider, message, Statistic, Row, Col, Progress, InputNumber, Popconfirm, Spin } from 'antd';
import { DownloadOutlined, DeleteOutlined, ReloadOutlined, HddOutlined, FileImageOutlined, DatabaseOutlined } from '@ant-design/icons';
import api from '../../services/api';

const { Title, Text } = Typography;

interface SystemStats {
  disk_total_gb: number;
  disk_used_gb: number;
  disk_free_gb: number;
  media_count: number;
  media_size_mb: number;
  media_path: string;
  db_size_mb: number;
}

const SystemStatsPage: React.FC = () => {
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [cleanupDays, setCleanupDays] = useState<number>(90);
  const [exporting, setExporting] = useState(false);
  const [cleaning, setCleaning] = useState(false);

  useEffect(() => { fetchStats(); }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await api.get('/system/stats/');
      setStats(res.data);
    } catch (e) {
      message.error('Ошибка загрузки статистики');
    } finally { setLoading(false); }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await api.get('/system/export-clients/', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'clients_export.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      message.success('Экспорт готов');
    } catch (e) {
      message.error('Ошибка экспорта');
    } finally { setExporting(false); }
  };

  const handleCleanup = async (deleteAll: boolean = false) => {
    setCleaning(true);
    try {
      const res = await api.post('/system/cleanup-media/', deleteAll ? { delete_all: true } : { days: cleanupDays });
      message.success(`Удалено файлов: ${res.data.deleted_count}, освобождено: ${res.data.deleted_size_mb} МБ`);
      fetchStats();
    } catch (e) {
      message.error('Ошибка очистки');
    } finally { setCleaning(false); }
  };

  const diskUsedPct = stats ? Math.round((stats.disk_used_gb / stats.disk_total_gb) * 100) : 0;

  return (
    <div style={{ maxWidth: 900 }}>
      <Title level={3}><HddOutlined /> Системная статистика</Title>

      <Spin spinning={loading}>
        {/* Диск */}
        <Card title="💾 Дисковое пространство" style={{ marginBottom: 16 }}>
          <Row gutter={24}>
            <Col span={8}><Statistic title="Всего" value={stats?.disk_total_gb || 0} suffix="ГБ" /></Col>
            <Col span={8}><Statistic title="Занято" value={stats?.disk_used_gb || 0} suffix="ГБ" /></Col>
            <Col span={8}><Statistic title="Свободно" value={stats?.disk_free_gb || 0} suffix="ГБ" valueStyle={{ color: '#52c41a' }} /></Col>
          </Row>
          <Progress percent={diskUsedPct} strokeColor={diskUsedPct > 80 ? '#ff4d4f' : '#1677ff'} style={{ marginTop: 12 }} />
        </Card>

        {/* Медиа */}
        <Card title={<><FileImageOutlined /> Медиафайлы (фото/видео отчёты)</>} style={{ marginBottom: 16 }}>
          <Row gutter={24}>
            <Col span={8}><Statistic title="Файлов" value={stats?.media_count || 0} /></Col>
            <Col span={8}><Statistic title="Размер" value={stats?.media_size_mb || 0} suffix="МБ" /></Col>
            <Col span={8}><Statistic title="База данных" value={stats?.db_size_mb || 0} suffix="МБ" /></Col>
          </Row>
          <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>Путь: {stats?.media_path || '—'}</Text>

          <Divider />

          <Space direction="vertical" style={{ width: '100%' }}>
            <Text strong>Очистка медиафайлов:</Text>
            <Space>
              <Text>Удалить файлы старше</Text>
              <InputNumber min={1} max={3650} value={cleanupDays} onChange={v => setCleanupDays(v || 90)} style={{ width: 80 }} />
              <Text>дней</Text>
              <Popconfirm title={`Удалить файлы старше ${cleanupDays} дней?`} onConfirm={() => handleCleanup(false)}>
                <Button icon={<DeleteOutlined />} loading={cleaning} danger>
                  Очистить по сроку
                </Button>
              </Popconfirm>
            </Space>

            <Popconfirm title="Удалить ВСЕ медиафайлы? Это необратимо!" onConfirm={() => handleCleanup(true)}>
              <Button icon={<DeleteOutlined />} loading={cleaning} danger type="primary">
                Удалить все медиафайлы
              </Button>
            </Popconfirm>
          </Space>
        </Card>

        {/* Экспорт */}
        <Card title="📥 Экспорт данных" style={{ marginBottom: 16 }}>
          <Space>
            <Button type="primary" icon={<DownloadOutlined />} onClick={handleExport} loading={exporting}>
              Экспорт клиентов в Excel
            </Button>
            <Text type="secondary">Все поля: ФИО, телефон, адрес, л/счет, УК, источник</Text>
          </Space>
        </Card>

        <Button icon={<ReloadOutlined />} onClick={fetchStats}>Обновить</Button>
      </Spin>
    </div>
  );
};

export default SystemStatsPage;
