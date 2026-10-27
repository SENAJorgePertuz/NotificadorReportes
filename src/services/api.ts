import { User, Biller, InvoiceRecord, UploadBatch, RipsLookupResult, HealthStatus, UserRole } from '../types';

const TOKEN_KEY = 'giza_auth_token';

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeAuthToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});
  
  // Only set Content-Type for requests with a body (e.g. POST/PUT), not plain GET requests
  if (options.body && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  let data: any = {};
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    data = await response.json().catch(() => ({}));
  } else {
    const text = await response.text().catch(() => '');
    data = { error: text || `HTTP ${response.status} ${response.statusText}` };
  }

  if (!response.ok) {
    const errorMsg = data.error || data.details || `Error en la solicitud: HTTP ${response.status} ${response.statusText || 'Error del servidor'}`;
    throw new Error(errorMsg);
  }

  return data as T;
}

export const api = {
  // Health
  getHealth: () => request<HealthStatus>('/api/health'),

  // Auth
  login: (username: string, password: string) => 
    request<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    }),

  getCurrentUser: () => request<{ user: User }>('/api/auth/me'),

  getUsers: () => request<{ users: User[] }>('/api/auth/users'),

  createUser: (userData: { username: string; email: string; password: string; full_name: string; role: UserRole }) =>
    request<{ user: User }>('/api/auth/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    }),

  updateUserRole: (id: number, data: { role?: UserRole; is_active?: boolean }) =>
    request<{ user: User }>(`/api/auth/users/${id}/role`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Billers
  getBillers: () => request<{ billers: Biller[] }>('/api/billers'),

  createBiller: (data: { name: string; display_name?: string; phone?: string; email?: string; notes?: string; aliases?: string[] }) =>
    request<{ biller: Biller }>('/api/billers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateBiller: (id: number, data: { display_name?: string; phone?: string; email?: string; notes?: string }) =>
    request<{ biller: Biller }>(`/api/billers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteBiller: (id: number) =>
    request<{ message: string }>(`/api/billers/${id}`, {
      method: 'DELETE',
    }),

  addAlias: (billerId: number, alias: string) =>
    request<{ alias: { id: number; alias: string } }>(`/api/billers/${billerId}/aliases`, {
      method: 'POST',
      body: JSON.stringify({ alias }),
    }),

  deleteAlias: (aliasId: number) =>
    request<{ message: string }>(`/api/billers/aliases/${aliasId}`, {
      method: 'DELETE',
    }),

  getUnmappedBillers: () =>
    request<{ unmapped: { biller_raw_name: string; count: number; eps_list: string[] }[] }>('/api/billers/unmapped'),

  relinkBillers: () =>
    request<{ message: string; updatedCount: number }>('/api/billers/re-link', {
      method: 'POST',
    }),

  // Invoices & Upload
  getInvoices: (params: { page?: number; limit?: number; search?: string; eps?: string; status?: string; biller_id?: number; batch_id?: number }) => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.search) query.set('search', params.search);
    if (params.eps) query.set('eps', params.eps);
    if (params.status) query.set('status', params.status);
    if (params.biller_id) query.set('biller_id', String(params.biller_id));
    if (params.batch_id) query.set('batch_id', String(params.batch_id));
    return request<{
      items: InvoiceRecord[];
      pagination: { page: number; limit: number; total: number; totalPages: number };
      availableFilters: { eps: string[]; statuses: string[] };
    }>(`/api/invoices?${query.toString()}`);
  },

  getInvoice: (id: number) => request<{ invoice: InvoiceRecord }>(`/api/invoices/${id}`),

  updateReturnNote: (id: number, returnNote: string) =>
    request<{ success: boolean; invoice: InvoiceRecord }>(`/api/invoices/${id}/return-note`, {
      method: 'PUT',
      body: JSON.stringify({ return_note: returnNote }),
    }),

  deleteInvoice: (id: number) =>
    request<{ message: string }>(`/api/invoices/${id}`, {
      method: 'DELETE',
    }),

  uploadInvoicesJson: (data: any[], filename?: string) =>
    request<{
      success: boolean;
      batchId: number;
      totalProcessed: number;
      inserted: number;
      updated: number;
      duplicatesCount: number;
      completedCount: number;
      newBillersDetected: string[];
    }>(`/api/invoices/upload${filename ? `?filename=${encodeURIComponent(filename)}` : ''}`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getBatches: () => request<{ batches: UploadBatch[] }>('/api/batches'),

  // RIPS & WhatsApp
  lookupRips: (invoiceNumbers: string | string[]) =>
    request<RipsLookupResult>('/api/rips/lookup', {
      method: 'POST',
      body: JSON.stringify({ invoice_numbers: invoiceNumbers }),
    }),

  notifyWhatsApp: (data: { invoice_id?: number; invoice_ids?: number[] }) =>
    request<{ success: boolean; notifiedCount: number; timestamp: string }>('/api/rips/notify-whatsapp', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Stats
  getStats: () =>
    request<{
      summary: {
        total_invoices: string;
        total_duplicates: string;
        total_completed: string;
        total_notified: string;
        total_patients: string;
      };
      byEps: { eps_folder: string; count: string; duplicates: string; completed: string }[];
      byBiller: { biller_name: string; biller_phone: string | null; count: string; duplicates: string; completed: string }[];
      recentBatches: UploadBatch[];
    }>('/api/stats'),
};
