import React, { useState } from 'react';
import {
  STMNode,
  STMMember,
  ConcreteMaterial,
  SteelMaterial,
  ConcreteOutline,
  SolverResult,
  MemberType,
  NodeType
} from '../types/stm';
import { buildParametricConcrete } from '../utils/geometryHelpers';
import {
  COMMERCIAL_DIAMETERS,
  getBarAreaCm2,
  getLinearMassKgPerM,
  calculateAnchorageLengths,
  findCommercialRebarOptions,
  calculateSuspensionStirrups
} from '../utils/rebarCalculator';
import {
  Layers,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Settings,
  CircleDot,
  Maximize2,
  Zap,
  Activity,
  Box,
  Compass,
  Anchor,
  ShieldCheck,
  Copy,
  Check,
  Hash,
  FileSpreadsheet
} from 'lucide-react';

interface PropertyPanelProps {
  selectedPresetId: string;
  selectedNodeId: string | null;
  selectedMemberId: string | null;
  nodes: STMNode[];
  members: STMMember[];
  concreteOutline: ConcreteOutline;
  concreteMat: ConcreteMaterial;
  steelMat: SteelMaterial;
  solverResult: SolverResult | null;
  onSelectNode: (id: string | null) => void;
  onSelectMember: (id: string | null) => void;
  onUpdateNode: (node: STMNode) => void;
  onAddNode: (node: STMNode) => void;
  onDeleteNode: (nodeId: string) => void;
  onUpdateMember: (member: STMMember) => void;
  onAddMember: (fromId: string, toId: string, type: MemberType) => void;
  onDeleteMember: (memberId: string) => void;
  onUpdateConcreteMat: (mat: ConcreteMaterial) => void;
  onUpdateSteelMat: (mat: SteelMaterial) => void;
  onUpdateConcreteOutline: (outline: ConcreteOutline) => void;
}

export const PropertyPanel: React.FC<PropertyPanelProps> = ({
  selectedPresetId,
  selectedNodeId,
  selectedMemberId,
  nodes,
  members,
  concreteOutline,
  concreteMat,
  steelMat,
  solverResult,
  onSelectNode,
  onSelectMember,
  onUpdateNode,
  onAddNode,
  onDeleteNode,
  onUpdateMember,
  onAddMember,
  onDeleteMember,
  onUpdateConcreteMat,
  onUpdateSteelMat,
  onUpdateConcreteOutline
}) => {
  const [activeTab, setActiveTab] = useState<'geometry' | 'nodes' | 'members' | 'materials' | 'rebar'>('geometry');
  const [copiedSchedule, setCopiedSchedule] = useState(false);

  // Quick new node state
  const [newNodeX, setNewNodeX] = useState<number>(1.0);
  const [newNodeY, setNewNodeY] = useState<number>(0.5);

  // Quick new member state
  const [newFromNode, setNewFromNode] = useState<string>(nodes[0]?.id || '');
  const [newToNode, setNewToNode] = useState<string>(nodes[1]?.id || '');

  // Eurocode 2 calculated values
  const fcd = (concreteMat.alphaCc * concreteMat.fck) / concreteMat.gammaC;
  const nuPrime = 1.0 - concreteMat.fck / 250.0;
  const fyd = steelMat.fyk / steelMat.gammaS;

  // Selected entities
  const selectedNode = selectedNodeId ? nodes.find(n => n.id === selectedNodeId) : null;
  const selectedMember = selectedMemberId ? members.find(m => m.id === selectedMemberId) : null;

  // Handler for quick parametric dimensions
  const handleUpdateDimensionParam = (paramName: string, value: number) => {
    if (paramName === 'thickness') {
      onUpdateConcreteOutline({ ...concreteOutline, thickness: value });
      return;
    }

    // Get current bounding width/height
    const xs = concreteOutline.points2D.map(p => p[0]);
    const ys = concreteOutline.points2D.map(p => p[1]);
    const curWidth = Math.max(...xs) - Math.min(...xs);
    const curHeight = Math.max(...ys) - Math.min(...ys);

    const newParams: any = {
      length: paramName === 'length' ? value : curWidth,
      height: paramName === 'height' ? value : curHeight,
      corbelLength: paramName === 'corbelLength' ? value : 0.45,
      corbelTipHeight: paramName === 'corbelTipHeight' ? value : 0.50,
      columnWidth: paramName === 'columnWidth' ? value : 0.40
    };

    const newPoints = buildParametricConcrete(selectedPresetId, newParams);
    onUpdateConcreteOutline({
      ...concreteOutline,
      points2D: newPoints
    });
  };

  return (
    <aside className="w-80 md:w-96 lg:w-[420px] max-w-full h-full bg-white border-l border-slate-200 flex flex-col overflow-hidden text-xs text-slate-700 select-none shadow-sm">
      {/* Top Tabs */}
      <div className="flex border-b border-slate-200 bg-slate-50/80 px-1.5 pt-2 gap-0.5 overflow-x-auto">
        <button
          onClick={() => setActiveTab('geometry')}
          className={`flex items-center gap-1 px-2.5 py-1.5 font-semibold text-xs rounded-t-lg transition-all border-t border-x whitespace-nowrap ${
            activeTab === 'geometry'
              ? 'bg-white text-slate-900 border-slate-200 -mb-px shadow-sm'
              : 'text-slate-500 hover:text-slate-800 border-transparent'
          }`}
        >
          <Box size={13} className={activeTab === 'geometry' ? 'text-red-600' : 'text-slate-400'} />
          <span>Géométrie</span>
        </button>

        <button
          onClick={() => setActiveTab('nodes')}
          className={`flex items-center gap-1 px-2.5 py-1.5 font-semibold text-xs rounded-t-lg transition-all border-t border-x whitespace-nowrap ${
            activeTab === 'nodes'
              ? 'bg-white text-slate-900 border-slate-200 -mb-px shadow-sm'
              : 'text-slate-500 hover:text-slate-800 border-transparent'
          }`}
        >
          <CircleDot size={13} className={activeTab === 'nodes' ? 'text-red-600' : 'text-slate-400'} />
          <span>Nœuds ({nodes.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('members')}
          className={`flex items-center gap-1 px-2.5 py-1.5 font-semibold text-xs rounded-t-lg transition-all border-t border-x whitespace-nowrap ${
            activeTab === 'members'
              ? 'bg-white text-slate-900 border-slate-200 -mb-px shadow-sm'
              : 'text-slate-500 hover:text-slate-800 border-transparent'
          }`}
        >
          <Layers size={13} className={activeTab === 'members' ? 'text-red-600' : 'text-slate-400'} />
          <span>Barres ({members.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('rebar')}
          className={`flex items-center gap-1 px-2.5 py-1.5 font-semibold text-xs rounded-t-lg transition-all border-t border-x whitespace-nowrap ${
            activeTab === 'rebar'
              ? 'bg-white text-slate-900 border-slate-200 -mb-px shadow-sm'
              : 'text-slate-500 hover:text-slate-800 border-transparent'
          }`}
        >
          <ShieldCheck size={13} className={activeTab === 'rebar' ? 'text-red-600' : 'text-slate-400'} />
          <span>Aciers HA</span>
        </button>

        <button
          onClick={() => setActiveTab('materials')}
          className={`flex items-center gap-1 px-2.5 py-1.5 font-semibold text-xs rounded-t-lg transition-all border-t border-x whitespace-nowrap ${
            activeTab === 'materials'
              ? 'bg-white text-slate-900 border-slate-200 -mb-px shadow-sm'
              : 'text-slate-500 hover:text-slate-800 border-transparent'
          }`}
        >
          <Settings size={13} className={activeTab === 'materials' ? 'text-red-600' : 'text-slate-400'} />
          <span>Matériaux</span>
        </button>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">

        {/* TAB 1: GÉOMÉTRIE PARAMÉTRIQUE */}
        {activeTab === 'geometry' && (
          <div className="space-y-4">
            <div className="border border-slate-200 rounded-lg p-3 bg-slate-50/50 space-y-3">
              <h3 className="font-bold text-slate-900 text-xs flex items-center justify-between">
                <span>Dimensions Générales de l'Élément</span>
                <span className="text-[10px] font-mono font-normal text-slate-500">{concreteOutline.name}</span>
              </h3>

              {/* Epaisseur bw - Saisie directe (sans curseur) */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label htmlFor="input-concrete-thickness" className="text-slate-700 font-semibold text-xs">
                    Épaisseur du béton bw :
                  </label>
                  <span className="text-[11px] font-mono text-slate-500 font-bold">
                    {(concreteOutline.thickness * 100).toFixed(0)} cm
                  </span>
                </div>
                <div className="relative">
                  <input
                    id="input-concrete-thickness"
                    type="number"
                    step="0.01"
                    min="0.05"
                    max="10.00"
                    value={concreteOutline.thickness}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      if (!isNaN(val) && val > 0) {
                        handleUpdateDimensionParam('thickness', val);
                      }
                    }}
                    className="w-full border border-slate-300 rounded-md px-3 py-1.5 text-slate-900 font-mono font-bold text-xs focus:ring-2 focus:ring-red-500 focus:border-red-500 focus:outline-none bg-slate-50 hover:bg-white transition-colors"
                    placeholder="0.30"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-xs pointer-events-none font-semibold">
                    m
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  Saisie numérique directe en mètres (ex: 0.35 pour 35 cm, 0.55 pour 55 cm).
                </p>
              </div>

              {/* Cas type console courte sur poteau */}
              {selectedPresetId === 'corbel' && (
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <span className="text-[11px] font-bold text-slate-800 block">Paramètres Console Eurocode 2 :</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-500 font-mono block">Saillie ac (m)</label>
                      <input
                        type="number"
                        step="0.05"
                        defaultValue="0.45"
                        onChange={(e) => handleUpdateDimensionParam('corbelLength', parseFloat(e.target.value) || 0.45)}
                        className="w-full border border-slate-300 rounded px-2 py-1 text-slate-900 font-mono text-xs focus:ring-1 focus:ring-red-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 font-mono block">Hauteur totale h (m)</label>
                      <input
                        type="number"
                        step="0.05"
                        defaultValue="0.85"
                        onChange={(e) => handleUpdateDimensionParam('height', parseFloat(e.target.value) || 0.85)}
                        className="w-full border border-slate-300 rounded px-2 py-1 text-slate-900 font-mono text-xs focus:ring-1 focus:ring-red-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 font-mono block">Hauteur nez h1 (m)</label>
                      <input
                        type="number"
                        step="0.05"
                        defaultValue="0.50"
                        onChange={(e) => handleUpdateDimensionParam('corbelTipHeight', parseFloat(e.target.value) || 0.50)}
                        className="w-full border border-slate-300 rounded px-2 py-1 text-slate-900 font-mono text-xs focus:ring-1 focus:ring-red-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 font-mono block">Poteau b_col (m)</label>
                      <input
                        type="number"
                        step="0.05"
                        defaultValue="0.40"
                        onChange={(e) => handleUpdateDimensionParam('columnWidth', parseFloat(e.target.value) || 0.40)}
                        className="w-full border border-slate-300 rounded px-2 py-1 text-slate-900 font-mono text-xs focus:ring-1 focus:ring-red-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Cas type console courte sur poutre */}
              {selectedPresetId === 'corbel_on_beam' && (
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <span className="text-[11px] font-bold text-slate-800 block">Paramètres Console sur Poutre :</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-500 font-mono block">Portée poutre L (m)</label>
                      <input
                        type="number"
                        step="0.10"
                        defaultValue="3.20"
                        onChange={(e) => handleUpdateDimensionParam('length', parseFloat(e.target.value) || 3.20)}
                        className="w-full border border-slate-300 rounded px-2 py-1 text-slate-900 font-mono text-xs focus:ring-1 focus:ring-red-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 font-mono block">Hauteur poutre H (m)</label>
                      <input
                        type="number"
                        step="0.05"
                        defaultValue="1.20"
                        onChange={(e) => handleUpdateDimensionParam('height', parseFloat(e.target.value) || 1.20)}
                        className="w-full border border-slate-300 rounded px-2 py-1 text-slate-900 font-mono text-xs focus:ring-1 focus:ring-red-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 font-mono block">Saillie console (m)</label>
                      <input
                        type="number"
                        step="0.05"
                        defaultValue="0.60"
                        onChange={(e) => handleUpdateDimensionParam('corbelLength', parseFloat(e.target.value) || 0.60)}
                        className="w-full border border-slate-300 rounded px-2 py-1 text-slate-900 font-mono text-xs focus:ring-1 focus:ring-red-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Cas type semelle 2 pieux */}
              {selectedPresetId === 'pile_cap_2_piles' && (
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <span className="text-[11px] font-bold text-slate-800 block">Paramètres Semelle 2 Pieux :</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-500 font-mono block">Longueur L (m)</label>
                      <input
                        type="number"
                        step="0.10"
                        defaultValue="2.40"
                        onChange={(e) => handleUpdateDimensionParam('length', parseFloat(e.target.value) || 2.40)}
                        className="w-full border border-slate-300 rounded px-2 py-1 text-slate-900 font-mono text-xs focus:ring-1 focus:ring-red-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 font-mono block">Hauteur H (m)</label>
                      <input
                        type="number"
                        step="0.05"
                        defaultValue="0.90"
                        onChange={(e) => handleUpdateDimensionParam('height', parseFloat(e.target.value) || 0.90)}
                        className="w-full border border-slate-300 rounded px-2 py-1 text-slate-900 font-mono text-xs focus:ring-1 focus:ring-red-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Cas type semelles 3 ou 4 pieux (3D) */}
              {(selectedPresetId === 'pile_cap_3_piles' || selectedPresetId === 'pile_cap_4_piles') && (
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <span className="text-[11px] font-bold text-slate-800 block">Paramètres Semelle Spatiale (3D) :</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-500 font-mono block">Côté emprise (m)</label>
                      <input
                        type="number"
                        step="0.10"
                        defaultValue="2.40"
                        onChange={(e) => handleUpdateDimensionParam('length', parseFloat(e.target.value) || 2.40)}
                        className="w-full border border-slate-300 rounded px-2 py-1 text-slate-900 font-mono text-xs focus:ring-1 focus:ring-red-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 font-mono block">Hauteur totale (m)</label>
                      <input
                        type="number"
                        step="0.05"
                        defaultValue="0.90"
                        onChange={(e) => handleUpdateDimensionParam('height', parseFloat(e.target.value) || 0.90)}
                        className="w-full border border-slate-300 rounded px-2 py-1 text-slate-900 font-mono text-xs focus:ring-1 focus:ring-red-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Cas type poutre cloison (standard ou excentrée) */}
              {(selectedPresetId === 'deep_beam' || selectedPresetId === 'deep_beam_eccentric') && (
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <span className="text-[11px] font-bold text-slate-800 block">Paramètres Poutre-Cloison :</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-500 font-mono block">Portée L (m)</label>
                      <input
                        type="number"
                        step="0.10"
                        defaultValue={selectedPresetId === 'deep_beam_eccentric' ? '3.60' : '3.20'}
                        onChange={(e) => handleUpdateDimensionParam('length', parseFloat(e.target.value) || 3.2)}
                        className="w-full border border-slate-300 rounded px-2 py-1 text-slate-900 font-mono text-xs focus:ring-1 focus:ring-red-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 font-mono block">Hauteur H (m)</label>
                      <input
                        type="number"
                        step="0.10"
                        defaultValue="2.00"
                        onChange={(e) => handleUpdateDimensionParam('height', parseFloat(e.target.value) || 2.0)}
                        className="w-full border border-slate-300 rounded px-2 py-1 text-slate-900 font-mono text-xs focus:ring-1 focus:ring-red-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Sommets du polygone de coffrage (Édition point par point) */}
            <div className="border border-slate-200 rounded-lg p-3 space-y-2 bg-white">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900 text-xs">Sommets du Contour Béton</span>
                <span className="text-[10px] text-slate-500 font-mono">{concreteOutline.points2D.length} sommets</span>
              </div>

              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {concreteOutline.points2D.map((pt, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-slate-50 p-1.5 rounded border border-slate-200">
                    <span className="text-[10px] font-mono text-slate-500 w-5 font-bold">P{idx + 1}</span>
                    <div className="flex items-center gap-1 flex-1">
                      <span className="text-[10px] text-slate-400 font-mono">X:</span>
                      <input
                        type="number"
                        step="0.05"
                        value={pt[0]}
                        onChange={(e) => {
                          const newPts = [...concreteOutline.points2D];
                          newPts[idx] = [parseFloat(e.target.value) || 0, pt[1]];
                          onUpdateConcreteOutline({ ...concreteOutline, points2D: newPts });
                        }}
                        className="w-full border border-slate-300 rounded px-1 py-0.5 text-[11px] font-mono text-slate-900 focus:outline-none focus:border-red-500"
                      />
                    </div>
                    <div className="flex items-center gap-1 flex-1">
                      <span className="text-[10px] text-slate-400 font-mono">Y:</span>
                      <input
                        type="number"
                        step="0.05"
                        value={pt[1]}
                        onChange={(e) => {
                          const newPts = [...concreteOutline.points2D];
                          newPts[idx] = [pt[0], parseFloat(e.target.value) || 0];
                          onUpdateConcreteOutline({ ...concreteOutline, points2D: newPts });
                        }}
                        className="w-full border border-slate-300 rounded px-1 py-0.5 text-[11px] font-mono text-slate-900 focus:outline-none focus:border-red-500"
                      />
                    </div>
                    {concreteOutline.points2D.length > 3 && (
                      <button
                        onClick={() => {
                          const newPts = concreteOutline.points2D.filter((_, i) => i !== idx);
                          onUpdateConcreteOutline({ ...concreteOutline, points2D: newPts });
                        }}
                        className="text-slate-400 hover:text-red-600 p-0.5"
                        title="Supprimer ce sommet"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <button
                onClick={() => {
                  const lastPt = concreteOutline.points2D[concreteOutline.points2D.length - 1] || [0, 0];
                  const newPts: [number, number][] = [...concreteOutline.points2D, [lastPt[0] + 0.5, lastPt[1]]];
                  onUpdateConcreteOutline({ ...concreteOutline, points2D: newPts });
                }}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded text-xs transition-colors"
              >
                <Plus size={13} />
                <span>Ajouter un sommet de contour</span>
              </button>
            </div>
          </div>
        )}

        {/* TAB 2: ONGLET NŒUDS PARAMÉTRIQUES */}
        {activeTab === 'nodes' && (
          <div className="space-y-3">
            {/* Action Bar: Nouveau Nœud */}
            <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50 flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-800 whitespace-nowrap">+ Nœud :</span>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-400 font-mono">X:</span>
                <input
                  type="number"
                  step="0.05"
                  value={newNodeX}
                  onChange={(e) => setNewNodeX(parseFloat(e.target.value) || 0)}
                  className="w-14 border border-slate-300 rounded px-1.5 py-0.5 text-xs font-mono text-slate-900"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-400 font-mono">Y:</span>
                <input
                  type="number"
                  step="0.05"
                  value={newNodeY}
                  onChange={(e) => setNewNodeY(parseFloat(e.target.value) || 0)}
                  className="w-14 border border-slate-300 rounded px-1.5 py-0.5 text-xs font-mono text-slate-900"
                />
              </div>
              <button
                onClick={() => {
                  const newId = `N${nodes.length + 1}`;
                  onAddNode({
                    id: newId,
                    x: newNodeX,
                    y: newNodeY,
                    bearingWidth: 0.20
                  });
                }}
                className="flex items-center gap-1 px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-bold transition-colors ml-auto shadow-sm"
              >
                <Plus size={13} />
                <span>Créer</span>
              </button>
            </div>

            {/* Tableau / Liste détaillée de tous les nœuds */}
            <div className="space-y-2">
              {nodes.map((node) => {
                const isSelected = selectedNodeId === node.id;
                const nodeRes = solverResult?.nodeResults.get(node.id);

                return (
                  <div
                    key={node.id}
                    className={`border rounded-lg p-2.5 transition-all ${
                      isSelected
                        ? 'border-red-500 bg-red-50/30 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                    onClick={() => {
                      onSelectNode(node.id);
                      onSelectMember(null);
                    }}
                  >
                    {/* Header Nœud */}
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 font-mono text-xs px-1.5 py-0.5 bg-slate-100 rounded">
                          {node.id}
                        </span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-200/70 font-semibold text-slate-700">
                          {nodeRes?.nodeType || node.nodeType || 'CCC'}
                        </span>
                        {node.isSupport && (
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded">
                            Appui ({node.supportType === 'roller_x' ? 'Rouleau X' : node.supportType === 'roller_y' ? 'Rouleau Y' : 'Fixe'})
                          </span>
                        )}
                        {node.isBlockedNearSupport && (
                          <span className="text-[10px] font-bold text-teal-700 bg-teal-100 px-1.5 py-0.5 rounded flex items-center gap-0.5" title="Nœud bloqué à l'interface d'appui">
                            <Anchor size={10} />
                            <span>Bloqué appui</span>
                          </span>
                        )}
                        {(node.fy || 0) !== 0 && (
                          <span className="text-[10px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded">
                            F = {node.fy} kN
                          </span>
                        )}
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteNode(node.id);
                        }}
                        className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-slate-100"
                        title="Supprimer le nœud"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    {/* Coordonnées X / Y éditables directement */}
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div>
                        <label className="text-[10px] font-mono text-slate-500 block">Position X (m)</label>
                        <input
                          type="number"
                          step="0.05"
                          value={node.x}
                          onChange={(e) => onUpdateNode({ ...node, x: parseFloat(e.target.value) || 0 })}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full border border-slate-300 rounded px-2 py-1 text-slate-900 font-mono text-xs focus:ring-1 focus:ring-red-500 focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-mono text-slate-500 block">Position Y (m)</label>
                        <input
                          type="number"
                          step="0.05"
                          value={node.y}
                          onChange={(e) => onUpdateNode({ ...node, y: parseFloat(e.target.value) || 0 })}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full border border-slate-300 rounded px-2 py-1 text-slate-900 font-mono text-xs focus:ring-1 focus:ring-red-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Ligne 2 : Type d'appui & Charge F */}
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <label className="text-[10px] text-slate-500 block">Condition d'appui</label>
                        <select
                          value={node.isSupport ? node.supportType || 'pin' : 'none'}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === 'none') {
                              onUpdateNode({ ...node, isSupport: false, supportType: undefined });
                            } else {
                              onUpdateNode({ ...node, isSupport: true, supportType: val as any });
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full border border-slate-300 rounded px-1.5 py-1 text-slate-900 text-xs bg-white focus:outline-none focus:border-red-500"
                        >
                          <option value="none">Libre (Nœud interne)</option>
                          <option value="pin">Appui Fixe (Pin / Rotule)</option>
                          <option value="roller_x">Appui Rouleau (Libre X)</option>
                          <option value="roller_y">Appui Rouleau (Libre Y)</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-500 block">Charge Fy (kN)</label>
                        <input
                          type="number"
                          step="25"
                          value={node.fy || 0}
                          onChange={(e) => onUpdateNode({ ...node, fy: parseFloat(e.target.value) || 0 })}
                          onClick={(e) => e.stopPropagation()}
                          placeholder="ex: -350"
                          className="w-full border border-slate-300 rounded px-2 py-1 text-slate-900 font-mono text-xs focus:ring-1 focus:ring-red-500 focus:outline-none"
                        />
                      </div>
                    </div>

                    {/* Ligne 3 : Largeur de plaque & Verrouillage Schlaich */}
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100 text-[10px]">
                      <div className="flex items-center gap-1">
                        <span className="text-slate-500">Plaque a1 (m):</span>
                        <input
                          type="number"
                          step="0.05"
                          value={node.bearingWidth || 0.20}
                          onChange={(e) => onUpdateNode({ ...node, bearingWidth: parseFloat(e.target.value) || 0.20 })}
                          onClick={(e) => e.stopPropagation()}
                          className="w-14 border border-slate-300 rounded px-1 py-0.5 text-slate-900 font-mono text-[10px]"
                        />
                      </div>

                      <label className="flex items-center gap-1.5 cursor-pointer text-slate-600">
                        <input
                          type="checkbox"
                          checked={node.isFixedInOpt ?? false}
                          onChange={(e) => onUpdateNode({ ...node, isFixedInOpt: e.target.checked })}
                          onClick={(e) => e.stopPropagation()}
                          className="accent-red-600"
                        />
                        <span>Verrouillé Schlaich</span>
                      </label>
                    </div>

                    {/* Option Nœud bloqué à l'interface d'appui (Rx et Ry bloqués, évite d'ajouter tirants/bielles fictifs) */}
                    <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between">
                      <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-medium text-slate-700 hover:text-slate-900">
                        <input
                          type="checkbox"
                          checked={node.isBlockedNearSupport ?? false}
                          onChange={(e) => onUpdateNode({ ...node, isBlockedNearSupport: e.target.checked })}
                          onClick={(e) => e.stopPropagation()}
                          className="accent-teal-600 rounded"
                        />
                        <span className="flex items-center gap-1">
                          <Anchor size={12} className={node.isBlockedNearSupport ? 'text-teal-600' : 'text-slate-400'} />
                          <span>Bloqué à l'appui (Rx & Ry)</span>
                        </span>
                      </label>
                      {node.isBlockedNearSupport ? (
                        <span className="text-[9px] font-mono font-bold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200" title="Degrés de liberté bloqués à l'appui">
                          Évite barres fictives
                        </span>
                      ) : (
                        <span className="text-[9px] text-slate-400">Pour nœud sur appui</span>
                      )}
                    </div>

                    {/* Résultats EC2 si nœud chargé ou en appui */}
                    {nodeRes && (
                      <div className="mt-2 bg-slate-50 p-2 rounded border border-slate-200 text-[10px] font-mono grid grid-cols-2 gap-1 text-slate-600">
                        <div>
                          <span>σ_Rd: </span>
                          <span className="font-bold text-slate-900">{nodeRes.designStressLimit.toFixed(1)} MPa</span>
                        </div>
                        <div>
                          <span>σ_b: </span>
                          <span className="font-bold text-slate-900">{nodeRes.bearingStress.toFixed(1)} MPa</span>
                        </div>
                        <div>
                          <span>Taux: </span>
                          <span className={`font-bold ${nodeRes.bearingUtilization > 1 ? 'text-red-600' : 'text-emerald-600'}`}>
                            {(nodeRes.bearingUtilization * 100).toFixed(0)}%
                          </span>
                        </div>
                        <div>
                          <span>Aire req: </span>
                          <span className="font-bold text-slate-900">{nodeRes.requiredBearingArea.toFixed(0)} cm²</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: BARRES (BIELLES ET TIRANTS) */}
        {activeTab === 'members' && (
          <div className="space-y-3">
            {/* Quick Add Member */}
            <div className="border border-slate-200 rounded-lg p-2.5 bg-slate-50 flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-800 whitespace-nowrap">+ Barre :</span>
              <select
                value={newFromNode}
                onChange={(e) => setNewFromNode(e.target.value)}
                className="border border-slate-300 rounded px-1.5 py-0.5 text-xs bg-white text-slate-900"
              >
                {nodes.map(n => <option key={n.id} value={n.id}>{n.id}</option>)}
              </select>
              <span className="text-slate-400">→</span>
              <select
                value={newToNode}
                onChange={(e) => setNewToNode(e.target.value)}
                className="border border-slate-300 rounded px-1.5 py-0.5 text-xs bg-white text-slate-900"
              >
                {nodes.map(n => <option key={n.id} value={n.id}>{n.id}</option>)}
              </select>
              <button
                onClick={() => {
                  if (newFromNode && newToNode && newFromNode !== newToNode) {
                    onAddMember(newFromNode, newToNode, 'auto');
                  }
                }}
                className="flex items-center gap-1 px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-bold transition-colors ml-auto shadow-sm"
              >
                <Plus size={13} />
                <span>Relier</span>
              </button>
            </div>

            {/* List of members */}
            <div className="space-y-2">
              {members.map((m) => {
                const isSelected = selectedMemberId === m.id;
                const mRes = solverResult?.memberResults.get(m.id);
                const isComp = mRes ? mRes.isCompression : m.type === 'strut';

                return (
                  <div
                    key={m.id}
                    className={`border rounded-lg p-2.5 transition-all ${
                      isSelected
                        ? 'border-red-500 bg-red-50/30 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                    onClick={() => {
                      onSelectMember(m.id);
                      onSelectNode(null);
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 font-mono text-xs px-1.5 py-0.5 bg-slate-100 rounded">
                          {m.id}
                        </span>
                        <span className="text-[11px] font-mono text-slate-600">
                          {m.fromNodeId} ↔ {m.toNodeId}
                        </span>
                        <span className="text-[10px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded">
                          {isComp ? 'Bielle (C)' : 'Tirant (T)'}
                        </span>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteMember(m.id);
                        }}
                        className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-slate-100"
                        title="Supprimer la barre"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>

                    {/* Propriétés de la barre */}
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <label className="text-[10px] text-slate-500 block">Comportement</label>
                        <select
                          value={m.type}
                          onChange={(e) => onUpdateMember({ ...m, type: e.target.value as any })}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full border border-slate-300 rounded px-1.5 py-1 text-slate-900 text-xs bg-white focus:outline-none focus:border-red-500"
                        >
                          <option value="auto">Automatique (selon N)</option>
                          <option value="strut">Bielle (Compression)</option>
                          <option value="tie">Tirant (Traction)</option>
                        </select>
                      </div>

                      {!isComp ? (
                        <div>
                          <label className="text-[10px] text-slate-500 block">Diamètre aciers</label>
                          <select
                            value={m.barDiameter || 20}
                            onChange={(e) => onUpdateMember({ ...m, barDiameter: parseInt(e.target.value) })}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full border border-slate-300 rounded px-1.5 py-1 text-slate-900 text-xs bg-white focus:outline-none focus:border-red-500"
                          >
                            <option value="12">HA 12 mm</option>
                            <option value="14">HA 14 mm</option>
                            <option value="16">HA 16 mm</option>
                            <option value="20">HA 20 mm</option>
                            <option value="25">HA 25 mm</option>
                            <option value="32">HA 32 mm</option>
                          </select>
                        </div>
                      ) : (
                        <div>
                          <label className="text-[10px] text-slate-500 block">Traction transversale</label>
                          <select
                            value={m.hasTransverseTension ? 'yes' : 'no'}
                            onChange={(e) => onUpdateMember({ ...m, hasTransverseTension: e.target.value === 'yes' })}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full border border-slate-300 rounded px-1.5 py-1 text-slate-900 text-xs bg-white focus:outline-none focus:border-red-500"
                          >
                            <option value="no">Non (0.6·ν'·fcd)</option>
                            <option value="yes">Oui fissurée (1.0·ν'·fcd)</option>
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Résultat calculé */}
                    {mRes && (
                      <div className="mt-2 bg-slate-50 p-2 rounded border border-slate-200 text-[10px] font-mono grid grid-cols-2 gap-1 text-slate-600">
                        <div>
                          <span>Effort N: </span>
                          <span className="font-bold text-red-600">
                            {isComp ? `-${Math.abs(mRes.force).toFixed(1)} kN` : `+${mRes.force.toFixed(1)} kN`}
                          </span>
                        </div>
                        <div>
                          <span>{isComp ? 'w_eff req: ' : 'As req: '}</span>
                          <span className="font-bold text-slate-900">
                            {isComp ? `${mRes.effectiveWidthRequired.toFixed(0)} mm` : `${mRes.requiredAs?.toFixed(2)} cm²`}
                          </span>
                        </div>
                        {!isComp && mRes.suggestedRebar && (
                          <div className="col-span-2 text-slate-700">
                            <span>Conseil : </span>
                            <span className="font-bold text-red-700">{mRes.suggestedRebar}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 4: MATÉRIAUX & EUROCODE 2 */}
        {activeTab === 'materials' && (
          <div className="space-y-4">
            {/* Béton */}
            <div className="border border-slate-200 rounded-lg p-3 space-y-3 bg-white">
              <span className="font-bold text-slate-900 text-xs block">Propriétés du Béton (EN 1992-1-1 §3.1)</span>
              <div>
                <label className="text-slate-600 font-medium block mb-1">Classe de résistance fck :</label>
                <select
                  value={concreteMat.fck}
                  onChange={(e) => {
                    const fckVal = parseInt(e.target.value);
                    const nameMap: Record<number, string> = {
                      20: 'C20/25', 25: 'C25/30', 30: 'C30/37', 35: 'C35/45', 40: 'C40/50', 50: 'C50/60'
                    };
                    onUpdateConcreteMat({ ...concreteMat, fck: fckVal, name: nameMap[fckVal] || `C${fckVal}` });
                  }}
                  className="w-full border border-slate-300 rounded px-2 py-1 text-slate-900 bg-white font-mono text-xs focus:outline-none focus:border-red-500"
                >
                  <option value="20">C20/25 (fck = 20 MPa)</option>
                  <option value="25">C25/30 (fck = 25 MPa)</option>
                  <option value="30">C30/37 (fck = 30 MPa)</option>
                  <option value="35">C35/45 (fck = 35 MPa)</option>
                  <option value="40">C40/50 (fck = 40 MPa)</option>
                  <option value="50">C50/60 (fck = 50 MPa)</option>
                </select>
              </div>

              <div className="bg-slate-50 p-2.5 rounded border border-slate-200 text-slate-700 font-mono space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span>fcd = αcc · fck / γc :</span>
                  <span className="font-bold text-slate-900">{fcd.toFixed(2)} MPa</span>
                </div>
                <div className="flex justify-between">
                  <span>ν' = 1 - fck/250 :</span>
                  <span className="font-bold text-slate-900">{nuPrime.toFixed(3)}</span>
                </div>
                <div className="flex justify-between">
                  <span>σRd,max (bielle saine) :</span>
                  <span className="font-bold text-slate-900">{(1.0 * nuPrime * fcd).toFixed(2)} MPa</span>
                </div>
                <div className="flex justify-between">
                  <span>σRd,max (fissurée) :</span>
                  <span className="font-bold text-slate-900">{(0.6 * nuPrime * fcd).toFixed(2)} MPa</span>
                </div>
              </div>
            </div>

            {/* Acier Passif */}
            <div className="border border-slate-200 rounded-lg p-3 space-y-3 bg-white">
              <span className="font-bold text-slate-900 text-xs block">Propriétés des Aciers de Tirant (EN 1992-1-1 §3.2)</span>
              <div>
                <label className="text-slate-600 font-medium block mb-1">Nuance d'acier fyk :</label>
                <select
                  value={steelMat.fyk}
                  onChange={(e) => {
                    const fykVal = parseInt(e.target.value);
                    onUpdateSteelMat({ ...steelMat, fyk: fykVal, name: fykVal === 500 ? 'B500B' : 'B400' });
                  }}
                  className="w-full border border-slate-300 rounded px-2 py-1 text-slate-900 bg-white font-mono text-xs focus:outline-none focus:border-red-500"
                >
                  <option value="500">B500B (fyk = 500 MPa, fyd = 435 MPa)</option>
                  <option value="400">B400 (fyk = 400 MPa, fyd = 348 MPa)</option>
                </select>
              </div>

              <div className="bg-slate-50 p-2.5 rounded border border-slate-200 text-slate-700 font-mono space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span>fyd = fyk / γs :</span>
                  <span className="font-bold text-slate-900">{fyd.toFixed(1)} MPa</span>
                </div>
                <div className="flex justify-between">
                  <span>Module Es :</span>
                  <span className="font-bold text-slate-900">{steelMat.Es} GPa</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: ARMATURES COMMERCIALES HA (EUROCODE 2) */}
        {activeTab === 'rebar' && (
          <div className="space-y-4">
            {/* Header info */}
            <div className="border border-slate-200 rounded-lg p-3 bg-gradient-to-r from-red-50/60 to-slate-50 space-y-1.5">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                  <ShieldCheck size={15} className="text-red-600" />
                  <span>Ferraillage Haute Adhérence (HA)</span>
                </h4>
                <span className="text-[10px] font-mono bg-white px-2 py-0.5 rounded border border-slate-200 font-bold text-slate-700">
                  EN 1992-1-1 §8
                </span>
              </div>
              <p className="text-[11px] text-slate-600 leading-snug">
                Choix des barres commerciales HA, calcul des longueurs d'ancrage $l_{`{bd}`} $ et étriers dans un coffrage de largeur $b_w = {(concreteOutline.thickness * 100).toFixed(0)}$ cm ($f_{`{yd}`} = {fyd.toFixed(1)}$ MPa).
              </p>
            </div>

            {/* Tirants en traction */}
            {(() => {
              const ties = members.filter((m) => {
                const res = solverResult?.memberResults.get(m.id);
                return m.type === 'tie' || (res && !res.isCompression && res.force > 0.01);
              });

              if (ties.length === 0) {
                return (
                  <div className="border border-slate-200 rounded-lg p-4 text-center bg-slate-50 space-y-2">
                    <AlertTriangle size={20} className="text-amber-500 mx-auto" />
                    <p className="text-xs font-medium text-slate-700">
                      Aucun tirant en traction détecté dans le modèle actuel.
                    </p>
                    <p className="text-[10px] text-slate-500">
                      Les éléments travaillent tous en compression pure (voûte) ou le système nécessite une charge supérieure.
                    </p>
                  </div>
                );
              }

              // Build schedule items
              const scheduleItems: Array<{
                memberId: string;
                label: string;
                diameter: number;
                count: number;
                layers: number;
                asReq: number;
                asProv: number;
                lStraightCm: number;
                lHookCm: number;
                unitLengthM: number;
                totalLengthM: number;
                totalWeightKg: number;
              }> = [];

              return (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900 text-xs">
                      Tirants Principaux ({ties.length})
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono">
                      Épaisseur bw = {(concreteOutline.thickness * 100).toFixed(0)} cm
                    </span>
                  </div>

                  {ties.map((m) => {
                    const mRes = solverResult?.memberResults.get(m.id);
                    const forceTed = mRes ? Math.max(0, mRes.force) : 0;
                    const asReq = (forceTed * 10) / fyd; // cm²

                    // Calculate member geometric length
                    const n1 = nodes.find((n) => n.id === (m.fromNodeId || (m as any).fromNode));
                    const n2 = nodes.find((n) => n.id === (m.toNodeId || (m as any).toNode));
                    const geomLengthM = n1 && n2 ? Math.hypot(n2.x - n1.x, n2.y - n1.y) : 1.0;

                    // Rebar options
                    const options = findCommercialRebarOptions(asReq, concreteOutline.thickness);
                    const defaultOpt = options[0] || { diameter: 16, numBars: 2, numLayers: 1, providedAs: 4.02 };

                    const activeConfig = m.rebarConfig || {
                      barDiameter: defaultOpt.diameter,
                      barCount: defaultOpt.numBars,
                      layers: defaultOpt.numLayers,
                      totalAreaCm2: defaultOpt.providedAs
                    };

                    const currentDiameter = activeConfig.barDiameter || 16;
                    const currentCount = activeConfig.barCount || 2;
                    const currentLayers = activeConfig.layers || 1;
                    const asProv = currentCount * getBarAreaCm2(currentDiameter);
                    const anchorage = calculateAnchorageLengths(currentDiameter, concreteMat.fck, steelMat.fyk, 1.15, 1.5, true);

                    const isAdequate = asProv >= asReq * 0.999;
                    const utilization = asReq > 0 ? (asReq / asProv) * 100 : 0;

                    // Spacing check
                    const coverM = 0.035;
                    const barsPerLayer = Math.ceil(currentCount / currentLayers);
                    const availableWidthM = concreteOutline.thickness - 2 * coverM;
                    const barSpaceM = barsPerLayer > 1
                      ? (availableWidthM - barsPerLayer * (currentDiameter / 1000)) / (barsPerLayer - 1)
                      : availableWidthM;
                    const minSpacingM = Math.max(currentDiameter / 1000, 0.02);
                    const isSpacingOk = barsPerLayer <= 1 || barSpaceM >= minSpacingM;

                    // Estimated total length with hooks at both ends: geom + 2 * l_hook
                    const unitLengthM = geomLengthM + 2 * (anchorage.lbdHookCm / 100);
                    const totalLengthM = unitLengthM * currentCount;
                    const totalWeightKg = totalLengthM * getLinearMassKgPerM(currentDiameter);

                    scheduleItems.push({
                      memberId: m.id,
                      label: `${m.id} (${m.fromNodeId || (m as any).fromNode}→${m.toNodeId || (m as any).toNode})`,
                      diameter: currentDiameter,
                      count: currentCount,
                      layers: currentLayers,
                      asReq,
                      asProv,
                      lStraightCm: anchorage.lbdStraightCm,
                      lHookCm: anchorage.lbdHookCm,
                      unitLengthM,
                      totalLengthM,
                      totalWeightKg
                    });

                    return (
                      <div
                        key={m.id}
                        className={`border rounded-lg p-3 bg-white space-y-2.5 transition-all ${
                          selectedMemberId === m.id ? 'border-red-500 shadow-sm' : 'border-slate-200 hover:border-slate-300'
                        }`}
                        onClick={() => {
                          onSelectMember(m.id);
                          onSelectNode(null);
                        }}
                      >
                        {/* Member title & force */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 font-mono text-xs px-1.5 py-0.5 bg-slate-100 rounded">
                              {m.id}
                            </span>
                            <span className="text-[11px] text-slate-500 font-mono">
                              {m.fromNodeId || (m as any).fromNode} ➔ {m.toNodeId || (m as any).toNode}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-mono font-bold text-red-600">
                              T_Ed = {forceTed.toFixed(1)} kN
                            </span>
                          </div>
                        </div>

                        {/* Section As requise vs fournie */}
                        <div className="bg-slate-50 p-2 rounded border border-slate-200 grid grid-cols-2 gap-2 text-[11px] font-mono">
                          <div>
                            <span className="text-slate-500 block text-[10px]">Section requise As,req :</span>
                            <span className="font-bold text-slate-900 text-xs">{asReq.toFixed(2)} cm²</span>
                            <span className="text-[9.5px] text-slate-400 block font-normal">
                              ({(asReq * 100).toFixed(0)} mm²)
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[10px]">Section fournie As,prov :</span>
                            <span className={`font-bold text-xs ${isAdequate ? 'text-emerald-700' : 'text-red-600'}`}>
                              {asProv.toFixed(2)} cm²
                            </span>
                            <span className={`text-[9.5px] block font-semibold ${isAdequate ? 'text-emerald-600' : 'text-red-500'}`}>
                              {isAdequate ? `Taux: ${utilization.toFixed(0)}% (Conforme)` : `Insuffisant (${utilization.toFixed(0)}%)`}
                            </span>
                          </div>
                        </div>

                        {/* Quick preset recommendations */}
                        {options.length > 0 && (
                          <div className="space-y-1">
                            <span className="text-[10px] text-slate-500 font-medium block">
                              Combinaisons recommandées (1 clic) :
                            </span>
                            <div className="flex flex-wrap gap-1.5">
                              {options.slice(0, 4).map((opt, oIdx) => {
                                const isCurrent = currentDiameter === opt.diameter && currentCount === opt.numBars;
                                return (
                                  <button
                                    key={oIdx}
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onUpdateMember({
                                        ...m,
                                        rebarConfig: {
                                          barDiameter: opt.diameter,
                                          barCount: opt.numBars,
                                          layers: opt.numLayers,
                                          totalAreaCm2: opt.providedAs,
                                          anchorageLengthCm: anchorage.lbdStraightCm,
                                          hookAnchorageLengthCm: anchorage.lbdHookCm
                                        }
                                      });
                                    }}
                                    className={`px-2 py-1 rounded text-[11px] font-mono transition-all ${
                                      isCurrent
                                        ? 'bg-red-600 text-white font-bold shadow-xs'
                                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                                    }`}
                                  >
                                    {opt.numBars} HA {opt.diameter} ({opt.providedAs.toFixed(2)} cm²)
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {/* Custom configuration row */}
                        <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-100">
                          <div>
                            <label className="text-[10px] text-slate-500 block mb-0.5">Nb barres</label>
                            <select
                              value={currentCount}
                              onChange={(e) => {
                                const cnt = parseInt(e.target.value);
                                onUpdateMember({
                                  ...m,
                                  rebarConfig: {
                                    ...activeConfig,
                                    barCount: cnt,
                                    totalAreaCm2: cnt * getBarAreaCm2(currentDiameter)
                                  }
                                });
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full border border-slate-300 rounded px-1.5 py-1 text-slate-900 font-mono text-xs bg-white"
                            >
                              {[1, 2, 3, 4, 5, 6, 8, 10, 12].map((n) => (
                                <option key={n} value={n}>{n} barres</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="text-[10px] text-slate-500 block mb-0.5">Diamètre Φ</label>
                            <select
                              value={currentDiameter}
                              onChange={(e) => {
                                const diam = parseInt(e.target.value);
                                onUpdateMember({
                                  ...m,
                                  rebarConfig: {
                                    ...activeConfig,
                                    barDiameter: diam,
                                    totalAreaCm2: currentCount * getBarAreaCm2(diam)
                                  }
                                });
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full border border-slate-300 rounded px-1.5 py-1 text-slate-900 font-mono text-xs bg-white"
                            >
                              {COMMERCIAL_DIAMETERS.map((d) => (
                                <option key={d} value={d}>HA {d}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="text-[10px] text-slate-500 block mb-0.5">Nappes / Lits</label>
                            <select
                              value={currentLayers}
                              onChange={(e) => {
                                const lay = parseInt(e.target.value);
                                onUpdateMember({
                                  ...m,
                                  rebarConfig: {
                                    ...activeConfig,
                                    layers: lay
                                  }
                                });
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full border border-slate-300 rounded px-1.5 py-1 text-slate-900 font-mono text-xs bg-white"
                            >
                              <option value="1">1 Lit</option>
                              <option value="2">2 Lits</option>
                              <option value="3">3 Lits</option>
                            </select>
                          </div>
                        </div>

                        {/* Spacing & Anchorage feedback */}
                        <div className="bg-slate-50/70 p-2 rounded border border-slate-200 space-y-1 text-[10.5px]">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-600">Espacement libre s_libre :</span>
                            <span className={`font-mono font-semibold ${isSpacingOk ? 'text-slate-800' : 'text-amber-600'}`}>
                              {(barSpaceM * 1000).toFixed(0)} mm {isSpacingOk ? '✓' : '⚠️ trop serré'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-600">Ancrage droit l_bd :</span>
                            <span className="font-mono font-bold text-slate-900">{anchorage.lbdStraightCm} cm ({anchorage.lbdStraightMm} mm)</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-600">Ancrage crosse 90° (0.7·l_bd) :</span>
                            <span className="font-mono font-bold text-emerald-700">{anchorage.lbdHookCm} cm ({anchorage.lbdHookMm} mm)</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {/* Suspension stirrups */}
                  {(() => {
                    // Estimate total shear from reaction or max vertical tie
                    const maxFy = Math.max(...nodes.map((n) => Math.abs(n.fy || 0)), 100);
                    const stirrups = calculateSuspensionStirrups(
                      maxFy,
                      concreteOutline.height,
                      steelMat.fyk
                    );
                    const prop = stirrups.stirrupProposals[0];

                    return (
                      <div className="border border-slate-200 rounded-lg p-3 bg-white space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 text-xs">
                            Armatures de Suspension / Étriers (Cisaillement)
                          </span>
                          <span className="text-[10px] font-mono text-slate-500">
                            V_Ed = {maxFy.toFixed(0)} kN
                          </span>
                        </div>
                        <div className="bg-slate-50 p-2 rounded border border-slate-200 grid grid-cols-2 gap-2 text-[11px] font-mono">
                          <div>
                            <span className="text-slate-500 block text-[10px]">Section requise As :</span>
                            <span className="font-bold text-slate-900">{stirrups.reqAsCm2.toFixed(2)} cm²</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[10px]">Espacement conseillé :</span>
                            <span className="font-bold text-slate-900">s = {prop?.spacingCm || 15} cm</span>
                          </div>
                        </div>
                        <div className="p-2 bg-emerald-50 border border-emerald-200 rounded text-[11px] text-emerald-900">
                          <span className="font-bold block text-[10px] text-emerald-800 uppercase tracking-wide">
                            Disposition conforme EC2 :
                          </span>
                          <span>{prop?.label || 'Étriers HA 8 e = 15 cm'}</span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Nomenclature Récapitulative Table */}
                  <div className="border border-slate-200 rounded-lg p-3 bg-white space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <FileSpreadsheet size={14} className="text-red-600" />
                        <span className="font-bold text-slate-900 text-xs">Nomenclature des Barres</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const headers = 'Repère\tDiamètre\tNombre\tL. Unit (m)\tL. Totale (m)\tPoids (kg)';
                          const rows = scheduleItems.map(
                            (s) => `${s.label}\tHA${s.diameter}\t${s.count}\t${s.unitLengthM.toFixed(2)}\t${s.totalLengthM.toFixed(2)}\t${s.totalWeightKg.toFixed(1)}`
                          );
                          const totalWeight = scheduleItems.reduce((sum, s) => sum + s.totalWeightKg, 0);
                          const text = `${headers}\n${rows.join('\n')}\nTotal Aciers HA:\t\t\t\t\t${totalWeight.toFixed(1)} kg`;
                          navigator.clipboard.writeText(text);
                          setCopiedSchedule(true);
                          setTimeout(() => setCopiedSchedule(false), 2500);
                        }}
                        className="flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[11px] font-medium transition-colors"
                      >
                        {copiedSchedule ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
                        <span>{copiedSchedule ? 'Copié !' : 'Copier nomenclature'}</span>
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left font-mono text-[10px] border border-slate-200 rounded">
                        <thead className="bg-slate-100 text-slate-700">
                          <tr>
                            <th className="p-1.5 border-b border-slate-200">Barre</th>
                            <th className="p-1.5 border-b border-slate-200">Nuance</th>
                            <th className="p-1.5 border-b border-slate-200">Nb</th>
                            <th className="p-1.5 border-b border-slate-200">L.tot</th>
                            <th className="p-1.5 border-b border-slate-200 text-right">Poids</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {scheduleItems.map((s, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="p-1.5 font-bold text-slate-900">{s.memberId}</td>
                              <td className="p-1.5 text-red-600 font-bold">HA {s.diameter}</td>
                              <td className="p-1.5">{s.count}</td>
                              <td className="p-1.5">{s.totalLengthM.toFixed(2)} m</td>
                              <td className="p-1.5 text-right font-bold text-slate-800">{s.totalWeightKg.toFixed(1)} kg</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-slate-50 font-bold text-slate-900 border-t border-slate-200">
                          <tr>
                            <td colSpan={4} className="p-1.5 text-right">Total Acier Tirants :</td>
                            <td className="p-1.5 text-right text-red-600">
                              {scheduleItems.reduce((sum, s) => sum + s.totalWeightKg, 0).toFixed(1)} kg
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

      </div>

      {/* Panel Footer: Résumé Équilibre Global */}
      <div className="p-3 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5">
          <span className={`w-2.5 h-2.5 rounded-full ${solverResult?.isStable ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
          <span className="font-bold text-slate-800">
            {solverResult?.isStable ? 'Système Isostatique Conforme' : 'Système Instable'}
          </span>
        </div>
        <span className="font-mono text-slate-500 text-[11px]">
          W = {solverResult?.totalStrainEnergy.toFixed(1)} J
        </span>
      </div>
    </aside>
  );
};
