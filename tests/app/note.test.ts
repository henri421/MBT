/**
 * Tests d'acceptation de P7 : note de calcul commune (aedificium-ui) et
 * sorties (SVG autonome, CSV, nom de fichier). Les attendus sont tires du
 * resultat du moteur et des modules deja faits, jamais recopies.
 */

import { describe, expect, it } from 'vitest';
import { JETONS, noteDeCalculHtml, texteVisible, type ElementNote } from 'aedificium-ui';
import { PRESETS, solveTruss, type ModelPreset, type SolverResult } from '../../src/index';
import type { ModeleMbt } from '../../app/src/modele';
import { tableauBielles, tableauNoeuds, tableauReactions, tableauTirants } from '../../app/src/vue';
import { HYPOTHESES, noteDuCalcul } from '../../app/src/note';
import { STYLES_TRACE, nomDeFichier, resultatsCsv, svgDuDessin } from '../../app/src/export';

const modele = (p: ModelPreset): ModeleMbt => ({
  nom: p.title, dimension: p.dimension, beton: p.concrete, materiauBeton: p.concreteMat, acier: p.steelMat, noeuds: p.nodes, barres: p.members,
});
const resultat = (p: ModelPreset): SolverResult => solveTruss(p.nodes, p.members, p.concreteMat, p.steelMat, p.concrete.thickness, p.dimension);
const P = PRESETS[0];
const M = modele(P);
const R = resultat(P);
const DESSIN = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><line data-barre="B1" class="bielle"/></svg>';
const CARTOUCHE = { projet: 'Halle', element: 'Console C1', date: '2026-10-29' };
const note = noteDuCalcul(M, R, CARTOUCHE, DESSIN);
const html = noteDeCalculHtml(note, STYLES_TRACE);
const de = <T extends ElementNote['type']>(els: ElementNote[] | undefined, t: T) =>
  (els ?? []).filter((e): e is Extract<ElementNote, { type: T }> => e.type === t);
const symboles = (els: ElementNote[] | undefined) => de(els, 'bloc').flatMap((b) => b.bloc.lignes.map((l) => l.symbole));

describe('cartouche', () => {
  it('projet, element, date, norme, outil', () => {
    expect(note.cartouche).toEqual({ ...CARTOUCHE, norme: 'EN 1992-1-1:2004, §6.5', outil: 'bielles et tirants' });
  });

  it('element vide : le nom du modele', () => {
    expect(noteDuCalcul(M, R, { ...CARTOUCHE, element: ' ' }, DESSIN).cartouche.element).toBe(M.nom);
  });
});

describe('sections', () => {
  it('ordre fixe, sans combinaisons', () => {
    const titres = [...html.matchAll(/<h2>([^<]*)<\/h2>/g)].map((x) => x[1]);
    expect(titres).toEqual(['1. Géométrie', '2. Matériaux', '3. Hypothèses', '4. Cas de charges', '5. Calculs et vérifications', '6. Conclusions']);
  });

  it('geometrie : epaisseur, tableau des noeuds, puis le dessin de la page', () => {
    const g = note.sections.geometrie;
    expect(symboles(g)).toEqual(['b_w']);
    const t = de(g, 'tableau');
    expect(t).toHaveLength(1);
    expect(t[0].entetes).toEqual(['Nœud', 'x (m)', 'y (m)']);
    expect(t[0].lignes.map((l) => l[0])).toEqual(M.noeuds.map((n) => n.id));
    expect(de(g, 'figure').map((f) => f.svg)).toEqual([DESSIN]);
    const p3 = PRESETS.find((p) => p.dimension === '3D')!;
    const g3 = noteDuCalcul(modele(p3), resultat(p3), CARTOUCHE, DESSIN).sections.geometrie;
    expect(de(g3, 'tableau')[0].entetes).toEqual(['Nœud', 'x (m)', 'y (m)', 'z (m)']);
  });

  it('materiaux, hypotheses', () => {
    expect(symboles(note.sections.materiaux)).toEqual(['f_ck', 'γ_c', 'α_cc', 'f_yk', 'γ_s']);
    expect(de(note.sections.hypotheses, 'liste').map((l) => l.items)).toEqual([[...HYPOTHESES]]);
    expect(HYPOTHESES.length).toBeGreaterThanOrEqual(3);
  });

  it('cas de charges : forces aux noeuds charges, puis appuis', () => {
    const t = de(note.sections.charges, 'tableau');
    expect(t.map((x) => x.titre)).toEqual(['Forces appliquées', 'Appuis']);
    expect(t[0].entetes).toEqual(['Nœud', 'F_x (kN)', 'F_y (kN)']);
    const charges = M.noeuds.filter((n) => (n.fx ?? 0) !== 0 || (n.fy ?? 0) !== 0 || (n.fz ?? 0) !== 0);
    expect(t[0].lignes.map((l) => l[0])).toEqual(charges.map((n) => n.id));
    expect(t[1].lignes.map((l) => l[0])).toEqual(M.noeuds.filter((n) => n.isSupport).map((n) => n.id));
  });

  it('calculs : les tableaux des volets, titres avec leur clause', () => {
    const t = de(note.sections.calculs, 'tableau');
    const attendus = [tableauBielles(M, R), tableauTirants(M, R), tableauNoeuds(M, R), tableauReactions(M, R)].filter((x) => x.lignes.length > 0);
    expect(t.map((x) => x.titre)).toEqual(attendus.map((x) => (x.clause ? `${x.titre} (${x.clause})` : x.titre)));
    expect(t.map((x) => x.lignes)).toEqual(attendus.map((x) => x.lignes));
  });
});

describe('conclusions', () => {
  it('une ligne par barre, par noeud, puis l equilibre', () => {
    const v = note.verifications;
    const barres = M.barres.filter((b) => R.memberResults.has(b.id));
    const noeuds = M.noeuds.filter((n) => R.nodeResults.has(n.id));
    const nb = barres.length + noeuds.length + noeuds.filter((n) => R.nodeResults.get(n.id)!.localBearingUtilization !== undefined).length + 1;
    expect(v).toHaveLength(nb);
    for (const b of barres) {
      const r = R.memberResults.get(b.id)!;
      const nom = `${r.isCompression ? 'Bielle' : 'Tirant'} ${b.id}`;
      expect(v.find((x) => x.nom === nom), nom).toEqual({ nom, clause: r.isCompression ? '§6.5.2' : '§6.5.3', taux: r.utilizationRatio, ok: r.utilizationRatio <= 1 });
    }
    const n = noeuds[0];
    const rn = R.nodeResults.get(n.id)!;
    expect(v.find((x) => x.nom === `Nœud ${n.id}`)).toEqual({ nom: `Nœud ${n.id}`, clause: '§6.5.4', taux: rn.bearingUtilization, ok: rn.bearingUtilization <= 1 });
    expect(v.at(-1)).toMatchObject({ nom: 'Équilibre', taux: null });
  });

  it('pressions localisees : une ligne par noeud ou le moteur les calcule', () => {
    for (const p of PRESETS) {
      const r = resultat(p);
      if (!r.success || !r.isStable) continue;
      const avec = [...r.nodeResults.values()].filter((x) => x.localBearingUtilization !== undefined);
      const v = noteDuCalcul(modele(p), r, CARTOUCHE, DESSIN).verifications.filter((x) => x.clause === '§6.7');
      expect(v.map((x) => x.nom), p.id).toEqual(avec.map((x) => `Pression localisée ${x.nodeId}`));
    }
  });

  it('treillis instable : equilibre seul, non satisfait ; le message en avertissement et en calculs', () => {
    const r = { ...R, isStable: false, message: 'Mécanisme au nœud N3.' };
    const n = noteDuCalcul(M, r, CARTOUCHE, DESSIN);
    expect(n.verifications).toEqual([{ nom: 'Équilibre', taux: null, ok: false }]);
    expect(n.avertissements).toEqual(['Mécanisme au nœud N3.']);
    expect(de(n.sections.calculs, 'texte').map((t) => t.texte)).toEqual(['Mécanisme au nœud N3.']);
    expect(de(n.sections.calculs, 'tableau')).toEqual([]);
  });

  it('aucun verdict global', () => {
    const t = texteVisible(html);
    expect(t).toContain('Vérification déterminante');
    expect(t).not.toContain('Conforme');
  });
});

describe('sorties', () => {
  it('styles du trace : jetons et classes du dessin', () => {
    expect(STYLES_TRACE.startsWith(JETONS)).toBe(true);
    for (const c of ['.bielle', '.tirant', '.neutre', '.choisi', '.noeud', '.effort', '.appui', '.charge', '.cote', '.angle']) expect(STYLES_TRACE, c).toContain(c);
  });

  it('svgDuDessin : document autonome avec ses styles', () => {
    const s = svgDuDessin(DESSIN);
    expect(s.startsWith('<?xml')).toBe(true);
    expect(s).toContain('<style');
    expect(s).toContain('.bielle');
    expect(s).toContain('data-barre="B1"');
  });

  it('resultatsCsv : un bloc par tableau des calculs, separateur point-virgule', () => {
    const c = resultatsCsv(M, R);
    expect(c.charCodeAt(0)).toBe(0xfeff);
    const lignes = c.slice(1).split('\r\n');
    expect(lignes).toContain('Bielles (§6.5.2)');
    expect(lignes).toContain(tableauBielles(M, R).entetes.join(';'));
    expect(lignes).toContain(tableauTirants(M, R).lignes[0].join(';'));
  });

  it('nomDeFichier : sans accents ni espaces, en minuscules', () => {
    expect(nomDeFichier('Console Courte sur Poteau (Corbel EC2)')).toBe('console-courte-sur-poteau-corbel-ec2');
    expect(nomDeFichier('Semelle à 3 pieux — Blévot')).toBe('semelle-a-3-pieux-blevot');
    expect(nomDeFichier('  ')).toBe('bielles-tirants');
  });
});
