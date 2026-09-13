import React, { useState } from 'react';
import {
  STMNode,
  STMMember,
  ConcreteMaterial,
  SteelMaterial,
  ConcreteOutline,
  SolverResult
} from '../types/stm';
import {
  Printer,
  Download,
  X,
  FileText,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ShieldCheck,
  Scale,
  Compass,
  Layers,
  Info
} from 'lucide-react';
import { calculateSkinRebar, checkStrutAngle, checkElsStress } from '../utils/eurocode2';

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

  const [projectTitle, setProjectTitle] = useState('NOTE DE CALCULS - ZONE D (STM)');
  const [engineerName, setEngineerName] = useState('BET Ingénierie des Structures BA');
  const [referenceRef, setReferenceRef] = useState(`NC-STM-${new Date().getFullYear()}-001`);

  const fcd = (concreteMat.alphaCc * concreteMat.fck) / concreteMat.gammaC;
  const nuPrime = 1.0 - concreteMat.fck / 250.0;
  const fyd = steelMat.fyk / steelMat.gammaS;

  // Calcul dimensions globales du béton
  const pts = concreteOutline.points2D;
  const ys = pts.map(p => p[1]);
  const xs = pts.map(p => p[0]);
  const heightM = pts.length > 0 ? Math.max(...ys) - Math.min(...ys) : 1.5;
  const widthM = pts.length > 0 ? Math.max(...xs) - Math.min(...xs) : 3.0;

  // Calcul armatures de peau minimales (EC2 §9.7.1 & §7.3)
  const skinRebar = calculateSkinRebar(
    concreteOutline.thickness,
    heightM,
    concreteMat.fck,
    steelMat.fyk
  );

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadJSON = () => {
    const data = {
      project: projectTitle,
      engineer: engineerName,
      reference: referenceRef,
      standard: 'NF EN 1992-1-1 (Eurocode 2) - Chapitre 6.5 & Annexe J',
      date: new Date().toISOString(),
      geometry: {
        widthM,
        heightM,
        thicknessM: concreteOutline.thickness,
        points: concreteOutline.points2D
      },
      materials: { concreteMat, steelMat, fcd, nuPrime, fyd },
      skinRebar,
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

  const nodeMap = new Map<string, STMNode>();
  nodes.forEach(n => nodeMap.set(n.id, n));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white border border-slate-300 rounded-xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[94vh] my-auto">
        {/* Modal Top Bar (Hidden on print) */}
        <div className="print:hidden p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 shadow-sm">
              <FileText size={20} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Dossier Justificatif Eurocode 2</h2>
              <p className="text-xs text-slate-500">NF EN 1992-1-1 §6.5 & Annexe J - Note de calculs officielle pour bureau de contrôle</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm active:scale-95"
            >
              <Printer size={14} />
              <span>Imprimer (A4 / PDF)</span>
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
        <div id="printable-report" className="p-8 overflow-y-auto space-y-6 text-slate-800 bg-white text-xs print:p-0 print:overflow-visible">
          
          {/* CARTOUCHE D'INGÉNIERIE OFFICIEL (Engineering Title Block) */}
          <div className="border-2 border-slate-800 rounded-lg overflow-hidden bg-white shadow-sm">
            <div className="grid grid-cols-12 divide-x-2 divide-slate-800 border-b-2 border-slate-800">
              <div className="col-span-8 p-3.5 bg-slate-50 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block">Document Technique</span>
                  <input
                    type="text"
                    value={projectTitle}
                    onChange={(e) => setProjectTitle(e.target.value)}
                    className="font-bold text-slate-900 text-base bg-transparent border-b border-dashed border-slate-300 focus:border-blue-600 outline-none w-full py-0.5"
                  />
                  <p className="text-[11px] text-slate-600 font-mono mt-1">
                    Élément : <span className="font-bold text-slate-800">{concreteOutline.name}</span> | Dimensions : {widthM.toFixed(2)} x {heightM.toFixed(2)} m (ép. {(concreteOutline.thickness * 100).toFixed(0)} cm)
                  </p>
                </div>
              </div>

              <div className="col-span-4 p-3 bg-white flex flex-col justify-between font-mono text-[11px] text-slate-700 space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Réf :</span>
                  <input
                    type="text"
                    value={referenceRef}
                    onChange={(e) => setReferenceRef(e.target.value)}
                    className="text-right font-bold text-slate-900 bg-transparent border-b border-dashed border-slate-300 outline-none w-32"
                  />
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Date :</span>
                  <span className="font-bold text-slate-900">{new Date().toLocaleDateString('fr-FR')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Phase :</span>
                  <span className="font-bold text-blue-700 bg-blue-50 px-1.5 py-0.2 rounded border border-blue-200">EXE / CONTRÔLE</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-12 divide-x-2 divide-slate-800 bg-slate-100 px-3 py-1.5 text-[10.5px] font-mono text-slate-600">
              <div className="col-span-7 flex items-center gap-1.5">
                <span className="font-bold text-slate-900">Auteur :</span>
                <input
                  type="text"
                  value={engineerName}
                  onChange={(e) => setEngineerName(e.target.value)}
                  className="bg-transparent border-b border-dashed border-slate-300 outline-none w-64 text-slate-800 font-sans"
                />
              </div>
              <div className="col-span-5 text-right font-sans font-bold text-slate-800">
                Norme : NF EN 1992-1-1 (Eurocode 2) & Annexe J
              </div>
            </div>
          </div>

          {/* SYNTHÈSE DES VÉRIFICATIONS ET INDICATEURS DE SÉCURITÉ */}
          <div className="grid grid-cols-4 gap-3 font-mono">
            <div className="border border-slate-200 bg-slate-50 p-3 rounded-lg">
              <span className="text-slate-500 text-[10px] block uppercase">Équilibre Statique</span>
              <span className={`font-bold text-sm flex items-center gap-1 mt-0.5 ${solverResult?.isStable ? 'text-emerald-700' : 'text-red-600'}`}>
                {solverResult?.isStable ? <CheckCircle2 size={16} /> : <XCircle size={16} />}
                {solverResult?.isStable ? 'Équilibré & Stable' : 'Mécanisme Instable'}
              </span>
            </div>

            <div className="border border-slate-200 bg-slate-50 p-3 rounded-lg">
              <span className="text-slate-500 text-[10px] block uppercase">Taux Travail Max (ELU)</span>
              <span className={`font-bold text-sm mt-0.5 block ${(solverResult?.maxUtilization || 0) > 1.0 ? 'text-red-600' : 'text-emerald-700'}`}>
                {((solverResult?.maxUtilization || 0) * 100).toFixed(1)} %
                <span className="text-[10px] font-normal text-slate-500 ml-1">
                  {(solverResult?.maxUtilization || 0) <= 1.0 ? '(≤ 100% Conforme)' : '(> 100% Rupture)'}
                </span>
              </span>
            </div>

            <div className="border border-slate-200 bg-slate-50 p-3 rounded-lg">
              <span className="text-slate-500 text-[10px] block uppercase">Énergie Déformation</span>
              <span className="font-bold text-sm text-slate-900 mt-0.5 block">
                {solverResult?.totalStrainEnergy.toFixed(1)} Joules
                <span className="text-[10px] font-normal text-slate-500 ml-1">(Critère Schlaich)</span>
              </span>
            </div>

            <div className="border border-slate-200 bg-slate-50 p-3 rounded-lg">
              <span className="text-slate-500 text-[10px] block uppercase">Tonnage Acier Requis</span>
              <span className="font-bold text-sm text-slate-900 mt-0.5 block">
                {solverResult?.totalSteelWeightEst.toFixed(1)} kg
                <span className="text-[10px] font-normal text-slate-500 ml-1">(Tirants principaux)</span>
              </span>
            </div>
          </div>

          {/* SECTION 1: COMBINAISONS D'ACTIONS RÈGLEMENTAIRES (ELU & ELS) */}
          <div className="border border-slate-200 rounded-lg p-4 bg-slate-50/70 space-y-3">
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wide flex items-center gap-2">
              <Scale size={15} className="text-blue-600" />
              <span>1. Combinaisons d'Actions Eurocode (NF EN 1990 & NF EN 1992-1-1 §6.5)</span>
            </h3>

            <div className="grid grid-cols-3 gap-3 text-[11px] font-mono">
              <div className="bg-white p-3 rounded border border-slate-200 space-y-1">
                <div className="font-bold text-slate-900 font-sans flex items-center gap-1 text-xs text-red-700">
                  <ShieldCheck size={13} /> ELU Fondamental (STR/GEO)
                </div>
                <div className="text-slate-600 text-[10px]">
                  Combinaison : <span className="font-bold text-slate-900">1.35 G + 1.50 Q</span>
                </div>
                <p className="text-[10px] text-slate-500 font-sans leading-relaxed">
                  Dimensionnement en résistance des bielles de béton (σ_c ≤ σ_Rd,max) et des tirants d'acier (T_Ed ≤ F_Rd).
                </p>
              </div>

              <div className="bg-white p-3 rounded border border-slate-200 space-y-1">
                <div className="font-bold text-slate-900 font-sans flex items-center gap-1 text-xs text-blue-700">
                  <ShieldCheck size={13} /> ELS Caractéristique
                </div>
                <div className="text-slate-600 text-[10px]">
                  Combinaison : <span className="font-bold text-slate-900">1.00 G + 1.00 Q (≈ 0.70 ELU)</span>
                </div>
                <p className="text-[10px] text-slate-500 font-sans leading-relaxed">
                  Limitation de la contrainte de traction dans les armatures : σ_s ≤ 0.80 fyk = {(0.80 * steelMat.fyk).toFixed(0)} MPa (EC2 §7.2).
                </p>
              </div>

              <div className="bg-white p-3 rounded border border-slate-200 space-y-1">
                <div className="font-bold text-slate-900 font-sans flex items-center gap-1 text-xs text-emerald-700">
                  <ShieldCheck size={13} /> ELS Quasi-Permanent
                </div>
                <div className="text-slate-600 text-[10px]">
                  Combinaison : <span className="font-bold text-slate-900">1.00 G + 0.30 Q</span>
                </div>
                <p className="text-[10px] text-slate-500 font-sans leading-relaxed">
                  Maîtrise de la fissuration sans calcul direct (wk ≤ 0.3 mm) par armature minimale de peau (§7.3 & §9.7).
                </p>
              </div>
            </div>
          </div>

          {/* SECTION 2: HYPOTHÈSES MATÉRIAUX */}
          <div className="border border-slate-200 rounded-lg p-4 space-y-3 bg-white">
            <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wide flex items-center gap-2">
              <span className="w-2 h-3.5 bg-blue-600 rounded-sm"></span>
              <span>2. Hypothèses et Caractéristiques des Matériaux</span>
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5 font-mono text-[11px]">
                <div className="font-bold text-slate-900 font-sans pb-1 border-b border-slate-200">
                  Béton de Structure : {concreteMat.name}
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Résistance caractéristique fck :</span>
                  <span className="font-bold text-slate-900">{concreteMat.fck} MPa</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Coefficients partiels γc / αcc :</span>
                  <span className="font-bold text-slate-900">{concreteMat.gammaC} / {concreteMat.alphaCc}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Résistance de calcul fcd = αcc·fck/γc :</span>
                  <span className="font-bold text-emerald-700">{fcd.toFixed(2)} MPa</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Facteur de fragilité ν' = 1 - fck/250 :</span>
                  <span className="font-bold text-slate-900">{nuPrime.toFixed(3)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Épaisseur de pièce bw :</span>
                  <span className="font-bold text-slate-900">{(concreteOutline.thickness * 100).toFixed(0)} cm</span>
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 space-y-1.5 font-mono text-[11px]">
                <div className="font-bold text-slate-900 font-sans pb-1 border-b border-slate-200">
                  Acier de Haute Adhérence : {steelMat.name}
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Limite d'élasticité fyk :</span>
                  <span className="font-bold text-slate-900">{steelMat.fyk} MPa</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Coefficient partiel γs :</span>
                  <span className="font-bold text-slate-900">{steelMat.gammaS}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Limite de calcul fyd = fyk/γs :</span>
                  <span className="font-bold text-emerald-700">{fyd.toFixed(1)} MPa</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Module d'élasticité Es :</span>
                  <span className="font-bold text-slate-900">{steelMat.Es} GPa</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Contrainte limite admissible ELS (0.80 fyk) :</span>
                  <span className="font-bold text-blue-700">{(0.80 * steelMat.fyk).toFixed(1)} MPa</span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: VÉRIFICATION DÉTAILLÉE DES BIELLES ET DES ANGLES (EC2 §6.5.2 & §6.5.3) */}
          <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
            <div className="bg-slate-100 px-4 py-2.5 font-bold text-slate-900 text-xs border-b border-slate-200 flex justify-between items-center">
              <span className="flex items-center gap-2">
                <Compass size={14} className="text-blue-700" />
                <span>3. Justification des Bielles de Béton & Angles d'Inclinaison θ (EC2 §6.5.2)</span>
              </span>
              <span className="text-[10px] text-slate-500 font-normal">Critère θ (Schlaich) : 30° ≤ θ ≤ 60°, optimal 45°-55°</span>
            </div>

            <table className="w-full text-left font-mono text-[11px]">
              <thead className="bg-slate-50 text-slate-500 text-[10px] border-b border-slate-200">
                <tr>
                  <th className="p-2.5">Bielle</th>
                  <th className="p-2.5">Effort Fc,Ed</th>
                  <th className="p-2.5">Angle θ / cot θ</th>
                  <th className="p-2.5">Contrainte σ_Rd,max</th>
                  <th className="p-2.5">Largeur requise weff</th>
                  <th className="p-2.5">Largeur effective</th>
                  <th className="p-2.5 text-right">Statut Bielle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {members.filter(m => {
                  const res = solverResult?.memberResults.get(m.id);
                  return (res && res.force < -0.01) || m.type === 'strut';
                }).map((m) => {
                  const res = solverResult?.memberResults.get(m.id);
                  const fn = nodeMap.get(m.fromNodeId);
                  const tn = nodeMap.get(m.toNodeId);
                  const dx = (tn?.x || 0) - (fn?.x || 0);
                  const dy = (tn?.y || 0) - (fn?.y || 0);
                  const rad = Math.atan2(Math.abs(dy), Math.abs(dx));
                  const angleDeg = (rad * 180) / Math.PI;
                  const angleDiag = checkStrutAngle(angleDeg);

                  const force = Math.abs(res?.force || 0);
                  const weffReq = res?.effectiveWidthRequired || 150;
                  const weffAct = res?.effectiveWidthActual ?? (m.effectiveWidth ? m.effectiveWidth * 1000 : weffReq * 1.05);
                  const sigmaRdMax = res?.designStressLimit ?? (m.hasTransverseTension ? nuPrime * fcd * 0.6 : fcd);

                  return (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="p-2.5 font-bold text-slate-900">{m.id} ({m.fromNodeId}-{m.toNodeId})</td>
                      <td className="p-2.5 font-bold text-blue-700">-{force.toFixed(1)} kN</td>
                      <td className="p-2.5">
                        <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                          angleDiag.status === 'VALID' ? 'bg-emerald-100 text-emerald-800'
                          : angleDiag.status === 'INVALID_LOW' || angleDiag.status === 'INVALID_HIGH' ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-800'
                        }`}>
                          {angleDeg.toFixed(1)}° (cot={angleDiag.cotTheta.toFixed(2)})
                        </span>
                      </td>
                      <td className="p-2.5 text-slate-700">
                        {sigmaRdMax.toFixed(2)} MPa
                      </td>
                      <td className="p-2.5 font-bold text-slate-900">{weffReq.toFixed(0)} mm</td>
                      <td className="p-2.5 text-slate-700">{weffAct.toFixed(0)} mm</td>
                      <td className="p-2.5 text-right">
                        {res?.status === 'OK' ? (
                          <span className="text-emerald-700 font-bold inline-flex items-center gap-1">
                            <CheckCircle2 size={13} /> Conforme
                          </span>
                        ) : (
                          <span className="text-red-600 font-bold inline-flex items-center gap-1">
                            <AlertTriangle size={13} /> {res?.status || 'Vérif'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* SECTION 4: VÉRIFICATION DÉTAILLÉE DES TIRANTS (ELU & ELS) */}
          <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
            <div className="bg-slate-100 px-4 py-2.5 font-bold text-slate-900 text-xs border-b border-slate-200 flex justify-between items-center">
              <span className="flex items-center gap-2">
                <Layers size={14} className="text-red-600" />
                <span>4. Justification des Tirants d'Armatures HA (ELU & ELS §7.2)</span>
              </span>
              <span className="text-[10px] text-slate-500 font-normal">Vérification fyd = {fyd.toFixed(0)} MPa & ELS ≤ {(0.80 * steelMat.fyk).toFixed(0)} MPa</span>
            </div>

            <table className="w-full text-left font-mono text-[11px]">
              <thead className="bg-slate-50 text-slate-500 text-[10px] border-b border-slate-200">
                <tr>
                  <th className="p-2.5">Tirant</th>
                  <th className="p-2.5">Effort T_Ed</th>
                  <th className="p-2.5">Section As,req</th>
                  <th className="p-2.5">Ferraillage proposé</th>
                  <th className="p-2.5">Section As,prov</th>
                  <th className="p-2.5">Contrainte ELS σ_s</th>
                  <th className="p-2.5">Longueur Ancrage l_bd</th>
                  <th className="p-2.5 text-right">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {members.filter(m => {
                  const res = solverResult?.memberResults.get(m.id);
                  return (res && res.force > 0.001) || m.type === 'tie';
                }).map((m) => {
                  const res = solverResult?.memberResults.get(m.id);
                  const force = res?.force || 0;
                  const reqAs = res?.requiredAs || (force > 0 ? (force * 10 / fyd) : 0);
                  const asProv = res?.providedAs || (reqAs * 1.15);
                  const elsCheck = checkElsStress(force, asProv, steelMat.fyk);
                  const lbd = res?.anchorageLengthMm || 450;
                  const isConforming = res?.status === 'OK' && elsCheck.isOk;

                  return (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="p-2.5 font-bold text-slate-900">{m.id} ({m.fromNodeId}-{m.toNodeId})</td>
                      <td className="p-2.5 font-bold text-red-600">+{force.toFixed(1)} kN</td>
                      <td className="p-2.5 text-slate-900 font-bold">{reqAs.toFixed(2)} cm²</td>
                      <td className="p-2.5 font-bold text-red-700">{res?.suggestedRebar || '4 HA20'}</td>
                      <td className="p-2.5 text-emerald-700 font-bold">{asProv.toFixed(2)} cm²</td>
                      <td className="p-2.5">
                        <span className={`font-bold ${elsCheck.isOk ? 'text-slate-800' : 'text-red-600'}`}>
                          {elsCheck.sigmaS_Els.toFixed(0)} / {elsCheck.limitMpa.toFixed(0)} MPa
                        </span>
                      </td>
                      <td className="p-2.5 text-slate-700">{lbd.toFixed(0)} mm</td>
                      <td className="p-2.5 text-right">
                        {isConforming ? (
                          <span className="text-emerald-700 font-bold inline-flex items-center gap-1">
                            <CheckCircle2 size={13} /> OK
                          </span>
                        ) : (
                          <span className="text-red-600 font-bold inline-flex items-center gap-1">
                            <AlertTriangle size={13} /> {res?.status && res.status !== 'OK' ? res.status : 'ELS'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* SECTION 5: ARMATURES DE PEAU MINIMALES & FISSURATION (EC2 §9.7.1 & §7.3) */}
          <div className="border-2 border-dashed border-indigo-200 rounded-lg p-4 bg-indigo-50/40 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-indigo-950 text-xs uppercase tracking-wide flex items-center gap-2">
                <Info size={15} className="text-indigo-600" />
                <span>5. Armatures de Peau Minimales & Maîtrise de la Fissuration (NF EN 1992-1-1 §9.7.1 & §7.3)</span>
              </h3>
              <span className="text-[10px] font-mono text-indigo-700 font-semibold bg-indigo-100 px-2 py-0.5 rounded">
                Ratio minimum : 0.10% par face (Ac,face = bw × h)
              </span>
            </div>

            <p className="text-[11px] text-indigo-900/80 leading-relaxed font-sans">
              Conformément à l'Eurocode 2 §9.7.1 pour les parois fléchies et poutres-cloisons, un ferraillage de peau en réseau orthogonal maillé doit être disposé sur chaque face pour prévenir le décollement superficiel et contenir l'ouverture des fissures w_k ≤ 0.30 mm en zone tendue.
            </p>

            <div className="grid grid-cols-4 gap-3 text-[11px] font-mono">
              <div className="bg-white p-2.5 rounded border border-indigo-200">
                <span className="text-slate-500 text-[10px] block">Section Min / Face</span>
                <span className="font-bold text-indigo-950 text-xs">{skinRebar.asMinPerFaceCm2PerM.toFixed(2)} cm²/m / face</span>
              </div>
              <div className="bg-white p-2.5 rounded border border-indigo-200">
                <span className="text-slate-500 text-[10px] block">Section Totale Élément</span>
                <span className="font-bold text-indigo-950 text-xs">{skinRebar.asMinTotalCm2.toFixed(2)} cm² (les 2 faces)</span>
              </div>
              <div className="bg-white p-2.5 rounded border border-indigo-200">
                <span className="text-slate-500 text-[10px] block">Espacement Maximal</span>
                <span className="font-bold text-indigo-950 text-xs">s_max ≤ {skinRebar.maxSpacingMm} mm</span>
              </div>
              <div className="bg-white p-2.5 rounded border border-indigo-200">
                <span className="text-slate-500 text-[10px] block">Treillis / Barres Recommandées</span>
                <span className="font-bold text-emerald-700 text-xs">{skinRebar.suggestedMesh}</span>
              </div>
            </div>
          </div>

          {/* SECTION 6: VÉRIFICATION DES NŒUDS ET DES PRESSIONS D'APPUI (EC2 §6.5.4) */}
          <div className="border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
            <div className="bg-slate-100 px-4 py-2.5 font-bold text-slate-900 text-xs border-b border-slate-200 flex justify-between items-center">
              <span>6. Justification des Nœuds Nodal Zones & Pressions d'Appui (EC2 §6.5.4)</span>
              <span className="text-[10px] text-slate-500 font-normal">CCC : k1=1.0 | CCT : k2=0.85 | CTT : k3=0.75</span>
            </div>
            <p className="px-4 py-1.5 text-[10px] text-slate-500 bg-slate-50/60 border-b border-slate-200 font-sans">
              La colonne "Écrasement local (§6.7)" est une vérification additionnelle sous les pieux circulaires (aire partiellement chargée) — elle ne remplace jamais la vérification de nœud ci-dessus.
            </p>

            <table className="w-full text-left font-mono text-[11px]">
              <thead className="bg-slate-50 text-slate-500 text-[10px] border-b border-slate-200">
                <tr>
                  <th className="p-2.5">Nœud</th>
                  <th className="p-2.5">Type Nœud</th>
                  <th className="p-2.5">Contrainte limite σ_Rd,max</th>
                  <th className="p-2.5">Pression d'appui σ_b</th>
                  <th className="p-2.5">Aire requise A_req</th>
                  <th className="p-2.5">Aire fournie A_act</th>
                  <th className="p-2.5">Écrasement local (§6.7)</th>
                  <th className="p-2.5 text-right">Taux de travail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {nodes.map((n) => {
                  const nodeRes = solverResult?.nodeResults.get(n.id);
                  if (!nodeRes) return null;

                  return (
                    <tr key={n.id} className="hover:bg-slate-50">
                      <td className="p-2.5 font-bold text-slate-900">
                        <div>{n.id}</div>
                        {n.bearingShape === 'circular' && (
                          <div className="text-[9px] text-blue-700 font-medium">Pieu ∅{((n.bearingDiameter || n.bearingWidth || 0.40) * 100).toFixed(0)}cm</div>
                        )}
                      </td>
                      <td className="p-2.5">
                        <span className="px-1.5 py-0.5 rounded font-bold text-[10px] bg-slate-200 text-slate-800">
                          {nodeRes.nodeType}
                        </span>
                      </td>
                      <td className="p-2.5 text-slate-700">{nodeRes.designStressLimit.toFixed(2)} MPa</td>
                      <td className="p-2.5 font-bold text-slate-900">{nodeRes.bearingStress.toFixed(2)} MPa</td>
                      <td className="p-2.5 text-slate-700">{nodeRes.requiredBearingArea.toFixed(0)} cm²</td>
                      <td className="p-2.5 text-slate-700">{nodeRes.actualBearingArea.toFixed(0)} cm²</td>
                      <td className="p-2.5 text-slate-700">
                        {nodeRes.localBearingLimit !== undefined ? (
                          <span className={nodeRes.localBearingUtilization! > 1 ? 'text-red-600 font-bold' : 'text-slate-700'}>
                            σRdu={nodeRes.localBearingLimit.toFixed(1)} MPa ({((nodeRes.localBearingUtilization || 0) * 100).toFixed(0)}%)
                          </span>
                        ) : '—'}
                      </td>
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

          {/* SIGNATURE & VALIDATION FINALE */}
          <div className="grid grid-cols-2 gap-6 pt-4 border-t border-slate-300 font-mono text-[11px]">
            <div>
              <span className="text-slate-500 uppercase text-[10px] block">Observations & Dispositions Constructives :</span>
              <p className="text-slate-700 font-sans text-xs mt-1 leading-relaxed">
                Les ancrages des tirants sur les appuis CCT doivent être réalisés par crosses à 90° ou plaques d'ancrage soudées conformes à l'article §8.4. Enrobage nominal c_nom = 35 mm (classe d'exposition XC3/XC4).
              </p>
            </div>
            <div className="border border-slate-300 rounded p-3 bg-slate-50 flex flex-col justify-between">
              <span className="text-slate-500 uppercase text-[10px] block">Visa de l'Ingénieur Responsable :</span>
              <div className="font-bold text-slate-900 mt-4 text-center border-t border-dashed border-slate-400 pt-2 font-sans">
                {engineerName} — {new Date().toLocaleDateString('fr-FR')}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer (Hidden on print) */}
        <div className="print:hidden p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 font-mono">
            Dossier généré conformément à l'Eurocode 2 & Annexe Nationale Française
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-lg text-xs transition-colors shadow-sm"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
