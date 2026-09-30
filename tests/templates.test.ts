import { describe, expect, it } from 'vitest';

import { PRESETS } from '../src/utils/templates';
import { solveTruss } from '../src/utils/matrixSolver';

describe('PRESETS — chaque modele fourni se resout et s equilibre', () => {
  it('au moins un modele, identifiants uniques', () => {
    expect(PRESETS.length).toBeGreaterThan(0);
    expect(new Set(PRESETS.map((p) => p.id)).size).toBe(PRESETS.length);
  });

  for (const p of PRESETS) {
    it(`${p.id} : resolu, equilibre nodal et global`, () => {
      const r = solveTruss(p.nodes, p.members, p.concreteMat, p.steelMat, p.concrete.thickness, p.dimension);
      expect(r.success, r.message).toBe(true);
      for (const n of r.nodeResults.values()) expect(n.equilibriumResidual, n.nodeId).toBeLessThan(1e-4);
      expect(Math.abs((r.totalRx ?? 0) + (r.totalFx ?? 0))).toBeLessThan(1e-4);
      expect(Math.abs((r.totalRy ?? 0) + (r.totalFy ?? 0))).toBeLessThan(1e-4);
      expect(Math.abs((r.totalRz ?? 0) + (r.totalFz ?? 0))).toBeLessThan(1e-4);
    });

    it(`${p.id} : barres referencant des noeuds existants`, () => {
      const ids = new Set(p.nodes.map((n) => n.id));
      for (const m of p.members) {
        expect(ids.has(m.fromNodeId), m.id).toBe(true);
        expect(ids.has(m.toNodeId), m.id).toBe(true);
      }
    });
  }
});
