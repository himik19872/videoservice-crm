import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Фикс иконок Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Цветные иконки
const onlineIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});
const offlineIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

interface MasterPoint {
  master_id: number;
  master_name: string;
  lat: number;
  lon: number;
  is_online: boolean;
  region: string;
  active_orders: number;
  cash_on_hand: number;
}

interface Props {
  masters: MasterPoint[];
  height?: string;
}

const FitBounds: React.FC<{ points: MasterPoint[] }> = ({ points }) => {
  const map = useMap();
  React.useEffect(() => {
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lon], 14);
    } else if (points.length > 1) {
      const bounds = L.latLngBounds(points.map(p => [p.lat, p.lon]));
      map.fitBounds(bounds, { padding: [30, 30] });
    }
  }, [points.length]);
  return null;
};

const MasterMapMulti: React.FC<Props> = ({ masters, height = '400px' }) => {
  if (masters.length === 0) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: '#999', border: '1px dashed #ddd', borderRadius: 8, height }}>
        Нет данных о местоположении мастеров
      </div>
    );
  }

  // Центр — по первому мастеру
  const center = masters[0];

  return (
    <div style={{ height, borderRadius: 8, overflow: 'hidden' }}>
      <MapContainer center={[center.lat, center.lon]} zoom={13} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
        <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FitBounds points={masters} />
        {masters.map(m => (
          <Marker key={m.master_id} position={[m.lat, m.lon]} icon={m.is_online ? onlineIcon : offlineIcon}>
            <Popup>
              <b>{m.master_name}</b><br />
              Район: {m.region}<br />
              📋 В работе: {m.active_orders} заявок<br />
              {m.cash_on_hand > 0 && <span>💰 На руках: {m.cash_on_hand.toLocaleString('ru-RU')} ₽<br /></span>}
              Статус: {m.is_online ? '🟢 Онлайн' : '🔴 Офлайн'}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default MasterMapMulti;
