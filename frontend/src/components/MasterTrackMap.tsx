import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

L.Control.Attribution.prototype.options.prefix = '';
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const trackerIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [22, 36], iconAnchor: [11, 36], popupAnchor: [1, -30], shadowSize: [36, 36],
});
const appIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-orange.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [22, 36], iconAnchor: [11, 36], popupAnchor: [1, -30], shadowSize: [36, 36],
});

export interface TrackPoint {
  lat: number;
  lon: number;
  source: 'traccar' | 'app';
  speed?: number | null;
  distance_km?: number;
  time: string;
}

interface Props {
  points: TrackPoint[];
  height?: string;
}

const FitTrack: React.FC<{ points: TrackPoint[] }> = ({ points }) => {
  const map = useMap();
  React.useEffect(() => {
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lon], 15);
    } else if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points.map(p => [p.lat, p.lon])), { padding: [30, 30] });
    }
  }, [points.length]);
  return null;
};

/** Карта трека: линия по точкам маяка + отдельные метки из приложения */
const MasterTrackMap: React.FC<Props> = ({ points, height = '360px' }) => {
  if (!points || points.length === 0) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: '#999', border: '1px dashed #ddd', borderRadius: 8, height }}>
        За выбранный день точек трека нет
      </div>
    );
  }

  const trackLine = points.filter(p => p.source === 'traccar').map(p => [p.lat, p.lon]) as [number, number][];
  const appPoints = points.filter(p => p.source === 'app');
  const trackerPoints = points.filter(p => p.source === 'traccar');
  const last = trackerPoints[trackerPoints.length - 1] || points[points.length - 1];

  return (
    <div style={{ height, borderRadius: 8, overflow: 'hidden' }}>
      <MapContainer center={[last.lat, last.lon]} zoom={13} style={{ height: '100%', width: '100%' }} scrollWheelZoom={false}>
        <TileLayer
          attribution='&copy; <a href="https://videoservice.ru">VideoService</a> | &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitTrack points={points} />
        {trackLine.length > 1 && <Polyline positions={trackLine} pathOptions={{ color: '#1890ff', weight: 4, opacity: 0.8 }} />}
        {trackerPoints.length > 0 && (
          <Marker position={[last.lat, last.lon]} icon={trackerIcon}>
            <Popup>
              <b>GPS-маяк</b><br />
              Последняя точка: {new Date(last.time).toLocaleTimeString('ru-RU')}<br />
              {last.speed != null && <>Скорость: {last.speed} км/ч<br /></>}
              Точек маяка за день: {trackerPoints.length}
            </Popup>
          </Marker>
        )}
        {appPoints.map((p, i) => (
          <Marker key={`app-${i}`} position={[p.lat, p.lon]} icon={appIcon}>
            <Popup>
              <b>Отметка из приложения</b><br />
              {new Date(p.time).toLocaleTimeString('ru-RU')}
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};

export default MasterTrackMap;
