import type { ConcreteMaterial, STMMember, STMNode, SteelMaterial } from '../src/types/stm';

/** C30/37, gamma_c = 1,5, alpha_cc = 1,0 : f_cd = 20 MPa, nu' = 0,88. */
export const C30: ConcreteMaterial = { name: 'C30/37', fck: 30, gammaC: 1.5, alphaCc: 1.0, aggregateSize: 20 };

/** B500, gamma_s = 1,15 : f_yd = 434,78 MPa. */
export const B500: SteelMaterial = { name: 'B500', fyk: 500, gammaS: 1.15, Es: 200 };

/**
 * Triangle isostatique : A(0,0) appui fixe, B(4,0) rouleau, C(2,2) charge 100 kN
 * vers le bas. Bielles AC et BC a 45 degres, tirant AB.
 *
 * Statique : R_A = R_B = 50 kN ; N_AC = N_BC = -50 / sin 45 = -70,7107 kN ;
 * N_AB = 70,7107 cos 45 = +50 kN.
 */
export function triangle(cx = 2, cy = 2): { nodes: STMNode[]; members: STMMember[] } {
  return {
    nodes: [
      { id: 'A', x: 0, y: 0, isSupport: true, supportType: 'pin' },
      { id: 'B', x: 4, y: 0, isSupport: true, supportType: 'roller_x' },
      { id: 'C', x: cx, y: cy, fy: -100 },
    ],
    members: [
      { id: 'AC', fromNodeId: 'A', toNodeId: 'C', type: 'strut' },
      { id: 'BC', fromNodeId: 'B', toNodeId: 'C', type: 'strut' },
      { id: 'AB', fromNodeId: 'A', toNodeId: 'B', type: 'tie' },
    ],
  };
}
