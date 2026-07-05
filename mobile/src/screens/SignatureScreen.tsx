import React, { useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Alert,
} from 'react-native';
import Signature from 'react-native-signature-canvas';

interface Props {
  route: { params: { orderId: number; onSign: (signature: string) => void } };
  navigation: any;
}

const SignatureScreen: React.FC<Props> = ({ route, navigation }) => {
  const { orderId, onSign } = route.params;
  const ref = useRef<any>(null);

  const handleOK = (signature: string) => {
    onSign(signature);
    navigation.goBack();
  };

  const handleClear = () => ref.current?.clearSignature();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Подпись клиента</Text>
      <Text style={styles.subtitle}>Заявка #{orderId}</Text>
      <View style={styles.sigBox}>
        <Signature
          ref={ref}
          onOK={handleOK}
          onEmpty={() => Alert.alert('Пусто', 'Пожалуйста, поставьте подпись')}
          descriptionText=""
          clearText=""
          confirmText=""
          webStyle={webStyles}
        />
      </View>
      <View style={styles.buttons}>
        <TouchableOpacity style={styles.clearBtn} onPress={handleClear}>
          <Text style={styles.clearText}>🔄 Очистить</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.okBtn} onPress={() => ref.current?.readSignature()}>
          <Text style={styles.okText}>✅ Подтвердить</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const webStyles = `
  .m-signature-pad--footer { display: none; }
  .m-signature-pad { box-shadow: none; border: 1px solid #d9d9d9; border-radius: 8px; }
`;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 16 },
  title: { fontSize: 20, fontWeight: '700', textAlign: 'center', marginTop: 10 },
  subtitle: { fontSize: 15, color: '#666', textAlign: 'center', marginBottom: 10 },
  sigBox: { flex: 1, borderWidth: 2, borderColor: '#1677ff', borderRadius: 12, marginBottom: 16, overflow: 'hidden' },
  buttons: { flexDirection: 'row', gap: 12, justifyContent: 'center', marginBottom: 20 },
  clearBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 8, backgroundColor: '#f5f5f5' },
  clearText: { fontSize: 15 },
  okBtn: { paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, backgroundColor: '#1677ff' },
  okText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});

export default SignatureScreen;
