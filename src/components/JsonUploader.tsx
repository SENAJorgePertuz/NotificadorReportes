import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { UploadBatch } from '../types';
import { 
  UploadCloud, 
  FileCode, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  FolderOpen, 
  RefreshCw, 
  Eye, 
  Layers,
  ArrowRight,
  FileText
} from 'lucide-react';
import { Pagination } from './Pagination';

interface JsonUploaderProps {
  onUploadSuccess?: () => void;
  onNavigateToBillers?: () => void;
}

export const JsonUploader: React.FC<JsonUploaderProps> = ({ onUploadSuccess, onNavigateToBillers }) => {
  const [jsonInput, setJsonInput] = useState<string>('');
  const [filename, setFilename] = useState<string>('Lote_Soportes_GIZA.json');
  const [previewRecords, setPreviewRecords] = useState<any[] | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<any | null>(null);
  const [batches, setBatches] = useState<UploadBatch[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);

  // Batches pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(5);

  const fetchBatches = async () => {
    setLoadingBatches(true);
    try {
      const data = await api.getBatches();
      setBatches(data.batches || []);
    } catch (e: any) {
      console.warn('Error fetching batches:', e.message);
    } finally {
      setLoadingBatches(false);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFilename(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setJsonInput(text);
      handleParse(text);
    };
    reader.readAsText(file);
  };

  const handleParse = (text: string) => {
    setParseError(null);
    setUploadResult(null);
    if (!text.trim()) {
      setPreviewRecords(null);
      return;
    }
    try {
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) {
        throw new Error('El JSON debe ser un arreglo de objetos [...]');
      }
      setPreviewRecords(parsed);
    } catch (err: any) {
      setParseError(err.message || 'JSON inválido');
      setPreviewRecords(null);
    }
  };

  const handleSubmit = async () => {
    if (!previewRecords || previewRecords.length === 0) return;
    setUploading(true);
    setUploadResult(null);
    try {
      const result = await api.uploadInvoicesJson(previewRecords, filename);
      setUploadResult(result);
      fetchBatches();
      if (onUploadSuccess) {
        setTimeout(onUploadSuccess, 2000);
      }
    } catch (err: any) {
      alert(`Error al guardar en PostgreSQL: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  // Batches slice
  const totalBatches = batches.length;
  const startIndex = (page - 1) * limit;
  const paginatedBatches = batches.slice(startIndex, startIndex + limit);

  return (
    <div className="w-full space-y-4">
      {/* Header */}
      <div className="bg-slate-850 p-4 sm:p-5 rounded-2xl border border-slate-750 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-white flex items-center gap-2">
            <UploadCloud className="w-6 h-6 text-cyan-400 shrink-0" />
            <span>Carga Masiva de Lotes JSON de Soportes</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Importa la salida del bot unificador de soportes médicos directamente a PostgreSQL con extracción de facturador por ruta de carpeta.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main Upload Box (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-slate-850 rounded-2xl border border-slate-750 p-4 sm:p-5 shadow-xl space-y-4">
            {/* File dropzone / selector */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-750">
              <div className="flex items-center gap-3">
                <input
                  type="file"
                  id="json-file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <label
                  htmlFor="json-file"
                  className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition shadow-md shadow-cyan-600/20"
                >
                  <FileCode className="w-4 h-4" />
                  <span>Seleccionar Archivo JSON</span>
                </label>
                <span className="text-xs text-slate-300 font-mono truncate max-w-[200px]">
                  {filename}
                </span>
              </div>

              <div className="text-xs text-slate-400">
                {previewRecords ? (
                  <span className="text-emerald-400 font-semibold font-mono">
                    ✓ {previewRecords.length} facturas detectadas
                  </span>
                ) : (
                  <span>O pega el JSON directamente abajo:</span>
                )}
              </div>
            </div>

            {/* Direct JSON Textarea */}
            <div>
              <textarea
                rows={7}
                value={jsonInput}
                onChange={(e) => {
                  setJsonInput(e.target.value);
                  handleParse(e.target.value);
                }}
                placeholder="Pega el contenido JSON generado por el bot aquí..."
                className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 font-mono placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-cyan-500 transition"
              />
            </div>

            {parseError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Error de sintaxis JSON: {parseError}</span>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={() => {
                  setJsonInput('');
                  setPreviewRecords(null);
                  setParseError(null);
                }}
                className="text-xs text-slate-400 hover:text-white"
              >
                Limpiar campo
              </button>

              <button
                type="button"
                disabled={!previewRecords || previewRecords.length === 0 || uploading}
                onClick={handleSubmit}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 text-white font-bold text-xs shadow-lg shadow-emerald-600/30 transition"
              >
                <UploadCloud className="w-4 h-4" />
                <span>
                  {uploading
                    ? 'Procesando e insertando en PostgreSQL...'
                    : `Persistir ${previewRecords?.length || 0} Facturas`}
                </span>
              </button>
            </div>
          </div>

          {/* Upload Result Alert */}
          {uploadResult && (
            <div className="bg-slate-850 rounded-2xl border border-emerald-500/40 p-4 sm:p-5 shadow-xl space-y-3">
              <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>¡Lote #{uploadResult.batchId} persistido exitosamente en PostgreSQL!</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-750">
                  <span className="text-slate-400 block text-[10px]">Total Procesados:</span>
                  <span className="text-base font-bold text-white font-mono">{uploadResult.totalProcessed}</span>
                </div>
                <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-750">
                  <span className="text-slate-400 block text-[10px]">Nuevos Guardados:</span>
                  <span className="text-base font-bold text-emerald-400 font-mono">{uploadResult.inserted}</span>
                </div>
                <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-750">
                  <span className="text-slate-400 block text-[10px]">Actualizados:</span>
                  <span className="text-base font-bold text-cyan-400 font-mono">{uploadResult.updated}</span>
                </div>
                <div className="bg-slate-900 p-2.5 rounded-xl border border-slate-750">
                  <span className="text-slate-400 block text-[10px]">Duplicados:</span>
                  <span className="text-base font-bold text-amber-400 font-mono">{uploadResult.duplicatesCount}</span>
                </div>
              </div>

              {uploadResult.newBillersDetected?.length > 0 && (
                <div className="p-3 bg-amber-500/10 rounded-xl border border-amber-500/30 text-xs space-y-2">
                  <div className="text-amber-300 font-semibold flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>Facturadores no reconocidos en el catálogo ({uploadResult.newBillersDetected.length}):</span>
                  </div>
                  <div className="flex flex-wrap gap-1 font-mono text-[11px]">
                    {uploadResult.newBillersDetected.map((b: string) => (
                      <span key={b} className="px-2 py-0.5 rounded bg-slate-900 text-amber-300 border border-amber-500/30">
                        {b}
                      </span>
                    ))}
                  </div>
                  {onNavigateToBillers && (
                    <button
                      onClick={onNavigateToBillers}
                      className="inline-flex items-center gap-1.5 text-xs text-amber-300 hover:text-white font-semibold underline pt-1"
                    >
                      <span>Ir al Directorio de Facturadores para registrar su teléfono y alias</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Upload History / Batches Sidebar (1 col) */}
        <div className="space-y-4">
          <div className="bg-slate-850 rounded-2xl border border-slate-750 shadow-xl overflow-hidden flex flex-col justify-between">
            <div className="p-4 border-b border-slate-750 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-cyan-400" />
                <span>Historial de Lotes Subidos</span>
              </h3>
              <button 
                onClick={fetchBatches} 
                disabled={loadingBatches}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-slate-800"
                title="Refrescar lotes"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingBatches ? 'animate-spin' : ''}`} />
              </button>
            </div>

            <div className="p-4 space-y-2.5">
              {batches.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">
                  No hay lotes previos registrados en PostgreSQL.
                </p>
              ) : (
                paginatedBatches.map((b) => (
                  <div key={b.id} className="p-3 rounded-xl bg-slate-900 border border-slate-750 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-200 truncate max-w-[160px]" title={b.filename}>
                        {b.filename}
                      </span>
                      <span className="text-[10px] text-slate-500 font-mono">
                        ID: #{b.id}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-400">
                      <span>Total: <strong className="text-slate-200">{b.total_records}</strong></span>
                      <span className="text-rose-400">Dup: <strong>{b.duplicates_count}</strong></span>
                      <span className="text-emerald-400">Comp: <strong>{b.completed_count}</strong></span>
                    </div>
                    <div className="text-[10px] text-slate-500 pt-1 border-t border-slate-800 flex justify-between">
                      <span>Por: {b.uploaded_by_username || 'sistema'}</span>
                      <span>{new Date(b.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Pagination for batches */}
            {batches.length > 5 && (
              <Pagination
                page={page}
                limit={limit}
                total={totalBatches}
                onPageChange={setPage}
                onLimitChange={setLimit}
                allowedLimits={[5, 10, 15]}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
