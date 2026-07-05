// Types for CRM System

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'dispatcher' | 'master';
  master_profile?: MasterProfile;
}

export interface MasterProfile {
  id: number;
  phone: string;
  region: number;
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
  created_at: string;
  notes?: string;
}

export interface Equipment {
  id: number;
  name: string;
  equipment_type: string;
  client?: Client;
  client_id?: number;
  serial_number: string;
  status: string;
  warranty_until?: string;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: number;
  number: string;
  order_type: 'repair' | 'connection' | 'sale';
  client: Client;
  client_id: number;
  client_info?: ClientInfo;
  region: Region;
  region_id: number;
  region_info?: RegionInfo;
  master: Master | null;
  master_id?: number | null;
  master_info?: MasterInfo;
  equipment?: Equipment | null;
  equipment_id?: number | null;
  building_id?: number | null;
  status: 'new' | 'assigned' | 'accepted' | 'in_progress' | 'paused' | 'need_help' | 'completed' | 'confirmed' | 'cancelled';
  description: string;
  created_at: string;
  updated_at: string;
  assigned_at?: string;
  accepted_at?: string;
  started_at?: string;
  paused_at?: string;
  completed_at?: string;
  confirmed_at?: string;
  confirmed_by?: User | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  address: string;
  city?: string;
  street_name?: string;
  house_number?: string;
  building_number?: string;
  apartment?: string;
  entrance?: string;
  scheduled_at?: string | null;
  cost?: number | null;
  payment_type?: 'cash' | 'cashless' | null;
  payment_type_display?: string | null;
  photo_report_required: boolean;
  deadline?: string | null;
  history?: OrderHistory[];
  media?: OrderMedia[];
}

export interface OrderMedia {
  id: number;
  order: number;
  file: string;
  file_type: 'image' | 'video';
  uploaded_by?: User;
  notes?: string;
  uploaded_at: string;
}

export interface OrderStatusUpdateValues {
  status: string;
  notes?: string;
  master_id?: number;
  cost?: number;
  payment_type?: string;
}

export interface MasterStats {
  master_id: number;
  master_name: string;
  total_orders: number;
  completed_orders: number;
  overdue_orders: number;
  avg_completion_hours: number;
  total_cost: number;
  by_type: { repair: number; connection: number; sale: number };
  month: string;
}

export interface Master {
  id: number;
  user: { id: number; username: string; email: string; first_name: string; last_name: string };
  full_name?: string;
  region?: Region;
  region_id?: number;
  phone: string;
  is_available: boolean;
  created_at: string;
  traccar_device?: TraccarDeviceInfo | null;
}

export interface TraccarDeviceInfo {
  id: number;
  device_name: string;
  internal_device_id: number;
  unique_id: string;
  last_latitude: number | null;
  last_longitude: number | null;
  last_speed: number | null;
  last_update: string | null;
  is_online: boolean;
}

export interface ClientInfo {
  id: number;
  full_name: string;
  phone: string;
  address: string;
}

export interface RegionInfo {
  id: number;
  name: string;
}

export interface MasterInfo {
  id: number;
  full_name: string;
  phone: string;
}

export interface OrderHistory {
  id: number;
  order: number;
  changed_by?: User;
  old_status: string;
  new_status: string;
  notes?: string;
  changed_at?: string;
}

// Form types
export interface OrderFormValues {
  client_id: number;
  region_id: number;
  order_type: 'repair' | 'connection' | 'sale';
  city?: string;
  street_name?: string;
  house_number?: string;
  building_number?: string;
  apartment?: string;
  entrance?: string;
  address?: string;
  description: string;
  equipment_id?: number;
  building_id?: number;
  master_id?: number;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  cost?: number;
  payment_type?: 'cash' | 'cashless';
  photo_report_required?: boolean;
  deadline?: string;
  scheduled_at?: string;
}

export interface ClientFormValues {
  full_name: string;
  phone: string;
  email?: string;
  address: string;
  region_id: number;
  notes?: string;
}

export interface MasterFormValues {
  full_name: string;
  phone: string;
  region_id: number;
  is_available?: boolean;
  username?: string;
  password?: string;
}

export interface EquipmentFormValues {
  name: string;
  equipment_type: string;
  serial_number: string;
  client_id: number;
  status: string;
  warranty_until?: string;
}

export interface RegionFormValues {
  name: string;
  description?: string;
}

// Reports
export interface Report {
  id: number;
  title: string;
  report_type: 'daily' | 'weekly' | 'monthly' | 'custom';
  period_start: string;
  period_end: string;
  data: Record<string, any>;
  status: 'draft' | 'generated' | 'sent';
  generated_at: string;
  created_by?: User;
}

// Building (справочник обслуживаемых адресов)
export interface Building {
  id: number;
  region?: Region;
  region_id: number;
  city: string;
  street_type: string;
  street_type_display: string;
  street_name: string;
  house_number: string;
  building_number: string;
  apartments_count: number;
  entrances_count: number;
  equipment_type: string;
  equipment_type_display: string;
  notes: string;
  created_at: string;
  updated_at: string;
  orders?: BuildingOrder[];
}

export interface BuildingOrder {
  id: number;
  number: string;
  order_type: string;
  order_type_display: string;
  status: string;
  status_display: string;
  master_name: string;
  created_at: string;
}

export interface BuildingFormValues {
  region_id: number;
  city: string;
  street_type: string;
  street_name: string;
  house_number: string;
  building_number?: string;
  apartments_count: number;
  entrances_count: number;
  equipment_type: string;
  notes?: string;
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
  total_value: number | null;
  status: string;
  status_display: string;
  location: string;
  supplier: string;
  warranty_months: number;
  notes: string;
  created_at: string;
  updated_at: string;
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
  item: number;
  master: number | null;
  order: number | null;
}

// Финансы
export interface Payment {
  id: number;
  order: number;
  order_number: string;
  amount: number;
  payment_method: string;
  payment_method_display: string;
  is_received: boolean;
  paid_at: string;
  received_by_name: string;
  notes: string;
  created_at: string;
}

export interface MasterSalary {
  id: number;
  master: number;
  master_name: string;
  period_start: string;
  period_end: string;
  orders_total: number;
  orders_completed: number;
  total_revenue: number;
  commission_percent: number;
  bonus: number;
  deduction: number;
  total_salary: number;
  status: string;
  status_display: string;
  notes: string;
  created_at: string;
}
