import React, { useState, useEffect, useCallback } from 'react';
import { Input, Button, message } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import api from '../services/api';

interface CompanyInfo {
  name: string;
  short_name: string;
  inn: string;
  kpp: string;
  ogrn: string;
  legal_address: string;
  director: string;
  director_post: string;
}

interface Props {
  value?: string;
  onChange?: (inn: string) => void;
  onFound?: (company: CompanyInfo) => void;
  placeholder?: string;
  style?: React.CSSProperties;
}

const InnSuggest: React.FC<Props> = ({ value, onChange, onFound, placeholder, style }) => {
  const [inn, setInn] = useState(value || '');
  const [loading, setLoading] = useState(false);
  const [found, setFound] = useState(false);

  useEffect(() => {
    if (value !== undefined) setInn(value);
  }, [value]);

  const lookup = useCallback(async () => {
    if (!inn || inn.length < 10) {
      message.warning('Введите ИНН (10 или 12 цифр)');
      return;
    }
    setLoading(true);
    try {
      const res = await api.get('/system-settings/lookup_company_by_inn/', { params: { inn } });
      if (res.data.found) {
        message.success(`Найдено: ${res.data.short_name || res.data.name}`);
        setFound(true);
        onFound?.({
          name: res.data.name,
          short_name: res.data.short_name,
          inn: res.data.inn,
          kpp: res.data.kpp,
          ogrn: res.data.ogrn,
          legal_address: res.data.legal_address,
          director: res.data.director,
          director_post: res.data.director_post,
        });
      } else {
        message.info('Компания не найдена в ЕГРЮЛ');
        setFound(false);
      }
    } catch (e: any) {
      message.error(e.response?.data?.error || 'Ошибка поиска');
    } finally {
      setLoading(false);
    }
  }, [inn]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 12);
    setInn(val);
    setFound(false);
    onChange?.(val);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      lookup();
    }
  };

  return (
    <Input
      value={inn}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onBlur={() => { if (inn.length >= 10) lookup(); }}
      placeholder={placeholder || 'Введите ИНН для автозаполнения'}
      maxLength={12}
      suffix={
        <Button
          type="text"
          size="small"
          icon={<SearchOutlined />}
          loading={loading}
          onClick={lookup}
          style={{ color: found ? '#52c41a' : undefined }}
        />
      }
      style={style}
    />
  );
};

export default InnSuggest;
