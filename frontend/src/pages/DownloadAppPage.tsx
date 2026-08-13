import React, { useState, useEffect } from 'react';
import { Card, Typography, Button, Spin, Divider } from 'antd';
import { DownloadOutlined, AndroidOutlined, PrinterOutlined, WifiOutlined, CameraOutlined, EnvironmentOutlined, ToolOutlined, CommentOutlined } from '@ant-design/icons';
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
      const res = await api.get('/app-versions/?platform=android&is_active=true&ordering=-version_code&page_size=1');
      const items = res.data.results || res.data;
      if (items.length > 0) {
        setLatestVersion(items[0]);
      }
    } catch (e) {
      // Не авторизован — запасная версия (должна совпадать с активной в БД)
      setLatestVersion({
        id: 11, version: '1.0.5', version_code: 11, file_size: 96480900, created_at: '2026-08-13', platform_display: 'Android',
        changelog: '- 🎒 Вкладка «Мой ЗИП»: список материалов, числящихся за мастером\n- 🏭/🎒 Источник выдачи: бейдж «Склад» или «ЗИП» в карточке заявки\n- 📚 Wiki: инструкции по категориям, встроенный просмотр PDF и изображений\n- 💾 Кеширование: файлы скачиваются один раз, потом из памяти телефона\n- 🗺 Яндекс.Навигатор: маршрут строится по адресу заявки\n- 🏠 Время визита клиента (по умолчанию 09:00–18:00)\n- Заявки на будущее видны мастеру',
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadUrl = latestVersion?.id
    ? `/api/app-versions/${latestVersion.id}/download/`
    : '/api/app-versions/1/download/';

  // QR-код должен использовать внешний IP (телефон не в локальной сети)
  const externalIp = '83.243.73.86';
  const externalPort = '3000';
  const fullDownloadUrl = `http://${externalIp}:${externalPort}${downloadUrl}`;

  const formatBytes = (bytes: number) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} Б`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /><div style={{ marginTop: 16 }}>Загрузка...</div></div>;
  }

  return (
    <div className="download-page" style={{ maxWidth: 800, margin: '0 auto', padding: '24px 16px' }}>
      {/* Кнопка печати (скрыта при печати) */}
      <div className="no-print" style={{ textAlign: 'right', marginBottom: 12 }}>
        <Button icon={<PrinterOutlined />} onClick={handlePrint} size="small">
          🖨️ Распечатать инструкцию
        </Button>
      </div>

      <Card>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <AndroidOutlined style={{ fontSize: 48, color: '#3DDC84' }} />
          <Title level={2} style={{ marginTop: 8, marginBottom: 4 }}>
            Мобильное приложение CRM «Видео Сервис»
          </Title>
          <Text type="secondary" style={{ fontSize: 14 }}>
            Управление заявками, GPS-трекинг, склад, фотоотчёты — всё в вашем телефоне
          </Text>

          <div style={{ marginTop: 16 }} className="no-print">
            <Button
              type="primary"
              size="large"
              icon={<DownloadOutlined />}
              href={downloadUrl}
              style={{ height: 48, fontSize: 16, padding: '0 40px' }}
            >
              📥 Скачать v{latestVersion?.version || '1.0.5'} ({formatBytes(latestVersion?.file_size || 0)})
            </Button>
            <div style={{ marginTop: 6 }}>
              <Text type="secondary" style={{ fontSize: 11 }}>Android 5.0+ • {formatBytes(latestVersion?.file_size || 0)}</Text>
            </div>
          </div>

          {/* Что нового */}
          {latestVersion?.changelog && (
            <div style={{ marginTop: 16, textAlign: 'left', background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 8, padding: 12 }}>
              <Text strong style={{ display: 'block', marginBottom: 6 }}>🆕 Что нового в v{latestVersion.version}:</Text>
              <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 13, lineHeight: '1.6' }}>
                {latestVersion.changelog}
              </pre>
            </div>
          )}

          {/* QR-код — виден и на экране, и при печати */}
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <div style={{ background: '#fff', padding: 16, borderRadius: 12, display: 'inline-block', border: '1px solid #eee' }}>
              <QRCodeSVG
                value={fullDownloadUrl}
                size={180}
                level="M"
                includeMargin
              />
              <div style={{ marginTop: 6, fontSize: 11, color: '#888' }}>
                📱 Наведите камеру или сканер QR-кода для скачивания
              </div>
            </div>
          </div>
        </div>

        <Divider />

        {/* Как установить */}
        <Title level={4}>📱 Как установить</Title>
        <ol style={{ paddingLeft: 18, lineHeight: '1.8' }}>
          <li>Нажмите кнопку <strong>«Скачать»</strong> выше — загрузится APK-файл.</li>
          <li>Откройте скачанный файл на устройстве.</li>
          <li>Если появится предупреждение — разрешите установку из <strong>неизвестных источников</strong> (Настройки → Безопасность).</li>
          <li>После установки откройте приложение и войдите под своим логином/паролем.</li>
        </ol>

        <Divider />

        {/* Возможности */}
        <Title level={4}>⚡ Возможности приложения</Title>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
          <ToolOutlined style={{ fontSize: 22, color: '#1677ff', marginTop: 2 }} />
          <div>
            <Text strong>Работа с заявками</Text>
            <Paragraph style={{ marginBottom: 0, color: '#555' }}>
              Просмотр списка заявок, принятие в работу, смена статусов (начал, на паузе, завершил).
              Поиск по номеру заявки или имени клиента. Фильтр активные/все.
            </Paragraph>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
          <EnvironmentOutlined style={{ fontSize: 22, color: '#52c41a', marginTop: 2 }} />
          <div>
            <Text strong>Навигация и маршрут</Text>
            <Paragraph style={{ marginBottom: 0, color: '#555' }}>
              Адрес заявки отображается на экране. Нажмите на адрес — откроется <strong>Яндекс.Навигатор</strong> (или 2GIS)
              и автоматически построит маршрут до клиента.
            </Paragraph>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
          <CameraOutlined style={{ fontSize: 22, color: '#fa8c16', marginTop: 2 }} />
          <div>
            <Text strong>Фото- и видеоотчёт</Text>
            <Paragraph style={{ marginBottom: 0, color: '#555' }}>
              Если заявка требует фотоотчёта — в карточке заявки будет метка 📸.
              Можно сделать фото/видео прямо из приложения (камера или галерея),
              добавить подпись к каждому файлу. Все материалы сохраняются на сервере.
            </Paragraph>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
          <WifiOutlined style={{ fontSize: 22, color: '#722ed1', marginTop: 2 }} />
          <div>
            <Text strong>Офлайн-режим</Text>
            <Paragraph style={{ marginBottom: 0, color: '#555' }}>
              Приложение работает <strong>без интернета</strong>. Заявки кешируются на устройстве.
              Можно принимать/завершать заявки офлайн — при появлении сети данные автоматически синхронизируются.
              Вверху экрана будет жёлтая плашка «📴 Офлайн-режим».
            </Paragraph>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
          <CommentOutlined style={{ fontSize: 22, color: '#13c2c2', marginTop: 2 }} />
          <div>
            <Text strong>Чат с диспетчером</Text>
            <Paragraph style={{ marginBottom: 0, color: '#555' }}>
              Встроенный чат для связи с офисом. Можно задать вопрос, уточнить детали заявки,
              сообщить о проблеме — диспетчер увидит сообщение сразу.
            </Paragraph>
          </div>
        </div>

        <Divider />

        {/* Как работать */}
        <Title level={4}>📋 Порядок работы мастера</Title>
        <ol style={{ paddingLeft: 18, lineHeight: '2' }}>
          <li><strong>Откройте приложение</strong> — вы увидите список своих заявок.</li>
          <li><strong>Выберите заявку</strong> — нажмите на неё, чтобы открыть карточку.</li>
          <li>В карточке заявки: адрес, телефон клиента (нажмите чтобы позвонить), описание проблемы.</li>
          <li><strong>Постройте маршрут</strong> — нажмите на адрес, откроется навигатор.</li>
          <li><strong>Примите заявку</strong> — нажмите «Принять».</li>
          <li><strong>Начните работу</strong> — нажмите «Начать», когда приступили к ремонту/монтажу.</li>
          <li><strong>Сделайте фотоотчёт</strong> (если требуется) — вкладка «📸 Медиа», кнопка «+».</li>
          <li><strong>Завершите заявку</strong> — нажмите «Завершить».</li>
          <li>Примите оплату от клиента и внесите сумму в приложении.</li>
        </ol>

        <Divider />

        {/* Системные требования */}
        <Title level={4}>💻 Системные требования</Title>
        <ul style={{ paddingLeft: 18, lineHeight: '1.8', color: '#555' }}>
          <li>Android 5.0 и выше</li>
          <li>GPS / ГЛОНАСС для отслеживания местоположения</li>
          <li>Доступ в интернет (мобильный или Wi-Fi)</li>
          <li>Камера для фотоотчётов</li>
          <li>~100 МБ свободного места</li>
        </ul>

        <Divider />

        {/* Обновления */}
        <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 8, padding: 12 }}>
          <Text strong>🔄 Автообновление:</Text>{' '}
          <Text>Приложение автоматически проверяет наличие новой версии при запуске и предлагает установить обновление.</Text>
        </div>

        {/* Кнопка скачивания внизу */}
        <div className="no-print" style={{ textAlign: 'center', marginTop: 24 }}>
          <Button
            type="primary"
            size="large"
            icon={<DownloadOutlined />}
            href={downloadUrl}
            block
            style={{ height: 48, fontSize: 16 }}
          >
            📥 Скачать Android-приложение v{latestVersion?.version || '1.0.5'}
          </Button>
        </div>
      </Card>

      {/* Стили для печати */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { font-size: 11pt; color: #000; }
          .ant-card { box-shadow: none !important; border: none !important; }
          .ant-divider { margin: 8px 0 !important; }
          .ant-typography h2 { font-size: 16pt !important; }
          .ant-typography h4 { font-size: 12pt !important; }
          .download-page { max-width: 100% !important; padding: 0 !important; }
        }
      `}</style>
    </div>
  );
};

export default DownloadAppPage;
