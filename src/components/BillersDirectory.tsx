import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Biller } from '../types';
import { useAuth } from '../context/AuthContext';
import { 
  Users, 
  Phone, 
  Mail, 
  Tag, 
  Plus, 
  Trash2, 
  RefreshCw, 
  AlertCircle, 
  CheckCircle2, 
  Edit3, 
  FileText,
  X,
  PhoneCall,
  Sparkles,
  Search,
  MessageSquare,
  Building2,
  FolderOpen
} from 'lucide-react';
import { Pagination } from './Pagination';
import { useScreenType } from '../hooks/useScreenType';
import { ViewModeSwitch } from './ViewModeSwitch';

export const BillersDirectory: React.FC = () => {
  const { hasRole } = useAuth();
  const { screenType, viewMode, isAuto, setViewMode, resetToAuto } = useScreenType();

  const [billers, setBillers] = useState<Biller[]>([]);
  const [unmapped, setUnmapped] = useState<{ biller_raw_name: string; count: number; eps_list: string[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // Pagination state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // New Biller Form Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newPhone, setNewPhone] = useState('+57');
  const [newEmail, setNewEmail] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [initialAliases, setInitialAliases] = useState('');

  // Add Alias Input state per biller
  const [newAliasInputs, setNewAliasInputs] = useState<Record<number, string>>({});

  // Edit Biller Modal
  const [editingBiller, setEditingBiller] = useState<Biller | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [billersData, unmappedData] = await Promise.all([
        api.getBillers(),
        api.getUnmappedBillers(),
      ]);
      setBillers(billersData.billers || []);
      setUnmapped(unmappedData.unmapped || []);
    } catch (err: any) {
      console.warn('Error fetching billers data:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateBiller = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    try {
      const aliasesArray = initialAliases
        .split(/[\n,]+/)
        .map((a) => a.trim().toUpperCase())
        .filter((a) => a.length > 0);

      await api.createBiller({
        name: newName.trim().toUpperCase(),
        display_name: newDisplayName.trim() || newName.trim(),
        phone: newPhone.trim() || undefined,
        email: newEmail.trim() || undefined,
        notes: newNotes.trim() || undefined,
        aliases: aliasesArray,
      });

      setShowCreateModal(false);
      setNewName('');
      setNewDisplayName('');
      setNewPhone('+57');
      setNewEmail('');
      setNewNotes('');
      setInitialAliases('');
      fetchData();
    } catch (err: any) {
      alert(`Error al crear facturador: ${err.message}`);
    }
  };

  const handleUpdateBiller = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBiller) return;

    try {
      await api.updateBiller(editingBiller.id, {
        display_name: editingBiller.display_name,
        phone: editingBiller.phone || undefined,
        email: editingBiller.email || undefined,
        notes: editingBiller.notes || undefined,
      });
      setEditingBiller(null);
      fetchData();
    } catch (err: any) {
      alert(`Error al actualizar: ${err.message}`);
    }
  };

  const handleDeleteBiller = async (id: number) => {
    if (!confirm('¿Eliminar este facturador? Las facturas asociadas quedarán sin asignar.')) {
      return;
    }
    try {
      await api.deleteBiller(id);
      fetchData();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  const handleAddAlias = async (billerId: number) => {
    const alias = newAliasInputs[billerId];
    if (!alias || !alias.trim()) return;

    try {
      await api.addAlias(billerId, alias.trim().toUpperCase());
      setNewAliasInputs((prev) => ({ ...prev, [billerId]: '' }));
      fetchData();
    } catch (err: any) {
      alert(`Error al agregar alias: ${err.message}`);
    }
  };

  const handleDeleteAlias = async (aliasId: number) => {
    try {
      await api.deleteAlias(aliasId);
      fetchData();
    } catch (err: any) {
      alert(`Error al eliminar alias: ${err.message}`);
    }
  };

  const handleRelinkAll = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await api.relinkBillers();
      setSyncMessage(`Sincronización completada: ${res.updatedCount} facturas vinculadas.`);
      fetchData();
    } catch (err: any) {
      setSyncMessage(`Error: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  const handleQuickAssignUnmapped = async (rawName: string, targetBillerId: number) => {
    try {
      await api.addAlias(targetBillerId, rawName.toUpperCase());
      fetchData();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    }
  };

  // Filter billers
  const filteredBillers = billers.filter((b) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const matchName = b.name.toLowerCase().includes(q);
    const matchDisplay = (b.display_name || '').toLowerCase().includes(q);
    const matchPhone = (b.phone || '').toLowerCase().includes(q);
    const matchAlias = (b.aliases || []).some((a) => ((a.alias_pattern || a.alias) || '').toLowerCase().includes(q));
    return matchName || matchDisplay || matchPhone || matchAlias;
  });

  const totalFiltered = filteredBillers.length;
  const startIndex = (page - 1) * limit;
  const paginatedBillers = filteredBillers.slice(startIndex, startIndex + limit);

  return (
    <div className="w-full space-y-4">
      {/* Header Banner */}
      <div className="bg-slate-850 p-4 sm:p-5 rounded-2xl border border-slate-750 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2">
              <Users className="w-6 h-6 text-amber-400 shrink-0" />
              <span>Directorio de Facturadores & Catálogo de Alias</span>
            </h2>
            <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-xs font-mono font-bold border border-amber-500/20">
              {billers.length} registrados
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Gestiona los números de WhatsApp y las variaciones de nombres de carpetas para el enrutamiento automático de notificaciones.
          </p>
        </div>

        {/* View Switcher & Action buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <ViewModeSwitch
            viewMode={viewMode}
            screenType={screenType}
            isAuto={isAuto}
            onSelectMode={setViewMode}
            onResetAuto={resetToAuto}
          />

          <button
            onClick={handleRelinkAll}
            disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-semibold border border-slate-700 transition"
            title="Re-ejecutar conciliación de nombres con facturas existentes"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{syncing ? 'Sincronizando...' : 'Re-vincular'}</span>
          </button>

          {hasRole(['SuperAdmin', 'Admin']) && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-md shadow-amber-600/20 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Facturador</span>
            </button>
          )}
        </div>
      </div>

      {syncMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{syncMessage}</span>
        </div>
      )}

      {/* Unmapped folder names warning */}
      {unmapped.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs space-y-3">
          <div className="flex items-center gap-2 font-bold text-sm text-amber-300">
            <AlertCircle className="w-4 h-4" />
            <span>Nombres de carpetas detectados sin facturador asignado ({unmapped.length}):</span>
          </div>
          <p className="text-slate-300 text-xs">
            Existen facturas en la base de datos cuyas carpetas contienen estos nombres no asociados. Puedes agregarlos como alias a un facturador existente con un solo clic:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {unmapped.map((u) => (
              <div key={u.biller_raw_name} className="p-3 rounded-xl bg-slate-900 border border-slate-700/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-amber-300 text-sm">
                    "{u.biller_raw_name}"
                  </span>
                  <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-mono">
                    {u.count} facturas
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  EPS: {u.eps_list.join(', ')}
                </div>
                <div className="pt-2 border-t border-slate-800 flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-400">Vincular a:</span>
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        handleQuickAssignUnmapped(u.biller_raw_name, Number(e.target.value));
                      }
                    }}
                    defaultValue=""
                    className="bg-slate-800 border border-slate-700 text-xs text-white rounded px-2 py-1 flex-1 focus:outline-none"
                  >
                    <option value="" disabled>Seleccionar facturador...</option>
                    {billers.map((b) => (
                      <option key={b.id} value={b.id}>{b.display_name || b.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter / Search Bar */}
      <div className="bg-slate-850 p-3 sm:p-4 rounded-2xl border border-slate-750 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:max-w-md">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, WhatsApp o patrón de alias..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        <div className="text-xs text-slate-400 font-mono self-end sm:self-auto">
          Mostrando {totalFiltered} de {billers.length} facturadores
        </div>
      </div>

      {/* Main Content Area: Table vs Cards */}
      <div className="w-full bg-slate-850 rounded-2xl border border-slate-750 shadow-xl overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-amber-400" />
            <p className="text-sm font-medium">Cargando catálogo de facturadores desde PostgreSQL...</p>
          </div>
        ) : totalFiltered === 0 ? (
          <div className="py-20 text-center text-slate-400">
            <Users className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-300">No hay facturadores que coincidan con la búsqueda</p>
          </div>
        ) : viewMode === 'table' ? (
          /* ==================== TABLE VIEW FOR DESKTOP ==================== */
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/90 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-750">
                <tr>
                  <th className="py-3 px-4 font-semibold">Facturador</th>
                  <th className="py-3 px-4 font-semibold">WhatsApp Directo</th>
                  <th className="py-3 px-4 font-semibold">Alias & Patrones de Carpeta</th>
                  <th className="py-3 px-4 font-semibold text-center">Facturas</th>
                  <th className="py-3 px-4 font-semibold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-750/70">
                {paginatedBillers.map((biller) => (
                  <tr key={biller.id} className="hover:bg-slate-800/60 transition group">
                    {/* Biller Info */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs shrink-0">
                          {biller.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <span className="font-bold text-white text-sm block">
                            {biller.display_name || biller.name}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            Código: {biller.name}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* WhatsApp */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {biller.phone ? (
                        <a
                          href={`https://web.whatsapp.com/send?phone=${biller.phone.replace(/[^0-9]/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-mono font-semibold transition"
                          title="Abrir chat en WhatsApp Web"
                        >
                          <Phone className="w-3 h-3" />
                          <span>{biller.phone}</span>
                        </a>
                      ) : (
                        <span className="text-slate-500 text-[11px] italic">Sin teléfono</span>
                      )}
                    </td>

                    {/* Aliases */}
                    <td className="py-3 px-4 max-w-md">
                      <div className="flex flex-wrap items-center gap-1">
                        {biller.aliases && biller.aliases.length > 0 ? (
                          biller.aliases.map((alias) => (
                            <span
                              key={alias.id}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono text-slate-300"
                            >
                              <Tag className="w-2.5 h-2.5 text-amber-400/80" />
                              <span>{alias.alias_pattern || alias.alias}</span>
                              {hasRole(['SuperAdmin', 'Admin']) && (
                                <button
                                  type="button"
                                  onClick={() => handleDeleteAlias(alias.id)}
                                  className="text-slate-500 hover:text-rose-400 ml-0.5"
                                  title="Eliminar alias"
                                >
                                  ×
                                </button>
                              )}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-500 text-[11px] italic">Sin alias adicionales</span>
                        )}

                        {hasRole(['SuperAdmin', 'Admin']) && (
                          <div className="inline-flex items-center gap-1 ml-1">
                            <input
                              type="text"
                              placeholder="+ Alias..."
                              value={newAliasInputs[biller.id] || ''}
                              onChange={(e) =>
                                setNewAliasInputs({ ...newAliasInputs, [biller.id]: e.target.value })
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddAlias(biller.id);
                                }
                              }}
                              className="w-20 bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-[10px] text-white focus:outline-none focus:ring-1 focus:ring-amber-500"
                            />
                            <button
                              type="button"
                              onClick={() => handleAddAlias(biller.id)}
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                              title="Guardar alias"
                            >
                              <Plus className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Facturas Count */}
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <span className="font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 text-xs">
                        {biller.invoice_count || 0}
                      </span>
                    </td>

                    {/* Acciones */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        {hasRole(['SuperAdmin', 'Admin']) && (
                          <>
                            <button
                              onClick={() => setEditingBiller(biller)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
                              title="Editar facturador"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteBiller(biller.id)}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-300 border border-slate-700 transition"
                              title="Eliminar facturador"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* ==================== CARDS VIEW FOR MOBILE / TABLET ==================== */
          <div className="p-3 sm:p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {paginatedBillers.map((biller) => (
                <div
                  key={biller.id}
                  className="bg-slate-900/90 rounded-2xl border border-slate-750 hover:border-slate-650 p-4 shadow-lg flex flex-col justify-between gap-3.5 transition"
                >
                  {/* Top: Name, Code, and Invoices count */}
                  <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-sm">
                        {biller.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="font-extrabold text-base text-white">
                          {biller.display_name || biller.name}
                        </h3>
                        <div className="flex items-center gap-2 text-xs text-slate-400">
                          <span>Código: <strong className="text-slate-300 font-mono">{biller.name}</strong></span>
                        </div>
                      </div>
                    </div>

                    <span className="font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 text-xs">
                      {biller.invoice_count || 0} facturas
                    </span>
                  </div>

                  {/* Phone & WhatsApp Link */}
                  <div className="text-xs space-y-1">
                    <span className="text-slate-400 text-[10px] block">Contacto WhatsApp:</span>
                    {biller.phone ? (
                      <a
                        href={`https://web.whatsapp.com/send?phone=${biller.phone.replace(/[^0-9]/g, '')}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-mono font-semibold transition"
                      >
                        <Phone className="w-3.5 h-3.5" />
                        <span>{biller.phone}</span>
                      </a>
                    ) : (
                      <span className="text-slate-500 italic">No configurado</span>
                    )}
                  </div>

                  {/* Aliases List */}
                  <div className="space-y-1.5 bg-slate-950/70 p-3 rounded-xl border border-slate-800">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-300 flex items-center gap-1 text-[11px]">
                        <Tag className="w-3 h-3 text-amber-400" />
                        Alias de Carpetas ({biller.aliases?.length || 0}):
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {biller.aliases && biller.aliases.length > 0 ? (
                        biller.aliases.map((alias) => (
                          <span
                            key={alias.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 border border-slate-750 text-[10px] font-mono text-slate-300"
                          >
                            <span>{alias.alias_pattern || alias.alias}</span>
                            {hasRole(['SuperAdmin', 'Admin']) && (
                              <button
                                onClick={() => handleDeleteAlias(alias.id)}
                                className="text-slate-500 hover:text-rose-400"
                              >
                                ×
                              </button>
                            )}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-500 text-[10px] italic">Sin alias adicionales</span>
                      )}
                    </div>

                    {/* Add alias input */}
                    {hasRole(['SuperAdmin', 'Admin']) && (
                      <div className="pt-2 flex items-center gap-1.5">
                        <input
                          type="text"
                          placeholder="Agregar alias (ej: JAIME PERTUZ)..."
                          value={newAliasInputs[biller.id] || ''}
                          onChange={(e) =>
                            setNewAliasInputs({ ...newAliasInputs, [biller.id]: e.target.value })
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddAlias(biller.id);
                            }
                          }}
                          className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                        />
                        <button
                          onClick={() => handleAddAlias(biller.id)}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700"
                        >
                          + Agregar
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Actions footer */}
                  {hasRole(['SuperAdmin', 'Admin']) && (
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                      <button
                        onClick={() => setEditingBiller(biller)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white text-xs border border-slate-700 transition"
                      >
                        <Edit3 className="w-3 h-3" />
                        <span>Editar</span>
                      </button>
                      <button
                        onClick={() => handleDeleteBiller(biller.id)}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-300 text-xs border border-slate-700 transition"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Eliminar</span>
                      </button>
                    </div>
                  )}
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

      {/* CREATE BILLER MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-850 border border-slate-700 rounded-2xl w-full max-w-lg p-5 sm:p-6 shadow-2xl relative">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg bg-slate-750"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <Users className="w-5 h-5 text-amber-400" />
              <span>Registrar Nuevo Facturador</span>
            </h3>

            <form onSubmit={handleCreateBiller} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Nombre Código (Identificador de carpeta, ej: JAIME, JHON):
                </label>
                <input
                  type="text"
                  required
                  placeholder="JAIME"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value.toUpperCase())}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono uppercase focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Nombre Completo / Para Mensaje de WhatsApp:
                </label>
                <input
                  type="text"
                  placeholder="Jaime Pertuz"
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Teléfono Móvil (WhatsApp con código de país, ej: +573001234567):
                </label>
                <input
                  type="text"
                  placeholder="+573001234567"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">
                  Alias o Variaciones (separados por comas):
                </label>
                <input
                  type="text"
                  placeholder="JAIME PERTUZ, JAIRO, JAIME P"
                  value={initialAliases}
                  onChange={(e) => setInitialAliases(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono uppercase focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
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
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold transition shadow-lg shadow-amber-600/30"
                >
                  Guardar Facturador
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT BILLER MODAL */}
      {editingBiller && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-850 border border-slate-700 rounded-2xl w-full max-w-lg p-5 sm:p-6 shadow-2xl relative">
            <button
              onClick={() => setEditingBiller(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg bg-slate-750"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-amber-400" />
              <span>Editar Facturador: {editingBiller.name}</span>
            </h3>

            <form onSubmit={handleUpdateBiller} className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Nombre Display:</label>
                <input
                  type="text"
                  required
                  value={editingBiller.display_name}
                  onChange={(e) => setEditingBiller({ ...editingBiller, display_name: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Teléfono WhatsApp:</label>
                <input
                  type="text"
                  value={editingBiller.phone || ''}
                  onChange={(e) => setEditingBiller({ ...editingBiller, phone: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Correo Electrónico:</label>
                <input
                  type="email"
                  value={editingBiller.email || ''}
                  onChange={(e) => setEditingBiller({ ...editingBiller, email: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-750">
                <button
                  type="button"
                  onClick={() => setEditingBiller(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold transition shadow-lg shadow-amber-600/30"
                >
                  Guardar Cambios
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
