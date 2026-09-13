/**
 * Calculateur de ferraillage commercial Haute Adhérence (HA) selon l'Eurocode 2 (NF EN 1992-1-1).
 * Gère le dimensionnement des tirants, choix des barres commerciales, vérifications
 * d'espacement libre dans le coffrage, longueurs d'ancrage lbd et armatures de suspension.
 */

export interface CommercialBarOption {
  numBars: number;
  diameter: number; // mm (8, 10, 12, 14, 16, 20, 25, 32)
  numLayers: number; // 1 ou 2 nappes
  providedAs: number; // cm²
  ratio: number; // providedAs / reqAs
  totalWeightPerMeter: number; // kg/m
  spacingMm: number; // entraxe ou espacement libre en mm
  isSpacingOk: boolean;
  label: string; // ex: "4 HA 20 (2 lits de 2)"
}

export interface TieRebarDesign {
  memberId: string;
  fromNodeId: string;
  toNodeId: string;
  forceTed: number; // kN (traction)
  length: number; // m
  requiredAs: number; // cm²
  chosenDiameter: number; // mm
  chosenNumBars: number;
  chosenNumLayers: number;
  providedAs: number; // cm²
  utilization: number; // reqAs / provAs
  isConforming: boolean;
  freeSpacingMm: number;
  minSpacingRequiredMm: number;
  isSpacingConforming: boolean;
  anchorageStraightCm: number; // lbd en cm pour barre droite
  anchorageHookCm: number; // lbd en cm avec crosse à 90°
  totalBarLengthM: number; // longueur barre avec ancrages aux 2 extrémités
  totalSteelWeightKg: number; // kg
  recommendedOptions: CommercialBarOption[];
}

export interface RebarScheduleItem {
  mark: string; // T1, T2, ...
  element: string;
  type: string; // "Tirant principal", "Étriers verticaux"
  diameter: number;
  numBars: number;
  unitLengthM: number;
  totalLengthM: number;
  unitWeightKgM: number;
  totalWeightKg: number;
  description: string;
}

export const COMMERCIAL_DIAMETERS = [8, 10, 12, 14, 16, 20, 25, 32];

/** Section d'une seule barre en cm² pour un diamètre en mm */
export function getBarAreaCm2(diameterMm: number): number {
  return (Math.PI * Math.pow(diameterMm / 10, 2)) / 4;
}

/** Poids linéique théorique en kg/m (densité 7850 kg/m³) */
export function getLinearMassKgPerM(diameterMm: number): number {
  return 0.006165 * diameterMm * diameterMm;
}

/**
 * Calcule la longueur d'ancrage de référence et de calcul selon EC2 §8.4
 */
export function calculateAnchorageLengths(
  diameterMm: number,
  fck: number,
  fyk: number = 500,
  gammaS: number = 1.15,
  gammaC: number = 1.5,
  isGoodBond: boolean = true
) {
  const fyd = fyk / gammaS; // ex: 434.78 MPa
  // fctm = 0.30 * fck^(2/3)
  const fctm = 0.30 * Math.pow(fck, 2 / 3);
  // fctd = alpha_ct * fctm / gammaC
  const fctd = (1.0 * fctm) / gammaC;

  const eta1 = isGoodBond ? 1.0 : 0.7;
  const eta2 = diameterMm <= 32 ? 1.0 : (132 - diameterMm) / 100;
  const fbd = 2.25 * eta1 * eta2 * fctd; // MPa

  // lb,rqd = (Phi / 4) * (fyd / fbd)
  const lbRqd = (diameterMm / 4) * (fyd / fbd); // mm

  // Ancrage droit : alpha1 = 1.0
  const lbdStraight = Math.max(lbRqd * 1.0, 10 * diameterMm, 100);
  // Ancrage courbe / crosse : alpha1 = 0.7
  const lbdHook = Math.max(lbRqd * 0.7, 10 * diameterMm, 100);

  return {
    fbd,
    fctd,
    lbRqdMm: Math.round(lbRqd),
    lbdStraightMm: Math.round(lbdStraight),
    lbdHookMm: Math.round(lbdHook),
    lbdStraightCm: Math.ceil(lbdStraight / 10),
    lbdHookCm: Math.ceil(lbdHook / 10)
  };
}

/**
 * Trouve les meilleures propositions de ferraillage commercial pour une section requise AsReq
 */
export function findCommercialRebarOptions(
  reqAsCm2: number,
  elementThicknessM: number,
  nominalCoverMm: number = 35,
  aggregateDgMm: number = 20
): CommercialBarOption[] {
  const bwMm = Math.round(elementThicknessM * 1000);
  const options: CommercialBarOption[] = [];

  const barCounts = [2, 3, 4, 5, 6, 8];

  COMMERCIAL_DIAMETERS.forEach((d) => {
    if (d < 10 && reqAsCm2 > 4.0) return; // Éviter trop de petits diamètres pour gros tirants

    barCounts.forEach((n) => {
      const singleArea = getBarAreaCm2(d);
      const totalArea = n * singleArea;

      // Doit couvrir le besoin avec un surdimensionnement raisonnable (< 160%)
      if (totalArea >= reqAsCm2 && totalArea <= reqAsCm2 * 1.7) {
        // Déterminer le nombre de lits (si n > 4, peut être sur 2 lits)
        const numLayers = n > 4 ? 2 : 1;
        const barsPerLayer = Math.ceil(n / numLayers);

        // Espacement libre horizontal : (bw - 2*c - barsPerLayer * d) / (barsPerLayer - 1)
        const availableWidth = bwMm - 2 * nominalCoverMm - barsPerLayer * d;
        const freeSpacing = barsPerLayer > 1 ? availableWidth / (barsPerLayer - 1) : availableWidth;
        const minSpacing = Math.max(d, aggregateDgMm + 5, 20);

        const isOk = freeSpacing >= minSpacing && availableWidth > 0;

        options.push({
          numBars: n,
          diameter: d,
          numLayers,
          providedAs: parseFloat(totalArea.toFixed(2)),
          ratio: parseFloat((totalArea / reqAsCm2).toFixed(2)),
          totalWeightPerMeter: parseFloat((n * getLinearMassKgPerM(d)).toFixed(2)),
          spacingMm: Math.round(freeSpacing),
          isSpacingOk: isOk,
          label: `${n} HA ${d}${numLayers > 1 ? ` (${numLayers} lits)` : ''}`
        });
      }
    });
  });

  // Trier par proximité à 1.0 (efficacité optimale) et faisabilité d'encombrement
  options.sort((a, b) => {
    if (a.isSpacingOk && !b.isSpacingOk) return -1;
    if (!a.isSpacingOk && b.isSpacingOk) return 1;
    return a.providedAs - b.providedAs;
  });

  return options.slice(0, 5);
}

/**
 * Calcule les armatures de suspension verticales (étriers) pour reprise d'effort vertical
 */
export function calculateSuspensionStirrups(
  verticalForceTedKn: number,
  elementHeightM: number,
  fyk: number = 500,
  gammaS: number = 1.15
) {
  const fyd = fyk / gammaS;
  const reqAsCm2 = (verticalForceTedKn * 10) / fyd;

  // Proposer des cadres/étriers HA 8, HA 10, HA 12 à 2 brins verticaux
  const stirrupProposals = [8, 10, 12].map((d) => {
    const area2LegsCm2 = 2 * getBarAreaCm2(d); // 2 brins verticaux
    // espacement requis s = area2Legs / reqAs * elementHeight
    const sIdealM = (area2LegsCm2 / reqAsCm2) * Math.min(elementHeightM, 1.0);
    // Arrondir aux espacements standard (10, 12, 15, 20 cm)
    let chosenSpacingCm = 15;
    if (sIdealM < 0.12) chosenSpacingCm = 10;
    else if (sIdealM < 0.17) chosenSpacingCm = 15;
    else chosenSpacingCm = 20;

    const providedAsPerM = (area2LegsCm2 / (chosenSpacingCm / 100));

    return {
      diameter: d,
      legs: 2,
      spacingCm: chosenSpacingCm,
      providedAsPerM: parseFloat(providedAsPerM.toFixed(2)),
      isConforming: providedAsPerM >= (reqAsCm2 / Math.min(elementHeightM, 1.0)),
      label: `Étriers HA ${d} e = ${chosenSpacingCm} cm (2 brins)`
    };
  });

  return {
    verticalForceTedKn,
    reqAsCm2: parseFloat(reqAsCm2.toFixed(2)),
    stirrupProposals
  };
}
