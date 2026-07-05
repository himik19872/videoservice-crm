import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface MasterMapProps {
  latitude: number | null;
  longitude: number | null;
  masterName?: string;
  speed?: number | null;
  height?: string;
}

const RecenterMap: React.FC<{ lat: number; lng: number }> = ({ lat, lng }) => {
  const map = useMap();
  useEffect(() => {
    map.setView([lat, lng], 15);
  }, [lat, lng, map]);
  return null;
};

const MasterMap: React.FC<MasterMapProps> = ({ latitude, longitude, masterName, speed, height = '300px' }) => {
  if (latitude == null || longitude == null) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: '#999', border: '1px dashed #ddd', borderRadius: 8, height }}>
        Нет данных о местоположении
      </div>
    );
  }

  return (
    <div style={{ height, borderRadius: 8, overflow: 'hidden' }}>
      <MapContainer
        center={[latitude, longitude]}
        zoom={15}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <RecenterMap lat={latitude} lng={longitude} />
        <Marker position={[latitude, longitude]}>
          <Popup>
            <b>{masterName || 'Мастер'}</b>
            {speed != null && <><br />Скорость: {speed} км/ч</>}
            <br />{latitude.toFixed(6)}, {longitude.toFixed(6)}
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
};

export default MasterMap;
