import {
  STMMember,
  STMNode,
  ConcreteMaterial,
  SteelMaterial,
  NodeType
} from '../types/stm';
import { calculateAnchorageLengths } from './rebarCalculator';

export interface EurocodeMemberCheckResult {
  stress: number; // MPa
  designStressLimit: number; // MPa (sigma_Rd,max)
  designCapacity: number; // kN
  utilizationRatio: number;
  requiredAs?: number; // cm² for ties
  providedAs?: number; // cm² for ties, from real rebarConfig or suggested rebar
  suggestedRebar?: string;
  anchorageLengthMm?: number; // lbd straight (mm), for ties
  effectiveWidthRequired: number; // mm
  effectiveWidthActual?: number; // mm, for struts
  status: 'OK' | 'WARNING' | 'EXCEEDED';
  notes: string;
}

export interface EurocodeNodeCheckResult {
  designStressLimit: number; // MPa (sigma_Rd,max)
  bearingStress: number; // MPa
  bearingUtilization: number;
  requiredBearingArea: number; // cm²
  actualBearingArea: number; // cm²
  localBearingLimit?: number; // MPa, EC2 §6.7 (aire partiellement chargée), pieux circulaires uniquement
  localBearingUtilization?: number;
  status: 'OK' | 'WARNING' | 'EXCEEDED';
  notes: string;
}

// Sections d'armatures HA commerciales (géométriques, indépendantes de la nuance d'acier)
const REBAR_TABLE = [
  { desc: '2 HA 12', asCm2: 2.26 },
  { desc: '2 HA 14', asCm2: 3.08 },
  { desc: '2 HA 16', asCm2: 4.02 },
  { desc: '3 HA 16', asCm2: 6.03 },
  { desc: '4 HA 16', asCm2: 8.04 },
  { desc: '3 HA 20', asCm2: 9.42 },
  { desc: '4 HA 20', asCm2: 12.57 },
  { desc: '4 HA 25', asCm2: 19.63 },
  { desc: '6 HA 25', asCm2: 29.45 },
  { desc: '6 HA 32', asCm2: 48.25 },
  { desc: '8 HA 32', asCm2: 64.34 },
];

export function checkEurocodeMember(
  forceKn: number, // positive = tension, negative = compression
  lengthM: number,
  member: STMMember,
  concreteMat: ConcreteMaterial,
  steelMat: SteelMaterial,
  concreteThicknessM: number
): EurocodeMemberCheckResult {
  const fcd = (concreteMat.alphaCc * concreteMat.fck) / concreteMat.gammaC; // MPa
  const nuPrime = 1.0 - concreteMat.fck / 250.0; // EC2 Eq. (6.57N)
  const fyd = steelMat.fyk / steelMat.gammaS; // MPa (ex: 500/1.15 = 434.8 MPa)

  const bw = member.thickness || concreteThicknessM; // m
  const isCompression = forceKn < -0.001;
  const isTension = forceKn > 0.001;
  const absForce = Math.abs(forceKn);

  if (member.type === 'tie' && isCompression) {
    // EN 1992-1-1 6.5.3 : un tirant ne reprend pas la compression. Le typage de l'élément
    // est incompatible avec l'effort résolu par le solveur (géométrie ou optimisation à revoir).
    return {
      stress: 0,
      designStressLimit: fyd,
      designCapacity: 0,
      utilizationRatio: 99,
      effectiveWidthRequired: 0,
      status: 'EXCEEDED',
      notes: `Incohérence de modèle (EC2 §6.5.3) : élément typé "Tirant" mais effort résolu compressif (${absForce.toFixed(1)} kN). Un tirant ne reprend pas la compression — revoir la géométrie du treillis ou retyper l'élément en bielle.`
    };
  }

  if (isTension || member.type === 'tie') {
    // EN 1992-1-1 6.5.3: Tirants (Ties)
    // As,req = Ftd / fyd. In cm²: (Ftd [kN] / (fyd [MPa] / 10))
    const requiredAsCm2 = (absForce / (fyd / 10)); // cm²

    // Find suggested rebar (next commercial size covering the requirement)
    let suggestedRebar = '> 8 HA 32 (Forte nappe)';
    let suggestedAsCm2 = requiredAsCm2 * 1.05;
    for (const reb of REBAR_TABLE) {
      if (reb.asCm2 >= requiredAsCm2 * 0.99) {
        suggestedRebar = `${reb.desc} (${reb.asCm2.toFixed(2)} cm²)`;
        suggestedAsCm2 = reb.asCm2;
        break;
      }
    }

    // Steel capacity: use the rebar the user actually selected (member.rebarConfig)
    // when available, otherwise fall back to the suggested commercial rebar.
    const providedAsCm2 = member.rebarConfig?.totalAreaCm2 ?? (requiredAsCm2 > 0 ? suggestedAsCm2 : 2.26);
    const designCapacityKn = providedAsCm2 * (fyd / 10);
    const util = designCapacityKn > 0 ? absForce / designCapacityKn : 0;
    const stress = absForce > 0 ? (absForce / (providedAsCm2 / 10)) : 0; // MPa

    const status = util > 1.0 ? 'EXCEEDED' : util > 0.9 ? 'WARNING' : 'OK';

    const diameterMm = member.rebarConfig?.barDiameter ?? member.barDiameter ?? 16;
    const anchorage = calculateAnchorageLengths(diameterMm, concreteMat.fck, steelMat.fyk, steelMat.gammaS, concreteMat.gammaC);

    return {
      stress: Math.min(stress, fyd),
      designStressLimit: fyd,
      designCapacity: designCapacityKn,
      utilizationRatio: util,
      requiredAs: requiredAsCm2,
      providedAs: providedAsCm2,
      suggestedRebar,
      anchorageLengthMm: anchorage.lbdStraightMm,
      effectiveWidthRequired: 0,
      status,
      notes: `Tirant d'armatures: As,req = ${requiredAsCm2.toFixed(2)} cm², As,prov = ${providedAsCm2.toFixed(2)} cm² (fyd = ${fyd.toFixed(1)} MPa)`
    };
  } else {
    // EN 1992-1-1 6.5.2: Bielles de compression (Struts)
    // 6.5.2(1) sans traction transversale : sigma_Rd,max = fcd (pas de facteur nu' au 6.5.2)
    // 6.5.2(2) avec traction transversale (bielle fissurée) : sigma_Rd,max = 0.6 * nu' * fcd
    const sigmaRdMax = member.hasTransverseTension ? 0.6 * nuPrime * fcd : fcd; // MPa

    // Required effective width ws,req = Fcd / (bw * sigmaRdMax)
    // bw in meters, sigma in MPa = 1000 kN/m²
    const requiredWidthM = absForce / (bw * sigmaRdMax * 1000); // meters
    const requiredWidthMm = requiredWidthM * 1000;

    // Actual or assigned effective width
    const actualWidthM = member.effectiveWidth || Math.max(requiredWidthM * 1.05, 0.15); // default 150mm
    const actualWidthMm = actualWidthM * 1000;

    // Capacity F_Rd = bw * w_eff * sigma_Rd,max
    const designCapacityKn = bw * actualWidthM * (sigmaRdMax * 1000);
    const actualStressMpa = absForce / (bw * actualWidthM * 1000);
    const util = designCapacityKn > 0 ? absForce / designCapacityKn : 0;

    const status = util > 1.0 ? 'EXCEEDED' : util > 0.9 ? 'WARNING' : 'OK';

    const regimeDesc = member.hasTransverseTension
      ? 'Bielle fissurée (avec traction transversale, σRd,max = 0.6·ν´·fcd)'
      : 'Bielle comprimée standard (σRd,max = fcd)';

    return {
      stress: actualStressMpa,
      designStressLimit: sigmaRdMax,
      designCapacity: designCapacityKn,
      utilizationRatio: util,
      effectiveWidthRequired: requiredWidthMm,
      effectiveWidthActual: actualWidthMm,
      status,
      notes: `${regimeDesc} | σ_Rd,max = ${sigmaRdMax.toFixed(2)} MPa | bielle req. = ${requiredWidthMm.toFixed(0)} mm`
    };
  }
}

export function checkEurocodeNode(
  node: STMNode,
  nodeType: NodeType,
  rx: number,
  ry: number,
  rz: number,
  incidentMemberForces: { memberId: string; force: number; dir: number[] }[],
  concreteMat: ConcreteMaterial,
  concreteThicknessM: number,
  nearestCircularSupportSpacingM?: number
): EurocodeNodeCheckResult {
  const fcd = (concreteMat.alphaCc * concreteMat.fck) / concreteMat.gammaC; // MPa
  const nuPrime = 1.0 - concreteMat.fck / 250.0;

  // EN 1992-1-1 6.5.4: Nodal zones stress limits
  // CCC: k1 = 1.0 => sigma_Rd,max = 1.0 * nu' * fcd
  // CCT: k2 = 0.85 => sigma_Rd,max = 0.85 * nu' * fcd
  // CTT: k3 = 0.75 => sigma_Rd,max = 0.75 * nu' * fcd (couvre aussi les nœuds à 3+ tirants,
  //   non distingués par l'EC2 qui ne définit que ces trois catégories)
  let kFactor = 1.0;
  if (nodeType === 'CCC') kFactor = 1.0;
  else if (nodeType === 'CCT') kFactor = 0.85;
  else if (nodeType === 'CTT') kFactor = 0.75;

  const designStressLimit = kFactor * nuPrime * fcd; // MPa

  // Calculate resultant force on this node from reaction or applied load
  const loadRx = (node.fx || 0) + rx;
  const loadRy = (node.fy || 0) + ry;
  const loadRz = (node.fz || 0) + rz;
  const resultantLoad = Math.sqrt(loadRx * loadRx + loadRy * loadRy + loadRz * loadRz);

  // Or from max compressive member framing into the node
  let maxCompressiveForce = 0;
  incidentMemberForces.forEach(mf => {
    if (mf.force < 0 && Math.abs(mf.force) > maxCompressiveForce) {
      maxCompressiveForce = Math.abs(mf.force);
    }
  });

  const governingForce = Math.max(resultantLoad, maxCompressiveForce);

  // Bearing plate / nodal zone area (rectangulaire ou circulaire pour pieux/colonnes)
  const isCircular = node.bearingShape === 'circular';
  const diamM = node.bearingDiameter || node.bearingWidth || 0.40;
  const actualAreaM2 = isCircular
    ? (Math.PI * diamM * diamM) / 4.0
    : (node.bearingWidth || 0.20) * (node.bearingDepth || concreteThicknessM);
  const actualAreaCm2 = actualAreaM2 * 10000;

  // Bearing stress = F / Area
  // F in kN, Area in m² => kPa / 1000 = MPa
  const bearingStressMpa = actualAreaM2 > 0 ? (governingForce / (actualAreaM2 * 1000)) : 0;

  // Required bearing area = F / sigmaRdMax
  const requiredAreaM2 = designStressLimit > 0 ? (governingForce / (designStressLimit * 1000)) : 0;
  const requiredAreaCm2 = requiredAreaM2 * 10000;

  const util = designStressLimit > 0 ? bearingStressMpa / designStressLimit : 0;
  const status = util > 1.0 ? 'EXCEEDED' : util > 0.9 ? 'WARNING' : 'OK';

  // EN 1992-1-1 6.7 : aire partiellement chargée (écrasement local sous un pieu circulaire).
  // Vérification ADDITIVE à la vérification de nœud ci-dessus, jamais un remplacement : Ac1 (aire
  // de répartition, cercle concentrique limité à mi-distance du pieu voisin le plus proche) est par
  // construction >= Ac0, donc sigma_Rdu = fcd*sqrt(Ac1/Ac0) >= fcd est toujours >= la limite nodale
  // ci-dessus (<= fcd). Elle ne peut donc jamais être dimensionnante ; elle documente une marge
  // de résistance locale distincte (écrasement de contact), pas une relaxation de la limite nodale.
  let localBearingLimit: number | undefined;
  let localBearingUtilization: number | undefined;
  if (isCircular && node.isSupport && nearestCircularSupportSpacingM && nearestCircularSupportSpacingM > diamM) {
    const ac0M2 = actualAreaM2;
    const ac1M2 = (Math.PI * nearestCircularSupportSpacingM * nearestCircularSupportSpacingM) / 4.0;
    const enhancementRatio = Math.min(3.0, Math.sqrt(ac1M2 / ac0M2));
    localBearingLimit = fcd * enhancementRatio;
    localBearingUtilization = localBearingLimit > 0 ? bearingStressMpa / localBearingLimit : 0;
  }

  const shapeNote = isCircular
    ? `Pieu/Appui circulaire ∅${(diamM * 100).toFixed(0)}cm (A=${actualAreaCm2.toFixed(0)}cm²)`
    + (localBearingLimit !== undefined ? ` | Écrasement local §6.7 : σRdu=${localBearingLimit.toFixed(2)} MPa` : '')
    : `Plaque ${( (node.bearingWidth || 0.20) * 100).toFixed(0)}×${((node.bearingDepth || concreteThicknessM) * 100).toFixed(0)}cm`;

  return {
    designStressLimit,
    bearingStress: bearingStressMpa,
    bearingUtilization: util,
    requiredBearingArea: requiredAreaCm2,
    actualBearingArea: actualAreaCm2,
    localBearingLimit,
    localBearingUtilization,
    status,
    notes: `Nœud ${nodeType} [${shapeNote}]: k=${kFactor.toFixed(2)}, σ_Rd,max = ${designStressLimit.toFixed(2)} MPa, σ_b = ${bearingStressMpa.toFixed(2)} MPa`
  };
}

export interface SkinRebarCalculation {
  bwM: number;
  heightM: number;
  fck: number;
  fyk: number;
  minRatio: number; // 0.001 (0.10%) per face according to EC2 9.7(1)
  asMinTotalCm2: number;
  asMinPerFaceCm2: number;
  asMinPerFaceCm2PerM: number;
  suggestedMesh: string;
  maxSpacingMm: number;
}

export function calculateSkinRebar(
  bwM: number,
  heightM: number,
  fck: number = 30,
  fyk: number = 500
): SkinRebarCalculation {
  const minRatio = 0.001; // EC2 9.7(1): 0.1% per face
  const totalAreaM2 = bwM * heightM;
  const asMinPerFaceM2 = totalAreaM2 * minRatio;
  const asMinPerFaceCm2 = asMinPerFaceM2 * 10000;
  const asMinTotalCm2 = asMinPerFaceCm2 * 2;
  const asMinPerFaceCm2PerM = (bwM * 1.0 * minRatio) * 10000; // cm²/m per face
  const maxSpacingMm = Math.min(2 * bwM * 1000, 300);

  let suggestedMesh = '2x HA8 e=15 cm';
  if (asMinPerFaceCm2PerM > 5.0) suggestedMesh = '2x HA12 e=15 cm (ou ST50C)';
  else if (asMinPerFaceCm2PerM > 3.0) suggestedMesh = '2x HA10 e=15 cm (ou ST35C)';
  else if (asMinPerFaceCm2PerM > 1.5) suggestedMesh = '2x HA8 e=15 cm (ou ST25C)';
  else suggestedMesh = '2x HA6 e=15 cm (ou ST15C)';

  return {
    bwM,
    heightM,
    fck,
    fyk,
    minRatio,
    asMinTotalCm2,
    asMinPerFaceCm2,
    asMinPerFaceCm2PerM,
    suggestedMesh,
    maxSpacingMm
  };
}

export interface StrutAngleDiagnostic {
  angleDeg: number;
  status: 'VALID' | 'WARNING_LOW' | 'WARNING_HIGH' | 'INVALID_LOW' | 'INVALID_HIGH';
  cotTheta: number;
  message: string;
}

// Plage de compatibilité géométrique bielle/tirant recommandée pour les modèles bielles-tirants
// (pratique Schlaich, non une limite numérique du texte EC2 §6.5 lui-même) :
// < 30° ou > 60° : non admis (bielle trop couchée/redressée, incompatibilité de déformation) ;
// 30-45° et 55-60° : admissible mais sous-optimal ; 45-55° : plage optimale.
export function checkStrutAngle(angleDeg: number): StrutAngleDiagnostic {
  const rad = (angleDeg * Math.PI) / 180;
  const cotTheta = Math.abs(1 / Math.tan(rad));
  if (angleDeg < 30.0) {
    return {
      angleDeg,
      status: 'INVALID_LOW',
      cotTheta,
      message: `Angle θ = ${angleDeg.toFixed(1)}° < 30°. Non admis : bielle trop couchée, incompatibilité de déformation bielle/tirant.`
    };
  } else if (angleDeg > 60.0) {
    return {
      angleDeg,
      status: 'INVALID_HIGH',
      cotTheta,
      message: `Angle θ = ${angleDeg.toFixed(1)}° > 60°. Non admis : bielle trop redressée, effort tranchant mal transmis.`
    };
  } else if (angleDeg < 45.0) {
    return {
      angleDeg,
      status: 'WARNING_LOW',
      cotTheta,
      message: `Angle θ = ${angleDeg.toFixed(1)}° admissible (30° ≤ θ ≤ 60°) mais sous-optimal : la plage recommandée est 45°-55°.`
    };
  } else if (angleDeg > 55.0) {
    return {
      angleDeg,
      status: 'WARNING_HIGH',
      cotTheta,
      message: `Angle θ = ${angleDeg.toFixed(1)}° admissible (30° ≤ θ ≤ 60°) mais sous-optimal : la plage recommandée est 45°-55°.`
    };
  }
  return {
    angleDeg,
    status: 'VALID',
    cotTheta,
    message: `Angle θ = ${angleDeg.toFixed(1)}° optimal (45° ≤ θ ≤ 55°, cot θ = ${cotTheta.toFixed(2)}).`
  };
}

export function checkElsStress(
  tensionEdKn: number,
  asProvidedCm2: number,
  fyk: number = 500,
  ratioElsElu: number = 0.70
): {
  sigmaS_Els: number;
  limitMpa: number;
  ratio: number;
  isOk: boolean;
} {
  const tensionElsKn = tensionEdKn * ratioElsElu;
  const sigmaS_Els = asProvidedCm2 > 0 ? (tensionElsKn / (asProvidedCm2 / 10)) : 0;
  const limitMpa = 0.80 * fyk; // EC2 7.2(5) : limite 0.80 fyk sous ELS caractéristique
  const ratio = limitMpa > 0 ? sigmaS_Els / limitMpa : 0;
  return {
    sigmaS_Els,
    limitMpa,
    ratio,
    isOk: ratio <= 1.0
  };
}
