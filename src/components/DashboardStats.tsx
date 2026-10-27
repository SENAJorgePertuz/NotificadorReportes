import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { 
  BarChart3, 
  FileCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Send, 
  Users, 
  Building2, 
  RefreshCw, 
  Database, 
  Server, 
  ShieldCheck 
} from 'lucide-react';

export const DashboardStats: React.FC = () => {
  const [stats, setStats] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const data = await api.getStats();
      setStats(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  if (loading || !stats) {
    return (
      <div className="text-center py-20 text-slate-400">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-rose-400" />
        <p className="text-sm">Calculando métricas operacionales desde PostgreSQL...</p>
      </div>
    );
  }

  const summary = stats.summary;
  const total = parseInt(summary.total_invoices || '0');
  const duplicates = parseInt(summary.total_duplicates || '0');
  const completed = parseInt(summary.total_completed || '0');
  const notified = parseInt(summary.total_notified || '0');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-800/80 p-5 rounded-2xl border border-slate-700 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-rose-400" />
            Métricas Operacionales & Auditoría de Soportes
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Resumen estadístico en tiempo real alimentado directamente desde la base de datos PostgreSQL.
          </p>
        </div>

        <button
          onClick={fetchStats}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-semibold transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Actualizar Métricas</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800/90 rounded-2xl border border-slate-700 p-5 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Facturas</span>
            <FileCheck className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-3xl font-extrabold text-white font-mono">{total}</div>
          <span className="text-[11px] text-slate-400 mt-1 block">
            {summary.total_patients} pacientes únicos
          </span>
        </div>

        <div className="bg-slate-800/90 rounded-2xl border border-slate-700 p-5 shadow-lg">
          <div className="flex items-center justify-between text-rose-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Facturas Duplicadas</span>
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="text-3xl font-extrabold text-rose-400 font-mono">{duplicates}</div>
          <span className="text-[11px] text-rose-300/80 mt-1 block">
            {total > 0 ? Math.round((duplicates / total) * 100) : 0}% del volumen total
          </span>
        </div>

        <div className="bg-slate-800/90 rounded-2xl border border-slate-700 p-5 shadow-lg">
          <div className="flex items-center justify-between text-emerald-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Facturas Completadas</span>
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div className="text-3xl font-extrabold text-emerald-400 font-mono">{completed}</div>
          <span className="text-[11px] text-emerald-300/80 mt-1 block">
            {total > 0 ? Math.round((completed / total) * 100) : 0}% aprobadas
          </span>
        </div>

        <div className="bg-slate-800/90 rounded-2xl border border-slate-700 p-5 shadow-lg">
          <div className="flex items-center justify-between text-teal-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">WhatsApp Enviados</span>
            <Send className="w-4 h-4" />
          </div>
          <div className="text-3xl font-extrabold text-teal-300 font-mono">{notified}</div>
          <span className="text-[11px] text-teal-400/80 mt-1 block">
            Notificaciones registradas
          </span>
        </div>
      </div>

      {/* Grid: EPS & Billers Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* EPS Breakdown */}
        <div className="bg-slate-800/90 rounded-2xl border border-slate-700 p-5 shadow-xl space-y-4">
          <h3 className="font-bold text-sm text-white flex items-center gap-2">
            <Building2 className="w-4 h-4 text-cyan-400" />
            Distribución por Entidad Promotora de Salud (EPS)
          </h3>

          <div className="space-y-3">
            {stats.byEps.map((ep: any) => {
              const epTotal = parseInt(ep.count);
              const percentage = total > 0 ? Math.round((epTotal / total) * 100) : 0;
              return (
                <div key={ep.eps_folder} className="bg-slate-900/80 p-3 rounded-xl border border-slate-750 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-sm">{ep.eps_folder}</span>
                    <span className="font-mono text-slate-300 font-semibold">{epTotal} facturas ({percentage}%)</span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden flex">
                    <div 
                      className="bg-emerald-500 h-full" 
                      style={{ width: `${(parseInt(ep.completed) / (epTotal || 1)) * 100}%` }}
                      title={`Completadas: ${ep.completed}`}
                    />
                    <div 
                      className="bg-rose-500 h-full" 
                      style={{ width: `${(parseInt(ep.duplicates) / (epTotal || 1)) * 100}%` }}
                      title={`Duplicadas: ${ep.duplicates}`}
                    />
                  </div>

                  <div className="flex justify-between text-[11px] text-slate-400 pt-0.5">
                    <span className="text-emerald-400">Completadas: {ep.completed}</span>
                    <span className="text-rose-400">Duplicadas: {ep.duplicates}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Facturadores Breakdown */}
        <div className="bg-slate-800/90 rounded-2xl border border-slate-700 p-5 shadow-xl space-y-4">
          <h3 className="font-bold text-sm text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-400" />
            Carga de Trabajo por Facturador
          </h3>

          <div className="space-y-3">
            {stats.byBiller.map((b: any, index: number) => {
              const bTotal = parseInt(b.count);
              return (
                <div key={index} className="bg-slate-900/80 p-3 rounded-xl border border-slate-750 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-white text-sm">{b.biller_name}</span>
                      <span className="text-[11px] text-emerald-400 font-mono ml-2">
                        {b.biller_phone || 'Sin tel.'}
                      </span>
                    </div>
                    <span className="font-mono text-slate-300 font-semibold">{bTotal} facturas</span>
                  </div>

                  <div className="flex justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800">
                    <span className="text-rose-400">Duplicados reportados: {b.duplicates}</span>
                    <span className="text-emerald-400">Completados: {b.completed}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Database Connection Infrastructure Details */}
      <div className="bg-slate-800/70 rounded-2xl border border-slate-700 p-5 shadow-xl space-y-3 text-xs">
        <h3 className="font-bold text-sm text-slate-200 flex items-center gap-2">
          <Database className="w-4 h-4 text-emerald-400" />
          Infraestructura de Base de Datos Activa (Sin Hardcoding)
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-slate-300">
          <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-750 space-y-1">
            <span className="text-emerald-400 font-bold block">PostgreSQL Aiven Cloud</span>
            <div className="font-mono text-[11px] text-slate-400 break-all">
              Host: pg-19f18a9a-jorgepertuz-57eb.h.aivencloud.com:28418
            </div>
            <div className="font-mono text-[11px] text-slate-400">
              Base de Datos: defaultdb | SSL: require (Aiven Cloud Pool)
            </div>
            <div className="text-[11px] text-emerald-500 font-medium pt-1">
              • Tablas: users, billers, biller_aliases, invoice_records, upload_batches
            </div>
          </div>

          <div className="bg-slate-900 p-3.5 rounded-xl border border-slate-750 space-y-1">
            <span className="text-cyan-400 font-bold block">Redis Upstash Cloud</span>
            <div className="font-mono text-[11px] text-slate-400 break-all">
              Host: charmed-tapir-42818.upstash.io:6379 (TLS/rediss)
            </div>
            <div className="text-[11px] text-cyan-400 font-medium pt-1">
              • Gestión de sesiones activas, tokens y caché de latencia ultra-baja
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
