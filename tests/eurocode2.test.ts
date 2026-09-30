import { describe, expect, it } from 'vitest';

import type { STMMember, STMNode } from '../src/types/stm';
import {
  calculateSkinRebar,
  checkElsStress,
  checkEurocodeMember,
  checkEurocodeNode,
  checkStrutAngle,
} from '../src/utils/eurocode2';
import { B500, C30 } from './fixtures';

const tirant: STMMember = { id: 't', fromNodeId: 'a', toNodeId: 'b', type: 'tie' };
const bielle: STMMember = { id: 'b', fromNodeId: 'a', toNodeId: 'b', type: 'strut' };

describe('checkEurocodeMember — tirants (§6.5.3)', () => {
  /**
   * T = 100 kN, f_yd = 500 / 1,15 = 434,783 MPa
   * A_s,req = 100 / 43,4783 = 2,3000 cm2 -> 2 HA 12 (2,26) insuffisant, 2 HA 14 (3,08)
   * F_Rd = 3,08 x 43,4783 = 133,913 kN ; taux 0,746753 ; sigma = 100 / 0,308 = 324,675 MPa
   */
  it('section requise, barres proposees, capacite', () => {
    const r = checkEurocodeMember(100, 2, tirant, C30, B500, 0.3);
    expect(r.requiredAs).toBeCloseTo(2.3, 9);
    expect(r.suggestedRebar).toMatch(/2 HA 14/);
    expect(r.providedAs).toBe(3.08);
    expect(r.designCapacity).toBeCloseTo(133.913043, 5);
    expect(r.utilizationRatio).toBeCloseTo(0.746753, 6);
    expect(r.stress).toBeCloseTo(324.675325, 5);
    expect(r.status).toBe('OK');
  });

  it('le ferraillage reellement choisi prime sur la suggestion', () => {
    const r = checkEurocodeMember(100, 2, { ...tirant, rebarConfig: { barDiameter: 12, barCount: 2, layers: 1, totalAreaCm2: 2 } }, C30, B500, 0.3);
    // 100 / (2 x 43,4783) = 1,15
    expect(r.utilizationRatio).toBeCloseTo(1.15, 9);
    expect(r.status).toBe('EXCEEDED');
    // La contrainte affichee est plafonnee a f_yd.
    expect(r.stress).toBeCloseTo(434.782609, 5);
  });

  it('au-dela de 8 HA 32, la suggestion l annonce', () => {
    expect(checkEurocodeMember(3000, 2, tirant, C30, B500, 0.3).suggestedRebar).toMatch(/> 8 HA 32/);
  });

  it('tirant comprime : incoherence de modele signalee', () => {
    const r = checkEurocodeMember(-50, 2, tirant, C30, B500, 0.3);
    expect(r.status).toBe('EXCEEDED');
    expect(r.notes).toMatch(/Incohérence/);
  });
});

describe('checkEurocodeMember — bielles (§6.5.2)', () => {
  it('sans traction transversale : sigma_Rd,max = f_cd = 20 MPa', () => {
    // C = 300 kN, b_w = 0,3 : w_req = 300 / (0,3 x 20 000) = 0,05 m ; largeur par defaut 0,15 m
    const r = checkEurocodeMember(-300, 2, bielle, C30, B500, 0.3);
    expect(r.designStressLimit).toBeCloseTo(20, 12);
    expect(r.effectiveWidthRequired).toBeCloseTo(50, 9);
    expect(r.designCapacity).toBeCloseTo(900, 9);
    expect(r.utilizationRatio).toBeCloseTo(1 / 3, 12);
  });

  it('avec traction transversale : 0,6 nu\' f_cd = 0,6 x 0,88 x 20 = 10,56 MPa', () => {
    const r = checkEurocodeMember(-300, 2, { ...bielle, hasTransverseTension: true }, C30, B500, 0.3);
    expect(r.designStressLimit).toBeCloseTo(10.56, 12);
  });

  it('largeur imposee insuffisante : depassement', () => {
    // 0,3 x 0,04 x 20 000 = 240 kN < 300
    const r = checkEurocodeMember(-300, 2, { ...bielle, effectiveWidth: 0.04 }, C30, B500, 0.3);
    expect(r.utilizationRatio).toBeCloseTo(1.25, 12);
    expect(r.status).toBe('EXCEEDED');
  });

  it('seuil d avertissement a 0,9', () => {
    // 0,3 x 0,05 x 20 000 = 300 ; 285 / 300 = 0,95
    expect(checkEurocodeMember(-285, 2, { ...bielle, effectiveWidth: 0.05 }, C30, B500, 0.3).status).toBe('WARNING');
  });
});

describe('checkEurocodeNode — §6.5.4', () => {
  const noeud: STMNode = { id: 'n', x: 0, y: 0 };

  it('limites CCC, CCT, CTT : 17,6 / 14,96 / 13,2 MPa en C30/37', () => {
    expect(checkEurocodeNode(noeud, 'CCC', 0, 0, 0, [], C30, 0.3).designStressLimit).toBeCloseTo(17.6, 12);
    expect(checkEurocodeNode(noeud, 'CCT', 0, 0, 0, [], C30, 0.3).designStressLimit).toBeCloseTo(14.96, 12);
    expect(checkEurocodeNode(noeud, 'CTT', 0, 0, 0, [], C30, 0.3).designStressLimit).toBeCloseTo(13.2, 12);
  });

  it('la force determinante est la plus grande : reaction ou bielle', () => {
    // Reaction 50 kN, bielle a -70,71 kN : 70,71 kN sur 0,20 x 0,30 = 0,06 m2 -> 1,1785 MPa
    const r = checkEurocodeNode(noeud, 'CCT', 0, 50, 0, [{ memberId: 'b', force: -70.71, dir: [1, 0, 0] }], C30, 0.3);
    expect(r.bearingStress).toBeCloseTo(1.1785, 9);
    expect(r.actualBearingArea).toBeCloseTo(600, 9);
  });

  it('pieu circulaire : ecrasement local §6.7 plafonne a 3 f_cd', () => {
    const pieu: STMNode = { id: 'p', x: 0, y: 0, isSupport: true, bearingShape: 'circular', bearingDiameter: 0.4 };
    // A_c1 / A_c0 = (1,2 / 0,4)^2 = 9 -> racine 3 -> plafond 3 : 60 MPa
    const r = checkEurocodeNode(pieu, 'CCT', 0, 0, 500, [], C30, 0.3, 1.2);
    expect(r.localBearingLimit).toBeCloseTo(60, 9);
    // 500 / (pi 0,04 x 1000) = 3,9789 MPa
    expect(r.bearingStress).toBeCloseTo(3.978874, 5);
  });

  it('pieux trop rapproches : pas de majoration locale', () => {
    const pieu: STMNode = { id: 'p', x: 0, y: 0, isSupport: true, bearingShape: 'circular', bearingDiameter: 0.4 };
    expect(checkEurocodeNode(pieu, 'CCT', 0, 0, 500, [], C30, 0.3, 0.3).localBearingLimit).toBeUndefined();
  });
});

describe('calculateSkinRebar — §9.7(1)', () => {
  it('0,1 % par face : b_w = 0,30 -> 3,0 cm2/m', () => {
    const r = calculateSkinRebar(0.3, 2.0);
    expect(r.asMinPerFaceCm2PerM).toBeCloseTo(3, 12);
    expect(r.asMinPerFaceCm2).toBeCloseTo(6, 12);
    expect(r.asMinTotalCm2).toBeCloseTo(12, 12);
    expect(r.maxSpacingMm).toBe(300);
  });

  it('plancher de 150 mm2/m par face sur une ame mince', () => {
    // 0,1 % x 0,12 m = 1,2 cm2/m < 1,5 cm2/m
    const r = calculateSkinRebar(0.12, 2.0);
    expect(r.asMinPerFaceCm2PerM).toBe(1.5);
    expect(r.asMinPerFaceCm2).toBeCloseTo(3, 12);
    expect(r.maxSpacingMm).toBe(240);
  });
});

describe('checkStrutAngle', () => {
  it('bornes des plages', () => {
    expect(checkStrutAngle(29.9).status).toBe('INVALID_LOW');
    expect(checkStrutAngle(30).status).toBe('WARNING_LOW');
    expect(checkStrutAngle(45).status).toBe('VALID');
    expect(checkStrutAngle(55).status).toBe('VALID');
    expect(checkStrutAngle(55.1).status).toBe('WARNING_HIGH');
    expect(checkStrutAngle(60).status).toBe('WARNING_HIGH');
    expect(checkStrutAngle(60.1).status).toBe('INVALID_HIGH');
    expect(checkStrutAngle(45).cotTheta).toBeCloseTo(1, 12);
  });
});

describe('checkElsStress — §7.2(5)', () => {
  it('0,7 x 100 kN sur 3,08 cm2 : 227,27 MPa contre 0,8 f_yk = 400', () => {
    const r = checkElsStress(100, 3.08);
    expect(r.sigmaS_Els).toBeCloseTo(227.272727, 5);
    expect(r.limitMpa).toBe(400);
    expect(r.isOk).toBe(true);
  });

  it('section nulle : pas de division par zero', () => {
    expect(checkElsStress(100, 0).sigmaS_Els).toBe(0);
  });
});
