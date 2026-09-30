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

describe('PRESETS — chaque barre travaille dans le role declare', () => {
  for (const p of PRESETS) {
    it(`${p.id} : bielles comprimees, tirants tendus`, () => {
      const r = solveTruss(p.nodes, p.members, p.concreteMat, p.steelMat, p.concrete.thickness, p.dimension);
      for (const m of p.members) {
        const f = r.memberResults.get(m.id)?.force ?? 0;
        if (m.type === 'strut') expect(f, m.id).toBeLessThan(0.5);
        if (m.type === 'tie') expect(f, m.id).toBeGreaterThan(-0.5);
      }
    });
  }
});

describe('PRESETS — about entaille et poutre-cloison a tremie, valeurs de reference', () => {
  function efforts(id: string) {
    const p = PRESETS.find((x) => x.id === id)!;
    return solveTruss(p.nodes, p.members, p.concreteMat, p.steelMat, p.concrete.thickness, p.dimension);
  }
  it('about entaille : la suspente reprend la reaction du nez', () => {
    const r = efforts('dapped_end');
    const nez = r.nodeResults.get('N_Nez')!.ry;
    // Reaction du nez 107,1 kN (bras de levier 1,30 - 0,62 et 1,95 - 1,30 : resultat du solveur)
    expect(r.memberResults.get('M_SuspenteHaut')!.force).toBeCloseTo(nez, 6);
    expect(r.nodeResults.get('N_Nez')!.ry + r.nodeResults.get('N_AppuiDroit')!.ry).toBeCloseTo(280, 6);
  });
  it('tremie : symetrie, bielles de linteau a 45 degres = 250 racine(2) kN', () => {
    const r = efforts('deep_beam_opening');
    expect(r.memberResults.get('M_BielleLinteauG')!.force).toBeCloseTo(-353.553, 2);
    expect(r.memberResults.get('M_BielleLinteauD')!.force).toBeCloseTo(-353.553, 2);
    expect(r.nodeResults.get('N_AppuiG')!.ry).toBeCloseTo(250, 6);
    expect(r.nodeResults.get('N_AppuiD')!.ry).toBeCloseTo(250, 6);
  });
});
