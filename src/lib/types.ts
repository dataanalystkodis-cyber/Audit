import { supabase } from './supabase';

export type UserRole = 'super_admin' | 'manager' | 'auditor' | 'viewer';

export type Warehouse = {
  id: string;
  code: string;
  name: string;
  address: string | null;
  created_at: string;
};

export type Product = {
  id: string;
  product_code: string;
  qr_code: string | null;
  name: string;
  category: string;
  brand: string | null;
  unit: string;
  warehouse_id: string | null;
  zone: string | null;
  rack_number: string | null;
  bin_number: string | null;
  system_quantity: number;
  unit_price: number;
  status: 'active' | 'inactive';
  image_url: string | null;
  created_at: string;
  updated_at: string;
  warehouse?: Warehouse | null;
};

export type UserProfile = {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  warehouse: string | null;
  active: boolean;
  created_at: string;
};

export type AuditType = 'full' | 'cycle' | 'random' | 'location' | 'category';
export type AuditStatus = 'draft' | 'assigned' | 'in_progress' | 'submitted' | 'reviewed' | 'approved' | 'closed';

export type AuditHeader = {
  id: string;
  audit_name: string;
  audit_type: AuditType;
  status: AuditStatus;
  assigned_to: string | null;
  warehouse_id: string | null;
  filter_criteria: Record<string, any> | null;
  created_by: string | null;
  created_at: string;
  assigned_at: string | null;
  started_at: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  approved_at: string | null;
  closed_at: string | null;
  notes: string | null;
  assigned_user?: UserProfile | null;
  created_by_user?: UserProfile | null;
  warehouse?: Warehouse | null;
};

export type AuditDetailStatus = 'pending' | 'counted' | 'flagged' | 'recount_requested' | 'recounted';

export type AuditDetail = {
  id: string;
  audit_id: string;
  product_id: string;
  system_quantity: number;
  physical_quantity: number | null;
  variance_quantity: number | null;
  variance_value: number | null;
  unit_price: number;
  status: AuditDetailStatus;
  scanned: boolean;
  scan_count: number;
  note: string | null;
  counted_by: string | null;
  counted_at: string | null;
  recount_approved_by: string | null;
  recount_approved_at: string | null;
  created_at: string;
  product?: Product;
};

export type AuditLog = {
  id: string;
  audit_id: string | null;
  user_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, any> | null;
  created_at: string;
  user?: UserProfile | null;
};

export type Notification = {
  id: string;
  user_id: string | null;
  audit_id: string | null;
  type: string;
  title: string;
  message: string;
  read: boolean;
  email_sent: boolean;
  created_at: string;
};

export const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: 'Super Admin',
  manager: 'Warehouse Manager',
  auditor: 'Auditor',
  viewer: 'Viewer',
};

export const AUDIT_TYPE_LABELS: Record<AuditType, string> = {
  full: 'Full Physical Inventory',
  cycle: 'Cycle Count',
  random: 'Random Audit',
  location: 'Location-wise Audit',
  category: 'Category-wise Audit',
};

export const AUDIT_STATUS_LABELS: Record<AuditStatus, string> = {
  draft: 'Draft',
  assigned: 'Assigned',
  in_progress: 'In Progress',
  submitted: 'Submitted',
  reviewed: 'Reviewed',
  approved: 'Approved',
  closed: 'Closed',
};

export const AUDIT_STATUS_COLORS: Record<AuditStatus, string> = {
  draft: 'bg-slate-100 text-slate-700',
  assigned: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  submitted: 'bg-purple-100 text-purple-700',
  reviewed: 'bg-cyan-100 text-cyan-700',
  approved: 'bg-emerald-100 text-emerald-700',
  closed: 'bg-slate-200 text-slate-600',
};

export async function logAction(
  auditId: string | null,
  userId: string | null,
  action: string,
  entityType?: string,
  entityId?: string,
  details?: Record<string, any>
) {
  await supabase.from('audit_log').insert({
    audit_id: auditId,
    user_id: userId,
    action,
    entity_type: entityType || null,
    entity_id: entityId || null,
    details: details || null,
  });
}

export async function createNotification(
  userId: string | null,
  auditId: string | null,
  type: string,
  title: string,
  message: string
) {
  await supabase.from('notifications').insert({
    user_id: userId,
    audit_id: auditId,
    type,
    title,
    message,
  });
}
