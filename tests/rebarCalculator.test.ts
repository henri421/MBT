import { describe, expect, it } from 'vitest';

import {
  COMMERCIAL_DIAMETERS,
  calculateAnchorageLengths,
  calculateSuspensionStirrups,
  findCommercialRebarOptions,
  getBarAreaCm2,
  getLinearMassKgPerM,
} from '../src/utils/rebarCalculator';

describe('getBarAreaCm2 et getLinearMassKgPerM', () => {
  it('HA 20 : 3,1416 cm2 et 2,466 kg/m', () => {
    expect(getBarAreaCm2(20)).toBeCloseTo(3.141593, 6);
    expect(getLinearMassKgPerM(20)).toBeCloseTo(2.466, 9);
  });

  it('masse lineique coherente avec 7850 kg/m3', () => {
    for (const d of COMMERCIAL_DIAMETERS) {
      expect(getLinearMassKgPerM(d)).toBeCloseTo(getBarAreaCm2(d) * 1e-4 * 7850, 3);
    }
  });
});

describe('calculateAnchorageLengths — §8.4', () => {
  /**
   * HA 16, C30/37, B500 : f_ctm = 2,8965 ; f_ctk,0.05 = 2,0275 ; f_ctd = 1,3517 MPa
   * f_bd = 2,25 x 1,3517 = 3,0413 MPa ; l_b,rqd = 16/4 x 434,78 / 3,0413 = 571,8 mm
   * crosse : max(0,7 x 571,8 ; 160 ; 100) = 400,3 mm
   */
  it('HA 16 en C30/37', () => {
    const r = calculateAnchorageLengths(16, 30);
    expect(r.fctd).toBeCloseTo(1.351685, 5);
    expect(r.fbd).toBeCloseTo(3.041292, 5);
    expect(r.lbRqdMm).toBe(572);
    expect(r.lbdStraightMm).toBe(572);
    expect(r.lbdHookMm).toBe(400);
    expect(r.lbdStraightCm).toBe(58);
  });

  it('mauvaise adherence : eta_1 = 0,7 allonge l ancrage de 1/0,7', () => {
    const bonne = calculateAnchorageLengths(16, 30, 500, 1.15, 1.5, true);
    const mauvaise = calculateAnchorageLengths(16, 30, 500, 1.15, 1.5, false);
    expect(mauvaise.fbd / bonne.fbd).toBeCloseTo(0.7, 12);
  });

  it('au-dela de 32 mm, eta_2 = (132 - phi) / 100', () => {
    const r40 = calculateAnchorageLengths(40, 30);
    const r32 = calculateAnchorageLengths(32, 30);
    expect(r40.fbd / r32.fbd).toBeCloseTo(0.92, 12);
  });

  it('resistance d adherence plafonnee au C60/75', () => {
    // f_ctm(C60) = 2,12 ln(1 + 68/10) = 4,3547
    expect(calculateAnchorageLengths(16, 90).fctd).toBeCloseTo((0.7 * 4.354742) / 1.5, 5);
    expect(calculateAnchorageLengths(16, 90).fbd).toBe(calculateAnchorageLengths(16, 60).fbd);
  });

  it('minimum de 10 phi et 100 mm', () => {
    // Petit diametre dans un beton tres resistant : le minimum gouverne la crosse
    const r = calculateAnchorageLengths(8, 60);
    expect(r.lbdHookMm).toBeGreaterThanOrEqual(100);
  });
});

describe('findCommercialRebarOptions', () => {
  /**
   * A_s,req = 2,30 cm2, b_w = 0,30 m : sections de 2,30 a 3,91 cm2.
   * Par section croissante : 3 HA 10 (2,36), 5 HA 8 (2,51), 6 HA 8 (3,02), 2 HA 14 (3,08), 4 HA 10 (3,14).
   */
  it('cinq options, de la plus econome a la plus forte', () => {
    const r = findCommercialRebarOptions(2.3, 0.3);
    expect(r.map((o) => o.label)).toEqual(['3 HA 10', '5 HA 8 (2 lits)', '6 HA 8 (2 lits)', '2 HA 14', '4 HA 10']);
    for (const o of r) {
      expect(o.providedAs).toBeGreaterThanOrEqual(2.3);
      expect(o.isSpacingOk).toBe(true);
    }
  });

  it('les options qui ne tiennent pas dans le coffrage passent en dernier', () => {
    const r = findCommercialRebarOptions(20, 0.15);
    const premierHorsGabarit = r.findIndex((o) => !o.isSpacingOk);
    if (premierHorsGabarit >= 0) expect(r.slice(premierHorsGabarit).every((o) => !o.isSpacingOk)).toBe(true);
  });

  it('pas de petits diametres pour un gros tirant', () => {
    expect(findCommercialRebarOptions(10, 0.4).every((o) => o.diameter >= 10)).toBe(true);
  });
});

describe('calculateSuspensionStirrups', () => {
  /**
   * 100 kN : A_s,req = 1000 / 434,78 = 2,30 cm2 sur min(h ; 1 m).
   * HA 8, 2 brins : 1,0053 cm2 ; s ideal = 1,0053 / 2,3 = 0,437 m -> 20 cm ; 5,03 cm2/m >= 2,3
   */
  it('proposition HA 8, HA 10, HA 12', () => {
    const r = calculateSuspensionStirrups(100, 1.0);
    expect(r.reqAsCm2).toBe(2.3);
    expect(r.stirrupProposals).toHaveLength(3);
    expect(r.stirrupProposals[0].spacingCm).toBe(20);
    expect(r.stirrupProposals[0].providedAsPerM).toBeCloseTo(5.03, 9);
    expect(r.stirrupProposals.every((p) => p.isConforming)).toBe(true);
  });

  it('forte suspension : l espacement standard ne suffit plus et le constat le dit', () => {
    const r = calculateSuspensionStirrups(1500, 1.0);
    expect(r.stirrupProposals[0].isConforming).toBe(false);
  });
});
