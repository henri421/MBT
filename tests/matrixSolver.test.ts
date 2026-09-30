import { describe, expect, it } from 'vitest';

import type { STMMember, STMNode } from '../src/types/stm';
import { solveTruss } from '../src/utils/matrixSolver';
import { B500, C30, triangle } from './fixtures';

function effort(r: ReturnType<typeof solveTruss>, id: string): number {
  const m = r.memberResults.get(id);
  if (m === undefined) throw new Error(`barre absente : ${id}`);
  return m.force;
}

describe('solveTruss — treillis isostatique, solution analytique', () => {
  it('triangle symetrique : bielles a -70,7107 kN, tirant a +50 kN', () => {
    const { nodes, members } = triangle();
    const r = solveTruss(nodes, members, C30, B500);
    expect(r.success).toBe(true);
    expect(effort(r, 'AC')).toBeCloseTo(-70.710678, 5);
    expect(effort(r, 'BC')).toBeCloseTo(-70.710678, 5);
    expect(effort(r, 'AB')).toBeCloseTo(50, 5);
  });

  it('reactions et equilibre global', () => {
    const { nodes, members } = triangle();
    const r = solveTruss(nodes, members, C30, B500);
    expect(r.nodeResults.get('A')?.ry).toBeCloseTo(50, 6);
    expect(r.nodeResults.get('B')?.ry).toBeCloseTo(50, 6);
    expect(r.nodeResults.get('A')?.rx).toBeCloseTo(0, 6);
    expect((r.totalRy ?? 0) + (r.totalFy ?? 0)).toBeCloseTo(0, 6);
    for (const n of r.nodeResults.values()) expect(n.equilibriumResidual).toBeLessThan(1e-6);
  });

  /**
   * C(1,2) : R_A = 75, R_B = 25 kN.
   * N_AC = -75 / sin(atan 2) = -75 racine(5)/2 = -83,8525 kN
   * N_BC = -25 / sin(atan 2/3) = -25 racine(13)/2 = -45,0694 kN
   * N_AB = 83,8525 / racine(5) = +37,5 kN
   */
  it('triangle dissymetrique', () => {
    const { nodes, members } = triangle(1, 2);
    const r = solveTruss(nodes, members, C30, B500);
    expect(effort(r, 'AC')).toBeCloseTo(-83.852549, 5);
    expect(effort(r, 'BC')).toBeCloseTo(-45.069391, 5);
    expect(effort(r, 'AB')).toBeCloseTo(37.5, 5);
  });

  /**
   * Energie : 0,5 somme N^2 L / EA, en joules (kN.m x 1000).
   * EA bielle = 33e6 x 0,30 x 0,20 = 1,98e6 kN ; EA tirant = 200e6 x 0,0015 = 3e5 kN.
   * 0,5 (2 x 5000 x 2,8284 / 1,98e6 + 2500 x 4 / 3e5) x 1000 = 23,8091 J
   */
  it('energie de deformation', () => {
    const { nodes, members } = triangle();
    expect(solveTruss(nodes, members, C30, B500).totalStrainEnergy).toBeCloseTo(23.8091, 3);
  });

  it('les efforts d un treillis isostatique ne dependent pas de la rigidite', () => {
    const { nodes, members } = triangle();
    const tous = members.map((m) => ({ ...m, type: 'strut' as const }));
    const r = solveTruss(nodes, tous, C30, B500);
    expect(effort(r, 'AB')).toBeCloseTo(50, 5);
  });

  it('proportionnalite a la charge', () => {
    const { nodes, members } = triangle();
    const double = nodes.map((n) => (n.fy ? { ...n, fy: 2 * n.fy } : n));
    expect(effort(solveTruss(double, members, C30, B500), 'AB')).toBeCloseTo(100, 5);
  });
});

describe('solveTruss — 3D, tripode sur trois appuis', () => {
  /**
   * Appuis sur un cercle de rayon 1 a 120 degres, sommet a (0,0,1) charge de 300 kN.
   * Chaque bielle : composante verticale 100 kN, longueur racine(2) : N = -141,4214 kN.
   * Poussee radiale 100 kN reprise par les deux tirants a 30 degres : T = 100 / racine(3) = 57,735 kN.
   * Six blocages exactement : reactions horizontales nulles.
   */
  const s3 = Math.sqrt(3) / 2;
  const nodes: STMNode[] = [
    { id: 'S1', x: 1, y: 0, z: 0, isSupport: true },
    { id: 'S2', x: -0.5, y: s3, z: 0, isSupport: true },
    { id: 'S3', x: -0.5, y: -s3, z: 0, isSupport: true },
    { id: 'T', x: 0, y: 0, z: 1, fz: -300 },
  ];
  const members: STMMember[] = [
    { id: 'B1', fromNodeId: 'S1', toNodeId: 'T', type: 'strut' },
    { id: 'B2', fromNodeId: 'S2', toNodeId: 'T', type: 'strut' },
    { id: 'B3', fromNodeId: 'S3', toNodeId: 'T', type: 'strut' },
    { id: 'T12', fromNodeId: 'S1', toNodeId: 'S2', type: 'tie' },
    { id: 'T23', fromNodeId: 'S2', toNodeId: 'S3', type: 'tie' },
    { id: 'T31', fromNodeId: 'S3', toNodeId: 'S1', type: 'tie' },
  ];

  it('bielles et tirants', () => {
    const r = solveTruss(nodes, members, C30, B500, 0.3, '3D');
    expect(r.success).toBe(true);
    for (const id of ['B1', 'B2', 'B3']) expect(effort(r, id)).toBeCloseTo(-141.421356, 4);
    for (const id of ['T12', 'T23', 'T31']) expect(effort(r, id)).toBeCloseTo(57.735027, 4);
  });

  it('reactions verticales de 100 kN, horizontales nulles', () => {
    const r = solveTruss(nodes, members, C30, B500, 0.3, '3D');
    for (const id of ['S1', 'S2', 'S3']) {
      const n = r.nodeResults.get(id);
      expect(n?.rz).toBeCloseTo(100, 5);
      expect(Math.hypot(n?.rx ?? 0, n?.ry ?? 0)).toBeLessThan(1e-6);
    }
  });
});

describe('solveTruss — cas degeneres', () => {
  it('moins de deux noeuds ou aucune barre', () => {
    const r = solveTruss([{ id: 'A', x: 0, y: 0 }], [], C30, B500);
    expect(r.success).toBe(false);
    expect(r.message).toMatch(/au moins 2/);
  });

  it('appuis insuffisants : un seul appui fixe en 2D', () => {
    const { nodes, members } = triangle();
    const r = solveTruss(nodes.map((n) => (n.id === 'B' ? { ...n, isSupport: false } : n)), members, C30, B500);
    expect(r.success).toBe(false);
    expect(r.message).toMatch(/insuffisantes/);
  });

  it('noeud aligne charge transversalement : singularite detectee et localisee', () => {
    const nodes: STMNode[] = [
      { id: 'A', x: 0, y: 0, isSupport: true, supportType: 'pin' },
      { id: 'M', x: 1, y: 0, fy: -10 },
      { id: 'B', x: 2, y: 0, isSupport: true, supportType: 'pin' },
    ];
    const members: STMMember[] = [
      { id: 'AM', fromNodeId: 'A', toNodeId: 'M', type: 'tie' },
      { id: 'MB', fromNodeId: 'M', toNodeId: 'B', type: 'tie' },
    ];
    const r = solveTruss(nodes, members, C30, B500);
    expect(r.success).toBe(false);
    expect(r.unstableDetails?.cause).toBe('zero_dof_stiffness');
    expect(r.unstableDetails?.problematicNodeIds).toContain('M');
  });

  /**
   * Quadrilatere sans diagonale, cotes inclines : mecanisme (4 barres + 3 blocages
   * < 2 x 4). La matrice est singuliere en arithmetique exacte, mais les
   * arrondis y laissent des pivots non nuls : le solveur doit tout de meme le
   * detecter, et non rendre des efforts arbitraires.
   */
  it('mecanisme a cotes inclines : detecte malgre les arrondis', () => {
    const nodes: STMNode[] = [
      { id: 'A', x: 0, y: 0, isSupport: true, supportType: 'pin' },
      { id: 'B', x: 3, y: 0, isSupport: true, supportType: 'roller_x' },
      { id: 'C', x: 2.7, y: 1.3, fy: -100 },
      { id: 'D', x: 0.4, y: 1.1 },
    ];
    const members: STMMember[] = [
      { id: 'AB', fromNodeId: 'A', toNodeId: 'B', type: 'tie' },
      { id: 'BC', fromNodeId: 'B', toNodeId: 'C', type: 'strut' },
      { id: 'CD', fromNodeId: 'C', toNodeId: 'D', type: 'strut' },
      { id: 'DA', fromNodeId: 'D', toNodeId: 'A', type: 'strut' },
    ];
    const r = solveTruss(nodes, members, C30, B500);
    expect(r.success).toBe(false);
    expect(r.isStable).toBe(false);
  });

  it('rouleau dont toutes les barres sont verticales : X bloque automatiquement', () => {
    const nodes: STMNode[] = [
      { id: 'A', x: 0, y: 0, isSupport: true, supportType: 'pin' },
      { id: 'B', x: 2, y: 0, isSupport: true, supportType: 'roller_x' },
      { id: 'C', x: 0, y: 1, fy: -10 },
      { id: 'D', x: 2, y: 1, fy: -10 },
    ];
    const members: STMMember[] = [
      { id: 'AC', fromNodeId: 'A', toNodeId: 'C', type: 'strut' },
      { id: 'BD', fromNodeId: 'B', toNodeId: 'D', type: 'strut' },
      { id: 'CD', fromNodeId: 'C', toNodeId: 'D', type: 'strut' },
      { id: 'AD', fromNodeId: 'A', toNodeId: 'D', type: 'strut' },
    ];
    const r = solveTruss(nodes, members, C30, B500);
    expect(r.success).toBe(true);
    expect(effort(r, 'BD')).toBeCloseTo(-10, 5);
  });
});

describe('solveTruss — sous-structure tenue par deux barres', () => {
  /**
   * Un triangle rigide (L, T, R) relie au reste par deux barres seulement :
   * mecanisme de rotation. Avant correction, les arrondis laissaient passer
   * le pivot, et le solveur rendait des efforts de plusieurs fois la charge
   * annonces comme un succes.
   */
  it('est rejete, pas resolu faux', () => {
    const nodes: STMNode[] = [
      { id: 'L', x: 0.25, y: 0.65, fy: -350 },
      { id: 'T', x: 0.75, y: 0.65 },
      { id: 'R', x: 0.65, y: 0.25 },
      { id: 'H', x: 0.75, y: 1.08 },
      { id: 'A', x: 0.75, y: 0.16, isSupport: true, supportType: 'pin' },
      { id: 'B', x: 2.95, y: 0.16, isSupport: true, supportType: 'roller_x' },
    ];
    const members: STMMember[] = [
      { id: 'LT', fromNodeId: 'L', toNodeId: 'T', type: 'tie' },
      { id: 'LR', fromNodeId: 'L', toNodeId: 'R', type: 'strut' },
      { id: 'RT', fromNodeId: 'R', toNodeId: 'T', type: 'strut' },
      { id: 'RA', fromNodeId: 'R', toNodeId: 'A', type: 'strut' },
      { id: 'TH', fromNodeId: 'T', toNodeId: 'H', type: 'tie' },
      { id: 'AH', fromNodeId: 'A', toNodeId: 'H', type: 'tie' },
      { id: 'HB', fromNodeId: 'H', toNodeId: 'B', type: 'strut' },
      { id: 'AB', fromNodeId: 'A', toNodeId: 'B', type: 'tie' },
    ];
    const r = solveTruss(nodes, members, C30, B500);
    expect(r.success).toBe(false);
  });
});
