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
  order_type: 'repair' | 'connection' | 'sale';
  client_info?: { id: number; full_name: string; phone: string; address: string };
  region_info?: { id: number; name: string };
  master_info?: { id: number; full_name: string; phone: string };
  master?: Master | null;
  status: string;
  description: string;
  address: string;
  priority: string;
  cost?: number | null;
  payment_type?: string | null;
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