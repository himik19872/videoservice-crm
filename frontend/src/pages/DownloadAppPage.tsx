import React, { useState, useEffect } from 'react';
import { Card, Typography, Button, Space, Spin, Alert, Descriptions, Tag, Divider } from 'antd';
import { DownloadOutlined, AndroidOutlined, AppleOutlined, QrcodeOutlined } from '@ant-design/icons';
import { QRCodeSVG } from 'qrcode.react';
import api from '../services/api';

const { Title, Text, Paragraph } = Typography;

const DownloadAppPage: React.FC = () => {
  const [latestVersion, setLatestVersion] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchLatestVersion();
  }, []);

  const fetchLatestVersion = async () => {
    setLoading(true);
    try {
      // Пробуем через API (если пользователь авторизован)
      const res = await api.get('/app-versions/?platform=android&is_active=true&ordering=-version_code&page_size=1');
      const items = res.data.results || res.data;
      if (items.length > 0) {
        setLatestVersion(items[0]);
      }
    } catch (e) {
      // Не авторизован — используем версию по умолчанию
      setLatestVersion({
        id: 1,
        version: '1.0.1',
        version_code: 2,
        file_size: 96461936,
        changelog: '- Исправлен чат: нижняя панель не перекрывается системными кнопками\n- Добавлена авто-проверка обновлений\n- Кнопка ручной проверки в шапке',
        created_at: '2026-07-29',
        platform_display: 'Android',
      });
    } finally {
      setLoading(false);
    }
  };

  // Прямая ссылка на скачивание последней версии (публичный endpoint)
  const downloadUrl = latestVersion?.id
    ? `/api/app-versions/${latestVersion.id}/download/`
    : '/api/app-versions/1/download/';

  // Полный URL для QR-кода (берём текущий origin)
  const fullDownloadUrl = `${window.location.origin}${downloadUrl}`;

  const formatBytes = (bytes: number) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} Б`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <Spin size="large" />
        <div style={{ marginTop: 16, color: '#888' }}>Загрузка...</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '24px 16px' }}>
      <Card>
        <Space direction="vertical" size="large" style={{ width: '100%', textAlign: 'center' }}>
          <div>
            <AndroidOutlined style={{ fontSize: 48, color: '#3DDC84' }} />
            <Title level={2} style={{ marginTop: 12, marginBottom: 4 }}>
              Мобильное приложение CRM
            </Title>
            <Text type="secondary">
              Видео Сервис — управление заявками, GPS-трекинг, склад
            </Text>
          </div>

          {latestVersion && (
            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label="Версия">
                <Tag color="blue">v{latestVersion.version}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Размер">
                {formatBytes(latestVersion.file_size)}
              </Descriptions.Item>
              <Descriptions.Item label="Дата выпуска">
                {new Date(latestVersion.created_at).toLocaleDateString('ru-RU')}
              </Descriptions.Item>
              {latestVersion.changelog && (
                <Descriptions.Item label="Что нового">
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13 }}>
                    {latestVersion.changelog}
                  </pre>
                </Descriptions.Item>
              )}
            </Descriptions>
          )}

          <Divider />

          {/* QR-код */}
          <div style={{ background: '#fff', padding: 20, borderRadius: 12, display: 'inline-block' }}>
            <QRCodeSVG
              value={fullDownloadUrl}
              size={200}
              level="M"
              includeMargin
            />
            <div style={{ marginTop: 8, color: '#888', fontSize: 12 }}>
              <QrcodeOutlined /> Наведите камеру для скачивания
            </div>
          </div>

          <Divider />

          {/* Кнопки скачивания */}
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Button
              type="primary"
              size="large"
              icon={<AndroidOutlined />}
              href={downloadUrl}
              block
              style={{ height: 48, fontSize: 16 }}
            >
              Скачать для Android (.apk)
            </Button>

            <Button
              size="large"
              icon={<AppleOutlined />}
              disabled
              block
              style={{ height: 48, fontSize: 16 }}
            >
              iOS — скоро
            </Button>
          </Space>

          {error && (
            <Alert
              type="warning"
              message={error}
              showIcon
              style={{ marginTop: 12 }}
            />
          )}

          <Divider />

          <div style={{ color: '#888', fontSize: 13 }}>
            <Paragraph>
              <Text type="secondary">
                После скачивания APK-файла откройте его на устройстве для установки.
                Может потребоваться разрешить установку из неизвестных источников
                в настройках безопасности.
              </Text>
            </Paragraph>
            <Paragraph>
              <Text type="secondary">
                Приложение автоматически проверяет наличие обновлений при запуске
                и предлагает установить новую версию.
              </Text>
            </Paragraph>
            <Paragraph>
              <Text type="secondary">
                Системные требования: Android 5.0+, GPS, доступ в интернет.
              </Text>
            </Paragraph>
          </div>
        </Space>
      </Card>
    </div>
  );
};

export default DownloadAppPage;
