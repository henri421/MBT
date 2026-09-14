import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  MousePointer,
  PlusCircle,
  Network,
  Anchor,
  ArrowDownCircle,
  Layers,
  Sparkles,
  FileText,
  Trash2,
  Grid,
  Undo2,
  Redo2,
  Download,
  Upload,
  Compass,
  ChevronDown,
  Check,
  Box,
  Square,
  FileCode,
  Ruler
} from 'lucide-react';
import { DimensionMode, ModelPreset } from '../types/stm';
import { PRESETS } from '../utils/templates';

interface ToolbarProps {
  activeTool: 'select' | 'add_node' | 'add_member' | 'add_support' | 'add_load';
  onSelectTool: (tool: 'select' | 'add_node' | 'add_member' | 'add_support' | 'add_load') => void;
  dimensionMode: DimensionMode;
  onToggleDimension: (dim: DimensionMode) => void;
  selectedPresetId: string;
  onSelectPreset: (preset: ModelPreset) => void;
  showStrutWidths: boolean;
  onToggleStrutWidths: () => void;
  showForceLabels: boolean;
  onToggleForceLabels: () => void;
  showAngles: boolean;
  onToggleAngles: () => void;
  showDimensions?: boolean;
  onToggleDimensions?: () => void;
  snapGrid: boolean;
  onToggleSnapGrid: () => void;
  canUndo: boolean;
  onUndo: () => void;
  canRedo: boolean;
  onRedo: () => void;
  onExportModel: () => void;
  onExportSvg?: () => void;
  onExportDxf?: () => void;
  onImportModel: (file: File) => void;
  hasSelection: boolean;
  onDeleteSelection: () => void;
  onOpenOptimizer: () => void;
  onOpenReport: () => void;
  onClearModel: () => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({
  activeTool,
  onSelectTool,
  dimensionMode,
  onToggleDimension,
  selectedPresetId,
  onSelectPreset,
  showStrutWidths,
  onToggleStrutWidths,
  showForceLabels,
  onToggleForceLabels,
  showAngles,
  onToggleAngles,
  showDimensions = true,
  onToggleDimensions,
  snapGrid,
  onToggleSnapGrid,
  canUndo,
  onUndo,
  canRedo,
  onRedo,
  onExportModel,
  onExportSvg,
  onExportDxf,
  onImportModel,
  hasSelection,
  onDeleteSelection,
  onOpenOptimizer,
  onOpenReport,
  onClearModel
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const presetDropdownRef = useRef<HTMLDivElement>(null);
  const [isPresetMenuOpen, setIsPresetMenuOpen] = useState(false);
  // La barre d'outils défile horizontalement sur écran étroit ; un conteneur
  // à défilement rogne ses descendants positionnés. Le menu des modèles est
  // donc rendu dans un portail sur <body> et positionné d'après son bouton.
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);

  const updateMenuPosition = useCallback(() => {
    const anchor = presetDropdownRef.current;
    if (!anchor) return;
    const MENU_WIDTH = 352; // w-88
    const MARGIN = 8;
    const rect = anchor.getBoundingClientRect();
    const maxLeft = window.innerWidth - MENU_WIDTH - MARGIN;
    setMenuPosition({
      top: rect.bottom + 6,
      left: Math.max(MARGIN, Math.min(rect.left, maxLeft)),
    });
  }, []);

  useLayoutEffect(() => {
    if (!isPresetMenuOpen) {
      setMenuPosition(null);
      return;
    }
    updateMenuPosition();
  }, [isPresetMenuOpen, updateMenuPosition]);

  useEffect(() => {
    if (!isPresetMenuOpen) return;
    const handler = () => updateMenuPosition();
    window.addEventListener('resize', handler);
    // Capture : suit aussi le défilement horizontal de la barre d'outils.
    window.addEventListener('scroll', handler, true);
    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('scroll', handler, true);
    };
  }, [isPresetMenuOpen, updateMenuPosition]);

  const currentPreset = PRESETS.find(p => p.id === selectedPresetId) || PRESETS[0];

  const presets2D = PRESETS.filter(p => p.dimension === '2D');
  const presets3D = PRESETS.filter(p => p.dimension === '3D');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportModel(file);
      e.target.value = '';
    }
  };

  return (
    <header className="h-14 shrink-0 bg-white border-b border-slate-200 flex items-center justify-between px-4 z-30 select-none shadow-sm gap-2 overflow-x-auto overflow-y-hidden">
      {/* Hidden File Input for JSON Model Import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* Left: Brand & Preset Dropdown & Undo/Redo */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 shrink-0 rounded-lg bg-red-600 flex items-center justify-center font-bold text-white shadow-sm text-xs font-mono">
            STM
          </div>
          <div className="hidden lg:block whitespace-nowrap">
            <h1 className="text-xs font-bold text-slate-900 leading-tight">Bielles &amp; Tirants</h1>
            <p className="text-[10px] font-mono text-slate-500 leading-tight">Eurocode 2 • Zones D</p>
          </div>
        </div>

        <div className="h-6 w-px bg-slate-200 mx-1"></div>

        {/* Custom Preset Selector Menu (Reliable, never closes abruptly) */}
        <div className="relative" ref={presetDropdownRef}>
          <button
            id="select-preset-btn"
            type="button"
            onClick={() => setIsPresetMenuOpen(!isPresetMenuOpen)}
            className="flex items-center justify-between gap-2 bg-slate-50 hover:bg-slate-100 text-slate-900 text-xs font-semibold rounded-lg border border-slate-300 px-3 py-1.5 transition-all shadow-2xs max-w-[290px] focus:ring-2 focus:ring-red-500 focus:outline-none"
            title="Choisir un modèle bielle-tirant prédéfini"
          >
            <div className="flex items-center gap-1.5 truncate">
              <span className="text-sm">
                {currentPreset.dimension === '3D' ? '🧊' : '📐'}
              </span>
              <span className="truncate">{currentPreset.title}</span>
            </div>
            <ChevronDown
              size={14}
              className={`text-slate-500 transition-transform flex-shrink-0 ${
                isPresetMenuOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* Floating Dropdown Menu with stable backdrop */}
          {isPresetMenuOpen && menuPosition && createPortal(
            <>
              <div
                className="fixed inset-0 z-40 bg-transparent"
                onClick={() => setIsPresetMenuOpen(false)}
              />
              <div
                id="preset-menu-popover"
                onClick={(e) => e.stopPropagation()}
                style={{ top: menuPosition.top, left: menuPosition.left }}
                className="fixed w-88 max-w-[calc(100vw-16px)] bg-white rounded-xl shadow-2xl border border-slate-200 py-1.5 z-50 text-xs overflow-hidden max-h-[min(440px,70vh)] overflow-y-auto animate-in fade-in slide-in-from-top-2 duration-150"
              >
              {/* 2D Section */}
              <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 bg-slate-50/70 border-b border-slate-100">
                <Square size={11} className="text-blue-500" />
                <span>Modèles Plans 2D (Eurocode 2 NF EN 1992-1-1)</span>
              </div>
              <div className="py-1">
                {presets2D.map(p => {
                  const isSelected = p.id === selectedPresetId;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        onSelectPreset(p);
                        setIsPresetMenuOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 flex items-start justify-between gap-2 transition-colors ${
                        isSelected
                          ? 'bg-red-50 text-red-950 font-semibold'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs">📐</span>
                          <span className="truncate text-xs font-medium text-slate-900">{p.title}</span>
                        </div>
                        {p.subtitle && (
                          <div className="text-[10px] text-slate-400 truncate pl-4">
                            {p.subtitle}
                          </div>
                        )}
                      </div>
                      {isSelected && (
                        <Check size={14} className="text-red-600 flex-shrink-0 mt-0.5" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* 3D Section */}
              <div className="px-3 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5 bg-slate-50/70 border-t border-b border-slate-100 mt-1">
                <Box size={11} className="text-amber-500" />
                <span>Modèles Spatiaux 3D (Fondations & Massifs)</span>
              </div>
              <div className="py-1">
                {presets3D.map(p => {
                  const isSelected = p.id === selectedPresetId;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        onSelectPreset(p);
                        setIsPresetMenuOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 flex items-start justify-between gap-2 transition-colors ${
                        isSelected
                          ? 'bg-amber-50 text-amber-950 font-semibold'
                          : 'hover:bg-slate-50 text-slate-700'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs">🧊</span>
                          <span className="truncate text-xs font-medium text-slate-900">{p.title}</span>
                        </div>
                        {p.subtitle && (
                          <div className="text-[10px] text-slate-400 truncate pl-4">
                            {p.subtitle}
                          </div>
                        )}
                      </div>
                      {isSelected && (
                        <Check size={14} className="text-amber-600 flex-shrink-0 mt-0.5" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </>,
            document.body,
          )}
        </div>

        {/* Undo / Redo Buttons */}
        <div className="flex items-center bg-slate-100 border border-slate-200 rounded-lg p-0.5 ml-1">
          <button
            id="btn-undo"
            onClick={onUndo}
            disabled={!canUndo}
            className={`p-1.5 rounded-md transition-all ${
              canUndo
                ? 'text-slate-700 hover:text-slate-900 hover:bg-white cursor-pointer active:scale-95'
                : 'text-slate-300 cursor-not-allowed'
            }`}
            title="Annuler (Ctrl+Z)"
          >
            <Undo2 size={15} />
          </button>
          <button
            id="btn-redo"
            onClick={onRedo}
            disabled={!canRedo}
            className={`p-1.5 rounded-md transition-all ${
              canRedo
                ? 'text-slate-700 hover:text-slate-900 hover:bg-white cursor-pointer active:scale-95'
                : 'text-slate-300 cursor-not-allowed'
            }`}
            title="Rétablir (Ctrl+Y)"
          >
            <Redo2 size={15} />
          </button>
        </div>
      </div>

      {/* Center: CAD Drawing Tools */}
      <div className="flex items-center bg-slate-100 border border-slate-200 rounded-lg p-1 gap-1 shrink-0">
        <button
          id="tool-select"
          onClick={() => onSelectTool('select')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            activeTool === 'select'
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200 font-bold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
          title="Sélectionner et déplacer (Clic ou Glisser)"
        >
          <MousePointer size={14} className={activeTool === 'select' ? 'text-red-600' : ''} />
          <span>Sélection</span>
        </button>

        <button
          id="tool-add-node"
          onClick={() => onSelectTool('add_node')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            activeTool === 'add_node'
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200 font-bold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
          title="Ajouter un nœud au clic"
        >
          <PlusCircle size={14} className={activeTool === 'add_node' ? 'text-red-600' : ''} />
          <span>Nœud</span>
        </button>

        <button
          id="tool-add-member"
          onClick={() => onSelectTool('add_member')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            activeTool === 'add_member'
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200 font-bold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
          title="Relier deux nœuds par une barre"
        >
          <Network size={14} className={activeTool === 'add_member' ? 'text-red-600' : ''} />
          <span>Barre</span>
        </button>

        <button
          id="tool-add-support"
          onClick={() => onSelectTool('add_support')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            activeTool === 'add_support'
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200 font-bold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
          title="Basculer un nœud en appui extérieur"
        >
          <Anchor size={14} className={activeTool === 'add_support' ? 'text-red-600' : ''} />
          <span>Appui</span>
        </button>

        <button
          id="tool-add-load"
          onClick={() => onSelectTool('add_load')}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
            activeTool === 'add_load'
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200 font-bold'
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
          }`}
          title="Appliquer une charge extérieure sur un nœud"
        >
          <ArrowDownCircle size={14} className={activeTool === 'add_load' ? 'text-red-600' : ''} />
          <span>Charge</span>
        </button>

        {/* Delete Selection Quick Tool */}
        {hasSelection && (
          <button
            id="tool-delete-selection"
            onClick={onDeleteSelection}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors animate-fadeIn"
            title="Supprimer l'élément sélectionné (Touche Suppr)"
          >
            <Trash2 size={13} />
            <span>Supprimer</span>
          </button>
        )}
      </div>

      {/* Right: View Options & Import/Export & Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {/* 2D / 3D Mode Toggle */}
        <div className="flex bg-slate-100 border border-slate-200 rounded-lg p-0.5">
          <button
            id="btn-mode-2d"
            onClick={() => onToggleDimension('2D')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
              dimensionMode === '2D' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            2D
          </button>
          <button
            id="btn-mode-3d"
            onClick={() => onToggleDimension('3D')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
              dimensionMode === '3D' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            3D
          </button>
        </div>

        {/* Display Toggles: Strut Widths / Angles / Snap */}
        <div className="flex items-center bg-slate-100 border border-slate-200 rounded-lg p-0.5 gap-0.5">
          <button
            id="btn-toggle-strut-widths"
            onClick={onToggleStrutWidths}
            className={`p-1.5 rounded-md text-xs transition-colors ${
              showStrutWidths
                ? 'bg-white text-blue-600 shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Réseau de contraintes (largeurs de bielles w_eff en pointillés)"
          >
            <Layers size={15} />
          </button>

          <button
            id="btn-toggle-angles"
            onClick={onToggleAngles}
            className={`flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors ${
              showAngles
                ? 'bg-white text-blue-700 shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Afficher les angles θ entre bielles et tirants"
          >
            <Compass size={14} />
            <span className="text-[11px] font-mono">θ</span>
          </button>

          {onToggleDimensions && (
            <button
              id="btn-toggle-dimensions"
              onClick={onToggleDimensions}
              className={`p-1.5 rounded-md text-xs transition-colors ${
                showDimensions
                  ? 'bg-white text-indigo-700 shadow-sm font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Afficher/Masquer les lignes de cotes d'ingénierie (L, H, L_appuis)"
            >
              <Ruler size={14} />
            </button>
          )}

          <button
            id="btn-toggle-snap"
            onClick={onToggleSnapGrid}
            className={`p-1.5 rounded-md text-xs transition-colors ${
              snapGrid
                ? 'bg-white text-slate-900 shadow-sm font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Aimantation sur la grille"
          >
            <Grid size={15} />
          </button>
        </div>

        {/* Import & Export Model Buttons */}
        <div className="flex items-center bg-slate-100 border border-slate-200 rounded-lg p-0.5 gap-0.5">
          <button
            id="btn-export-model"
            onClick={onExportModel}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-slate-700 hover:text-slate-900 hover:bg-white transition-colors"
            title="Exporter le modèle de bielles et tirants en JSON"
          >
            <Download size={13} />
            <span className="hidden xl:inline">JSON</span>
          </button>
          {onExportSvg && (
            <button
              id="btn-export-svg"
              onClick={onExportSvg}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold text-slate-800 hover:text-red-700 hover:bg-white transition-colors"
              title="Exporter le schéma structurel avec efforts et nœuds au format SVG"
            >
              <FileCode size={13} className="text-red-600" />
              <span>SVG</span>
            </button>
          )}
          {onExportDxf && (
            <button
              id="btn-export-dxf"
              onClick={onExportDxf}
              className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-semibold text-slate-800 hover:text-indigo-700 hover:bg-white transition-colors"
              title="Exporter le modèle vers AutoCAD / Allplan / Revit (format DXF)"
            >
              <FileCode size={13} className="text-indigo-600" />
              <span>DXF</span>
            </button>
          )}
          <button
            id="btn-import-model"
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-slate-700 hover:text-slate-900 hover:bg-white transition-colors"
            title="Importer un modèle de bielles et tirants (fichier JSON)"
          >
            <Upload size={13} />
            <span className="hidden xl:inline">Importer</span>
          </button>
        </div>

        <div className="h-6 w-px bg-slate-200"></div>

        {/* Schlaich Energy Optimizer Button */}
        <button
          id="btn-open-schlaich-opt"
          onClick={onOpenOptimizer}
          className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-3 py-1.5 rounded-lg text-xs shadow-sm transition-all active:scale-95"
          title="Optimisation géométrique par minimisation de l'énergie de déformation (Schlaich)"
        >
          <Sparkles size={14} className="text-slate-950" />
          <span>Schlaich</span>
        </button>

        {/* Eurocode Calculation Report */}
        <button
          id="btn-open-report"
          onClick={onOpenReport}
          className="flex items-center gap-1.5 bg-white hover:bg-slate-50 text-slate-800 font-medium px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs transition-colors shadow-sm"
          title="Consulter la note de calcul Eurocode 2 détaillée"
        >
          <FileText size={14} className="text-slate-600" />
          <span className="hidden sm:inline">Note EC2</span>
        </button>

        <button
          id="btn-clear-model"
          onClick={onClearModel}
          className="p-1.5 rounded-lg bg-white border border-slate-300 text-slate-500 hover:text-red-600 hover:border-red-300 transition-colors shadow-sm"
          title="Réinitialiser le modèle"
        >
          <Trash2 size={15} />
        </button>
      </div>
    </header>
  );
};
