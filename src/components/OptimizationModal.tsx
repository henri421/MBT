import React, { useState, useEffect } from 'react';
import {
  STMNode,
  STMMember,
  ConcreteMaterial,
  SteelMaterial,
  ConcreteOutline,
  OptimizationResult
} from '../types/stm';
import { optimizeSchlaichEnergy } from '../utils/schlaichOptimizer';
import { Sparkles, TrendingDown, ArrowRight, Check, X, ShieldCheck, Zap } from 'lucide-react';

interface OptimizationModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: STMNode[];
  members: STMMember[];
  concreteMat: ConcreteMaterial;
  steelMat: SteelMaterial;
  concreteOutline: ConcreteOutline;
  dimension: '2D' | '3D';
  onApplyOptimization: (optimizedNodes: STMNode[]) => void;
}

export const OptimizationModal: React.FC<OptimizationModalProps> = ({
  isOpen,
  onClose,
  nodes,
  members,
  concreteMat,
  steelMat,
  concreteOutline,
  dimension,
  onApplyOptimization
}) => {
  const [optResult, setOptResult] = useState<OptimizationResult | null>(null);
  const [sliderStep, setSliderStep] = useState(100); // 0 = initial, 100 = optimized
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsRunning(true);
      setTimeout(() => {
        const res = optimizeSchlaichEnergy(
          nodes,
          members,
          concreteMat,
          steelMat,
          concreteOutline,
          dimension,
          40
        );
        setOptResult(res);
        setIsRunning(false);
      }, 250);
    }
  }, [isOpen, nodes, members, concreteMat, steelMat, concreteOutline, dimension]);

  if (!isOpen) return null;

  const currentStepIndex = optResult && optResult.steps.length > 0
    ? Math.min(
        Math.floor((sliderStep / 100) * (optResult.steps.length - 1)),
        optResult.steps.length - 1
      )
    : 0;

  const currentEnergy = optResult && optResult.steps[currentStepIndex]
    ? optResult.steps[currentStepIndex].totalEnergy
    : optResult?.initialEnergy || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 select-none">
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-700">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                Optimisation Géométrique de Schlaich
                <span className="text-[11px] bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full font-mono font-medium">
                  Énergie Minimale
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                Principe des travaux de déformation minimale selon Jörg Schlaich (1987)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-5 text-slate-700 text-xs">
          {/* Engineering Principle card */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2">
            <div className="font-semibold text-slate-900 flex items-center gap-2">
              <Zap size={14} className="text-amber-600" />
              <span>Théorie du Chemin de Charge à Énergie Réduite</span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Selon le principe de Schlaich, le treillis bielles-tirants le plus naturel et économe est celui qui minimise l'énergie élastique totale :
            </p>
            <div className="bg-white border border-amber-200 rounded p-2 text-center font-mono text-amber-800 font-bold text-[13px] shadow-sm">
              W = ½ ∑ F_i · ΔL_i = ∑ T_i · L_i · ε_s + ∑ C_j · L_j · ε_c → Minimum
            </div>
            <p className="text-slate-600 leading-relaxed">
              Les tirants d'acier subissant une déformation spécifique bien plus importante que le béton comprimé (ε_s ≈ 2.17 ‰ contre ε_c ≈ 0.6 ‰), l'algorithme déplace les nœuds internes libres pour raccourcir et soulager les tirants d'acier tout en maintenant les bielles dans la plage angulaire admissible Eurocode 2 (θ entre 30° et 60°).
            </p>
          </div>

          {/* Results Comparison Grid */}
          {isRunning ? (
            <div className="py-12 flex flex-col items-center justify-center space-y-3">
              <div className="w-8 h-8 border-2 border-amber-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-slate-600 font-mono">Calcul des gradients d'énergie de déformation...</span>
            </div>
          ) : optResult ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                  <div className="text-slate-500 text-[11px] mb-1">Énergie Initiale (W0)</div>
                  <div className="text-lg font-bold font-mono text-slate-900">
                    {optResult.initialEnergy.toFixed(1)} J
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">Modèle de départ</div>
                </div>

                <div className="bg-emerald-50 p-3.5 rounded-lg border border-emerald-200">
                  <div className="text-emerald-700 text-[11px] font-semibold mb-1 flex items-center gap-1">
                    <TrendingDown size={14} />
                    <span>Énergie Optimale (W_opt)</span>
                  </div>
                  <div className="text-lg font-bold font-mono text-emerald-700">
                    {optResult.optimizedEnergy.toFixed(1)} J
                  </div>
                  <div className="text-[10px] text-emerald-800 font-bold mt-1">
                    Gain : -{optResult.energyReductionPercent.toFixed(1)}% d'énergie
                  </div>
                </div>

                <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200">
                  <div className="text-slate-500 text-[11px] mb-1">Gain Aciers Estimé</div>
                  <div className="text-lg font-bold font-mono text-slate-900">
                    -{optResult.steelWeightReductionPercent.toFixed(1)}%
                  </div>
                  <div className="text-[10px] text-slate-400 mt-1">Économie de ferraillage</div>
                </div>
              </div>

              {/* Interactive Morphing Slider */}
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 space-y-3">
                <div className="flex items-center justify-between font-semibold">
                  <span className="text-slate-900">Progression Géométrique de l'Optimisation</span>
                  <span className="font-mono text-amber-700 bg-white px-2 py-0.5 rounded border border-slate-200">
                    W({sliderStep}%) = {currentEnergy.toFixed(1)} J
                  </span>
                </div>

                <input
                  type="range"
                  min="0"
                  max="100"
                  value={sliderStep}
                  onChange={(e) => setSliderStep(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-600"
                />

                <div className="flex justify-between text-[11px] text-slate-500 font-mono">
                  <span>Initial (0%)</span>
                  <span>Transition continue</span>
                  <span className="text-emerald-700 font-bold">100% Minimum Schlaich</span>
                </div>
              </div>

              {/* Displacement table */}
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-slate-100 px-3 py-2 font-semibold text-slate-800 border-b border-slate-200 flex justify-between">
                  <span>Déplacements Optimaux des Nœuds Mobiles</span>
                  <span className="text-[10px] text-slate-500 font-normal">Contraintes de coffrage respectées</span>
                </div>
                <div className="max-h-36 overflow-y-auto">
                  <table className="w-full text-left font-mono text-[11px]">
                    <thead className="bg-slate-50 text-slate-500 text-[10px]">
                      <tr>
                        <th className="p-2">Nœud</th>
                        <th className="p-2">Coord. Initiale (m)</th>
                        <th className="p-2">Coord. Optimisée (m)</th>
                        <th className="p-2">Déplacement Δ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {optResult.optimizedNodes.map((optNode) => {
                        const initNode = nodes.find(n => n.id === optNode.id);
                        if (!initNode) return null;
                        const dist = Math.hypot(optNode.x - initNode.x, optNode.y - initNode.y);
                        if (dist < 0.001) return null;

                        return (
                          <tr key={optNode.id} className="hover:bg-slate-50">
                            <td className="p-2 font-bold text-slate-900">{optNode.id}</td>
                            <td className="p-2 text-slate-600">({initNode.x.toFixed(3)}, {initNode.y.toFixed(3)})</td>
                            <td className="p-2 text-emerald-700 font-bold">({optNode.x.toFixed(3)}, {optNode.y.toFixed(3)})</td>
                            <td className="p-2 text-amber-700 font-bold">{(dist * 100).toFixed(1)} cm</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 font-medium rounded-lg text-xs transition-colors"
          >
            Fermer sans appliquer
          </button>

          {optResult && (
            <button
              onClick={() => {
                if (optResult.steps[currentStepIndex]) {
                  onApplyOptimization(optResult.steps[currentStepIndex].nodes);
                } else {
                  onApplyOptimization(optResult.optimizedNodes);
                }
                onClose();
              }}
              className="flex items-center gap-2 px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs shadow-sm transition-all"
            >
              <Check size={16} />
              <span>Appliquer la géométrie optimisée ({sliderStep}%)</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
