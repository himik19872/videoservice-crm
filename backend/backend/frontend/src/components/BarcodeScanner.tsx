import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Modal, Button, Input, Space, message, Typography, Divider } from 'antd';
import { ScanOutlined, CameraOutlined, AudioOutlined, EditOutlined, BarcodeOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface BarcodeScannerProps {
  visible: boolean;
  onClose: () => void;
  onScanned: (barcode: string) => void;
  onItemFound?: (item: any) => void;
  title?: string;
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({
  visible, onClose, onScanned, onItemFound, title = 'Сканировать штрих-код'
}) => {
  const [mode, setMode] = useState<'camera' | 'keyboard'>('camera');
  const [manualCode, setManualCode] = useState('');
  const [scanning, setScanning] = useState(false);
  const [scannerReady, setScannerReady] = useState(false);
  const scannerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastScannedRef = useRef<string>('');

  // Инициализация камеры
  useEffect(() => {
    if (!visible || mode !== 'camera') return;

    let Html5Qrcode: any = null;
    let mounted = true;

    const init = async () => {
      try {
        const mod = await import('html5-qrcode');
        Html5Qrcode = mod.Html5Qrcode;

        if (!mounted) return;

        // Убиваем старый сканер если есть
        if (scannerRef.current) {
          try {
            await scannerRef.current.stop();
            scannerRef.current.clear();
          } catch {}
        }

        const scanner = new Html5Qrcode('barcode-scanner-view');
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: 'environment' },
          { fps: 10, qrbox: { width: 250, height: 150 }, aspectRatio: 1.5 },
          (decodedText: string) => {
            // Дебаунс — не срабатывать дважды за секунду на один код
            if (decodedText === lastScannedRef.current) return;
            lastScannedRef.current = decodedText;

            onScanned(decodedText);
            message.success(`Считано: ${decodedText}`);

            // Авто-закрытие через 1с
            setTimeout(() => {
              if (mounted) {
                onClose();
              }
            }, 800);
          },
          () => {} // ошибки сканирования игнорируем
        );

        if (mounted) {
          setScannerReady(true);
          setScanning(true);
        }
      } catch (e) {
        console.error('Scanner init error:', e);
        if (mounted) {
          message.warning('Не удалось запустить камеру. Введите штрих-код вручную.');
          setMode('keyboard');
        }
      }
    };

    init();

    return () => {
      mounted = false;
      if (scannerRef.current) {
        try {
          scannerRef.current.stop().catch(() => {});
        } catch {}
        try {
          scannerRef.current.clear();
        } catch {}
      }
      scannerRef.current = null;
      lastScannedRef.current = '';
    };
  }, [visible, mode]);

  const handleManualSubmit = () => {
    const code = manualCode.trim();
    if (!code) {
      message.warning('Введите штрих-код');
      return;
    }
    lastScannedRef.current = code;
    onScanned(code);
    setManualCode('');
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleManualSubmit();
    }
  };

  // Авто-фокус для USB-сканера в режиме клавиатуры
  useEffect(() => {
    if (visible && mode === 'keyboard') {
      const timer = setTimeout(() => {
        const input = document.getElementById('barcode-manual-input');
        input?.focus();
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [visible, mode]);

  const handleClose = () => {
    if (scannerRef.current) {
      try { scannerRef.current.stop().catch(() => {}); } catch {}
      try { scannerRef.current.clear(); } catch {}
      scannerRef.current = null;
    }
    setScanning(false);
    setScannerReady(false);
    lastScannedRef.current = '';
    onClose();
  };

  return (
    <Modal
      title={title}
      open={visible}
      onCancel={handleClose}
      footer={null}
      width={520}
      destroyOnClose
    >
      <div style={{ textAlign: 'center', marginBottom: 16 }}>
        <Space>
          <Button
            type={mode === 'camera' ? 'primary' : 'default'}
            icon={<CameraOutlined />}
            onClick={() => setMode('camera')}
          >
            Камера
          </Button>
          <Button
            type={mode === 'keyboard' ? 'primary' : 'default'}
            icon={<EditOutlined />}
            onClick={() => setMode('keyboard')}
          >
            Вручную / USB
          </Button>
        </Space>
      </div>

      {mode === 'camera' ? (
        <div style={{ textAlign: 'center' }}>
          <div
            id="barcode-scanner-view"
            ref={containerRef}
            style={{ width: '100%', maxWidth: 400, margin: '0 auto', borderRadius: 8, overflow: 'hidden' }}
          />
          <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
            Наведите камеру на штрих-код товара
          </Text>
        </div>
      ) : (
        <div style={{ textAlign: 'center' }}>
          <BarcodeOutlined style={{ fontSize: 48, color: '#d9d9d9', marginBottom: 16 }} />
          <div style={{ display: 'flex', gap: 8, maxWidth: 350, margin: '0 auto' }}>
            <Input
              id="barcode-manual-input"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Отсканируйте USB-сканером или введите код..."
              size="large"
              autoFocus
              prefix={<BarcodeOutlined />}
            />
            <Button type="primary" onClick={handleManualSubmit} icon={<ScanOutlined />}>
              Найти
            </Button>
          </div>
          <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
            USB-сканер вставит код сам и нажмёт Enter
          </Text>
        </div>
      )}
    </Modal>
  );
};

export default BarcodeScanner;
