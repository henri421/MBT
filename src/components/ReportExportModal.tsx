import React from 'react';
import {
  STMNode,
  STMMember,
  ConcreteMaterial,
  SteelMaterial,
  ConcreteOutline,
  SolverResult
} from '../types/stm';
import { Printer, Download, X, FileText, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

interface ReportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: STMNode[];
  members: STMMember[];
  concreteMat: ConcreteMaterial;
  steelMat: SteelMaterial;
  concreteOutline: ConcreteOutline;
  solverResult: SolverResult | null;
}

export const ReportExportModal: React.FC<ReportExportModalProps> = ({
  isOpen,
  onClose,
  nodes,
  members,
  concreteMat,
  steelMat,
  concreteOutline,
  solverResult
}) => {
  if (!isOpen) return null;

  const fcd = (concreteMat.alphaCc * concreteMat.fck) / concreteMat.gammaC;
  const nuPrime = 1.0 - concreteMat.fck / 250.0;
  const fyd = steelMat.fyk / steelMat.gammaS;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadJSON = () => {
    const data = {
      project: 'Modèle Bielles & Tirants - Eurocode 2',
      date: new Date().toISOString(),
      materials: { concreteMat, steelMat, concreteThickness: concreteOutline.thickness },
      nodes,
      members,
      results: solverResult ? {
        totalStrainEnergy: solverResult.totalStrainEnergy,
        totalSteelWeightEst: solverResult.totalSteelWeightEst,
        maxUtilization: solverResult.maxUtilization,
        isStable: solverResult.isStable,
        members: Array.from(solverResult.memberResults.values()),
        nodes: Array.from(solverResult.nodeResults.values())
      } : null
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `note_calcul_bielles_tirants_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 select-none">
      <div className="bg-white border border-slate-200 rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Top Bar */}
        <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-100 border border-red-200 flex items-center justify-center text-red-600">
              <FileText size={18} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Note de Calcul Justificative</h2>
              <p className="text-xs text-slate-500">Conformité NF EN 1992-1-1 (Eurocode 2) - Section 6.5</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-medium transition-colors shadow-sm"
            >
              <Printer size={14} />
              <span>Imprimer</span>
            </button>
            <button
              onClick={handleDownloadJSON}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-xs font-medium transition-colors shadow-sm"
            >
              <Download size={14} />
              <span>Exporter JSON</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-200 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Printable Report Document Body */}
        <div id="printable-report" className="p-6 overflow-y-auto space-y-6 text-slate-800 bg-white text-xs">
          {/* Header */}
          <div className="border-b border-slate-200 pb-4 flex justify-between items-start">
            <div>
              <h1 className="text-base font-bold text-slate-900 uppercase">Vérification Technique de Zone D (Discontinuité)</h1>
              <p className="text-slate-500 text-xs font-mono mt-1">Méthode des Bielles et Tirants (STM) - EN 1992-1-1 §6.5 & Annexe J</p>
            </div>
            <div className="text-right font-mono text-[11px] text-slate-500">
              <div>Élément : <span className="text-slate-900 font-semibold">{concreteOutline.name || 'Structure BA'}</span></div>
              <div>Date : {new Date().toLocaleDateString('fr-FR')}</div>
            </div>
          </div>

          {/* Synthèse globale */}
          <div className="grid grid-cols-4 gap-3">
            <div className="border border-slate-200 bg-slate-50 p-3 rounded-lg">
              <span className="text-slate-500 text-[10px] block">Statut d'Équilibre</span>
              <span className={`font-bold font-mono text-sm flex items-center gap-1 mt-0.5 ${solverResult?.isStable ? 'text-emerald-700' : 'text-red-600'}`}>
                {solverResult?.isStable ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
                {solverResult?.isStable ? 'Isostatique' : 'Instable'}
              </span>
            </div>

            <div className="border border-slate-200 bg-slate-50 p-3 rounded-lg">
              <span className="text-slate-500 text-[10px] block">Taux de Travail Max</span>
              <span className={`font-bold font-mono text-sm mt-0.5 block ${(solverResult?.maxUtilization || 0) > 1 ? 'text-red-600' : 'text-emerald-700'}`}>
                {((solverResult?.maxUtilization || 0) * 100).toFixed(1)}%
              </span>
            </div>

            <div className="border border-slate-200 bg-slate-50 p-3 rounded-lg">
              <span className="text-slate-500 text-[10px] block">Énergie de Déformation W</span>
              <span className="font-bold font-mono text-sm text-slate-900 mt-0.5 block">
                {solverResult?.totalStrainEnergy.toFixed(1)} Joules
              </span>
            </div>

            <div className="border border-slate-200 bg-slate-50 p-3 rounded-lg">
              <span className="text-slate-500 text-[10px] block">Masse Acier Estimée</span>
              <span className="font-bold font-mono text-sm text-slate-900 mt-0.5 block">
                {solverResult?.totalSteelWeightEst.toFixed(1)} kg
              </span>
            </div>
          </div>

          {/* Section 1: Hypothèses Matériaux */}
          <div className="border border-slate-200 rounded-lg p-4 space-y-3 bg-slate-50/50">
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wide flex items-center gap-2">
              <span className="w-1.5 h-3.5 bg-red-600 rounded-full"></span>
              <span>1. Hypothèses et Résistances de Calcul des Matériaux</span>
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-3 rounded border border-slate-200 space-y-1 font-mono text-[11px]">
                <div className="font-bold text-slate-900 mb-1.5 font-sans">Béton : {concreteMat.name}</div>
                <div className="flex justify-between text-slate-600">
                  <span>Résistance caractéristique fck :</span>
                  <span className="font-bold text-slate-900">{concreteMat.fck} MPa</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Coefficient partiel γc / αcc :</span>
                  <span className="font-bold text-slate-900">{concreteMat.gammaC} / {concreteMat.alphaCc}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Résistance de calcul fcd :</span>
                  <span className="font-bold text-emerald-700">{fcd.toFixed(2)} MPa</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Facteur de réduction ν' :</span>
                  <span className="font-bold text-slate-900">{nuPrime.toFixed(3)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Épaisseur de pièce bw :</span>
                  <span className="font-bold text-slate-900">{concreteOutline.thickness * 100} cm</span>
                </div>
              </div>

              <div className="bg-white p-3 rounded border border-slate-200 space-y-1 font-mono text-[11px]">
                <div className="font-bold text-slate-900 mb-1.5 font-sans">Acier de ferraillage : {steelMat.name}</div>
                <div className="flex justify-between text-slate-600">
                  <span>Limite d'élasticité fyk :</span>
                  <span className="font-bold text-slate-900">{steelMat.fyk} MPa</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Coefficient partiel γs :</span>
                  <span className="font-bold text-slate-900">{steelMat.gammaS}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Limite de calcul fyd :</span>
                  <span className="font-bold text-emerald-700">{fyd.toFixed(1)} MPa</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Module d'Young Es :</span>
                  <span className="font-bold text-slate-900">{steelMat.Es} GPa</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Déformation limite εyd :</span>
                  <span className="font-bold text-slate-900">{(fyd / (steelMat.Es * 10)).toFixed(3)} ‰</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Tableau des Bielles & Tirants */}
          <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
            <div className="bg-slate-100 px-4 py-2.5 font-bold text-slate-900 text-xs border-b border-slate-200 flex justify-between items-center">
              <span>2. Vérification des Barres (Bielles de Béton & Tirants d'Armatures)</span>
              <span className="text-[10px] text-slate-500 font-normal">EN 1992-1-1 §6.5.2 & §6.5.3</span>
            </div>

            <table className="w-full text-left font-mono text-[11px]">
              <thead className="bg-slate-50 text-slate-500 text-[10px] border-b border-slate-200">
                <tr>
                  <th className="p-2.5">Barre</th>
                  <th className="p-2.5">Type</th>
                  <th className="p-2.5">Effort N_Ed</th>
                  <th className="p-2.5">Résistance de calcul</th>
                  <th className="p-2.5">Dimension requise</th>
                  <th className="p-2.5">Armatures préconisées</th>
                  <th className="p-2.5 text-right">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {members.map((m) => {
                  const res = solverResult?.memberResults.get(m.id);
                  const isComp = res ? res.isCompression : m.type === 'strut';
                  const force = res?.force || 0;

                  return (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="p-2.5 font-bold text-slate-900">{m.id} ({m.fromNodeId}-{m.toNodeId})</td>
                      <td className="p-2.5">
                        <span className="px-1.5 py-0.5 rounded font-bold text-[10px] bg-red-100 text-red-700">
                          {isComp ? 'Bielle (C)' : 'Tirant (T)'}
                        </span>
                      </td>
                      <td className="p-2.5 font-bold text-red-600">
                        {isComp ? `-${Math.abs(force).toFixed(1)} kN` : `+${force.toFixed(1)} kN`}
                      </td>
                      <td className="p-2.5 text-slate-700">
                        {isComp
                          ? `σ_Rd = ${res?.designCapacity.toFixed(2)} MPa`
                          : `F_Rd = ${res?.designCapacity.toFixed(1)} kN`}
                      </td>
                      <td className="p-2.5 text-slate-900 font-bold">
                        {isComp
                          ? `w_eff ≥ ${res?.effectiveWidthRequired.toFixed(0)} mm`
                          : `As ≥ ${res?.requiredAs?.toFixed(2)} cm²`}
                      </td>
                      <td className="p-2.5 text-red-700 font-bold">
                        {!isComp ? res?.suggestedRebar || '—' : `Bielle béton bw=${(concreteOutline.thickness * 100).toFixed(0)}cm`}
                      </td>
                      <td className="p-2.5 text-right">
                        {res?.status === 'OK' ? (
                          <span className="text-emerald-700 font-bold inline-flex items-center gap-1">
                            <CheckCircle2 size={13} /> Conforme
                          </span>
                        ) : (
                          <span className="text-red-600 font-bold inline-flex items-center gap-1">
                            <AlertTriangle size={13} /> Non conforme
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Section 3: Nœuds de compression / traction */}
          <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
            <div className="bg-slate-100 px-4 py-2.5 font-bold text-slate-900 text-xs border-b border-slate-200 flex justify-between items-center">
              <span>3. Vérification des Nœuds & Surfaces d'Appui</span>
              <span className="text-[10px] text-slate-500 font-normal">EN 1992-1-1 §6.5.4</span>
            </div>

            <table className="w-full text-left font-mono text-[11px]">
              <thead className="bg-slate-50 text-slate-500 text-[10px] border-b border-slate-200">
                <tr>
                  <th className="p-2.5">Nœud</th>
                  <th className="p-2.5">Type EC2</th>
                  <th className="p-2.5">Contrainte limite σ_Rd,max</th>
                  <th className="p-2.5">Pression d'appui σ_b</th>
                  <th className="p-2.5">Aire d'appui requise</th>
                  <th className="p-2.5 text-right">Taux de travail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {nodes.map((n) => {
                  const nodeRes = solverResult?.nodeResults.get(n.id);
                  if (!nodeRes) return null;

                  return (
                    <tr key={n.id} className="hover:bg-slate-50">
                      <td className="p-2.5 font-bold text-slate-900">{n.id}</td>
                      <td className="p-2.5">
                        <span className="px-1.5 py-0.5 rounded font-bold text-[10px] bg-slate-200 text-slate-800">
                          {nodeRes.nodeType}
                        </span>
                      </td>
                      <td className="p-2.5 text-slate-700">{nodeRes.designStressLimit.toFixed(2)} MPa</td>
                      <td className="p-2.5 font-bold text-slate-900">{nodeRes.bearingStress.toFixed(2)} MPa</td>
                      <td className="p-2.5 text-slate-700">{nodeRes.requiredBearingArea.toFixed(0)} cm²</td>
                      <td className="p-2.5 text-right">
                        <span className={`font-bold ${nodeRes.bearingUtilization > 1 ? 'text-red-600' : 'text-emerald-700'}`}>
                          {(nodeRes.bearingUtilization * 100).toFixed(0)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 font-mono">
            Calcul conforme Eurocode 2 & Théorie des bielles-tirants
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg text-xs transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
