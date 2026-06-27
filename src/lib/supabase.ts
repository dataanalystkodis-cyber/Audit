import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Location = {
  id: string;
  code: string;
  name: string;
  zone: string;
  created_at: string;
};

export type Product = {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  system_quantity: number;
  location_id: string | null;
  barcode: string | null;
  created_at: string;
  location?: Location | null;
};

export type Audit = {
  id: string;
  name: string;
  status: 'in_progress' | 'completed';
  created_at: string;
  completed_at: string | null;
};

export type AuditItem = {
  id: string;
  audit_id: string;
  product_id: string;
  counted_quantity: number | null;
  status: 'pending' | 'counted' | 'flagged';
  note: string | null;
  counted_at: string | null;
  created_at: string;
  product?: Product;
};

export type AuditItemWithProduct = AuditItem & {
  product: Product;
};
