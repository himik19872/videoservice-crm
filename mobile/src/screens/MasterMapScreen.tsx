import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity, Alert } from 'react-native';
import MapView, { Marker, Callout } from 'react-native-maps';
import * as Location from 'expo-location';
import api from '../services/api';
import { useTheme } from '../contexts/ThemeContext';

interface MasterLocation {
  master_id: number;
  master_name: string;
  lat: number;
  lon: number;
  speed?: number;
  is_online: boolean;
  last_update?: string;
  source: 'phone' | 'traccar';
}

const MasterMapScreen: React.FC = () => {
  const [locations, setLocations] = useState<MasterLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [myLocation, setMyLocation] = useState<{ lat: number; lon: number } | null>(null);

  useEffect(() => {
    loadMyPosition();
    loadMasterLocations();
    const interval = setInterval(loadMasterLocations, 30000); // Обновление каждые 30с
    return () => clearInterval(interval);
  }, []);

  const loadMyPosition = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Нет доступа', 'Разрешите геолокацию для работы карты');
        return;
      }
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setMyLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude });
    } catch (e) {
      console.log('GPS error:', e);
    }
  };

  const loadMasterLocations = async () => {
    try {
      const res = await api.get('/masters/locations/');
      setLocations(res.data || []);
    } catch (e) {
      console.log('Load masters error:', e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1677ff" />
        <Text style={{ marginTop: 8 }}>Загрузка карты...</Text>
      </View>
    );
  }

  const initialRegion = myLocation
    ? { latitude: myLocation.lat, longitude: myLocation.lon, latitudeDelta: 0.05, longitudeDelta: 0.05 }
    : { latitude: 55.7558, longitude: 37.6173, latitudeDelta: 0.5, longitudeDelta: 0.5 };

  return (
    <View style={styles.container}>
      <MapView style={styles.map} initialRegion={initialRegion} showsUserLocation={true}>
        {locations.map((loc) => (
          <Marker
            key={loc.master_id}
            coordinate={{ latitude: loc.lat, longitude: loc.lon }}
            title={loc.master_name}
            pinColor={loc.source === 'traccar' ? (loc.is_online ? 'green' : 'orange') : 'blue'}
          >
            <Callout>
              <View style={{ width: 180 }}>
                <Text style={{ fontWeight: 'bold' }}>{loc.master_name}</Text>
                <Text>Источник: {loc.source === 'traccar' ? '📡 Traccar-маяк' : '📱 Телефон'}</Text>
                {loc.speed != null && <Text>Скорость: {loc.speed} км/ч</Text>}
                <Text>{loc.is_online ? '🟢 Онлайн' : '🔴 Офлайн'}</Text>
                {loc.last_update && (
                  <Text style={{ fontSize: 10, color: '#888' }}>
                    {new Date(loc.last_update).toLocaleString('ru-RU')}
                  </Text>
                )}
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>
      <TouchableOpacity style={styles.refreshBtn} onPress={() => { setLoading(true); loadMyPosition(); loadMasterLocations(); }}>
        <Text style={styles.refreshBtnText}>🔄 Обновить</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' },
  refreshBtn: {
    position: 'absolute', bottom: 20, right: 20,
    backgroundColor: '#1677ff', paddingVertical: 10, paddingHorizontal: 16,
    borderRadius: 20, elevation: 4,
  },
  refreshBtnText: { color: '#fff', fontWeight: '600' },
});

export default MasterMapScreen;
