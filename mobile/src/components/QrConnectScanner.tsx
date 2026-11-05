import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Alert, Platform } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { parseConnectPayload, ConnectPayload } from '../utils/connectPayload';

interface Props {
  visible: boolean;
  onClose: () => void;
  onPayload: (payload: ConnectPayload) => void;
}

/**
 * Модальное окно со сканером QR-кода подключения к CRM.
 */
const QrConnectScanner: React.FC<Props> = ({ visible, onClose, onPayload }) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [locked, setLocked] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLocked(false);
    if (!permission?.granted) requestPermission();
  }, [visible, permission?.granted]);

  const handleScanned = ({ data }: { data: string }) => {
    if (locked) return;
    setLocked(true);

    const parsed = parseConnectPayload(data);
    if (!parsed || !parsed.host) {
      Alert.alert('QR-код не распознан', 'Это не код подключения к CRM.\nОтсканируйте код из карточки сотрудника.');
      onClose();
      return;
    }
    onPayload(parsed);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {permission?.granted ? (
          <CameraView
            style={styles.camera}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
            onBarcodeScanned={visible ? handleScanned : undefined}
          />
        ) : (
          <View style={styles.center}>
            <Text style={styles.permissionText}>
              Нет доступа к камере.{'\n'}Разрешите использование камеры в настройках телефона.
            </Text>
            <TouchableOpacity style={styles.permissionBtn} onPress={() => requestPermission()}>
              <Text style={styles.permissionBtnText}>Разрешить</Text>
            </TouchableOpacity>
          </View>
        )}

        {permission?.granted && (
          <View style={styles.overlay} pointerEvents="none">
            <View style={styles.frame} />
            <Text style={styles.hint}>Наведите камеру на QR-код</Text>
          </View>
        )}

        <TouchableOpacity style={styles.close} onPress={onClose}>
          <Text style={styles.closeText}>✕ Закрыть</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  permissionText: { color: '#fff', textAlign: 'center', fontSize: 15, lineHeight: 22 },
  permissionBtn: { marginTop: 16, backgroundColor: '#1677ff', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 20 },
  permissionBtnText: { color: '#fff', fontWeight: '600' },
  overlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  frame: { width: 240, height: 240, borderWidth: 3, borderColor: '#1677ff', borderRadius: 16 },
  hint: { color: '#fff', marginTop: 16, fontSize: 15, fontWeight: '600' },
  close: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 24,
    right: 20,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 8,
  },
  closeText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});

export default QrConnectScanner;
