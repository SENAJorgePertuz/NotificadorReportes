export type UserRole = 'SuperAdmin' | 'Admin' | 'Operador';

export interface User {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: UserRole;
  is_active?: boolean;
  created_at?: string;
  last_login?: string | null;
}

export interface BillerAlias {
  id: number;
  alias: string;
  alias_pattern?: string;
}

export interface Biller {
  id: number;
  name: string;
  display_name: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  aliases: BillerAlias[];
  invoice_count?: number;
  created_at?: string;
}

export interface InvoiceRecord {
  id: number;
  batch_id?: number | null;
  patient_name: string;
  eps_folder: string;
  biller_raw_name: string | null;
  biller_id: number | null;
  biller_display_name?: string | null;
  biller_system_name?: string | null;
  biller_phone?: string | null;
  biller_email?: string | null;
  folder_path: string;
  base_path: string | null;
  subfolder_patient: string | null;
  invoice_number: string;
  invoice_date: string | null;
  regimen: string | null;
  contract_id: string | null;
  contract_name: string | null;
  files_to_upload: string[];
  status: 'DUPLICADO' | 'COMPLETADO' | 'PENDIENTE' | 'ERROR' | string;
  error_reason: string | null;
  return_note?: string | null;
  whatsapp_notified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UploadBatch {
  id: number;
  filename: string;
  total_records: number;
  duplicates_count: number;
  completed_count: number;
  uploaded_by_username: string;
  created_at: string;
}

export interface RipsLookupResult {
  searchedCount: number;
  foundCount: number;
  missingCount: number;
  records: InvoiceRecord[];
  missingNumbers: string[];
  groupedByBiller: {
    billerName: string;
    billerPhone: string | null;
    invoices: InvoiceRecord[];
  }[];
}

export interface HealthStatus {
  status: string;
  timestamp: string;
  postgres: string;
  redis: string;
  latencyMs: number;
}
