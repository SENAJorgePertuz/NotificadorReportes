import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { InvoiceRecord, Biller } from '../types';
import { useAuth } from '../context/AuthContext';
import { 
  Layers, 
  Search, 
  Filter, 
  RefreshCw, 
  FileText, 
  FolderOpen, 
  ExternalLink, 
  Send, 
  Trash2, 
  Eye, 
  X, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  User,
  ShieldAlert,
  Edit3,
  StickyNote,
  Plus,
  Save,
  MessageSquare,
  Sparkles,
  Shuffle,
  Copy,
  Check,
  Building2,
  Calendar,
  FileCheck2
} from 'lucide-react';
import { 
  WHATSAPP_TEMPLATES, 
  buildCoworkerWhatsAppMessage, 
  getRandomTemplateIndex 
} from '../utils/whatsappTemplates';
import { Pagination } from './Pagination';
import { useScreenType } from '../hooks/useScreenType';
import { ViewModeSwitch } from './ViewModeSwitch';

export const InvoicesManager: React.FC = () => {
  const { hasRole } = useAuth();
  const { screenType, viewMode, isAuto, setViewMode, resetToAuto } = useScreenType();

  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [eps, setEps] = useState('');
  const [status, setStatus] = useState('');
  const [billerId, setBillerId] = useState<number | undefined>(undefined);
  const [availableEps, setAvailableEps] = useState<string[]>([]);
  const [billersList, setBillersList] = useState<Biller[]>([]);

  // Modals
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRecord | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [copiedInvoice, setCopiedInvoice] = useState<string | null>(null);

  // Return Note Modal State
  const [noteModalInvoice, setNoteModalInvoice] = useState<InvoiceRecord | null>(null);
  const [returnNoteInput, setReturnNoteInput] = useState<string>('');
  const [savingNote, setSavingNote] = useState<boolean>(false);
  const [selectedTemplateIndex, setSelectedTemplateIndex] = useState<number>(0);

  const fetchInvoices = async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const data = await api.getInvoices({
        page,
        limit,
        search,
        eps,
        status,
        biller_id: billerId,
      });
      setInvoices(data.items || []);
      setTotalPages(data.pagination?.totalPages || 1);
      setTotalRecords(data.pagination?.total || 0);
      if (data.availableFilters?.eps && data.availableFilters.eps.length > 0) {
        setAvailableEps(data.availableFilters.eps);
      }
    } catch (err: any) {
      console.warn('Error fetching invoices:', err.message);
      setFetchError(err.message || 'Error al conectar con la base de datos');
    } finally {
      setLoading(false);
    }
  };

  const fetchBillers = async () => {
    try {
      const data = await api.getBillers();
      setBillersList(data.billers || []);
    } catch (e: any) {
      console.warn('Error fetching billers:', e.message);
    }
  };

  useEffect(() => {
    fetchBillers();
  }, []);

  useEffect(() => {
    fetchInvoices();
  }, [page, limit, eps, status, billerId]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchInvoices();
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedInvoice(id);
    setTimeout(() => setCopiedInvoice(null), 2000);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('¿Estás seguro de eliminar este registro de factura y sus soportes de PostgreSQL?')) {
      return;
    }
    try {
      await api.deleteInvoice(id);
      if (selectedInvoice?.id === id) {
        setSelectedInvoice(null);
      }
      fetchInvoices();
    } catch (err: any) {
      alert(`Error al eliminar: ${err.message}`);
    }
  };

  // Open Return Note Editor Modal with random template
  const openReturnNoteModal = (inv: InvoiceRecord) => {
    setNoteModalInvoice(inv);
    setReturnNoteInput(inv.return_note || '');
    setSelectedTemplateIndex(getRandomTemplateIndex());
  };

  // Save Return Note directly to PostgreSQL
  const handleSaveReturnNote = async (sendWhatsAppAfter: boolean = false) => {
    if (!noteModalInvoice) return;
    setSavingNote(true);
    try {
      const res = await api.updateReturnNote(noteModalInvoice.id, returnNoteInput);
      const updatedInv = { ...noteModalInvoice, return_note: res.invoice.return_note };
      
      // Update in table/cards state
      setInvoices(prev => prev.map(inv => inv.id === updatedInv.id ? { ...inv, return_note: updatedInv.return_note } : inv));
      
      if (selectedInvoice?.id === updatedInv.id) {
        setSelectedInvoice({ ...selectedInvoice, return_note: updatedInv.return_note });
      }

      const invoiceToSend = updatedInv;
      const tplToUse = selectedTemplateIndex;

      setNoteModalInvoice(null);

      if (sendWhatsAppAfter) {
        executeWhatsAppSend(invoiceToSend, tplToUse);
      }
    } catch (err: any) {
      alert(`Error al guardar la nota de devolución: ${err.message}`);
    } finally {
      setSavingNote(false);
    }
  };

  // Direct WhatsApp Web Trigger (friendly coworker dynamic templates without Estado)
  const executeWhatsAppSend = (inv: InvoiceRecord, customTplIndex?: number) => {
    const tplIdx = customTplIndex !== undefined ? customTplIndex : getRandomTemplateIndex();
    const message = buildCoworkerWhatsAppMessage(inv, tplIdx);
    const cleanPhone = (inv.biller_phone || '').replace(/[^0-9]/g, '');

    const url = cleanPhone
      ? `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`
      : `https://web.whatsapp.com/send?text=${encodeURIComponent(message)}`;

    window.open(url, '_blank');

    api.notifyWhatsApp({ invoice_id: inv.id }).then(() => {
      setInvoices(prev => prev.map(i => i.id === inv.id ? { ...i, whatsapp_notified_at: new Date().toISOString() } : i));
    });
  };

  // User clicked WhatsApp button on a row/card
  const handleWhatsAppButtonClick = (inv: InvoiceRecord) => {
    // If the invoice does NOT have a return note yet, prompt the user to enter it first
    if (!inv.return_note || !inv.return_note.trim()) {
      openReturnNoteModal(inv);
    } else {
      executeWhatsAppSend(inv);
    }
  };

  // Quick suggestion snippets for the return note
  const suggestionSnippets = [
    'Soportes ilegibles o incompletos en la carpeta.',
    'Falta firma o registro médico en la orden facultativa.',
    'Inconsistencia en número de contrato o régimen de la EPS.',
    'Diagnóstico CIE-10 no coincide con el procedimiento facturado.',
    'Falta evidencia del trámite respectivo.',
    'Factura no cruza con la autorización de la EPS.',
  ];

  return (
    <div className="w-full space-y-4">
      {/* Header Banner */}
      <div className="bg-slate-850 p-4 sm:p-5 rounded-2xl border border-slate-700/80 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2">
              <FileText className="w-6 h-6 text-emerald-400 shrink-0" />
              <span>Facturas & Soportes Unificados</span>
            </h2>
            <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs font-mono font-bold border border-emerald-500/20">
              {totalRecords} en BD
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Gestión completa de facturas, auditoría de soportes médicos, edición manual de notas de devolución y notificación instantánea a facturadores vía WhatsApp Web.
          </p>
        </div>

        {/* View mode switcher & refresh */}
        <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
          <ViewModeSwitch
            viewMode={viewMode}
            screenType={screenType}
            isAuto={isAuto}
            onSelectMode={setViewMode}
            onResetAuto={resetToAuto}
          />
          <button
            onClick={() => fetchInvoices()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 text-xs font-medium transition"
            title="Refrescar datos"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Actualizar</span>
          </button>
        </div>
      </div>

      {fetchError && (
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{fetchError}</span>
        </div>
      )}

      {/* Filters Toolbar */}
      <div className="bg-slate-850 p-3 sm:p-4 rounded-2xl border border-slate-750 shadow-lg space-y-3">
        <form onSubmit={handleSearchSubmit} className="flex flex-col lg:flex-row gap-2.5">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por factura (ej: HSHJ78965), paciente o carpeta..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:flex gap-2">
            {/* Filter EPS */}
            <select
              value={eps}
              onChange={(e) => {
                setEps(e.target.value);
                setPage(1);
              }}
              className="bg-slate-900 border border-slate-700 text-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Todas las EPS</option>
              {availableEps.map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>

            {/* Filter Facturador */}
            <select
              value={billerId || ''}
              onChange={(e) => {
                setBillerId(e.target.value ? Number(e.target.value) : undefined);
                setPage(1);
              }}
              className="bg-slate-900 border border-slate-700 text-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Todos los Facturadores</option>
              {billersList.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.display_name || b.name}
                </option>
              ))}
            </select>

            {/* Filter Status */}
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setPage(1);
              }}
              className="bg-slate-900 border border-slate-700 text-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">Todos los Estados</option>
              <option value="COMPLETADO">COMPLETADO</option>
              <option value="DUPLICADO">DUPLICADO</option>
            </select>

            {/* Submit search */}
            <button
              type="submit"
              className="flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow-md shadow-emerald-600/20"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filtrar</span>
            </button>
          </div>
        </form>
      </div>

      {/* Main Content Area: Responsive Table vs Responsive Cards */}
      <div className="w-full bg-slate-850 rounded-2xl border border-slate-750 shadow-xl overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-emerald-400" />
            <p className="text-sm font-medium">Consultando registros en PostgreSQL...</p>
          </div>
        ) : invoices.length === 0 ? (
          <div className="py-20 text-center text-slate-400">
            <FileText className="w-10 h-10 text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-300">No se encontraron facturas</p>
            <p className="text-xs text-slate-500 mt-1">Prueba ajustando los filtros de búsqueda o EPS.</p>
          </div>
        ) : viewMode === 'table' ? (
          /* ==================== DESKTOP TABLE VIEW ==================== */
          <div className="w-full overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/90 text-slate-400 uppercase tracking-wider text-[11px] border-b border-slate-750">
                <tr>
                  <th className="py-3 px-4 font-semibold">Factura</th>
                  <th className="py-3 px-4 font-semibold">Paciente</th>
                  <th className="py-3 px-4 font-semibold">EPS / Régimen</th>
                  <th className="py-3 px-4 font-semibold">Facturador</th>
                  <th className="py-3 px-4 font-semibold text-amber-300">Nota de Devolución</th>
                  <th className="py-3 px-4 font-semibold">Soportes</th>
                  <th className="py-3 px-4 font-semibold text-right">Notificar / Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-750/70">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-800/60 transition group">
                    {/* Factura */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 font-mono font-bold text-white">
                        <span>{inv.invoice_number}</span>
                        <button
                          onClick={() => handleCopy(inv.invoice_number, `inv-${inv.id}`)}
                          className="text-slate-500 hover:text-slate-300 opacity-60 group-hover:opacity-100 transition"
                          title="Copiar factura"
                        >
                          {copiedInvoice === `inv-${inv.id}` ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span
                          className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${
                            inv.status === 'DUPLICADO'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}
                        >
                          {inv.status}
                        </span>
                        {inv.whatsapp_notified_at && (
                          <span className="text-[10px] text-teal-400 flex items-center gap-0.5" title="Notificado">
                            <Clock className="w-2.5 h-2.5" />
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Paciente */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-200 line-clamp-1">{inv.patient_name}</div>
                      <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                        <Calendar className="w-2.5 h-2.5 text-slate-500" />
                        <span>{inv.invoice_date || 'N/A'}</span>
                      </div>
                    </td>

                    {/* EPS */}
                    <td className="py-3 px-4">
                      <div className="font-bold text-cyan-300 flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-cyan-400/70" />
                        <span>{inv.eps_folder}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 truncate max-w-[130px]">
                        {inv.contract_name || inv.regimen}
                      </div>
                    </td>

                    {/* Facturador */}
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-200">
                        {inv.biller_display_name || inv.biller_raw_name || 'Sin Asignar'}
                      </div>
                      <div className="text-[10px] text-emerald-400 font-mono">
                        {inv.biller_phone || 'Sin tel.'}
                      </div>
                    </td>

                    {/* NOTA DE DEVOLUCIÓN */}
                    <td className="py-3 px-4 max-w-xs">
                      {inv.return_note ? (
                        <div 
                          onClick={() => openReturnNoteModal(inv)}
                          className="cursor-pointer group/note flex items-start gap-1.5 p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition text-amber-200 text-xs"
                          title="Haga clic para editar la nota de devolución"
                        >
                          <StickyNote className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                          <span className="line-clamp-2 text-[11px] leading-tight flex-1">
                            {inv.return_note}
                          </span>
                          <Edit3 className="w-3 h-3 text-amber-400/70 group-hover/note:text-amber-300 shrink-0" />
                        </div>
                      ) : (
                        <button
                          onClick={() => openReturnNoteModal(inv)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-dashed border-amber-500/40 hover:border-amber-400 bg-amber-500/5 hover:bg-amber-500/15 text-amber-300 text-[11px] font-medium transition"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Agregar Nota</span>
                        </button>
                      )}
                    </td>

                    {/* Soportes */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      <button
                        onClick={() => setSelectedInvoice(inv)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-[11px] transition font-medium"
                      >
                        <FileCheck2 className="w-3.5 h-3.5 text-cyan-400" />
                        <span>{inv.files_to_upload?.length || 0} docs</span>
                      </button>
                    </td>

                    {/* Acciones */}
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleWhatsAppButtonClick(inv)}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] shadow-sm shadow-emerald-600/30 transition"
                          title="Notificar novedad al Facturador vía WhatsApp Web"
                        >
                          <Send className="w-3 h-3" />
                          <span>WhatsApp</span>
                        </button>

                        <button
                          onClick={() => setSelectedInvoice(inv)}
                          className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
                          title="Ver detalle completo"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {hasRole(['SuperAdmin', 'Admin']) && (
                          <button
                            onClick={() => handleDelete(inv.id)}
                            className="p-1 rounded-lg bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-300 border border-slate-700 transition"
                            title="Eliminar de base de datos"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* ==================== MOBILE / TABLET CARDS VIEW ==================== */
          <div className="p-3 sm:p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5 sm:gap-4">
              {invoices.map((inv) => (
                <div
                  key={inv.id}
                  className="bg-slate-900/90 rounded-2xl border border-slate-750 hover:border-slate-650 p-4 shadow-lg flex flex-col justify-between gap-3.5 transition"
                >
                  {/* Top row: Invoice, Status, Date */}
                  <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-extrabold text-base text-white tracking-wide">
                          {inv.invoice_number}
                        </span>
                        <button
                          onClick={() => handleCopy(inv.invoice_number, `inv-c-${inv.id}`)}
                          className="text-slate-400 hover:text-white p-0.5"
                          title="Copiar factura"
                        >
                          {copiedInvoice === `inv-c-${inv.id}` ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-500" />
                        <span>{inv.invoice_date || 'Sin fecha'}</span>
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          inv.status === 'DUPLICADO'
                            ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                        }`}
                      >
                        {inv.status}
                      </span>
                      {inv.whatsapp_notified_at && (
                        <span className="text-[9px] text-teal-400 flex items-center gap-1 font-mono">
                          <Clock className="w-2.5 h-2.5" />
                          Notificado
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Patient, EPS, and Biller details */}
                  <div className="space-y-2 text-xs">
                    <div>
                      <span className="text-slate-400 text-[11px] block">Paciente:</span>
                      <span className="font-bold text-slate-100 text-sm">{inv.patient_name}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-800/80">
                      <div>
                        <span className="text-slate-400 text-[10px] block">EPS:</span>
                        <span className="font-semibold text-cyan-300">{inv.eps_folder}</span>
                        <span className="text-[10px] text-slate-500 block truncate">
                          {inv.contract_name || inv.regimen}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] block">Facturador:</span>
                        <span className="font-semibold text-slate-200 block truncate">
                          {inv.biller_display_name || inv.biller_raw_name || 'Sin Asignar'}
                        </span>
                        <span className="text-[10px] text-emerald-400 font-mono block">
                          {inv.biller_phone || 'Sin tel.'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* NOTA DE DEVOLUCIÓN BLOCK */}
                  <div className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-amber-300 flex items-center gap-1">
                        <StickyNote className="w-3.5 h-3.5 text-amber-400" />
                        Nota de Devolución:
                      </span>
                      <button
                        onClick={() => openReturnNoteModal(inv)}
                        className="text-[10px] text-amber-400 hover:text-amber-300 font-semibold underline flex items-center gap-0.5"
                      >
                        <Edit3 className="w-2.5 h-2.5" />
                        {inv.return_note ? 'Editar' : 'Agregar'}
                      </button>
                    </div>
                    {inv.return_note ? (
                      <p className="text-[11px] text-amber-200/90 leading-snug line-clamp-2 italic">
                        "{inv.return_note}"
                      </p>
                    ) : (
                      <p className="text-[10px] text-slate-500 italic">
                        Sin nota cargada. Se solicitará antes de notificar.
                      </p>
                    )}
                  </div>

                  {/* Soportes Summary */}
                  <div className="flex items-center justify-between text-[11px] text-slate-400 bg-slate-850 px-2.5 py-1.5 rounded-lg border border-slate-800">
                    <span className="flex items-center gap-1">
                      <FolderOpen className="w-3.5 h-3.5 text-cyan-400" />
                      <span>{inv.files_to_upload?.length || 0} soportes adjuntos</span>
                    </span>
                    <button
                      onClick={() => setSelectedInvoice(inv)}
                      className="text-cyan-400 hover:underline font-medium text-[10px]"
                    >
                      Ver lista
                    </button>
                  </div>

                  {/* Card Action Buttons */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                    <button
                      onClick={() => handleWhatsAppButtonClick(inv)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-600/30 transition"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>Notificar WhatsApp</span>
                    </button>

                    <button
                      onClick={() => setSelectedInvoice(inv)}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border border-slate-700 transition"
                      title="Ver Detalles"
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    {hasRole(['SuperAdmin', 'Admin']) && (
                      <button
                        onClick={() => handleDelete(inv.id)}
                        className="p-2 rounded-xl bg-slate-800 hover:bg-rose-900/40 text-slate-400 hover:text-rose-300 border border-slate-700 transition"
                        title="Eliminar registro"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
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
          total={totalRecords}
          onPageChange={setPage}
          onLimitChange={setLimit}
          allowedLimits={[5, 10, 15]}
        />
      </div>

      {/* ========================================================================= */}
      {/* MODAL: EDITAR / AGREGAR NOTA DE DEVOLUCIÓN & ENVIAR POR WHATSAPP          */}
      {/* ========================================================================= */}
      {noteModalInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-850 border border-slate-700 rounded-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto shadow-2xl p-5 sm:p-6 relative">
            <button
              onClick={() => setNoteModalInvoice(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg bg-slate-750 hover:bg-slate-700"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 mb-2">
              <StickyNote className="w-5 h-5 text-amber-400" />
              <h3 className="text-lg font-bold text-white">
                Nota de Devolución para el Facturador
              </h3>
            </div>
            <p className="text-xs text-slate-300 mb-4">
              Ingresa o edita la observación que proviene del validador. Se guardará directamente en PostgreSQL y se incluirá en el mensaje de WhatsApp.
            </p>

            {/* Quick Context Card */}
            <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-750 grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs mb-4">
              <div>
                <span className="text-slate-400 text-[10px] block">Factura:</span>
                <span className="font-mono font-bold text-white text-sm">{noteModalInvoice.invoice_number}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">Paciente:</span>
                <span className="font-semibold text-slate-200 truncate block">{noteModalInvoice.patient_name}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">EPS:</span>
                <span className="font-semibold text-cyan-300">{noteModalInvoice.eps_folder}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">Fecha:</span>
                <span className="font-mono text-slate-300">{noteModalInvoice.invoice_date || 'N/A'}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">Facturador:</span>
                <span className="font-bold text-amber-300">{noteModalInvoice.biller_display_name || noteModalInvoice.biller_raw_name}</span>
              </div>
              <div>
                <span className="text-slate-400 text-[10px] block">WhatsApp:</span>
                <span className="font-mono text-emerald-400">{noteModalInvoice.biller_phone || 'Sin tel.'}</span>
              </div>
            </div>

            {/* Note Textarea */}
            <div className="space-y-1.5 mb-3">
              <label className="text-xs font-semibold text-slate-200 flex items-center justify-between">
                <span>Contenido de la Nota de Devolución:</span>
                <span className="text-[10px] text-slate-400">Requerido para la notificación</span>
              </label>
              <textarea
                rows={3}
                value={returnNoteInput}
                onChange={(e) => setReturnNoteInput(e.target.value)}
                placeholder="Escribe aquí la nota o motivo de devolución emitido por el validador... ej: Falta firma y sello del médico especialista en la orden facultativa."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition"
              />
            </div>

            {/* Quick Suggestion Chips */}
            <div className="space-y-1.5 mb-4">
              <span className="text-[10px] text-slate-400 font-medium block">
                Insertar motivo frecuente rápido:
              </span>
              <div className="flex flex-wrap gap-1.5">
                {suggestionSnippets.map((snip, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setReturnNoteInput(snip)}
                    className="text-[10px] px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
                  >
                    {snip}
                  </button>
                ))}
              </div>
            </div>

            {/* WhatsApp Template Selector (6 Dynamic Coworker Templates) */}
            <div className="bg-slate-900/90 rounded-xl border border-slate-750 p-3 mb-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Plantilla de WhatsApp (Estilo Compañero de Trabajo):
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedTemplateIndex(getRandomTemplateIndex())}
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-emerald-300 transition"
                  title="Elegir otra plantilla al azar"
                >
                  <Shuffle className="w-3 h-3" />
                  <span>Aleatorio</span>
                </button>
              </div>

              {/* Template chips 1 to 6 */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {WHATSAPP_TEMPLATES.map((tpl, i) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => setSelectedTemplateIndex(i)}
                    className={`px-2 py-1 rounded-lg text-[10px] font-semibold text-left transition ${
                      selectedTemplateIndex === i
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'bg-slate-800 hover:bg-slate-750 text-slate-300'
                    }`}
                  >
                    #{tpl.id}: {tpl.label}
                  </button>
                ))}
              </div>

              {/* Live Message Preview */}
              <div className="mt-2 pt-2 border-t border-slate-800">
                <span className="text-[10px] font-mono text-slate-400 block mb-1">
                  Vista Previa del Mensaje (sin Estado):
                </span>
                <pre className="bg-slate-950 p-2.5 rounded-lg text-[11px] text-emerald-300/90 font-sans whitespace-pre-wrap leading-relaxed border border-slate-800 max-h-36 overflow-y-auto">
                  {buildCoworkerWhatsAppMessage(
                    {
                      ...noteModalInvoice,
                      return_note: returnNoteInput,
                    },
                    selectedTemplateIndex
                  )}
                </pre>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2 border-t border-slate-750">
              <button
                type="button"
                onClick={() => setNoteModalInvoice(null)}
                className="w-full sm:w-auto px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                Cancelar
              </button>
              
              <button
                type="button"
                disabled={savingNote}
                onClick={() => handleSaveReturnNote(false)}
                className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white text-xs font-semibold transition"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Solo Guardar Nota</span>
              </button>

              <button
                type="button"
                disabled={savingNote || !returnNoteInput.trim()}
                onClick={() => handleSaveReturnNote(true)}
                className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 transition"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Guardar y Enviar a WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: VER DETALLE COMPLETO DE FACTURA & SOPORTES                         */}
      {/* ========================================================================= */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4">
          <div className="bg-slate-850 border border-slate-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl p-5 sm:p-6 relative">
            <button
              onClick={() => setSelectedInvoice(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg bg-slate-750 hover:bg-slate-700"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-emerald-400" />
              <h3 className="text-lg font-bold text-white">
                Detalle de Factura: <span className="font-mono text-emerald-400">{selectedInvoice.invoice_number}</span>
              </h3>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs mb-4">
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-750">
                <span className="text-slate-400 block text-[10px]">Paciente:</span>
                <span className="font-semibold text-slate-100 text-sm">{selectedInvoice.patient_name}</span>
              </div>
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-750">
                <span className="text-slate-400 block text-[10px]">EPS & Régimen:</span>
                <span className="font-semibold text-cyan-300">{selectedInvoice.eps_folder}</span>
                <span className="text-slate-400 block text-[11px]">{selectedInvoice.regimen || 'N/A'}</span>
              </div>
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-750">
                <span className="text-slate-400 block text-[10px]">Facturador Responsable:</span>
                <span className="font-semibold text-white">
                  {selectedInvoice.biller_display_name || selectedInvoice.biller_raw_name || 'Sin Asignar'}
                </span>
                <span className="text-emerald-400 block text-[11px] font-mono">{selectedInvoice.biller_phone || 'Sin WhatsApp'}</span>
              </div>
              <div className="p-3 bg-slate-900 rounded-xl border border-slate-750">
                <span className="text-slate-400 block text-[10px]">Estado en Validador:</span>
                <span className="font-bold text-rose-400">{selectedInvoice.status}</span>
                {selectedInvoice.error_reason && (
                  <span className="text-slate-400 block text-[10px] mt-0.5">{selectedInvoice.error_reason}</span>
                )}
              </div>
            </div>

            {/* Return note section in details */}
            <div className="p-3.5 bg-slate-900 rounded-xl border border-slate-750 mb-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <StickyNote className="w-4 h-4 text-amber-400" />
                  Nota de Devolución Registrada:
                </span>
                <button
                  onClick={() => openReturnNoteModal(selectedInvoice)}
                  className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 font-semibold underline"
                >
                  <Edit3 className="w-3 h-3" />
                  <span>Editar Nota</span>
                </button>
              </div>
              {selectedInvoice.return_note ? (
                <p className="text-xs text-amber-200/90 bg-amber-500/10 p-2.5 rounded-lg border border-amber-500/20 italic">
                  "{selectedInvoice.return_note}"
                </p>
              ) : (
                <p className="text-xs text-slate-500 italic">
                  No hay nota de devolución asignada a esta factura.
                </p>
              )}
            </div>

            {/* Unified files list */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <FolderOpen className="w-4 h-4 text-cyan-400" />
                Soportes Médicos Unificados ({selectedInvoice.files_to_upload?.length || 0}):
              </span>
              <div className="bg-slate-900 p-3 rounded-xl border border-slate-750 max-h-48 overflow-y-auto space-y-1.5">
                {selectedInvoice.files_to_upload && selectedInvoice.files_to_upload.length > 0 ? (
                  selectedInvoice.files_to_upload.map((file, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-slate-300 hover:text-white py-1 border-b border-slate-800 last:border-0">
                      <FileCheck2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span className="font-mono text-[11px] truncate">{file}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500 text-center py-2">No se detallaron soportes.</p>
                )}
              </div>
              <div className="text-[10px] text-slate-500 font-mono truncate">
                Ruta: {selectedInvoice.folder_path}
              </div>
            </div>

            {/* Footer actions */}
            <div className="flex items-center justify-end gap-2 mt-5 pt-3 border-t border-slate-750">
              <button
                onClick={() => setSelectedInvoice(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition"
              >
                Cerrar
              </button>
              <button
                onClick={() => handleWhatsAppButtonClick(selectedInvoice)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-md shadow-emerald-600/20"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Notificar por WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
