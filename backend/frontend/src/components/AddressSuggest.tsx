import React, { useState, useCallback, useEffect } from 'react';
import { AutoComplete, Input } from 'antd';
import { EnvironmentOutlined } from '@ant-design/icons';
import api from '../services/api';

interface Props {
  onSelect?: (addr: {
    city: string; street_name: string; house_number: string;
    building_number: string; apartment: string; entrance: string; full_address: string;
  }) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  value?: string;
  onChange?: (val: string) => void;
}

const AddressSuggest: React.FC<Props> = ({ onSelect, placeholder, style, value, onChange }) => {
  const [options, setOptions] = useState<{ value: string; label: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState('');

  useEffect(() => {
    api.get('/system-settings/').then(r => setToken(r.data?.dadata_token || '')).catch(() => {});
  }, []);

  const search = useCallback(async (q: string) => {
    if (!token || q.length < 3) { setOptions([]); return; }
    setLoading(true);
    try {
      const r = await fetch('https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': `Token ${token}` },
        body: JSON.stringify({ query: q, count: 7 }),
      });
      const d = await r.json();
      setOptions((d.suggestions || []).map((s: any, i: number) => ({ value: s.value, label: s.value, key: i })));
    } catch { setOptions([]); } finally { setLoading(false); }
  }, [token]);

  const select = async (val: string) => {
    if (!token) return;
    try {
      const r = await fetch('https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Authorization': `Token ${token}` },
        body: JSON.stringify({ query: val, count: 1 }),
      });
      const d = await r.json();
      const s = d.suggestions?.[0];
      if (s && onSelect) {
        onSelect({
          city: s.data.city_with_type || s.data.settlement_with_type || s.data.city || '',
          street_name: s.data.street_with_type || s.data.street || '',
          house_number: s.data.house || '',
          building_number: s.data.block || '',
          apartment: s.data.flat || '',
          entrance: s.data.entrance || '',
          full_address: s.unrestricted_value,
        });
      }
    } catch {}
    if (onChange) onChange(val);
  };

  return (
    <AutoComplete options={options} onSearch={search} onSelect={select} onChange={onChange} value={value} style={style}
      notFoundContent={loading ? 'Поиск...' : token ? 'Ничего не найдено' : 'ⓘ Токен DaData не настроен'}>
      <Input prefix={<EnvironmentOutlined style={{ color: '#1677ff' }} />} placeholder={placeholder || 'Начните вводить адрес...'} allowClear />
    </AutoComplete>
  );
};

export default AddressSuggest;
