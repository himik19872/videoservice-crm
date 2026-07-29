import React, { useState, useEffect } from 'react';
import { Card, Input, InputNumber, Switch, Button, message, Space, ColorPicker, Divider } from 'antd';
import api from '../../services/api';

const EstimateSettingsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    cp_logo_url: '', cp_header_text: 'Коммерческое предложение',
    cp_footer_text: 'С уважением, команда Видео Сервис',
    cp_signature_name: '', cp_signature_title: '',
    cp_validity_days: 7, cp_color: '#1a3e60', cp_show_logo: true,
  });

  useEffect(() => { fetchSettings(); }, []);

  const fetchSettings = async () => {
    try {
      const res = await api.get('/system-settings/');
      const data = res.data?.results?.[0] || res.data?.[0] || res.data;
      if (data) {
        setForm({
          cp_logo_url: data.cp_logo_url || '',
          cp_header_text: data.cp_header_text || 'Коммерческое предложение',
          cp_footer_text: data.cp_footer_text || 'С уважением, команда Видео Сервис',
          cp_signature_name: data.cp_signature_name || '',
          cp_signature_title: data.cp_signature_title || '',
          cp_validity_days: data.cp_validity_days || 7,
          cp_color: data.cp_color || '#1a3e60',
          cp_show_logo: data.cp_show_logo !== false,
        });
      }
    } catch (e) { console.error('Ошибка загрузки настроек', e); }
    finally { setLoading(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post('/system-settings/', form);
      message.success('Настройки сохранены');
    } catch (e: any) {
      try { await api.patch('/system-settings/1/', form); message.success('Настройки сохранены'); }
      catch { message.error('Ошибка сохранения'); }
    }
    setSaving(false);
  };

  return (
    <Card loading={loading} title="🖨️ Настройки шаблона коммерческого предложения" style={{ maxWidth: 700 }}>
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        <div>
          <label>Заголовок КП</label>
          <Input value={form.cp_header_text} onChange={e => setForm({ ...form, cp_header_text: e.target.value })} />
        </div>
        <div>
          <label>Логотип (URL)</label>
          <Input value={form.cp_logo_url} onChange={e => setForm({ ...form, cp_logo_url: e.target.value })} placeholder="https://example.com/logo.png" />
          <div style={{ marginTop: 8 }}>
            <Switch checked={form.cp_show_logo} onChange={v => setForm({ ...form, cp_show_logo: v })} />{' '}Показывать логотип
          </div>
        </div>
        <div>
          <label>Цвет шапки</label>
          <Space>
            <Input value={form.cp_color} onChange={e => setForm({ ...form, cp_color: e.target.value })} style={{ width: 120 }} />
            <ColorPicker value={form.cp_color} onChange={(c) => setForm({ ...form, cp_color: c.toHexString() })} />
          </Space>
        </div>
        <div>
          <label>ФИО подписанта</label>
          <Input value={form.cp_signature_name} onChange={e => setForm({ ...form, cp_signature_name: e.target.value })} placeholder="Иванов И.И." />
        </div>
        <div>
          <label>Должность подписанта</label>
          <Input value={form.cp_signature_title} onChange={e => setForm({ ...form, cp_signature_title: e.target.value })} placeholder="Генеральный директор" />
        </div>
        <div>
          <label>Срок действия КП (дней)</label>
          <InputNumber value={form.cp_validity_days} onChange={v => setForm({ ...form, cp_validity_days: v || 7 })} min={1} max={90} />
        </div>
        <div>
          <label>Текст в подвале</label>
          <Input.TextArea value={form.cp_footer_text} onChange={e => setForm({ ...form, cp_footer_text: e.target.value })} rows={2} />
        </div>
        <Button type="primary" onClick={handleSave} loading={saving}>💾 Сохранить настройки</Button>
      </Space>
    </Card>
  );
};

export default EstimateSettingsPage;
