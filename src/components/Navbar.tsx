import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { HealthStatus, UserRole } from '../types';
import { api } from '../services/api';
import { 
  Database, 
  Server, 
  ShieldCheck, 
  FileCheck, 
  Layers, 
  UploadCloud, 
  Users, 
  BarChart3, 
  LogOut, 
  UserCircle2, 
  RefreshCw,
  Zap,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, setActiveTab }) => {
  const { user, logout, switchRoleQuick, hasRole } = useAuth();
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [showRoleMenu, setShowRoleMenu] = useState(false);

  const checkHealth = async () => {
    setLoadingHealth(true);
    try {
      const data = await api.getHealth();
      setHealth(data);
    } catch {
      setHealth(null);
    } finally {
      setLoadingHealth(false);
    }
  };

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const navItems = [
    { id: 'rips', label: 'Validador RIPS & WhatsApp', icon: FileCheck, color: 'text-emerald-400' },
    { id: 'invoices', label: 'Facturas & Soportes', icon: Layers, color: 'text-cyan-400' },
    { id: 'upload', label: 'Cargar JSON', icon: UploadCloud, color: 'text-indigo-400' },
    { id: 'billers', label: 'Facturadores & Alias', icon: Users, color: 'text-amber-400' },
    ...(hasRole(['SuperAdmin', 'Admin']) ? [
      { id: 'users', label: 'Gestión Usuarios', icon: ShieldCheck, color: 'text-purple-400' }
    ] : []),
    { id: 'stats', label: 'Métricas & Auditoría', icon: BarChart3, color: 'text-rose-400' },
  ];

  const getRoleBadgeColor = (role?: UserRole) => {
    switch (role) {
      case 'SuperAdmin':
        return 'bg-purple-900/60 text-purple-300 border-purple-500/40';
      case 'Admin':
        return 'bg-blue-900/60 text-blue-300 border-blue-500/40';
      case 'Operador':
        return 'bg-emerald-900/60 text-emerald-300 border-emerald-500/40';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 shadow-xl">
      <div className="w-full px-2 sm:px-4 md:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-500 p-0.5 shadow-lg shadow-emerald-500/20 flex items-center justify-center">
              <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
                <FileCheck className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-emerald-400 via-teal-200 to-cyan-400 bg-clip-text text-transparent">
                  GIZA SOPORTES
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  RIPS 2026
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Validador, Persistencia PostgreSQL & WhatsApp
              </p>
            </div>
          </div>

          {/* Database Health Pill */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700/60 text-xs">
            <div className="flex items-center gap-1.5" title="Base de Datos PostgreSQL (Aiven Cloud)">
              <Database className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-slate-300 font-medium">Postgres:</span>
              <span className={`inline-block w-2 h-2 rounded-full ${health?.postgres.includes('Conectado') ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
            </div>

            <div className="h-3 w-[1px] bg-slate-700 mx-1" />

            <div className="flex items-center gap-1.5" title="Caché & Sesiones Redis (Upstash Cloud)">
              <Server className="w-3.5 h-3.5 text-cyan-400" />
              <span className="text-slate-300 font-medium">Redis:</span>
              <span className={`inline-block w-2 h-2 rounded-full ${health?.redis.includes('Conectado') ? 'bg-cyan-400' : 'bg-rose-500'}`} />
            </div>

            {health && (
              <span className="text-[11px] text-slate-400 font-mono ml-1">
                {health.latencyMs}ms
              </span>
            )}

            <button 
              onClick={checkHealth} 
              disabled={loadingHealth}
              title="Actualizar estado de conexión"
              className="text-slate-400 hover:text-slate-200 p-0.5 rounded transition"
            >
              <RefreshCw className={`w-3 h-3 ${loadingHealth ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* User Role Badge & Actions */}
          <div className="flex items-center gap-3">
            {user ? (
              <div className="relative">
                <button
                  onClick={() => setShowRoleMenu(!showRoleMenu)}
                  className="flex items-center gap-2.5 px-3 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-750 border border-slate-700 transition text-left"
                >
                  <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center font-bold text-xs text-slate-200">
                    {user.username.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="hidden sm:block">
                    <div className="text-xs font-semibold text-slate-200 leading-tight">
                      {user.full_name}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${getRoleBadgeColor(user.role)}`}>
                        {user.role}
                      </span>
                      <span className="text-[10px] text-slate-400 underline">Cambiar</span>
                    </div>
                  </div>
                </button>

                {/* Role Switcher Dropdown */}
                {showRoleMenu && (
                  <div className="absolute right-0 mt-2 w-64 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl py-2 z-50">
                    <div className="px-3 py-1.5 border-b border-slate-700/60 mb-1">
                      <p className="text-[11px] text-slate-400 font-medium">Probar con otro rol de usuario:</p>
                    </div>
                    {(['SuperAdmin', 'Admin', 'Operador'] as UserRole[]).map((r) => (
                      <button
                        key={r}
                        onClick={() => {
                          switchRoleQuick(r);
                          setShowRoleMenu(false);
                        }}
                        className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left hover:bg-slate-700/70 transition ${user.role === r ? 'text-emerald-400 font-semibold' : 'text-slate-300'}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${r === 'SuperAdmin' ? 'bg-purple-400' : r === 'Admin' ? 'bg-blue-400' : 'bg-emerald-400'}`} />
                          <span>{r}</span>
                        </div>
                        {user.role === r && <CheckCircle2 className="w-3.5 h-3.5" />}
                      </button>
                    ))}
                    <div className="border-t border-slate-700/60 mt-1 pt-1">
                      <button
                        onClick={() => {
                          logout();
                          setShowRoleMenu(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-rose-400 hover:bg-rose-500/10 transition text-left"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Cerrar sesión</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <button
                onClick={() => switchRoleQuick('SuperAdmin')}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition"
              >
                <UserCircle2 className="w-4 h-4" />
                <span>Ingresar como SuperAdmin</span>
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex space-x-1 sm:space-x-2 overflow-x-auto py-2 scrollbar-none border-t border-slate-800/80">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold tracking-wide whitespace-nowrap transition-all duration-150 ${
                  isActive
                    ? 'bg-slate-800 text-white shadow-inner border border-slate-700/80'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? item.color : 'text-slate-500'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
