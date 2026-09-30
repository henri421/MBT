import { describe, expect, it } from 'vitest';

import type { ConcreteOutline, STMMember, STMNode } from '../src/types/stm';
import { isPointInPolygon, optimizeSchlaichEnergy } from '../src/utils/schlaichOptimizer';
import { B500, C30, triangle } from './fixtures';

const CARRE: [number, number][] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];

describe('isPointInPolygon', () => {
  it('interieur, exterieur', () => {
    expect(isPointInPolygon([0.5, 0.5], CARRE)).toBe(true);
    expect(isPointInPolygon([1.5, 0.5], CARRE)).toBe(false);
    expect(isPointInPolygon([0.5, -0.01], CARRE)).toBe(false);
  });

  it('polygone concave', () => {
    const L: [number, number][] = [[0, 0], [2, 0], [2, 1], [1, 1], [1, 2], [0, 2]];
    expect(isPointInPolygon([1.5, 1.5], L)).toBe(false);
    expect(isPointInPolygon([0.5, 1.5], L)).toBe(true);
  });

  it('moins de trois sommets : aucun contour, tout point est admis', () => {
    expect(isPointInPolygon([10, 10], [[0, 0], [1, 1]])).toBe(true);
  });
});

/**
 * Triangle de reference (tirant AB, bielles AC et BC, 100 kN en C) auquel on
 * ajoute un noeud D sous la charge, relie a A, B et C : le treillis reste
 * isostatique. D n est pas charge, donc mobile.
 *
 * Geometrie optimale connue : descendre D allonge le bras de levier entre la
 * charge et le tirant, donc reduit tous les efforts. L optimum est D au plus
 * bas que permet l enrobage, 5 cm au-dessus du bord y = -0,30 : y = -0,25.
 * En passant par y = 0, on retrouve exactement le triangle seul (23,8091 J,
 * tests/matrixSolver.test.ts), puis l energie continue de baisser.
 */
function triangleANoeud(k = 1): { nodes: STMNode[]; members: STMMember[]; contour: ConcreteOutline } {
  const { nodes, members } = triangle();
  return {
    nodes: [...nodes.map((n) => (n.fy ? { ...n, fy: n.fy * k } : n)), { id: 'D', x: 2, y: 0.4 }],
    members: [
      ...members.filter((m) => m.id !== 'AB'),
      { id: 'AD', fromNodeId: 'A', toNodeId: 'D', type: 'tie' },
      { id: 'DB', fromNodeId: 'D', toNodeId: 'B', type: 'tie' },
      { id: 'DC', fromNodeId: 'D', toNodeId: 'C', type: 'auto' },
    ],
    contour: { points2D: [[-0.5, -0.3], [4.5, -0.3], [4.5, 2.5], [-0.5, 2.5]], thickness: 0.3 },
  };
}

/** Chaine A - D - B sans triangulation : mecanisme. */
function chaineInstable(): { nodes: STMNode[]; members: STMMember[]; contour: ConcreteOutline } {
  return {
    nodes: [
      { id: 'A', x: 0, y: 0, isSupport: true, supportType: 'pin' },
      { id: 'B', x: 2, y: 0, isSupport: true, supportType: 'roller_x', fx: 100 },
      { id: 'D', x: 1, y: 0.3 },
    ],
    members: [
      { id: 'AD', fromNodeId: 'A', toNodeId: 'D', type: 'tie' },
      { id: 'DB', fromNodeId: 'D', toNodeId: 'B', type: 'tie' },
    ],
    contour: { points2D: [[-0.5, -0.6], [2.5, -0.6], [2.5, 0.8], [-0.5, 0.8]], thickness: 0.3 },
  };
}

function position(r: ReturnType<typeof optimizeSchlaichEnergy>, id: string): STMNode {
  const n = r.optimizedNodes.find((x) => x.id === id);
  if (n === undefined) throw new Error(`noeud absent : ${id}`);
  return n;
}

describe('optimizeSchlaichEnergy — geometrie optimale connue', () => {
  const { nodes, members, contour } = triangleANoeud();
  const r = optimizeSchlaichEnergy(nodes, members, C30, B500, contour);

  it('D descend jusqu a l enrobage : le bras de levier est maximal', () => {
    expect(position(r, 'D').y).toBeLessThan(-0.2);
    expect(position(r, 'D').y).toBeGreaterThanOrEqual(-0.25);
    expect(r.optimizedEnergy).toBeLessThan(23.8091);
  });

  it('en y = 0, l energie est celle du triangle seul', () => {
    const passage = r.steps.find((s) => Math.abs(s.nodePositions.find((p) => p.id === 'D')!.y) < 1e-9);
    expect(passage?.totalEnergy).toBeCloseTo(23.8091, 3);
  });

  it('les appuis et les noeuds charges ne bougent pas', () => {
    expect(position(r, 'A')).toMatchObject({ x: 0, y: 0 });
    expect(position(r, 'B')).toMatchObject({ x: 4, y: 0 });
    expect(position(r, 'C')).toMatchObject({ x: 2, y: 2 });
  });

  it('l energie decroit a chaque iteration', () => {
    for (let i = 1; i < r.steps.length; i++) {
      expect(r.steps[i].totalEnergy).toBeLessThanOrEqual(r.steps[i - 1].totalEnergy);
    }
  });

  it('les noeuds restent a 5 cm au moins du contour', () => {
    for (const s of r.steps) for (const p of s.nodePositions) expect(isPointInPolygon([p.x, p.y], contour.points2D)).toBe(true);
  });
});

describe('optimizeSchlaichEnergy — invariance', () => {
  /**
   * Le modele est lineaire : multiplier les charges par k multiplie l energie
   * par k^2 sans rien changer a la geometrie optimale. k est une puissance de
   * deux, pour que la mise a l echelle soit exacte en virgule flottante et que
   * l optimiseur prenne exactement les memes decisions.
   */
  it('par changement d echelle des charges', () => {
    const a = triangleANoeud(1);
    const b = triangleANoeud(2 ** -10);
    const ra = optimizeSchlaichEnergy(a.nodes, a.members, C30, B500, a.contour);
    const rb = optimizeSchlaichEnergy(b.nodes, b.members, C30, B500, b.contour);
    expect(position(rb, 'D').x).toBeCloseTo(position(ra, 'D').x, 9);
    expect(position(rb, 'D').y).toBeCloseTo(position(ra, 'D').y, 9);
    expect(rb.optimizedEnergy / ra.optimizedEnergy).toBeCloseTo(2 ** -20, 15);
  });
});

describe('optimizeSchlaichEnergy — cas degeneres', () => {
  it('aucun noeud mobile : rien ne bouge', () => {
    const { nodes, members } = triangle();
    const contour: ConcreteOutline = { points2D: [[-1, -1], [5, -1], [5, 3], [-1, 3]], thickness: 0.3 };
    const r = optimizeSchlaichEnergy(
      nodes.map((n) => ({ ...n, isFixedInOpt: true })),
      members,
      C30,
      B500,
      contour,
    );
    expect(r.iterations).toBe(0);
    expect(r.reductionPercentage).toBe(0);
  });

  /**
   * Un modele initial instable n a pas d energie : l optimiseur ne doit pas en
   * inventer une, ni annoncer un gain par rapport a elle.
   */
  it('modele initial instable : aucune optimisation, aucun gain annonce', () => {
    const { nodes, members, contour } = chaineInstable();
    const r = optimizeSchlaichEnergy(nodes, members, C30, B500, contour);
    expect(r.iterations).toBe(0);
    expect(r.reductionPercentage).toBe(0);
    expect(r.initialEnergy).toBe(0);
  });

  it('3D : les bornes du volume sont respectees', () => {
    const s3 = Math.sqrt(3) / 2;
    const nodes: STMNode[] = [
      { id: 'S1', x: 1, y: 0, z: 0, isSupport: true },
      { id: 'S2', x: -0.5, y: s3, z: 0, isSupport: true },
      { id: 'S3', x: -0.5, y: -s3, z: 0, isSupport: true },
      { id: 'T', x: 0, y: 0, z: 1, fz: -300 },
      { id: 'M', x: 0.3, y: 0, z: 0.5 },
    ];
    const members: STMMember[] = [
      { id: 'B1', fromNodeId: 'S1', toNodeId: 'M', type: 'strut' },
      { id: 'B1b', fromNodeId: 'M', toNodeId: 'T', type: 'strut' },
      { id: 'B1c', fromNodeId: 'M', toNodeId: 'S2', type: 'strut' },
      { id: 'B1d', fromNodeId: 'M', toNodeId: 'S3', type: 'strut' },
      { id: 'B2', fromNodeId: 'S2', toNodeId: 'T', type: 'strut' },
      { id: 'B3', fromNodeId: 'S3', toNodeId: 'T', type: 'strut' },
      { id: 'T12', fromNodeId: 'S1', toNodeId: 'S2', type: 'tie' },
      { id: 'T23', fromNodeId: 'S2', toNodeId: 'S3', type: 'tie' },
      { id: 'T31', fromNodeId: 'S3', toNodeId: 'S1', type: 'tie' },
    ];
    const bounds3D = { minX: -1, maxX: 1.2, minY: -1, maxY: 1, minZ: 0, maxZ: 1 };
    const contour: ConcreteOutline = { points2D: [], bounds3D, thickness: 0.3 };
    const r = optimizeSchlaichEnergy(nodes, members, C30, B500, contour, '3D', 10);
    for (const s of r.steps) {
      for (const p of s.nodePositions) {
        expect(p.x).toBeGreaterThanOrEqual(bounds3D.minX);
        expect(p.x).toBeLessThanOrEqual(bounds3D.maxX);
        expect(p.z ?? 0).toBeGreaterThanOrEqual(bounds3D.minZ);
        expect(p.z ?? 0).toBeLessThanOrEqual(bounds3D.maxZ);
      }
    }
  });
});

describe('optimizeSchlaichEnergy — noeuds charges', () => {
  it('une charge faible fixe aussi son noeud', () => {
    const { nodes, members, contour } = triangleANoeud(2 ** -10);
    const r = optimizeSchlaichEnergy(nodes, members, C30, B500, contour);
    expect(position(r, 'C')).toMatchObject({ x: 2, y: 2 });
  });
});

describe('optimizeSchlaichEnergy — aucun noeud libre non charge', () => {
  it('ne deplace jamais un noeud charge, meme faute d autre candidat', () => {
    const { nodes, members } = triangle();
    const contour: ConcreteOutline = { points2D: [[-1, -1], [5, -1], [5, 3], [-1, 3]], thickness: 0.3 };
    const r = optimizeSchlaichEnergy(nodes, members, C30, B500, contour);
    expect(r.iterations).toBe(0);
    expect(r.optimizedNodes.find((n) => n.id === 'C')).toMatchObject({ x: 2, y: 2 });
  });
});

describe('optimizeSchlaichEnergy — motif quand rien n est optimise', () => {
  it('modele instable, ou aucun noeud libre : le motif est donne', () => {
    const { nodes, members, contour } = chaineInstable();
    expect(optimizeSchlaichEnergy(nodes, members, C30, B500, contour).message).toMatch(/instable/);
    const t = triangle();
    const c: ConcreteOutline = { points2D: [[-1, -1], [5, -1], [5, 3], [-1, 3]], thickness: 0.3 };
    expect(optimizeSchlaichEnergy(t.nodes, t.members, C30, B500, c).message).toMatch(/Aucun nœud libre/);
  });
});
