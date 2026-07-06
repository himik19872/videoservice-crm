import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import api from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

interface Props {
  route: { params: { orderId: number; orderNumber: string; orderCost?: number | null } };
  navigation: any;
}

const paymentMethods = [
  { key: 'cash', label: '💰 Наличные' },
  { key: 'card', label: '💳 Карта' },
  { key: 'transfer', label: '🏦 Перевод' },
  { key: 'online', label: '🌐 Онлайн' },
];

const AddPaymentScreen: React.FC<Props> = ({ route, navigation }) => {
  const { orderId, orderNumber, orderCost } = route.params;
  const { theme } = useTheme();
  const [amount, setAmount] = useState(orderCost ? String(orderCost) : '');
  const [method, setMethod] = useState('cash');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      Alert.alert('Ошибка', 'Введите корректную сумму');
      return;
    }
    setLoading(true);
    try {
      await api.post('/payments/', {
        order: orderId,
        amount: amt,
        payment_method: method,
        notes,
      });
      Alert.alert('Готово', 'Оплата зарегистрирована', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert('Ошибка', e?.response?.data?.error || 'Не удалось сохранить оплату');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: theme.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView>
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Text style={[styles.title, { color: theme.text }]}>Оплата по заявке</Text>
          <Text style={[styles.orderNum, { color: theme.primary }]}>{orderNumber}</Text>

          <Text style={[styles.label, { color: theme.textSecondary }]}>Сумма</Text>
          <TextInput
            style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
            keyboardType="numeric"
            placeholder="0 ₽"
            placeholderTextColor={theme.textTertiary}
            value={amount}
            onChangeText={setAmount}
          />

          <Text style={[styles.label, { color: theme.textSecondary }]}>Способ оплаты</Text>
          <View style={styles.methodGrid}>
            {paymentMethods.map((m) => (
              <TouchableOpacity
                key={m.key}
                style={[
                  styles.methodChip,
                  { backgroundColor: theme.chipBg, borderColor: theme.border },
                  method === m.key && { backgroundColor: theme.chipActiveBg, borderColor: theme.chipActiveBg },
                ]}
                onPress={() => setMethod(m.key)}
              >
                <Text style={[styles.methodText, { color: method === m.key ? '#fff' : theme.text }]}>
                  {m.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.label, { color: theme.textSecondary }]}>Примечание</Text>
          <TextInput
            style={[styles.input, styles.notesInput, { backgroundColor: theme.inputBg, borderColor: theme.border, color: theme.text }]}
            placeholder="Необязательно"
            placeholderTextColor={theme.textTertiary}
            multiline
            value={notes}
            onChangeText={setNotes}
          />

          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={loading}>
            <Text style={styles.submitText}>{loading ? 'Сохранение...' : '💾 Сохранить оплату'}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12 },
  card: { borderRadius: 10, padding: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 4 },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 4 },
  orderNum: { fontSize: 14, fontWeight: '600', marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 12 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16 },
  notesInput: { height: 80, textAlignVertical: 'top' },
  methodGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  methodChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, borderWidth: 1 },
  methodText: { fontSize: 14 },
  submitBtn: { backgroundColor: '#1677ff', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 20 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});

export default AddPaymentScreen;
