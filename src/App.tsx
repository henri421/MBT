import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  STMNode,
  STMMember,
  ConcreteMaterial,
  SteelMaterial,
  ConcreteOutline,
  DimensionMode,
  ModelPreset,
  MemberType
} from './types/stm';
import { PRESETS } from './utils/templates';
import { solveTruss } from './utils/matrixSolver';
import { Canvas2D } from './components/Canvas2D';
import { Canvas3D } from './components/Canvas3D';
import { Toolbar } from './components/Toolbar';
import { PropertyPanel } from './components/PropertyPanel';
import { OptimizationModal } from './components/OptimizationModal';
import { ReportExportModal } from './components/ReportExportModal';
import { generateStmSvg, downloadSvgFile } from './utils/svgExporter';
import { ShieldAlert, ChevronLeft, ChevronRight } from 'lucide-react';

interface HistorySnapshot {
  nodes: STMNode[];
  members: STMMember[];
  concreteOutline: ConcreteOutline;
  concreteMat: ConcreteMaterial;
  steelMat: SteelMaterial;
  selectedPresetId: string;
}

export default function App() {
  // Active Preset (default: Console Courte / Corbel)
  const initialPreset = PRESETS[0];

  const [selectedPresetId, setSelectedPresetId] = useState<string>(initialPreset.id);
  const [dimensionMode, setDimensionMode] = useState<DimensionMode>(initialPreset.dimension);
  const [concreteOutline, setConcreteOutline] = useState<ConcreteOutline>(initialPreset.concrete);
  const [concreteMat, setConcreteMat] = useState<ConcreteMaterial>(initialPreset.concreteMat);
  const [steelMat, setSteelMat] = useState<SteelMaterial>(initialPreset.steelMat);
  const [nodes, setNodes] = useState<STMNode[]>(initialPreset.nodes);
  const [members, setMembers] = useState<STMMember[]>(initialPreset.members);

  // History stack for Undo / Redo (Ctrl+Z, Ctrl+Y)
  const [history, setHistory] = useState<HistorySnapshot[]>([
    {
      nodes: initialPreset.nodes,
      members: initialPreset.members,
      concreteOutline: initialPreset.concrete,
      concreteMat: initialPreset.concreteMat,
      steelMat: initialPreset.steelMat,
      selectedPresetId: initialPreset.id
    }
  ]);
  const [historyIndex, setHistoryIndex] = useState<number>(0);

  const pushHistory = useCallback((
    newNodes: STMNode[],
    newMembers: STMMember[],
    newOutline?: ConcreteOutline,
    newMatC?: ConcreteMaterial,
    newMatS?: SteelMaterial,
    newPresetId?: string
  ) => {
    const nextSnapshot: HistorySnapshot = {
      nodes: newNodes,
      members: newMembers,
      concreteOutline: newOutline ?? concreteOutline,
      concreteMat: newMatC ?? concreteMat,
      steelMat: newMatS ?? steelMat,
      selectedPresetId: newPresetId ?? selectedPresetId
    };
    setHistory(prev => [...prev.slice(0, historyIndex + 1), nextSnapshot]);
    setHistoryIndex(prev => prev + 1);
  }, [concreteOutline, concreteMat, steelMat, selectedPresetId, historyIndex]);

  // Tools & Selection
  const [activeTool, setActiveTool] = useState<'select' | 'add_node' | 'add_member' | 'add_support' | 'add_load'>('select');
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  // Display toggles
  const [showStrutWidths, setShowStrutWidths] = useState<boolean>(true);
  const [showForceLabels, setShowForceLabels] = useState<boolean>(true);
  const [showAngles, setShowAngles] = useState<boolean>(true);
  const [snapGrid, setSnapGrid] = useState<boolean>(true);

  // Modals
  const [isOptimizerOpen, setIsOptimizerOpen] = useState<boolean>(false);
  const [isReportOpen, setIsReportOpen] = useState<boolean>(false);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState<boolean>(false);

  // Reactive Solver Computation
  const solverResult = useMemo(() => {
    return solveTruss(
      nodes,
      members,
      concreteMat,
      steelMat,
      concreteOutline.thickness,
      dimensionMode
    );
  }, [nodes, members, concreteMat, steelMat, concreteOutline.thickness, dimensionMode]);

  // Preset switch handler
  const handleSelectPreset = (preset: ModelPreset) => {
    setSelectedPresetId(preset.id);
    setDimensionMode(preset.dimension);
    setConcreteOutline(preset.concrete);
    setConcreteMat(preset.concreteMat);
    setSteelMat(preset.steelMat);
    setNodes(preset.nodes);
    setMembers(preset.members);
    setSelectedNodeId(null);
    setSelectedMemberId(null);
    pushHistory(preset.nodes, preset.members, preset.concrete, preset.concreteMat, preset.steelMat, preset.id);
  };

  // Undo / Redo handlers
  const handleUndo = useCallback(() => {
    if (historyIndex > 0) {
      const targetIdx = historyIndex - 1;
      const snap = history[targetIdx];
      setNodes(snap.nodes);
      setMembers(snap.members);
      setConcreteOutline(snap.concreteOutline);
      setConcreteMat(snap.concreteMat);
      setSteelMat(snap.steelMat);
      setSelectedPresetId(snap.selectedPresetId);
      setSelectedNodeId(null);
      setSelectedMemberId(null);
      setHistoryIndex(targetIdx);
    }
  }, [history, historyIndex]);

  const handleRedo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const targetIdx = historyIndex + 1;
      const snap = history[targetIdx];
      setNodes(snap.nodes);
      setMembers(snap.members);
      setConcreteOutline(snap.concreteOutline);
      setConcreteMat(snap.concreteMat);
      setSteelMat(snap.steelMat);
      setSelectedPresetId(snap.selectedPresetId);
      setSelectedNodeId(null);
      setSelectedMemberId(null);
      setHistoryIndex(targetIdx);
    }
  }, [history, historyIndex]);

  // Node CRUD handlers
  const handleUpdateNode = (updated: STMNode) => {
    setNodes(prev => {
      const next = prev.map(n => n.id === updated.id ? updated : n);
      pushHistory(next, members);
      return next;
    });
  };

  const handleAddNode = (newNode: STMNode) => {
    setNodes(prev => {
      const next = [...prev, newNode];
      pushHistory(next, members);
      return next;
    });
    setSelectedNodeId(newNode.id);
    setSelectedMemberId(null);
  };

  const handleDeleteNode = useCallback((nodeId: string) => {
    setNodes(prevNodes => {
      const nextNodes = prevNodes.filter(n => n.id !== nodeId);
      setMembers(prevMembers => {
        const nextMembers = prevMembers.filter(m => m.fromNodeId !== nodeId && m.toNodeId !== nodeId);
        pushHistory(nextNodes, nextMembers);
        return nextMembers;
      });
      return nextNodes;
    });
    setSelectedNodeId(current => (current === nodeId ? null : current));
  }, [pushHistory]);

  // Member CRUD handlers
  const handleUpdateMember = (updated: STMMember) => {
    setMembers(prev => {
      const next = prev.map(m => m.id === updated.id ? updated : m);
      pushHistory(nodes, next);
      return next;
    });
  };

  const handleAddMember = (fromId: string, toId: string, type: MemberType) => {
    const exists = members.some(
      m => (m.fromNodeId === fromId && m.toNodeId === toId) ||
           (m.fromNodeId === toId && m.toNodeId === fromId)
    );
    if (exists) return;

    const newId = `M${members.length + 1}`;
    const newMember: STMMember = {
      id: newId,
      fromNodeId: fromId,
      toNodeId: toId,
      type: type === 'auto' ? 'strut' : type,
      effectiveWidth: 0.18,
      barDiameter: 20
    };
    setMembers(prev => {
      const next = [...prev, newMember];
      pushHistory(nodes, next);
      return next;
    });
    setSelectedMemberId(newId);
    setSelectedNodeId(null);
  };

  const handleDeleteMember = useCallback((memberId: string) => {
    setMembers(prev => {
      const next = prev.filter(m => m.id !== memberId);
      pushHistory(nodes, next);
      return next;
    });
    setSelectedMemberId(current => (current === memberId ? null : current));
  }, [nodes, pushHistory]);

  // Generic Selection Deletion
  const handleDeleteSelection = useCallback(() => {
    if (selectedNodeId) {
      handleDeleteNode(selectedNodeId);
    } else if (selectedMemberId) {
      handleDeleteMember(selectedMemberId);
    }
  }, [selectedNodeId, selectedMemberId, handleDeleteNode, handleDeleteMember]);

  // Global Keyboard Shortcuts (Ctrl+Z, Ctrl+Y, Delete/Backspace)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }

      // Ctrl+Z / Cmd+Z (Undo)
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }

      // Ctrl+Y / Cmd+Y or Ctrl+Shift+Z (Redo)
      if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
        ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')
      ) {
        e.preventDefault();
        handleRedo();
        return;
      }

      // Delete or Backspace key to remove current selection
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodeId || selectedMemberId) {
          e.preventDefault();
          handleDeleteSelection();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, selectedNodeId, selectedMemberId, handleDeleteSelection]);

  // Import / Export JSON Model
  const handleExportModel = () => {
    const exportPayload = {
      app: 'CivilEngineering-STM',
      version: '1.0.0',
      exportDate: new Date().toISOString(),
      name: PRESETS.find(p => p.id === selectedPresetId)?.title || 'Modèle personnalisé Bielle-Tirant',
      dimensionMode,
      concreteOutline,
      concreteMat,
      steelMat,
      nodes,
      members
    };

    const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
      JSON.stringify(exportPayload, null, 2)
    )}`;
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', jsonString);
    const cleanName = (PRESETS.find(p => p.id === selectedPresetId)?.title || 'modele_bielle_tirant')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_');
    downloadAnchor.setAttribute('download', `${cleanName}_stm.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleExportSvg = useCallback(() => {
    const title = PRESETS.find(p => p.id === selectedPresetId)?.title || 'Modele_Bielles_Tirants';
    const svgString = generateStmSvg(
      nodes,
      members,
      concreteOutline,
      solverResult,
      concreteMat,
      steelMat,
      { modelTitle: title }
    );
    const cleanName = title.toLowerCase().replace(/[^a-z0-9]/g, '_');
    downloadSvgFile(svgString, `${cleanName}_schema.svg`);
  }, [nodes, members, concreteOutline, solverResult, concreteMat, steelMat, selectedPresetId]);

  const handleImportModel = (file: File) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);

        if (parsed.nodes && Array.isArray(parsed.nodes) && parsed.members && Array.isArray(parsed.members)) {
          setNodes(parsed.nodes);
          setMembers(parsed.members);
          if (parsed.concreteOutline) setConcreteOutline(parsed.concreteOutline);
          if (parsed.concreteMat) setConcreteMat(parsed.concreteMat);
          if (parsed.steelMat) setSteelMat(parsed.steelMat);
          if (parsed.dimensionMode) setDimensionMode(parsed.dimensionMode);
          setSelectedPresetId('custom');
          setSelectedNodeId(null);
          setSelectedMemberId(null);
          pushHistory(
            parsed.nodes,
            parsed.members,
            parsed.concreteOutline,
            parsed.concreteMat,
            parsed.steelMat,
            'custom'
          );
        } else {
          alert("Fichier de modèle invalide : clés 'nodes' ou 'members' manquantes.");
        }
      } catch (err) {
        console.error(err);
        alert("Erreur lors de la lecture du fichier JSON de modèle.");
      }
    };
    reader.readAsText(file);
  };

  // Schlaich optimization apply handler
  const handleApplyOptimization = (optimizedNodes: STMNode[]) => {
    setNodes(optimizedNodes);
    pushHistory(optimizedNodes, members);
  };

  // Clear model
  const handleClearModel = () => {
    setNodes([]);
    setMembers([]);
    setSelectedNodeId(null);
    setSelectedMemberId(null);
    pushHistory([], []);
  };

  // Stats calculation
  const totalAppliedVerticalLoad = useMemo(() => {
    return nodes.reduce((sum, n) => sum + Math.abs(n.fy || n.fz || 0), 0);
  }, [nodes]);

  const strutsCount = useMemo(() => {
    if (!solverResult) return members.filter(m => m.type === 'strut').length;
    let count = 0;
    solverResult.memberResults.forEach(r => { if (r.isCompression) count++; });
    return count;
  }, [members, solverResult]);

  const tiesCount = useMemo(() => {
    if (!solverResult) return members.filter(m => m.type === 'tie').length;
    let count = 0;
    solverResult.memberResults.forEach(r => { if (!r.isCompression) count++; });
    return count;
  }, [members, solverResult]);

  return (
    <div className="flex flex-col h-screen w-screen bg-white text-slate-900 overflow-hidden select-none font-sans">
      {/* Top Application Toolbar */}
      <Toolbar
        activeTool={activeTool}
        onSelectTool={setActiveTool}
        dimensionMode={dimensionMode}
        onToggleDimension={setDimensionMode}
        selectedPresetId={selectedPresetId}
        onSelectPreset={handleSelectPreset}
        showStrutWidths={showStrutWidths}
        onToggleStrutWidths={() => setShowStrutWidths(!showStrutWidths)}
        showForceLabels={showForceLabels}
        onToggleForceLabels={() => setShowForceLabels(!showForceLabels)}
        showAngles={showAngles}
        onToggleAngles={() => setShowAngles(!showAngles)}
        snapGrid={snapGrid}
        onToggleSnapGrid={() => setSnapGrid(!snapGrid)}
        canUndo={historyIndex > 0}
        onUndo={handleUndo}
        canRedo={historyIndex < history.length - 1}
        onRedo={handleRedo}
        onExportModel={handleExportModel}
        onExportSvg={handleExportSvg}
        onImportModel={handleImportModel}
        hasSelection={Boolean(selectedNodeId || selectedMemberId)}
        onDeleteSelection={handleDeleteSelection}
        onOpenOptimizer={() => setIsOptimizerOpen(true)}
        onOpenReport={() => setIsReportOpen(true)}
        onClearModel={handleClearModel}
      />

      {/* Main Workspace: Left Canvas + Right Property Inspector */}
      <div className="flex-1 flex overflow-hidden relative w-full h-full min-w-0">
        {/* Canvas Area (2D SVG or 3D Three.js) */}
        <div className="flex-1 h-full relative bg-white min-w-0 overflow-hidden">
          {dimensionMode === '2D' ? (
            <Canvas2D
              nodes={nodes}
              members={members}
              concrete={concreteOutline}
              solverResult={solverResult}
              activeTool={activeTool}
              selectedNodeId={selectedNodeId}
              selectedMemberId={selectedMemberId}
              onSelectNode={setSelectedNodeId}
              onSelectMember={setSelectedMemberId}
              onUpdateNode={handleUpdateNode}
              onAddNode={handleAddNode}
              onAddMember={handleAddMember}
              onDeleteNode={handleDeleteNode}
              onDeleteMember={handleDeleteMember}
              showStrutWidths={showStrutWidths}
              showForceLabels={showForceLabels}
              showAngles={showAngles}
              snapGrid={snapGrid}
              gridSize={0.05}
            />
          ) : (
            <Canvas3D
              nodes={nodes}
              members={members}
              concrete={concreteOutline}
              solverResult={solverResult}
              selectedNodeId={selectedNodeId}
              selectedMemberId={selectedMemberId}
              onSelectNode={setSelectedNodeId}
              onSelectMember={setSelectedMemberId}
            />
          )}

          {/* Floating Model Description Banner */}
          <div className="absolute top-3 left-3 bg-white/90 backdrop-blur border border-slate-200 rounded-lg px-3 py-2 max-w-sm pointer-events-none shadow-sm z-10">
            <h3 className="text-xs font-bold text-slate-900">
              {PRESETS.find(p => p.id === selectedPresetId)?.title || 'Modèle Personnalisé'}
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
              {PRESETS.find(p => p.id === selectedPresetId)?.description || 'Zone de discontinuité D'}
            </p>
          </div>

          {/* Solver Warnings Banner */}
          {!solverResult.isStable && solverResult.message && (
            <div className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-red-50 border border-red-300 rounded-lg px-4 py-2 text-xs text-red-800 flex items-center gap-2 shadow-md z-10">
              <ShieldAlert size={16} className="text-red-600 flex-shrink-0" />
              <span>{solverResult.message}</span>
            </div>
          )}

          {/* Panel Collapse / Expand Button */}
          <button
            id="btn-toggle-panel"
            onClick={() => setIsPanelCollapsed(!isPanelCollapsed)}
            className="absolute top-1/2 -translate-y-1/2 right-0 z-20 bg-white hover:bg-slate-100 text-slate-600 border-l border-y border-slate-300 rounded-l-md p-1.5 shadow-md transition-transform"
            title={isPanelCollapsed ? "Afficher les propriétés et aciers" : "Masquer le panneau"}
          >
            {isPanelCollapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
          </button>
        </div>

        {/* Right Property & Material Inspector Panel */}
        {!isPanelCollapsed && (
          <PropertyPanel
            selectedPresetId={selectedPresetId}
            selectedNodeId={selectedNodeId}
            selectedMemberId={selectedMemberId}
            nodes={nodes}
            members={members}
            concreteOutline={concreteOutline}
            concreteMat={concreteMat}
            steelMat={steelMat}
            solverResult={solverResult}
            onSelectNode={setSelectedNodeId}
            onSelectMember={setSelectedMemberId}
            onUpdateNode={handleUpdateNode}
            onAddNode={handleAddNode}
            onDeleteNode={handleDeleteNode}
            onUpdateMember={handleUpdateMember}
            onAddMember={handleAddMember}
            onDeleteMember={handleDeleteMember}
            onUpdateConcreteMat={setConcreteMat}
            onUpdateSteelMat={setSteelMat}
            onUpdateConcreteOutline={setConcreteOutline}
          />
        )}
      </div>

      {/* Engineering Bottom Status Bar */}
      <footer className="h-8 bg-white border-t border-slate-200 px-4 flex items-center justify-between text-[11px] font-mono text-slate-600 z-10 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="text-slate-900 font-semibold">{nodes.length} Nœuds</span>
          </div>
          <div>
            Bielles (C) : <span className="text-blue-600 font-bold">{strutsCount}</span>
          </div>
          <div>
            Tirants (T) : <span className="text-red-600 font-bold">{tiesCount}</span>
          </div>
          <div>
            Charge totale : <span className="text-slate-900 font-bold">{totalAppliedVerticalLoad.toFixed(0)} kN</span>
          </div>
        </div>

        <div className="flex items-center gap-5">
          <div>
            Énergie Schlaich : <span className="text-amber-700 font-bold">{solverResult.totalStrainEnergy.toFixed(1)} J</span>
          </div>
          <div>
            Acier requis : <span className="text-slate-900 font-bold">{solverResult.totalSteelWeightEst.toFixed(1)} kg</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span>Taux max :</span>
            <span className={`font-bold ${solverResult.maxUtilization > 1.0 ? 'text-red-600' : 'text-emerald-600'}`}>
              {(solverResult.maxUtilization * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      </footer>

      {/* Optimization Modal Dialog */}
      <OptimizationModal
        isOpen={isOptimizerOpen}
        onClose={() => setIsOptimizerOpen(false)}
        nodes={nodes}
        members={members}
        concreteMat={concreteMat}
        steelMat={steelMat}
        concreteOutline={concreteOutline}
        dimension={dimensionMode}
        onApplyOptimization={handleApplyOptimization}
      />

      {/* Eurocode 2 Calculation Report Sheet Modal */}
      <ReportExportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        nodes={nodes}
        members={members}
        concreteMat={concreteMat}
        steelMat={steelMat}
        concreteOutline={concreteOutline}
        solverResult={solverResult}
      />
    </div>
  );
}
