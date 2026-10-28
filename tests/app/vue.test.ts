/**
 * Tests d'acceptation de P4 : verdicts par famille (colonne de droite) et
 * tableaux des volets sous le dessin. Les valeurs attendues sont tirees du
 * resultat du moteur lui-meme, jamais recopiees a la main.
 */

import { describe, expect, it } from 'vitest';
import { nombreAffiche, tauxAffiche, texteVisible } from 'aedificium-ui';
import { PRESETS, solveTruss, type ModelPreset, type SolverResult } from '../../src/index';
import type { ModeleMbt } from '../../app/src/modele';
import {
  tableauBielles,
  tableauNoeuds,
  tableauReactions,
  tableauTirants,
  tableauHtml,
  verdictsDuCalcul,
  verdictsHtml,
} from '../../app/src/vue';

/** ModeleMbt construit a la main : ces tests ne dependent pas de P1. */
const modele = (p: ModelPreset): ModeleMbt => ({
  nom: p.title,
  dimension: p.dimension,
  beton: p.concrete,
  materiauBeton: p.concreteMat,
  acier: p.steelMat,
  noeuds: p.nodes,
  barres: p.members,
});
const resultat = (p: ModelPreset): SolverResult => solveTruss(p.nodes, p.members, p.concreteMat, p.steelMat, p.concrete.thickness, p.dimension);

const P = PRESETS[0];
const M = modele(P);
const R = resultat(P);
const membres = [...R.memberResults.values()];
const maxPar = <T>(xs: T[], f: (x: T) => number) => xs.reduce((a, b) => (f(b) > f(a) ? b : a));

describe('verdicts par famille', () => {
  it('ordre : bielles, tirants, noeuds, (pressions localisees), equilibre', () => {
    for (const p of PRESETS) {
      const r = resultat(p);
      if (!r.success || !r.isStable) continue;
      const familles = verdictsDuCalcul(r).map((v) => v.famille);
      const attendu = ['bielles', 'tirants', 'noeuds', 'pressions', 'equilibre'].filter((f) => familles.includes(f as never));
      expect(familles, p.id).toEqual(attendu);
      expect(familles.at(-1), p.id).toBe('equilibre');
    }
  });

  it('bielles et tirants : taux maximal et barre qui le donne', () => {
    const v = verdictsDuCalcul(R);
    const bielles = v.find((x) => x.famille === 'bielles');
    const tirants = v.find((x) => x.famille === 'tirants');
    const b = maxPar(membres.filter((m) => m.isCompression), (m) => m.utilizationRatio);
    const t = maxPar(membres.filter((m) => !m.isCompression), (m) => m.utilizationRatio);
    expect(bielles).toMatchObject({ titre: 'Bielles', clause: '§6.5.2', taux: b.utilizationRatio, element: b.memberId });
    expect(tirants).toMatchObject({ titre: 'Tirants', clause: '§6.5.3', taux: t.utilizationRatio, element: t.memberId });
    expect(bielles?.motif).not.toBe('');
  });

  it('noeuds : taux d appui maximal', () => {
    const n = maxPar([...R.nodeResults.values()], (x) => x.bearingUtilization);
    expect(verdictsDuCalcul(R).find((x) => x.famille === 'noeuds')).toMatchObject({ titre: 'Nœuds', clause: '§6.5.4', taux: n.bearingUtilization, element: n.nodeId });
  });

  it('pressions localisees : seulement si le moteur les calcule', () => {
    for (const p of PRESETS) {
      const r = resultat(p);
      if (!r.success || !r.isStable) continue;
      const avec = [...r.nodeResults.values()].filter((n) => n.localBearingUtilization !== undefined);
      const v = verdictsDuCalcul(r).find((x) => x.famille === 'pressions');
      if (avec.length === 0) {
        expect(v, p.id).toBeUndefined();
      } else {
        const n = maxPar(avec, (x) => x.localBearingUtilization as number);
        expect(v, p.id).toMatchObject({ titre: 'Pressions localisées', clause: '§6.7', taux: n.localBearingUtilization, element: n.nodeId });
      }
    }
  });

  it('etat : ok jusqu a 1, refus au-dela', () => {
    for (const p of PRESETS) {
      const r = resultat(p);
      for (const v of verdictsDuCalcul(r)) {
        if (v.taux === null) continue;
        expect(v.etat, `${p.id} ${v.famille}`).toBe(v.taux <= 1 ? 'ok' : 'refus');
      }
    }
  });

  it('equilibre : sans taux ; residu au plus 0,01 kN -> ok, sinon alerte', () => {
    const e = verdictsDuCalcul(R).find((x) => x.famille === 'equilibre');
    expect(e).toMatchObject({ titre: 'Équilibre', taux: null, element: null });
    const residu = Math.max(...[...R.nodeResults.values()].map((n) => Math.abs(n.equilibriumResidual)));
    expect(e?.etat).toBe(residu <= 0.01 ? 'ok' : 'alerte');
    const fausse = new Map([...R.nodeResults].map(([k, n]) => [k, { ...n, equilibriumResidual: 0.5 }]));
    expect(verdictsDuCalcul({ ...R, nodeResults: fausse }).find((x) => x.famille === 'equilibre')?.etat).toBe('alerte');
  });

  it('treillis instable ou calcul en echec : un seul verdict, equilibre en refus, avec le message', () => {
    const instable = verdictsDuCalcul({ ...R, isStable: false, message: 'Mécanisme au nœud N3.' });
    expect(instable).toEqual([{ famille: 'equilibre', titre: 'Équilibre', clause: '', taux: null, element: null, etat: 'refus', motif: 'Mécanisme au nœud N3.' }]);
    const echec = verdictsDuCalcul({ ...R, success: false, message: undefined });
    expect(echec).toHaveLength(1);
    expect(echec[0]).toMatchObject({ famille: 'equilibre', etat: 'refus' });
    expect(echec[0].motif).not.toBe('');
  });
});

describe('verdictsHtml', () => {
  it('un cadre par famille, avec etat, element cliquable et jauge bornee a 100 %', () => {
    const v = verdictsDuCalcul(R);
    const h = verdictsHtml(v);
    expect(h.match(/class="verdict /g)).toHaveLength(v.length);
    const b = v.find((x) => x.famille === 'bielles');
    expect(h).toContain(`class="verdict ${b?.etat}"`);
    expect(h).toContain(`data-element="${b?.element}"`);
    expect(h).toContain(tauxAffiche(b?.taux as number));
    const trop = verdictsHtml([{ famille: 'tirants', titre: 'Tirants', clause: '§6.5.3', taux: 2.5, element: 'B1', etat: 'refus', motif: 'x' }]);
    expect(trop).toContain('width:100%');
  });

  it('textes echappes', () => {
    const h = verdictsHtml([{ famille: 'equilibre', titre: 'Équilibre', clause: '', taux: null, element: null, etat: 'refus', motif: 'a <b> c' }]);
    expect(h).toContain('a &lt;b&gt; c');
    expect(h).not.toContain('data-element');
  });
});

describe('tableaux des volets', () => {
  it('bielles : une ligne par barre comprimee, dans l ordre du modele', () => {
    const t = tableauBielles(M, R);
    expect(t).toMatchObject({ titre: 'Bielles', clause: '§6.5.2' });
    expect(t.entetes).toEqual(['Barre', 'Nœuds', 'F_Ed (kN)', 'σ_Rd,max (MPa)', 'w requise (mm)', 'w (mm)', 'Taux']);
    const attendues = M.barres.filter((b) => R.memberResults.get(b.id)?.isCompression);
    expect(t.lignes.map((l) => l[0])).toEqual(attendues.map((b) => b.id));
    const b = attendues[0];
    const r = R.memberResults.get(b.id)!;
    expect(t.lignes[0]).toEqual([
      b.id,
      `${b.fromNodeId} → ${b.toNodeId}`,
      nombreAffiche(Math.abs(r.force)),
      nombreAffiche(r.designStressLimit),
      nombreAffiche(r.effectiveWidthRequired),
      r.effectiveWidthActual === undefined ? '—' : nombreAffiche(r.effectiveWidthActual),
      tauxAffiche(r.utilizationRatio),
    ]);
  });

  it('tirants : section requise, section mise en place, armatures, ancrage', () => {
    const t = tableauTirants(M, R);
    expect(t).toMatchObject({ titre: 'Tirants', clause: '§6.5.3' });
    expect(t.entetes).toEqual(['Barre', 'Nœuds', 'F_Ed (kN)', 'A_s,req (cm²)', 'A_s (cm²)', 'Armatures', 'l_bd (mm)', 'Taux']);
    const attendues = M.barres.filter((b) => R.memberResults.has(b.id) && !R.memberResults.get(b.id)!.isCompression);
    expect(t.lignes.map((l) => l[0])).toEqual(attendues.map((b) => b.id));
    const b = attendues[0];
    const r = R.memberResults.get(b.id)!;
    const ou = (x: number | undefined) => (x === undefined ? '—' : nombreAffiche(x));
    expect(t.lignes[0]).toEqual([
      b.id,
      `${b.fromNodeId} → ${b.toNodeId}`,
      nombreAffiche(Math.abs(r.force)),
      ou(r.requiredAs),
      ou(r.providedAs),
      r.suggestedRebar ?? '—',
      ou(r.anchorageLengthMm),
      tauxAffiche(r.utilizationRatio),
    ]);
  });

  it('noeuds : type, contrainte d appui, limite, taux', () => {
    const t = tableauNoeuds(M, R);
    expect(t).toMatchObject({ titre: 'Nœuds', clause: '§6.5.4' });
    expect(t.entetes).toEqual(['Nœud', 'Type', 'σ (MPa)', 'σ_Rd,max (MPa)', 'Taux']);
    expect(t.lignes.map((l) => l[0])).toEqual(M.noeuds.filter((n) => R.nodeResults.has(n.id)).map((n) => n.id));
    const r = R.nodeResults.get(t.lignes[0][0])!;
    expect(t.lignes[0]).toEqual([r.nodeId, r.nodeType, nombreAffiche(r.bearingStress), nombreAffiche(r.designStressLimit), tauxAffiche(r.bearingUtilization)]);
  });

  it('reactions : appuis seulement ; R_z en 3D seulement', () => {
    const t = tableauReactions(M, R);
    expect(t).toMatchObject({ titre: "Réactions d'appui", clause: '' });
    expect(t.entetes).toEqual(['Nœud', 'R_x (kN)', 'R_y (kN)']);
    const appuis = M.noeuds.filter((n) => n.isSupport);
    expect(t.lignes.map((l) => l[0])).toEqual(appuis.map((n) => n.id));
    const r = R.nodeResults.get(appuis[0].id)!;
    expect(t.lignes[0]).toEqual([appuis[0].id, nombreAffiche(r.rx), nombreAffiche(r.ry)]);
    const p3 = PRESETS.find((p) => p.dimension === '3D');
    if (p3) expect(tableauReactions(modele(p3), resultat(p3)).entetes).toEqual(['Nœud', 'R_x (kN)', 'R_y (kN)', 'R_z (kN)']);
  });

  it('tableauHtml : en-tetes, cellules echappees, sans accent manquant', () => {
    const h = tableauHtml({ titre: 'Bielles', clause: '§6.5.2', entetes: ['A', 'B'], lignes: [['1', 'x < y']] });
    expect(h).toContain('<table');
    expect(h).toContain('<th>A</th>');
    expect(h).toContain('x &lt; y');
    expect(texteVisible(tableauHtml(tableauBielles(M, R)))).toContain('σ');
  });
});
