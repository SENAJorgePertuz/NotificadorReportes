import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/Navbar';
import { RipsValidator } from './components/RipsValidator';
import { InvoicesManager } from './components/InvoicesManager';
import { JsonUploader } from './components/JsonUploader';
import { BillersDirectory } from './components/BillersDirectory';
import { UsersManager } from './components/UsersManager';
import { DashboardStats } from './components/DashboardStats';
import { RefreshCw } from 'lucide-react';

function AppContent() {
  const { loading } = useAuth();
  const [activeTab, setActiveTab] = useState<string>('rips');

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-400 mb-3" />
        <p className="text-sm font-medium">Conectando a PostgreSQL y autenticando sesión...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-emerald-500/30 selection:text-emerald-200">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1 w-full px-2 sm:px-4 md:px-6 lg:px-8 py-4 sm:py-6">
        {activeTab === 'rips' && <RipsValidator />}
        {activeTab === 'invoices' && <InvoicesManager />}
        {activeTab === 'upload' && (
          <JsonUploader 
            onUploadSuccess={() => setActiveTab('invoices')}
            onNavigateToBillers={() => setActiveTab('billers')}
          />
        )}
        {activeTab === 'billers' && <BillersDirectory />}
        {activeTab === 'users' && <UsersManager />}
        {activeTab === 'stats' && <DashboardStats />}
      </main>

      <footer className="border-t border-slate-900 bg-slate-950 py-4 text-center text-xs text-slate-400">
        <div className="w-full px-3 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p>© 2026 GIZA Medical Billing • Sistema de Gestión de Soportes & Validador RIPS</p>
          <div className="flex items-center gap-4 text-[11px] text-slate-400">
            <span>Aiven PostgreSQL 16 (defaultdb)</span>
            <span>•</span>
            <span>Upstash Redis TLS</span>
            <span>•</span>
            <span>WhatsApp Web Direct</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
