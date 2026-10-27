import React from 'react';
import { LayoutGrid, Table, Smartphone, Monitor, Tablet } from 'lucide-react';
import { ViewMode, ScreenType } from '../hooks/useScreenType';

interface ViewModeSwitchProps {
  viewMode: ViewMode;
  screenType: ScreenType;
  isAuto: boolean;
  onSelectMode: (mode: ViewMode) => void;
  onResetAuto: () => void;
}

export const ViewModeSwitch: React.FC<ViewModeSwitchProps> = ({
  viewMode,
  screenType,
  isAuto,
  onSelectMode,
  onResetAuto,
}) => {
  return (
    <div className="flex items-center gap-1.5 bg-slate-900/90 p-1 rounded-xl border border-slate-750 text-xs">
      {/* Screen Type Badge */}
      <div 
        className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-800 text-[11px] text-slate-400 font-medium"
        title={`Pantalla detectada: ${screenType}`}
      >
        {screenType === 'mobile' && <Smartphone className="w-3 h-3 text-emerald-400" />}
        {screenType === 'tablet' && <Tablet className="w-3 h-3 text-cyan-400" />}
        {screenType === 'desktop' && <Monitor className="w-3 h-3 text-indigo-400" />}
        <span className="capitalize">{screenType}</span>
      </div>

      <div className="h-3 w-[1px] bg-slate-800 hidden sm:block" />

      {/* Auto Switch */}
      <button
        type="button"
        onClick={onResetAuto}
        className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition ${
          isAuto
            ? 'bg-slate-700/90 text-emerald-300 shadow-sm border border-slate-650'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
        }`}
        title="Modo Inteligente: detecta automáticamente si usar Tabla o Tarjetas según el ancho de pantalla"
      >
        Auto
      </button>

      {/* Table Button */}
      <button
        type="button"
        onClick={() => onSelectMode('table')}
        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition ${
          !isAuto && viewMode === 'table'
            ? 'bg-emerald-600 text-white shadow-sm'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
        }`}
        title="Vista en Tabla"
      >
        <Table className="w-3.5 h-3.5" />
        <span className="hidden xs:inline">Tabla</span>
      </button>

      {/* Cards Button */}
      <button
        type="button"
        onClick={() => onSelectMode('cards')}
        className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition ${
          !isAuto && viewMode === 'cards'
            ? 'bg-emerald-600 text-white shadow-sm'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
        }`}
        title="Vista en Tarjetas (Cards)"
      >
        <LayoutGrid className="w-3.5 h-3.5" />
        <span className="hidden xs:inline">Tarjetas</span>
      </button>
    </div>
  );
};
