import React, { useState } from 'react';
import { api } from '../services/api';
import { InvoiceRecord, RipsLookupResult } from '../types';
import { 
  FileCheck, 
  Search, 
  Send, 
  AlertTriangle, 
  CheckCircle2, 
  ExternalLink, 
  Copy, 
  Check, 
  FileText, 
  FolderOpen, 
  PhoneCall, 
  Sparkles,
  Filter,
  Layers,
  MessageSquare,
  Clock,
  Info,
  Users,
  Edit3,
  StickyNote,
  X,
  Save,
  Shuffle,
  Building2,
  Calendar,
  FileCheck2,
  Eye,
  Plus
} from 'lucide-react';
import { 
  buildCoworkerWhatsAppMessage, 
  getRandomTemplateIndex, 
  WHATSAPP_TEMPLATES 
} from '../utils/whatsappTemplates';
import { Pagination } from './Pagination';
import { useScreenType } from '../hooks/useScreenType';
import { ViewModeSwitch } from './ViewModeSwitch';

export const RipsValidator: React.FC = () => {
  const { screenType, viewMode, isAuto, setViewMode, resetToAuto } = useScreenType();

  const [inputText, setInputText] = useState<string>(
    'HSHJ78965\nHSHJ78860\nHSHJ78967\nHSHJ78506\nHSHJ79445\nHSHJ79502'
  );
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RipsLookupResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [displayType, setDisplayType] = useState<'individual' | 'grouped'>('individual');
  const [copiedInvoice, setCopiedInvoice] = useState<string | null>(null);

  // Filters
  const [filterEps, setFilterEps] = useState<string>('ALL');
  const [filterBiller, setFilterBiller] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  // Pagination state
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  // Return Note & WhatsApp Modal State
  const [noteModalInvoice, setNoteModalInvoice] = useState<InvoiceRecord | null>(null);
  const [returnNoteInput, setReturnNoteInput] = useState<string>('');
  const [savingNote, setSavingNote] = useState<boolean>(false);
  const [selectedTemplateIndex, setSelectedTemplateIndex] = useState<number>(0);

  // Details Modal
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceRecord | null>(null);

  const handleLookup = async () => {
    if (!inputText.trim()) {
      setError('Por favor ingresa uno o más números de factura para consultar.');
      return;
    }

    setLoading(true);
    setError(null);

    // Extract invoice strings from textarea
    const invoiceList = inputText
      .split(/[\r\n,;\s]+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (invoiceList.length === 0) {
      setError('No se identificaron números de factura válidos en el texto.');
      setLoading(false);
      return;
    }

    try {
      const data = await api.lookupRips(invoiceList);
      setResult(data);
      setPage(1); // Reset page on new lookup
    } catch (err: any) {
      setError(err.message || 'Error al conectar con la base de datos PostgreSQL.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedInvoice(id);
    setTimeout(() => setCopiedInvoice(null), 2000);
  };

  const buildWhatsAppLink = (phone?: string | null, message?: string) => {
    const cleanPhone = (phone || '').replace(/[^0-9]/g, '');
    const encoded = encodeURIComponent(message || '');
    if (!cleanPhone) {
      return `https://web.whatsapp.com/send?text=${encoded}`;
    }
    return `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encoded}`;
  };

  // Open Return Note Editor Modal
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

      // Update in result records
      if (result) {
        setResult({
          ...result,
          records: result.records.map((r) => (r.id === updatedInv.id ? { ...r, return_note: updatedInv.return_note } : r)),
        });
      }

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

  // Direct WhatsApp Web Trigger
  const executeWhatsAppSend = (inv: InvoiceRecord, customTplIndex?: number) => {
    const tplIdx = customTplIndex !== undefined ? customTplIndex : getRandomTemplateIndex();
    const message = buildCoworkerWhatsAppMessage(inv, tplIdx);
    const link = buildWhatsAppLink(inv.biller_phone, message);
    window.open(link, '_blank');

    api.notifyWhatsApp({ invoice_id: inv.id }).then(() => {
      if (result) {
        setResult({
          ...result,
          records: result.records.map((r) =>
            r.id === inv.id ? { ...r, whatsapp_notified_at: new Date().toISOString() } : r
          ),
        });
      }
    });
  };

  // User clicked WhatsApp button on a row/card
  const handleWhatsAppButtonClick = (inv: InvoiceRecord) => {
    if (!inv.return_note || !inv.return_note.trim()) {
      openReturnNoteModal(inv);
    } else {
      executeWhatsAppSend(inv);
    }
  };

  // Build consolidated group message
  const createGroupInvoiceMessage = (billerName: string, invoices: InvoiceRecord[]) => {
    let msg = `👋 ¡Hola, *${billerName}*! ¿Cómo estás? Te compartimos el reporte de facturas con novedad del validador para tu revisión:\n\n`;

    invoices.forEach((inv, index) => {
      const fecha = inv.invoice_date || 'No especificada';
      const notaDevolucion = (inv.return_note || inv.error_reason || '').trim() || 'Revisión y ajuste de soportes requeridos.';
      msg += `*${index + 1}. Factura ${inv.invoice_number}*\n`;
      msg += `   • Paciente: ${inv.patient_name}\n`;
      msg += `   • EPS: ${inv.eps_folder}\n`;
      msg += `   • Fecha: ${fecha}\n`;
      msg += `   • Facturador: ${billerName}\n`;
      msg += `   • Nota de Devolución: ${notaDevolucion}\n\n`;
    });

    msg += `Porfa échale un ojito a los soportes respectivos para continuar con el trámite. ¡Mil gracias por tu apoyo! ✨`;
    return msg;
  };

  // Filtered records
  const filteredRecords = (result?.records || []).filter((r) => {
    if (filterEps !== 'ALL' && r.eps_folder !== filterEps) return false;
    if (filterBiller !== 'ALL') {
      const bName = r.biller_display_name || r.biller_raw_name || 'Desconocido';
      if (bName !== filterBiller) return false;
    }
    if (filterStatus !== 'ALL' && r.status !== filterStatus) return false;
    return true;
  });

  // Client-side pagination slice for filteredRecords
  const totalFiltered = filteredRecords.length;
  const startIndex = (page - 1) * limit;
  const paginatedRecords = filteredRecords.slice(startIndex, startIndex + limit);

  // Grouped records by biller for consolidated WhatsApp view
  const groupedByBiller = filteredRecords.reduce((acc, inv) => {
    const billerKey = inv.biller_display_name || inv.biller_raw_name || 'Sin Asignar';
    if (!acc[billerKey]) {
      acc[billerKey] = {
        billerName: billerKey,
        phone: inv.biller_phone,
        invoices: [],
      };
    }
    acc[billerKey].invoices.push(inv);
    return acc;
  }, {} as Record<string, { billerName: string; phone?: string | null; invoices: InvoiceRecord[] }>);

  const uniqueEpsList = Array.from(new Set((result?.records || []).map((r) => r.eps_folder)));
  const uniqueBillerList = Array.from(
    new Set((result?.records || []).map((r) => r.biller_display_name || r.biller_raw_name || 'Desconocido'))
  );

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
      {/* Top Banner / Hero */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-emerald-950/40 p-4 sm:p-6 rounded-2xl border border-slate-700/80 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <FileCheck className="w-64 h-64 text-emerald-400" />
        </div>
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            Conciliación Inteligente con Base de Datos & Notificación WhatsApp Web
          </div>
          <h1 className="text-xl sm:text-3xl font-extrabold text-white tracking-tight">
            Validador RIPS & Notificador a Facturadores
          </h1>
          <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
            Ingresa o pega el listado de números devuelto por el validador. El sistema busca de inmediato en PostgreSQL para asociar automáticamente: 
            <strong className="text-emerald-300"> Paciente</strong>, 
            <strong className="text-cyan-300"> Facturador asignado</strong> (mediante catálogo y alias fonéticos), 
            <strong className="text-indigo-300"> EPS</strong>, 
            <strong className="text-amber-300"> Nota de devolución</strong> y habilita el reenvío directo a 
            <strong className="text-emerald-400"> WhatsApp Web</strong> con plantillas dinámicas de compañeros de trabajo.
          </p>
        </div>
      </div>

      {/* Input Section */}
      <div className="bg-slate-850 rounded-2xl border border-slate-750 p-4 sm:p-5 shadow-xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <label className="text-xs sm:text-sm font-semibold text-slate-200 flex items-center gap-2">
            <Search className="w-4 h-4 text-emerald-400" />
            <span>Números de Facturas del Validador (separados por líneas, comas o espacios)</span>
          </label>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-slate-400 font-medium text-[11px]">Ejemplos:</span>
            <button
              onClick={() => setInputText('HSHJ78965\nHSHJ78860\nHSHJ78967\nHSHJ78506\nHSHJ78652')}
              className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] transition"
            >
              Duplicados Jaime
            </button>
            <button
              onClick={() => setInputText('HSHJ79502\nHSHJ79475\nHSHJ78963\nHSHJ79445\nHSHJ79425')}
              className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] transition"
            >
              Completados Jhon
            </button>
          </div>
        </div>

        <textarea
          rows={3}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Pega aquí los números de facturas... ej:&#10;HSHJ78965&#10;HSHJ79502&#10;HSHJ78860"
          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-slate-100 font-mono text-xs sm:text-sm placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
        />

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="text-xs text-slate-400">
            Total líneas detectadas: <span className="font-semibold text-slate-200 font-mono">{inputText.split(/[\r\n,;\s]+/).filter(Boolean).length}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setInputText('')}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs transition"
            >
              Limpiar
            </button>
            <button
              onClick={handleLookup}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition disabled:opacity-50"
            >
              <FileCheck className="w-4 h-4" />
              <span>{loading ? 'Consultando...' : 'Cruzar con Base de Datos'}</span>
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Results Section */}
      {result && (
        <div className="w-full space-y-4">
          {/* Summary Metric Counters */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-850 p-3.5 rounded-2xl border border-slate-750">
              <span className="text-[11px] text-slate-400 block font-medium">Facturas Consultadas</span>
              <span className="text-xl font-mono font-extrabold text-white mt-1 block">
                {result.searchedCount}
              </span>
            </div>
            <div className="bg-slate-850 p-3.5 rounded-2xl border border-slate-750">
              <span className="text-[11px] text-slate-400 block font-medium">Encontradas en BD</span>
              <span className="text-xl font-mono font-extrabold text-emerald-400 mt-1 block">
                {result.foundCount}
              </span>
            </div>
            <div className="bg-slate-850 p-3.5 rounded-2xl border border-slate-750">
              <span className="text-[11px] text-slate-400 block font-medium">No Encontradas</span>
              <span className="text-xl font-mono font-extrabold text-rose-400 mt-1 block">
                {result.missingCount}
              </span>
            </div>
            <div className="bg-slate-850 p-3.5 rounded-2xl border border-slate-750">
              <span className="text-[11px] text-slate-400 block font-medium">Facturadores Involucrados</span>
              <span className="text-xl font-mono font-extrabold text-amber-400 mt-1 block">
                {result.groupedByBiller?.length || 0}
              </span>
            </div>
          </div>

          {/* Missing invoices warning if any */}
          {result.missingNumbers && result.missingNumbers.length > 0 && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-200 text-xs space-y-1">
              <span className="font-bold flex items-center gap-1 text-rose-300">
                <AlertTriangle className="w-3.5 h-3.5" />
                Facturas no halladas en la base de datos ({result.missingNumbers.length}):
              </span>
              <div className="flex flex-wrap gap-1 font-mono text-[11px]">
                {result.missingNumbers.map((inv) => (
                  <span key={inv} className="bg-slate-900 px-2 py-0.5 rounded border border-rose-500/20">
                    {inv}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Control Bar: Mode Toggle, Intelligent Screen Switch, Filters */}
          <div className="bg-slate-850 p-3 sm:p-4 rounded-2xl border border-slate-750 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Left: View Mode (Individual vs Grouped) + Screen Switch */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-750 text-xs">
                <button
                  type="button"
                  onClick={() => setDisplayType('individual')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition ${
                    displayType === 'individual'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>Por Factura ({filteredRecords.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDisplayType('grouped')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition ${
                    displayType === 'grouped'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Users className="w-3.5 h-3.5" />
                  <span>Agrupado por Facturador</span>
                </button>
              </div>

              {displayType === 'individual' && (
                <ViewModeSwitch
                  viewMode={viewMode}
                  screenType={screenType}
                  isAuto={isAuto}
                  onSelectMode={setViewMode}
                  onResetAuto={resetToAuto}
                />
              )}
            </div>

            {/* Right: Filters */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {/* EPS Filter */}
              <select
                value={filterEps}
                onChange={(e) => {
                  setFilterEps(e.target.value);
                  setPage(1);
                }}
                className="bg-slate-900 border border-slate-700 text-slate-200 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="ALL">Todas las EPS</option>
                {uniqueEpsList.map((e) => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>

              {/* Biller Filter */}
              <select
                value={filterBiller}
                onChange={(e) => {
                  setFilterBiller(e.target.value);
                  setPage(1);
                }}
                className="bg-slate-900 border border-slate-700 text-slate-200 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="ALL">Todos los Facturadores</option>
                {uniqueBillerList.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>

              {/* Status Filter */}
              <select
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value);
                  setPage(1);
                }}
                className="bg-slate-900 border border-slate-700 text-slate-200 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500 col-span-2 sm:col-span-1"
              >
                <option value="ALL">Todos los Estados</option>
                <option value="DUPLICADO">DUPLICADO</option>
                <option value="COMPLETADO">COMPLETADO</option>
              </select>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* DISPLAY TYPE 1: INDIVIDUAL INVOICE LIST (TABLE OR CARDS)                 */}
          {/* ========================================================================= */}
          {displayType === 'individual' && (
            <div className="w-full bg-slate-850 rounded-2xl border border-slate-750 shadow-xl overflow-hidden">
              {totalFiltered === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-10 h-10 text-slate-600 mx-auto mb-2" />
                  <p className="text-slate-300 font-semibold text-sm">No hay facturas con los filtros seleccionados</p>
                  <p className="text-slate-500 text-xs mt-1">Ajusta los filtros de EPS, Facturador o Estado.</p>
                </div>
              ) : viewMode === 'table' ? (
                /* TABLE VIEW FOR DESKTOP */
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
                        <th className="py-3 px-4 font-semibold text-right">Notificar WhatsApp</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-750/70">
                      {paginatedRecords.map((inv) => (
                        <tr key={inv.id} className="hover:bg-slate-800/60 transition group">
                          {/* Factura */}
                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 font-mono font-bold text-white">
                              <span>{inv.invoice_number}</span>
                              <button
                                onClick={() => handleCopy(inv.invoice_number, `inv-r-${inv.id}`)}
                                className="text-slate-500 hover:text-slate-300 opacity-60 group-hover:opacity-100 transition"
                                title="Copiar factura"
                              >
                                {copiedInvoice === `inv-r-${inv.id}` ? (
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

                          {/* Nota de Devolución */}
                          <td className="py-3 px-4 max-w-xs">
                            {inv.return_note ? (
                              <div
                                onClick={() => openReturnNoteModal(inv)}
                                className="cursor-pointer group/note flex items-start gap-1.5 p-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition text-amber-200 text-xs"
                                title="Editar nota de devolución"
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

                          {/* Notificar WhatsApp */}
                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleWhatsAppButtonClick(inv)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] shadow-sm shadow-emerald-600/30 transition"
                                title="Enviar mensaje de WhatsApp al Facturador"
                              >
                                <Send className="w-3 h-3" />
                                <span>WhatsApp</span>
                              </button>

                              <button
                                onClick={() => setSelectedInvoice(inv)}
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition"
                                title="Ver detalle completo"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                /* CARDS VIEW FOR MOBILE / TABLET */
                <div className="p-3 sm:p-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5 sm:gap-4">
                    {paginatedRecords.map((inv) => (
                      <div
                        key={inv.id}
                        className="bg-slate-900/90 rounded-2xl border border-slate-750 hover:border-slate-650 p-4 shadow-lg flex flex-col justify-between gap-3.5 transition"
                      >
                        {/* Top: Factura, Status, Date */}
                        <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-extrabold text-base text-white tracking-wide">
                                {inv.invoice_number}
                              </span>
                              <button
                                onClick={() => handleCopy(inv.invoice_number, `inv-cr-${inv.id}`)}
                                className="text-slate-400 hover:text-white p-0.5"
                                title="Copiar factura"
                              >
                                {copiedInvoice === `inv-cr-${inv.id}` ? (
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
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
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

                        {/* Patient & Biller */}
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

                        {/* Card Actions */}
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
                            title="Ver detalles"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Dynamic Paginator for Results */}
              <Pagination
                page={page}
                limit={limit}
                total={totalFiltered}
                onPageChange={setPage}
                onLimitChange={setLimit}
                allowedLimits={[5, 10, 15]}
              />
            </div>
          )}

          {/* ========================================================================= */}
          {/* DISPLAY TYPE 2: CONSOLIDATED GROUP BY BILLER VIEW                        */}
          {/* ========================================================================= */}
          {displayType === 'grouped' && (
            <div className="space-y-4">
              {Object.keys(groupedByBiller).length === 0 ? (
                <div className="text-center py-12 bg-slate-850 rounded-2xl border border-slate-750">
                  <p className="text-slate-400 text-sm">No hay registros para agrupar con los filtros actuales.</p>
                </div>
              ) : (
                Object.values(groupedByBiller).map((group) => {
                  const groupMessage = createGroupInvoiceMessage(group.billerName, group.invoices);
                  const groupUrl = buildWhatsAppLink(group.phone, groupMessage);
                  const hasPhone = Boolean(group.phone);

                  return (
                    <div
                      key={group.billerName}
                      className="bg-slate-850 rounded-2xl border border-slate-750 overflow-hidden shadow-xl"
                    >
                      {/* Group Header */}
                      <div className="bg-slate-900/95 p-4 border-b border-slate-750 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-sm">
                            {group.billerName.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-extrabold text-base text-white">{group.billerName}</h3>
                              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full text-[11px] font-mono font-bold">
                                {group.invoices.length} facturas
                              </span>
                            </div>
                            <span className="text-xs text-slate-400 font-mono">
                              WhatsApp: <strong className="text-emerald-400">{group.phone || 'No configurado'}</strong>
                            </span>
                          </div>
                        </div>

                        {/* Send Group Message Button */}
                        <a
                          href={groupUrl}
                          target="_blank"
                          rel="noreferrer"
                          className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition shadow-md ${
                            hasPhone
                              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-600/20'
                              : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
                          }`}
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Enviar Consolidado ({group.invoices.length}) por WhatsApp</span>
                        </a>
                      </div>

                      {/* Group Invoices Table/List */}
                      <div className="p-4 space-y-2">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                          {group.invoices.map((inv) => (
                            <div key={inv.id} className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-mono font-bold text-white text-sm">{inv.invoice_number}</span>
                                <span className="text-[10px] font-bold text-cyan-300">{inv.eps_folder}</span>
                              </div>
                              <div className="text-slate-300 font-medium truncate">{inv.patient_name}</div>
                              {inv.return_note && (
                                <div className="text-[11px] text-amber-300/90 bg-amber-500/10 p-1.5 rounded border border-amber-500/20 truncate">
                                  Nota: {inv.return_note}
                                </div>
                              )}
                              <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[10px] text-slate-400">
                                <span>{inv.invoice_date || 'N/A'}</span>
                                <button
                                  onClick={() => handleWhatsAppButtonClick(inv)}
                                  className="text-emerald-400 hover:underline flex items-center gap-0.5"
                                >
                                  <Send className="w-2.5 h-2.5" />
                                  <span>Notificar</span>
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EDITAR NOTA DE DEVOLUCIÓN & ENVIAR POR WHATSAPP                    */}
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

              {/* Live Preview */}
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
