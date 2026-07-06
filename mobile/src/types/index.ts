// Внешний адрес API (сервер за роутером, порт 3000 проброшен на 8000)
// Либо через тот же порт 3000 с прокси
export const API_URL = 'http://83.243.73.86:3000/api';

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'dispatcher' | 'master';
  master_profile?: { id: number; phone: string; region: number };
}

export interface Region {
  id: number;
  name: string;
  description?: string;
}

export interface Client {
  id: number;
  full_name: string;
  phone: string;
  email?: string;
  address: string;
  region?: Region;
  region_id?: number;
}

export interface Master {
  id: number;
  full_name?: string;
  phone: string;
  region?: Region;
  region_id?: number;
  is_available: boolean;
}

export interface Order {
  id: number;
  number: string;
  order_type: 'repair' | 'connection' | 'sale' | 'installation' | 'maintenance';
  client_info?: { id: number; full_name: string; phone: string; address: string };
  client?: { id: number; phone?: string };
  region_info?: { id: number; name: string };
  master_info?: { id: number; full_name: string; phone: string };
  master?: Master | null;
  status: string;
  description: string;
  address: string;
  priority: string;
  cost?: number | null;
  payment_type?: string | null;
  is_paid?: boolean;
  photo_report_required?: boolean;
  city?: string;
  street_name?: string;
  house_number?: string;
  building_number?: string;
  apartment?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  confirmed_at?: string;
  history?: OrderHistory[];
}

export interface OrderHistory {
  id: number;
  old_status: string;
  new_status: string;
  notes?: string;
  changed_at?: string;
  changed_by?: { username: string };
  master_lat?: number;
  master_lon?: number;
}

// Склад
export interface InventoryItem {
  id: number;
  name: string;
  item_type: string;
  item_type_display: string;
  serial_number: string;
  model_name: string;
  quantity: number;
  unit: string;
  cost_price: number | null;
  sale_price: number | null;
  status: string;
  status_display: string;
  location: string;
  supplier: string;
  warranty_months: number;
  notes: string;
  created_at: string;
}

export interface InventoryMovement {
  id: number;
  movement_type: string;
  movement_type_display: string;
  item_name: string;
  master_name: string;
  order_number: string;
  performed_by_name: string;
  quantity: number;
  notes: string;
  created_at: string;
}

// Оплаты
export interface Payment {
  id: number;
  order: number;
  order_number: string;
  amount: string | number;
  payment_method: string;
  payment_method_display: string;
  is_received: boolean;
  paid_at: string;
  received_by_name: string;
  notes: string;
}