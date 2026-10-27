import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { User, UserRole } from '../types';
import { useAuth } from '../context/AuthContext';
import { 
  ShieldCheck, 
  UserPlus, 
  Shield, 
  CheckCircle2, 
  XCircle, 
  RefreshCw, 
  User as UserIcon,
  X,
  Lock,
  Mail,
  Search
} from 'lucide-react';
import { Pagination } from './Pagination';
import { useScreenType } from '../hooks/useScreenType';
import { ViewModeSwitch } from './ViewModeSwitch';

export const UsersManager: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { screenType, viewMode, isAuto, setViewMode, resetToAuto } = useScreenType();

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Pagination state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // Form state
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('Operador');
  const [formError, setFormError] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await api.getUsers();
      setUsers(data.users || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      await api.createUser({
        username: newUsername.trim(),
        email: newEmail.trim(),
        password: newPassword,
        full_name: newFullName.trim(),
        role: newRole,
      });

      setShowCreateModal(false);
      setNewUsername('');
      setNewEmail('');
      setNewFullName('');
      setNewPassword('');
      setNewRole('Operador');
      fetchUsers();
    } catch (err: any) {
      setFormError(err.message || 'Error al crear usuario.');
    }
  };

  const handleToggleStatus = async (user: User) => {
    if (user.id === currentUser?.id) {
      alert('No puedes desactivar tu propia cuenta activa.');
      return;
    }
    try {
      await api.updateUserRole(user.id, { is_active: !user.is_active });
      fetchUsers();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleChangeRole = async (user: User, newRoleTarget: UserRole) => {
    if (user.id === currentUser?.id) {
      alert('No puedes cambiar tu propio rol.');
      return;
    }
    try {
      await api.updateUserRole(user.id, { role: newRoleTarget });
      fetchUsers();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'SuperAdmin':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      case 'Admin':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'Operador':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    }
  };

  // Filter users
  const filteredUsers = users.filter((u) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      u.username.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.full_name || '').toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    );
  });

  const totalFiltered = filteredUsers.length;
  const startIndex = (page - 1) * limit;
  const paginatedUsers = filteredUsers.slice(startIndex, startIndex + limit);

  return (
    <div className="w-full space-y-4">
      {/* Header Banner */}
      <div className="bg-slate-850 p-4 sm:p-5 rounded-2xl border border-slate-750 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-purple-400 shrink-0" />
              <span>Control de Usuarios & Permisos RBAC</span>
            </h2>
            <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 text-xs font-mono font-bold border border-purple-500/20">
              {users.length} usuarios
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Gestión de cuentas con roles SuperAdmin, Admin y Operador persistidas en PostgreSQL.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <ViewModeSwitch
            viewMode={viewMode}
            screenType={screenType}
            isAuto={isAuto}
            onSelectMode={setViewMode}
            onResetAuto={resetToAuto}
          />

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md shadow-purple-600/20 transition"
          >
            <UserPlus className="w-4 h-4" />
            <span>Nuevo Usuario</span>
          </button>
        </div>
      </div>

      {/* Role explanation cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-800/30 text-xs space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-purple-300">
            <Shield className="w-4 h-4" />
            <span>SuperAdmin</span>
          </div>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            Control total: gestión de usuarios, asignación de roles, eliminación de facturas en PostgreSQL y configuración global.
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-blue-950/20 border border-blue-800/30 text-xs space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-blue-300">
            <Shield className="w-4 h-4" />
            <span>Admin</span>
          </div>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            Carga de archivos JSON, directorio de facturadores y alias, creación de operadores y auditoría de soportes.
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-emerald-950/20 border border-emerald-800/30 text-xs space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-emerald-300">
            <Shield className="w-4 h-4" />
            <span>Operador</span>
          </div>
          <p className="text-slate-400 text-[11px] leading-relaxed">
            Consulta en Validador RIPS, notas de devolución, revisión de soportes unificados y envío de WhatsApp Web.
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-slate-850 p-3 sm:p-4 rounded-2xl border border-slate-750 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por usuario, correo, nombre o rol..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
        <div className="text-xs text-slate-400 font-mono self-end sm:self-auto">
          Mostrando {totalFiltered} de {users.length} usuarios
        </div>
      </div>

      {/* Main Content Area: Table vs Cards */}
      <div className="w-full bg-slate-850 rounded-2xl border border-slate-750 shadow-xl overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-purple-400" />
            <p className="text-sm font-medium">Cargando usuarios desde PostgreSQL...</p>
          </div>
        ) : totalFiltered === 0 ? (
          <div className="py-20 text-center text-slate-400">
            <UserIcon className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-300">No hay usuarios que coincidan con la búsqueda</p>
          </div>
        ) : viewMode === 'table' ? (
          /* ==================== TABLE VIEW FOR DESKTOP ==================== */
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/90 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-750">
                <tr>
                  <th className="py-3 px-4 font-semibold">Usuario</th>
                  <th className="py-3 px-4 font-semibold">Nombre Completo</th>
                  <th className="py-3 px-4 font-semibold">Correo</th>
                  <th className="py-3 px-4 font-semibold">Rol RBAC</th>
                  <th className="py-3 px-4 font-semibold text-center">Estado</th>
                  <th className="py-3 px-4 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-750/70">
                {paginatedUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-800/60 transition group">
                    <td className="py-3 px-4 font-mono font-bold text-white whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-bold text-xs">
                          {u.username.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <span>{u.username}</span>
                          {u.id === currentUser?.id && (
                            <span className="ml-1.5 text-[9px] bg-purple-500/20 text-purple-300 px-1.5 py-0.2 rounded font-sans">
                              (Tú)
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-slate-200">
                      {u.full_name || 'Sin nombre'}
                    </td>

                    <td className="py-3 px-4 text-slate-300 font-mono text-[11px]">
                      {u.email}
                    </td>

                    <td className="py-3 px-4 whitespace-nowrap">
                      <select
                        value={u.role}
                        disabled={u.id === currentUser?.id}
                        onChange={(e) => handleChangeRole(u, e.target.value as UserRole)}
                        className={`text-xs font-semibold rounded-lg px-2.5 py-1 border focus:outline-none focus:ring-1 focus:ring-purple-500 bg-slate-900 ${getRoleBadge(
                          u.role
                        )} disabled:opacity-50`}
                      >
                        <option value="Operador">Operador</option>
                        <option value="Admin">Admin</option>
                        <option value="SuperAdmin">SuperAdmin</option>
                      </select>
                    </td>

                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <button
                        onClick={() => handleToggleStatus(u)}
                        disabled={u.id === currentUser?.id}
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border transition ${
                          u.is_active
                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20'
                        } disabled:opacity-50`}
                      >
                        {u.is_active ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Activo</span>
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3 h-3" />
                            <span>Inactivo</span>
                          </>
                        )}
                      </button>
                    </td>

                    <td className="py-3 px-4 text-right text-slate-400 text-[11px] whitespace-nowrap">
                      Registrado: {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'N/A'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* ==================== CARDS VIEW FOR MOBILE / TABLET ==================== */
          <div className="p-3 sm:p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-4">
              {paginatedUsers.map((u) => (
                <div
                  key={u.id}
                  className="bg-slate-900/90 rounded-2xl border border-slate-750 hover:border-slate-650 p-4 shadow-lg flex flex-col justify-between gap-3 transition"
                >
                  <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center font-bold text-sm">
                        {u.username.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-extrabold text-white text-sm font-mono">{u.username}</h3>
                          {u.id === currentUser?.id && (
                            <span className="text-[9px] bg-purple-500/20 text-purple-300 px-1.5 py-0.2 rounded font-sans">
                              (Tú)
                            </span>
                          )}
                        </div>
                        <span className="text-slate-400 text-xs block">{u.full_name || 'Sin nombre'}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleToggleStatus(u)}
                      disabled={u.id === currentUser?.id}
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition ${
                        u.is_active
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      } disabled:opacity-50`}
                    >
                      {u.is_active ? 'Activo' : 'Inactivo'}
                    </button>
                  </div>

                  <div className="space-y-2 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-300">
                      <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="font-mono text-[11px] truncate">{u.email}</span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                      <span className="text-[11px] text-slate-400">Rol asignado:</span>
                      <select
                        value={u.role}
                        disabled={u.id === currentUser?.id}
                        onChange={(e) => handleChangeRole(u, e.target.value as UserRole)}
                        className={`text-xs font-semibold rounded-lg px-2.5 py-1 border focus:outline-none focus:ring-1 focus:ring-purple-500 bg-slate-900 ${getRoleBadge(
                          u.role
                        )} disabled:opacity-50`}
                      >
                        <option value="Operador">Operador</option>
                        <option value="Admin">Admin</option>
                        <option value="SuperAdmin">SuperAdmin</option>
                      </select>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-800 text-[10px] text-slate-500 flex justify-between items-center">
                    <span>ID: #{u.id}</span>
                    <span>Registrado: {u.created_at ? new Date(u.created_at).toLocaleDateString() : 'N/A'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dynamic Professional Paginator */}
        <Pagination
          page={page}
          limit={limit}
          total={totalFiltered}
          onPageChange={setPage}
          onLimitChange={setLimit}
          allowedLimits={[5, 10, 15]}
        />
      </div>

      {/* CREATE USER MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-850 border border-slate-700 rounded-2xl w-full max-w-md p-5 sm:p-6 shadow-2xl relative">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg bg-slate-750"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-purple-400" />
              <span>Registrar Nuevo Usuario</span>
            </h3>

            {formError && (
              <div className="p-3 mb-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Nombre de Usuario (Login):</label>
                <input
                  type="text"
                  required
                  placeholder="ej: jorge.pertuz"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value.toLowerCase())}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Nombre Completo:</label>
                <input
                  type="text"
                  required
                  placeholder="ej: Jorge Pertuz"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Correo Electrónico:</label>
                <input
                  type="email"
                  required
                  placeholder="usuario@giza.med"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Contraseña Inicial:</label>
                <div className="relative">
                  <Lock className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Rol RBAC:</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="Operador">Operador (Consulta RIPS, Notas, WhatsApp)</option>
                  <option value="Admin">Admin (Carga JSON, Facturadores, Alias)</option>
                  <option value="SuperAdmin">SuperAdmin (Acceso total & BD)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-750">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold transition shadow-lg shadow-purple-600/30"
                >
                  Crear Usuario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
