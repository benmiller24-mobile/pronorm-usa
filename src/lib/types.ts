/* ── Supabase Database Types ── */

export type ProjectStatus = 'submitted' | 'in_review' | 'quoted' | 'revision_requested' | 'approved';
export type OrderStatus = 'pending_payment' | 'paid' | 'in_production' | 'shipped' | 'delivered';
export type PaymentStatus = 'unpaid' | 'partial' | 'paid';
export type WarrantyStatus = 'submitted' | 'under_review' | 'approved' | 'shipped' | 'resolved' | 'denied';

export interface Dealer {
  id: string;
  user_id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  address: string;
  created_at: string;
}

export interface Project {
  id: string;
  dealer_id: string;
  job_name: string;
  client_name: string;
  message: string;
  status: ProjectStatus;
  admin_notes: string | null;
  quote_amount: number | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectFile {
  id: string;
  project_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  uploaded_at: string;
}

export interface Order {
  id: string;
  project_id: string;
  dealer_id: string;
  order_number: string;
  status: OrderStatus;
  total_amount: number;
  quickbooks_invoice_id: string | null;
  payment_status: PaymentStatus;
  shipping_tracking: string | null;
  shipping_carrier: string | null;
  estimated_delivery: string | null;
  production_started_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderStatusUpdate {
  id: string;
  order_id: string;
  old_status: string;
  new_status: string;
  note: string | null;
  updated_by: string;
  created_at: string;
}

export interface WarrantyClaim {
  id: string;
  order_id: string;
  dealer_id: string;
  description: string;
  status: WarrantyStatus;
  resolution_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface WarrantyFile {
  id: string;
  warranty_id: string;
  file_name: string;
  file_path: string;
  uploaded_at: string;
}

/* ── Supabase Generated Database Type ── */
export interface Database {
  public: {
    Tables: {
      dealers: {
        Row: Dealer;
        Insert: Omit<Dealer, 'id' | 'created_at'>;
        Update: Partial<Omit<Dealer, 'id'>>;
      };
      projects: {
        Row: Project;
        Insert: Omit<Project, 'id' | 'created_at' | 'updated_at' | 'status' | 'admin_notes' | 'quote_amount'>;
        Update: Partial<Omit<Project, 'id'>>;
      };
      project_files: {
        Row: ProjectFile;
        Insert: Omit<ProjectFile, 'id' | 'uploaded_at'>;
        Update: Partial<Omit<ProjectFile, 'id'>>;
      };
      orders: {
        Row: Order;
        Insert: Omit<Order, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Order, 'id'>>;
      };
      order_status_updates: {
        Row: OrderStatusUpdate;
        Insert: Omit<OrderStatusUpdate, 'id' | 'created_at'>;
        Update: Partial<Omit<OrderStatusUpdate, 'id'>>;
      };
      warranty_claims: {
        Row: WarrantyClaim;
        Insert: Omit<WarrantyClaim, 'id' | 'created_at' | 'updated_at' | 'status' | 'resolution_notes'>;
        Update: Partial<Omit<WarrantyClaim, 'id'>>;
      };
      warranty_files: {
        Row: WarrantyFile;
        Insert: Omit<WarrantyFile, 'id' | 'uploaded_at'>;
        Update: Partial<Omit<WarrantyFile, 'id'>>;
      };
    };
  };
}
