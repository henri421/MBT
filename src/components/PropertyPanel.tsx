import React, { useState, useEffect } from 'react';
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
import { calculateSkinRebar, checkStrutAngle, checkElsStress } from '../utils/eurocode2';
import { DirectNumberInput } from './DirectNumberInput';
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
  FileSpreadsheet,
  Circle,
  Square,
  Unlock,
  Lock
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

  // Auto switch tab when selecting a node or member from canvas
  useEffect(() => {
    if (selectedNodeId) {
      setActiveTab('nodes');
    }
  }, [selectedNodeId]);

  useEffect(() => {
    if (selectedMemberId) {
      setActiveTab('members');
    }
  }, [selectedMemberId]);

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

              {/* Epaisseur bw - Saisie directe fluide sans flèche + Presets */}
              <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-2.5">
                <div className="flex justify-between items-center">
                  <label htmlFor="input-concrete-thickness" className="text-slate-800 font-bold text-xs">
                    Épaisseur du béton bw :
                  </label>
                  <span className="text-xs font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 font-bold">
                    {(concreteOutline.thickness * 100).toFixed(0)} cm ({concreteOutline.thickness.toFixed(2)} m)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <DirectNumberInput
                    id="input-concrete-thickness"
                    unit="m"
                    min={0.05}
                    max={10.00}
                    precision={2}
                    value={concreteOutline.thickness}
                    onChange={(val) => {
                      if (val > 0) handleUpdateDimensionParam('thickness', val);
                    }}
                    placeholder="0.30"
                    className="flex-1"
                    inputClassName="py-1.5 text-sm"
                  />
                </div>
                {/* Boutons de présélection rapide en cm */}
                <div className="flex items-center gap-1 flex-wrap pt-0.5">
                  <span className="text-[10px] text-slate-400 font-medium mr-1">Épaisseurs usuelles :</span>
                  {[0.15, 0.20, 0.25, 0.30, 0.35, 0.40, 0.50, 0.60].map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => handleUpdateDimensionParam('thickness', t)}
                      className={`px-2 py-0.5 text-[10px] font-mono rounded border transition-colors ${
                        Math.abs(concreteOutline.thickness - t) < 0.005
                          ? 'bg-blue-600 text-white border-blue-600 font-bold shadow-xs'
                          : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100 hover:border-slate-400'
                      }`}
                    >
                      {(t * 100).toFixed(0)} cm
                    </button>
                  ))}
                </div>
              </div>

              {/* Cas type console courte sur poteau */}
              {selectedPresetId === 'corbel' && (
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <span className="text-[11px] font-bold text-slate-800 block">Paramètres Console Eurocode 2 :</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-500 font-mono block mb-0.5">Saillie ac (m)</label>
                      <DirectNumberInput
                        unit="m"
                        precision={2}
                        value={0.45}
                        onChange={(val) => handleUpdateDimensionParam('corbelLength', val)}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 font-mono block mb-0.5">Hauteur totale h (m)</label>
                      <DirectNumberInput
                        unit="m"
                        precision={2}
                        value={0.85}
                        onChange={(val) => handleUpdateDimensionParam('height', val)}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 font-mono block mb-0.5">Hauteur nez h1 (m)</label>
                      <DirectNumberInput
                        unit="m"
                        precision={2}
                        value={0.50}
                        onChange={(val) => handleUpdateDimensionParam('corbelTipHeight', val)}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 font-mono block mb-0.5">Poteau b_col (m)</label>
                      <DirectNumberInput
                        unit="m"
                        precision={2}
                        value={0.40}
                        onChange={(val) => handleUpdateDimensionParam('columnWidth', val)}
                        className="w-full"
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
                      <label className="text-[10px] text-slate-500 font-mono block mb-0.5">Portée poutre L (m)</label>
                      <DirectNumberInput
                        unit="m"
                        precision={2}
                        value={3.20}
                        onChange={(val) => handleUpdateDimensionParam('length', val)}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 font-mono block mb-0.5">Hauteur poutre H (m)</label>
                      <DirectNumberInput
                        unit="m"
                        precision={2}
                        value={1.20}
                        onChange={(val) => handleUpdateDimensionParam('height', val)}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 font-mono block mb-0.5">Saillie console (m)</label>
                      <DirectNumberInput
                        unit="m"
                        precision={2}
                        value={0.60}
                        onChange={(val) => handleUpdateDimensionParam('corbelLength', val)}
                        className="w-full"
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
                      <label className="text-[10px] text-slate-500 font-mono block mb-0.5">Longueur L (m)</label>
                      <DirectNumberInput
                        unit="m"
                        precision={2}
                        value={2.40}
                        onChange={(val) => handleUpdateDimensionParam('length', val)}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 font-mono block mb-0.5">Hauteur H (m)</label>
                      <DirectNumberInput
                        unit="m"
                        precision={2}
                        value={0.90}
                        onChange={(val) => handleUpdateDimensionParam('height', val)}
                        className="w-full"
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
                      <label className="text-[10px] text-slate-500 font-mono block mb-0.5">Côté emprise (m)</label>
                      <DirectNumberInput
                        unit="m"
                        precision={2}
                        value={2.40}
                        onChange={(val) => handleUpdateDimensionParam('length', val)}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 font-mono block mb-0.5">Hauteur totale (m)</label>
                      <DirectNumberInput
                        unit="m"
                        precision={2}
                        value={0.90}
                        onChange={(val) => handleUpdateDimensionParam('height', val)}
                        className="w-full"
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
                      <label className="text-[10px] text-slate-500 font-mono block mb-0.5">Portée L (m)</label>
                      <DirectNumberInput
                        unit="m"
                        precision={2}
                        value={selectedPresetId === 'deep_beam_eccentric' ? 3.60 : 3.20}
                        onChange={(val) => handleUpdateDimensionParam('length', val)}
                        className="w-full"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 font-mono block mb-0.5">Hauteur H (m)</label>
                      <DirectNumberInput
                        unit="m"
                        precision={2}
                        value={2.00}
                        onChange={(val) => handleUpdateDimensionParam('height', val)}
                        className="w-full"
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
                      <DirectNumberInput
                        unit="m"
                        precision={2}
                        value={pt[0]}
                        onChange={(val) => {
                          const newPts = [...concreteOutline.points2D];
                          newPts[idx] = [val, pt[1]];
                          onUpdateConcreteOutline({ ...concreteOutline, points2D: newPts });
                        }}
                        className="w-full"
                        inputClassName="py-0.5 text-[11px]"
                      />
                    </div>
                    <div className="flex items-center gap-1 flex-1">
                      <span className="text-[10px] text-slate-400 font-mono">Y:</span>
                      <DirectNumberInput
                        unit="m"
                        precision={2}
                        value={pt[1]}
                        onChange={(val) => {
                          const newPts = [...concreteOutline.points2D];
                          newPts[idx] = [pt[0], val];
                          onUpdateConcreteOutline({ ...concreteOutline, points2D: newPts });
                        }}
                        className="w-full"
                        inputClassName="py-0.5 text-[11px]"
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
                <DirectNumberInput
                  unit="m"
                  precision={2}
                  value={newNodeX}
                  onChange={(val) => setNewNodeX(val)}
                  className="w-18"
                  inputClassName="py-0.5 text-xs"
                />
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-slate-400 font-mono">Y:</span>
                <DirectNumberInput
                  unit="m"
                  precision={2}
                  value={newNodeY}
                  onChange={(val) => setNewNodeY(val)}
                  className="w-18"
                  inputClassName="py-0.5 text-xs"
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

                    {/* Coordonnées X / Y éditables directement sans flèche */}
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div>
                        <label className="text-[10px] font-mono text-slate-500 block mb-0.5">Position X (m)</label>
                        <DirectNumberInput
                          unit="m"
                          precision={2}
                          value={node.x}
                          onChange={(val) => onUpdateNode({ ...node, x: val })}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full"
                          inputClassName="py-1 text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-mono text-slate-500 block mb-0.5">Position Y (m)</label>
                        <DirectNumberInput
                          unit="m"
                          precision={2}
                          value={node.y}
                          onChange={(val) => onUpdateNode({ ...node, y: val })}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full"
                          inputClassName="py-1 text-xs"
                        />
                      </div>
                    </div>

                    {/* Ligne 2 : Type d'appui & Charge F */}
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div>
                        <label className="text-[10px] text-slate-500 block mb-0.5">Condition d'appui</label>
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
                          <option value="pin">Appui Fixe / Rotule (Bloque Rx & Ry)</option>
                          <option value="roller_x">Appui Rouleau X (Libre X, bloque Ry - Tirant)</option>
                          <option value="roller_y">Appui Rouleau Y (Libre Y, bloque Rx)</option>
                          <option value="roller_z">Pieu / Rouleau Z (Libre X & Y, bloque Rz)</option>
                        </select>
                      </div>

                      <div>
                        <div className="flex justify-between items-center mb-0.5">
                          <label className="text-[10px] text-slate-500 block">Charge Fy (kN)</label>
                          {node.fy && node.fy !== 0 && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onUpdateNode({ ...node, fy: 0 });
                              }}
                              className="text-[9px] text-slate-400 hover:text-red-600"
                              title="Annuler la charge"
                            >
                              0 kN
                            </button>
                          )}
                        </div>
                        <DirectNumberInput
                          unit="kN"
                          precision={0}
                          value={node.fy || 0}
                          onChange={(val) => onUpdateNode({ ...node, fy: val })}
                          onClick={(e) => e.stopPropagation()}
                          placeholder="ex: -350"
                          className="w-full"
                          inputClassName="py-1 text-xs font-semibold"
                        />
                        <div className="flex items-center gap-1 mt-1">
                          {[-250, -500, -750, -1000].map(c => (
                            <button
                              key={c}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onUpdateNode({ ...node, fy: c });
                              }}
                              className={`px-1 py-0.2 rounded text-[8px] font-mono border transition-colors ${
                                node.fy === c ? 'bg-red-600 text-white border-red-600 font-bold' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              {c}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Ligne 3 : Surface d'appui / contact (Directe sans flèche) */}
                    <div className="mt-2.5 pt-2 border-t border-slate-100">
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="text-[10px] font-bold text-slate-700">Surface d'appui / contact :</label>
                        <div className="flex items-center bg-slate-100 p-0.5 rounded border border-slate-200">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onUpdateNode({ ...node, bearingShape: 'rectangular' });
                            }}
                            className={`px-2 py-0.5 text-[10px] rounded font-medium flex items-center gap-1 transition-colors ${
                              (node.bearingShape !== 'circular') ? 'bg-white shadow-xs text-slate-900 font-bold' : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            <Square size={10} />
                            <span>Plaque</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onUpdateNode({
                                ...node,
                                bearingShape: 'circular',
                                bearingDiameter: node.bearingDiameter || node.bearingWidth || 0.40
                              });
                            }}
                            className={`px-2 py-0.5 text-[10px] rounded font-medium flex items-center gap-1 transition-colors ${
                              node.bearingShape === 'circular' ? 'bg-white shadow-xs text-slate-900 font-bold' : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            <Circle size={10} />
                            <span>Pieu rond</span>
                          </button>
                        </div>
                      </div>

                      {node.bearingShape === 'circular' ? (
                        <div className="bg-slate-50/80 p-2.5 rounded-lg border border-slate-200 text-[10px] space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-slate-700 font-semibold">Diamètre pieu ∅ :</span>
                            <div className="flex items-center gap-1">
                              <DirectNumberInput
                                unit="m"
                                min={0.10}
                                max={3.00}
                                precision={2}
                                value={node.bearingDiameter || 0.40}
                                onChange={(val) => onUpdateNode({
                                  ...node,
                                  bearingDiameter: val,
                                  bearingWidth: val
                                })}
                                onClick={(e) => e.stopPropagation()}
                                className="w-24"
                                inputClassName="text-right py-0.5"
                              />
                              <span className="text-slate-500 font-mono text-[10px]">
                                ({((node.bearingDiameter || 0.40) * 100).toFixed(0)} cm)
                              </span>
                            </div>
                          </div>
                          {/* Presets rapides de pieux */}
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="text-[9px] text-slate-400 font-medium">∅ usuels :</span>
                            {[0.30, 0.35, 0.40, 0.50, 0.60, 0.80].map((d) => (
                              <button
                                key={d}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onUpdateNode({
                                    ...node,
                                    bearingShape: 'circular',
                                    bearingDiameter: d,
                                    bearingWidth: d
                                  });
                                }}
                                className={`px-1.5 py-0.5 rounded text-[9px] font-mono border transition-colors ${
                                  Math.abs((node.bearingDiameter || 0.40) - d) < 0.01
                                    ? 'bg-blue-600 text-white border-blue-600 font-bold'
                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                                }`}
                              >
                                ∅{d * 100}
                              </button>
                            ))}
                          </div>
                          <div className="text-[9px] text-slate-500 font-mono flex justify-between pt-1 border-t border-slate-200/60">
                            <span>Section Ac :</span>
                            <span className="font-bold text-slate-800">
                              {((Math.PI * Math.pow(node.bearingDiameter || 0.40, 2) / 4) * 10000).toFixed(0)} cm²
                            </span>
                          </div>
                        </div>
                      ) : (
                        <div className="bg-slate-50/80 p-2.5 rounded-lg border border-slate-200 text-[10px] space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <span className="text-slate-600 font-medium block mb-1">Longueur a1 :</span>
                              <DirectNumberInput
                                unit="m"
                                min={0.05}
                                max={5.00}
                                precision={2}
                                value={node.bearingWidth || 0.20}
                                onChange={(val) => onUpdateNode({ ...node, bearingWidth: val })}
                                onClick={(e) => e.stopPropagation()}
                                placeholder="0.20"
                                className="w-full"
                                inputClassName="py-0.5"
                              />
                              <span className="text-[9px] text-slate-400 font-mono">
                                {((node.bearingWidth || 0.20) * 100).toFixed(0)} cm
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-600 font-medium block mb-1">Largeur a2 :</span>
                              <DirectNumberInput
                                unit="m"
                                min={0.05}
                                max={5.00}
                                precision={2}
                                value={node.bearingDepth || concreteOutline.thickness || 0.30}
                                onChange={(val) => onUpdateNode({ ...node, bearingDepth: val })}
                                onClick={(e) => e.stopPropagation()}
                                placeholder="0.30"
                                className="w-full"
                                inputClassName="py-0.5"
                              />
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onUpdateNode({ ...node, bearingDepth: concreteOutline.thickness });
                                }}
                                className="text-[9px] text-blue-600 hover:text-blue-800 font-mono underline"
                                title="Définir a2 égal à l'épaisseur du béton"
                              >
                                = bw ({(concreteOutline.thickness * 100).toFixed(0)} cm)
                              </button>
                            </div>
                          </div>

                          {/* Presets rapides de plaques */}
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="text-[9px] text-slate-400 font-medium">Plaques usuelles :</span>
                            {[0.15, 0.20, 0.25, 0.30, 0.40].map((dim) => (
                              <button
                                key={dim}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onUpdateNode({
                                    ...node,
                                    bearingShape: 'rectangular',
                                    bearingWidth: dim,
                                    bearingDepth: node.bearingDepth || concreteOutline.thickness || dim
                                  });
                                }}
                                className={`px-1.5 py-0.5 rounded text-[9px] font-mono border transition-colors ${
                                  Math.abs((node.bearingWidth || 0.20) - dim) < 0.01
                                    ? 'bg-blue-600 text-white border-blue-600 font-bold'
                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                                }`}
                              >
                                {dim * 100} cm
                              </button>
                            ))}
                          </div>

                          <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 font-mono text-[9px]">
                            <div className="flex items-center gap-2">
                              <span className="text-slate-500">Aire contact Ac :</span>
                              <span className="font-bold text-slate-800">
                                {(((node.bearingWidth || 0.20) * (node.bearingDepth || concreteOutline.thickness || 0.30)) * 10000).toFixed(0)} cm²
                              </span>
                            </div>
                            <label className="flex items-center gap-1 cursor-pointer text-slate-600">
                              <input
                                type="checkbox"
                                checked={node.isFixedInOpt ?? false}
                                onChange={(e) => onUpdateNode({ ...node, isFixedInOpt: e.target.checked })}
                                onClick={(e) => e.stopPropagation()}
                                className="accent-red-600"
                              />
                              <span>Fixe Schlaich</span>
                            </label>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Option Nœud bloqué à l'interface d'appui & Détection de tirant */}
                    {(() => {
                      const connectedTies = members.filter(m => m.type === 'tie' && (m.fromNodeId === node.id || m.toNodeId === node.id));
                      const hasTie = connectedTies.length > 0;
                      const isOverConstrainedWithTie = hasTie && (node.isBlockedNearSupport || (node.isSupport && node.supportType === 'pin'));

                      return (
                        <div className="mt-2.5 pt-2 border-t border-slate-100 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-semibold text-slate-700 flex items-center gap-1">
                              <Anchor size={12} className={node.isBlockedNearSupport ? 'text-teal-600' : 'text-slate-400'} />
                              <span>Comportement horizontal à l'appui :</span>
                            </span>
                            {hasTie && (
                              <span className="text-[9px] font-medium bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                                <CheckCircle2 size={10} />
                                <span>Tirant relié</span>
                              </span>
                            )}
                          </div>

                          {/* Sélecteur intuitif : Libre en X vs Bloqué */}
                          <div className="grid grid-cols-2 gap-1.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onUpdateNode({
                                  ...node,
                                  isBlockedNearSupport: false,
                                  supportType: node.isSupport ? 'roller_x' : node.supportType
                                });
                              }}
                              className={`p-1.5 rounded-lg border text-left transition-all ${
                                !node.isBlockedNearSupport && (node.supportType === 'roller_x' || !node.isSupport || !node.supportType)
                                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900 ring-1 ring-emerald-400/50'
                                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex items-center gap-1 font-semibold text-[10px]">
                                <Unlock size={11} className={!node.isBlockedNearSupport ? 'text-emerald-600' : 'text-slate-400'} />
                                <span>Libre en X (Tirant)</span>
                              </div>
                              <p className="text-[9px] text-slate-500 mt-0.5 leading-tight">
                                Glisse horizontalement pour transmettre la traction au tirant
                              </p>
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onUpdateNode({
                                  ...node,
                                  isBlockedNearSupport: true,
                                  supportType: node.isSupport ? 'pin' : node.supportType
                                });
                              }}
                              className={`p-1.5 rounded-lg border text-left transition-all ${
                                node.isBlockedNearSupport || (node.isSupport && node.supportType === 'pin')
                                  ? 'bg-amber-50 border-amber-300 text-amber-900 ring-1 ring-amber-400/50'
                                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                              }`}
                            >
                              <div className="flex items-center gap-1 font-semibold text-[10px]">
                                <Lock size={11} className={node.isBlockedNearSupport ? 'text-amber-600' : 'text-slate-400'} />
                                <span>Bloqué Rx & Ry</span>
                              </div>
                              <p className="text-[9px] text-slate-500 mt-0.5 leading-tight">
                                Appui rigide qui absorbe toute la poussée horizontale
                              </p>
                            </button>
                          </div>

                          {/* Avertissement intelligent si un tirant est connecté à un appui bloqué */}
                          {isOverConstrainedWithTie && (
                            <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg text-[10px] text-amber-900">
                              <div className="flex items-start gap-1.5">
                                <AlertTriangle size={13} className="text-amber-600 shrink-0 mt-0.5" />
                                <div className="flex-1">
                                  <div className="font-bold text-amber-800 flex items-center justify-between">
                                    <span>Tirant {connectedTies.map(t => t.id).join(', ')} bloqué !</span>
                                    <span className="text-[9px] font-semibold bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded">Traction N = 0</span>
                                  </div>
                                  <p className="text-[9px] text-amber-700 mt-0.5 leading-tight">
                                    L'appui rigide bloque le déplacement horizontal et court-circuite le tirant. Libérez le glissement en X pour activer la traction.
                                  </p>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onUpdateNode({
                                        ...node,
                                        isBlockedNearSupport: false,
                                        supportType: 'roller_x'
                                      });
                                    }}
                                    className="mt-1.5 px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded font-medium text-[10px] shadow-xs inline-flex items-center gap-1 transition-colors"
                                  >
                                    <Unlock size={11} />
                                    <span>Débloquer en X (Activer la traction du tirant)</span>
                                  </button>
                                </div>
                              </div>
                            </div>
                          )}

                          {hasTie && !isOverConstrainedWithTie && (
                            <div className="text-[9px] text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200 flex items-center gap-1.5">
                              <CheckCircle2 size={11} className="text-emerald-600 shrink-0" />
                              <span>Tirant {connectedTies.map(t => t.id).join(', ')} actif : l'appui glisse librement pour reprendre 100% de la poussée en traction.</span>
                            </div>
                          )}
                        </div>
                      );
                    })()}

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

                        {/* Diagnostic Bielle EC2: Angle θ */}
                        {isComp && (() => {
                          const fn = nodes.find(n => n.id === m.fromNodeId);
                          const tn = nodes.find(n => n.id === m.toNodeId);
                          if (!fn || !tn) return null;
                          const deg = (Math.atan2(Math.abs(tn.y - fn.y), Math.abs(tn.x - fn.x)) * 180) / Math.PI;
                          const diag = checkStrutAngle(deg);
                          return (
                            <div className="col-span-2 flex items-center justify-between pt-1 border-t border-slate-200 text-[9.5px]">
                              <span>Angle θ : <strong className="text-slate-800">{deg.toFixed(1)}°</strong> (cot={diag.cotTheta.toFixed(2)})</span>
                              <span className={`px-1.5 py-0.2 rounded font-bold ${diag.status === 'VALID' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                                {diag.status === 'VALID' ? 'EC2 Conforme' : diag.status === 'WARNING_LOW' ? 'θ < 30° (Schlaich)' : 'Non conforme'}
                              </span>
                            </div>
                          );
                        })()}

                        {/* Diagnostic Tirant ELS EC2: σ_s ≤ 400 MPa */}
                        {!isComp && (() => {
                          const asProv = mRes.providedAs || (mRes.requiredAs ? mRes.requiredAs * 1.15 : 4.0);
                          const els = checkElsStress(mRes.force, asProv, steelMat.fyk);
                          return (
                            <div className="col-span-2 flex items-center justify-between pt-1 border-t border-slate-200 text-[9.5px]">
                              <span>Contrainte ELS : <strong className={els.isOk ? 'text-slate-800' : 'text-red-600'}>{els.sigmaS_Els.toFixed(0)} MPa</strong></span>
                              <span className={`px-1.5 py-0.2 rounded font-bold ${els.isOk ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                                {els.isOk ? `σs ≤ ${els.limitMpa.toFixed(0)} MPa OK` : `σs > ${els.limitMpa.toFixed(0)} MPa Fissuration`}
                              </span>
                            </div>
                          );
                        })()}

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
                    const ys = concreteOutline.points2D.map(([, y]) => y);
                    const elementHeightM = ys.length > 1
                      ? Math.max(...ys) - Math.min(...ys)
                      : concreteOutline.thickness;
                    const stirrups = calculateSuspensionStirrups(
                      maxFy,
                      elementHeightM,
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

                  {/* Armatures de Peau Minimales (EC2 §9.7.1 & §7.3) */}
                  {(() => {
                    const ys = concreteOutline.points2D.map(p => p[1]);
                    const elemHeightM = ys.length > 0 ? Math.max(...ys) - Math.min(...ys) : 1.5;
                    const skin = calculateSkinRebar(concreteOutline.thickness, elemHeightM, concreteMat.fck, steelMat.fyk);

                    return (
                      <div className="border border-slate-200 rounded-lg p-3 bg-white space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                            <ShieldCheck size={14} className="text-indigo-600" />
                            <span>Armatures de Peau & Fissuration</span>
                          </span>
                          <span className="text-[10px] font-mono text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">
                            EC2 §9.7.1
                          </span>
                        </div>
                        <p className="text-[10.5px] text-slate-500 leading-snug">
                          Maillage surfacique minimal par face (0.10% Ac) pour maîtriser la fissuration superficielle :
                        </p>
                        <div className="bg-slate-50 p-2 rounded border border-slate-200 grid grid-cols-2 gap-2 text-[11px] font-mono">
                          <div>
                            <span className="text-slate-500 block text-[10px]">Section requise / face :</span>
                            <span className="font-bold text-slate-900">{skin.asMinPerFaceCm2PerM.toFixed(2)} cm²/m</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block text-[10px]">Espacement maximal :</span>
                            <span className="font-bold text-slate-900">s_max ≤ {skin.maxSpacingMm} mm</span>
                          </div>
                        </div>
                        <div className="p-2 bg-indigo-50/70 border border-indigo-200 rounded text-[11px] text-indigo-950 font-medium">
                          <span className="font-bold text-[10px] text-indigo-800 uppercase block">Recommandation chantier :</span>
                          <span>{skin.suggestedMesh}</span>
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
