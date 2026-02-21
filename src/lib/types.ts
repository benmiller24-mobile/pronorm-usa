/* ── Supabase Database Types ── */

/*
  FULL WORKFLOW:
  ─────────────────────────────────────────
  PROJECT PHASE (Design)
  1. submitted              – Dealer submitted design packet
  2. in_design              – Pronorm USA is designing
  3. design_delivered        – Design output package uploaded for dealer review
  4. changes_requested       – Dealer marked up changes
  5. design_revised          – Pronorm revised design (can loop to 4)
  6. approved                – Dealer approved design → ready for order

  ORDER PHASE (Production & Delivery)
  1. pending_order_payment   – Awaiting order payment (QuickBooks)
  2. order_paid              – Order payment received
  3. sent_to_factory         – Sent to pronorm factory
  4. acknowledgement_review  – Factory order confirmation uploaded for dealer review
  5. acknowledgement_changes – Dealer marked up changes on confirmation
  6. acknowledgement_approved – Dealer approved factory confirmation
  7. in_production           – Manufacturing in progress
  8. shipped                 – Order shipped from factory
  9. pending_shipping_payment – Awaiting shipping/balance payment
  10. shipping_paid           – Shipping payment received
  11. delivered               – Order delivered to dealer/client
*/

export type ProjectStatus =
  | 'submitted'
  | 'in_design'
  | 'design_delivered'
  | 'changes_requested'
  | 'design_revised'
  | 'approved';

export type OrderStatus =
  | 'pending_order_payment'
  | 'order_paid'
  | 'sent_to_factory'
  | 'acknowledgement_review'
  | 'acknowledgement_changes'
  | 'acknowledgement_approved'
  | 'in_production'
  | 'shipped'
  | 'pending_shipping_payment'
  | 'shipping_paid'
  | 'delivered';

export type PaymentStatus = 'unpaid' | 'partial' | 'paid';
export type WarrantyStatus = 'submitted' | 'under_review' | 'approved' | 'shipped' | 'resolved' | 'denied';

/* File categories distinguish design-packet uploads from design-output deliveries from markup responses */
export type FileCategory =
  | 'submission'            // Dealer's original design packet files
  | 'design_output'         // Pronorm's design output package (perspectives, plans, element lists)
  | 'dealer_markup'         // Dealer's marked-up changes
  | 'design_revision'       // Pronorm's revised design files
  | 'acknowledgement'       // Factory order confirmation PDF
  | 'acknowledgement_markup'; // Dealer's markup on factory confirmation

export type DealerRole = 'dealer' | 'admin' | 'designer';

export interface Dealer {
  id: string;
  user_id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  address: string;
  role: DealerRole;
  parent_dealer_id: string | null; // designers belong to a dealer
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
  design_packet_data: Record<string, any> | null;
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
  category: FileCategory;
  uploaded_by: 'dealer' | 'admin';
  uploaded_at: string;
}

export interface Order {
  id: string;
  project_id: string;
  dealer_id: string;
  order_number: string;
  status: OrderStatus;
  total_amount: number;
  shipping_amount: number | null;
  payment_link: string | null;
  quickbooks_order_invoice_id: string | null;
  quickbooks_shipping_invoice_id: string | null;
  payment_status: PaymentStatus;
  shipping_payment_status: PaymentStatus;
  shipping_tracking: string | null;
  shipping_carrier: string | null;
  estimated_delivery: string | null;
  production_started_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderFile {
  id: string;
  order_id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  category: 'acknowledgement' | 'acknowledgement_revision' | 'acknowledgement_markup' | 'other';
  uploaded_by: 'dealer' | 'admin';
  uploaded_at: string;
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
      order_files: {
        Row: OrderFile;
        Insert: Omit<OrderFile, 'id' | 'uploaded_at'>;
        Update: Partial<Omit<OrderFile, 'id'>>;
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
