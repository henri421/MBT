/**
 * Tests d'acceptation de P3 : dessin SVG 2D du modele (module pur, chaine).
 * Le SVG est lu par ses attributs data-* ; les positions sont comparees a
 * 0,1 px pres, jamais la mise en forme exacte.
 */

import { describe, expect, it } from 'vitest';
import { nombreAffiche, versEcran, vueAjustee, type Vue } from 'aedificium-ui';
import { PRESETS, calculateStmDimensions, solveTruss, type ModelPreset, type SolverResult } from '../../src/index';
import type { ModeleMbt } from '../../app/src/modele';
import { MARGE_DESSIN, OPTIONS_DESSIN, dessinModele, vueDuModele, type OptionsDessin } from '../../app/src/dessin';

const modele = (p: ModelPreset): ModeleMbt => ({
  nom: p.title, dimension: p.dimension, beton: p.concrete, materiauBeton: p.concreteMat, acier: p.steelMat, noeuds: p.nodes, barres: p.members,
});
const P = PRESETS[0];
const M = modele(P);
const R: SolverResult = solveTruss(P.nodes, P.members, P.concreteMat, P.steelMat, P.concrete.thickness, P.dimension);
const L = 640;
const H = 520;
const V: Vue = vueDuModele(M, L, H);
const o = (x: Partial<OptionsDessin> = {}): OptionsDessin => ({ ...OPTIONS_DESSIN, ...x });

/** Premiere balise ouvrante qui porte l'attribut donne. */
const balise = (svg: string, attribut: string): string | undefined => svg.match(new RegExp(`<[a-z]+[^>]*\\s${attribut}[^>]*>`))?.[0];
const attr = (b: string | undefined, nom: string): string | undefined => b?.match(new RegExp(`\\s${nom}="([^"]*)"`))?.[1];
const num = (b: string | undefined, nom: string): number => Number(attr(b, nom));
const toutes = (svg: string, attribut: string): string[] => [...svg.matchAll(new RegExp(`<[a-z]+[^>]*\\s${attribut}="[^"]*"[^>]*>`, 'g'))].map((x) => x[0]);
const pres = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(0.1);

describe('vue et cadre', () => {
  it('vueDuModele : contour et noeuds ajustes dans la marge', () => {
    const pts = [...M.beton.points2D.map(([x, y]) => ({ x, y })), ...M.noeuds.map((n) => ({ x: n.x, y: n.y }))];
    expect(V).toEqual(vueAjustee(pts, L, H, MARGE_DESSIN));
    expect(MARGE_DESSIN).toBe(40);
  });

  it('racine svg : xmlns, viewBox et role', () => {
    const svg = dessinModele(M, R, V, o({ largeur: L, hauteur: H }));
    const racine = svg.match(/^<svg[^>]*>/)?.[0];
    expect(attr(racine, 'xmlns')).toBe('http://www.w3.org/2000/svg');
    expect(attr(racine, 'viewBox')).toBe(`0 0 ${L} ${H}`);
    expect(attr(racine, 'role')).toBe('img');
    expect(svg.trim().endsWith('</svg>')).toBe(true);
  });

  it('options par defaut', () => {
    expect(OPTIONS_DESSIN).toEqual({ largeur: 640, hauteur: 520, selection: null, grille: null, angles: true, cotes: false, largeurs: false });
  });
});

describe('contour, barres, noeuds', () => {
  const svg = dessinModele(M, R, V, o());

  it('contour : un polygone aux sommets du beton', () => {
    const b = balise(svg, 'data-role="contour"');
    expect(b?.startsWith('<polygon')).toBe(true);
    const pts = (attr(b, 'points') ?? '').trim().split(/\s+/).map((c) => c.split(',').map(Number));
    expect(pts).toHaveLength(M.beton.points2D.length);
    M.beton.points2D.forEach(([x, y], i) => {
      const e = versEcran({ x, y }, V);
      pres(pts[i][0], e.x);
      pres(pts[i][1], e.y);
    });
  });

  it('une ligne par barre, entre ses noeuds', () => {
    const lignes = toutes(svg, 'data-barre');
    expect(lignes.map((l) => attr(l, 'data-barre'))).toEqual(M.barres.map((b) => b.id));
    for (const b of M.barres) {
      const l = balise(svg, `data-barre="${b.id}"`);
      expect(l?.startsWith('<line')).toBe(true);
      const de = M.noeuds.find((n) => n.id === b.fromNodeId)!;
      const a = M.noeuds.find((n) => n.id === b.toNodeId)!;
      pres(num(l, 'x1'), versEcran(de, V).x);
      pres(num(l, 'y1'), versEcran(de, V).y);
      pres(num(l, 'x2'), versEcran(a, V).x);
      pres(num(l, 'y2'), versEcran(a, V).y);
    }
  });

  it('classe : bielle si comprimee, tirant si tendue ; sans calcul, le type declare', () => {
    for (const b of M.barres) {
      const r = R.memberResults.get(b.id)!;
      const classe = attr(balise(svg, `data-barre="${b.id}"`), 'class') ?? '';
      expect(classe.split(' ')[0], b.id).toBe(r.isCompression ? 'bielle' : 'tirant');
    }
    const sans = dessinModele(M, null, V, o());
    for (const b of M.barres) {
      const attendu = b.type === 'strut' ? 'bielle' : b.type === 'tie' ? 'tirant' : 'neutre';
      expect((attr(balise(sans, `data-barre="${b.id}"`), 'class') ?? '').split(' ')[0], b.id).toBe(attendu);
    }
  });

  it('un cercle par noeud, au bon endroit', () => {
    expect(toutes(svg, 'data-noeud').map((c) => attr(c, 'data-noeud'))).toEqual(M.noeuds.map((n) => n.id));
    const n = M.noeuds[0];
    const c = balise(svg, `data-noeud="${n.id}"`);
    expect(c?.startsWith('<circle')).toBe(true);
    pres(num(c, 'cx'), versEcran(n, V).x);
    pres(num(c, 'cy'), versEcran(n, V).y);
  });

  it('element choisi : classe choisi, et lui seul', () => {
    const b = M.barres[1].id;
    const s = dessinModele(M, R, V, o({ selection: { type: 'barre', id: b } }));
    expect(attr(balise(s, `data-barre="${b}"`), 'class')).toMatch(/\bchoisi\b/);
    expect(s.match(/\bchoisi\b/g)).toHaveLength(1);
    const n = dessinModele(M, R, V, o({ selection: { type: 'noeud', id: 'N3' } }));
    expect(attr(balise(n, 'data-noeud="N3"'), 'class')).toMatch(/\bchoisi\b/);
    expect(n.match(/\bchoisi\b/g)).toHaveLength(1);
  });
});

describe('efforts, appuis, charges', () => {
  const svg = dessinModele(M, R, V, o());

  it('effort de chaque barre : signe + en traction, − (U+2212) en compression', () => {
    for (const b of M.barres) {
      const f = R.memberResults.get(b.id)!.force;
      const t = svg.match(new RegExp(`<text[^>]*data-effort="${b.id}"[^>]*>([^<]*)</text>`))?.[1];
      const attendu = Math.abs(f) < 1e-9 ? '0' : `${f > 0 ? '+' : '−'}${nombreAffiche(Math.abs(f), 1)}`;
      expect(t, b.id).toBe(attendu);
    }
    expect(dessinModele(M, null, V, o())).not.toContain('data-effort');
  });

  it('un symbole par appui, une fleche par noeud charge avec sa valeur en kN', () => {
    const appuis = M.noeuds.filter((n) => n.isSupport).map((n) => n.id);
    expect(toutes(svg, 'data-appui').map((g) => attr(g, 'data-appui'))).toEqual(appuis);
    const charges = M.noeuds.filter((n) => Math.hypot(n.fx ?? 0, n.fy ?? 0) > 0);
    expect(toutes(svg, 'data-charge').map((g) => attr(g, 'data-charge'))).toEqual(charges.map((n) => n.id));
    const n = charges[0];
    expect(svg).toContain(`${nombreAffiche(Math.hypot(n.fx ?? 0, n.fy ?? 0), 1)} kN`);
  });
});

describe('options d affichage', () => {
  it('grille : motif au pas demande, absent sinon', () => {
    const avec = dessinModele(M, R, V, o({ grille: 0.05 }));
    const motif = balise(avec, 'id="grille"');
    expect(motif?.startsWith('<pattern')).toBe(true);
    pres(num(motif, 'width'), 0.05 * V.echelle);
    expect(dessinModele(M, R, V, o())).not.toContain('id="grille"');
  });

  it('angles : un repere par paire bielle-tirant concourante, angle aigu en degres', () => {
    const svg = dessinModele(M, R, V, o({ angles: true }));
    const angles = toutes(svg, 'data-angle');
    expect(angles.length).toBeGreaterThan(0);
    const nom = (attr(angles[0], 'data-angle') ?? '').split('|');
    expect(nom).toHaveLength(3);
    const [noeud, b1, b2] = nom;
    const autre = (id: string) => {
      const b = M.barres.find((x) => x.id === id)!;
      const k = b.fromNodeId === noeud ? b.toNodeId : b.fromNodeId;
      return M.noeuds.find((n) => n.id === k)!;
    };
    const c = M.noeuds.find((n) => n.id === noeud)!;
    const u = autre(b1);
    const v = autre(b2);
    const cos = ((u.x - c.x) * (v.x - c.x) + (u.y - c.y) * (v.y - c.y)) / (Math.hypot(u.x - c.x, u.y - c.y) * Math.hypot(v.x - c.x, v.y - c.y));
    let deg = (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
    if (deg > 90) deg = 180 - deg;
    const texte = svg.match(new RegExp(`<text[^>]*data-angle="${noeud}\\|${b1}\\|${b2}"[^>]*>([^<]*)</text>`))?.[1];
    expect(texte).toBe(`θ = ${nombreAffiche(deg, 1)}°`);
    const types = [b1, b2].map((id) => R.memberResults.get(id)!.isCompression);
    expect(types.sort()).toEqual([false, true]);
    expect(dessinModele(M, R, V, o({ angles: false }))).not.toContain('data-angle');
  });

  it('largeurs : une bande par bielle, seulement si demande et calcule', () => {
    const svg = dessinModele(M, R, V, o({ largeurs: true }));
    const bielles = M.barres.filter((b) => R.memberResults.get(b.id)!.isCompression).map((b) => b.id);
    expect(toutes(svg, 'data-largeur').map((g) => attr(g, 'data-largeur'))).toEqual(bielles);
    expect(dessinModele(M, R, V, o())).not.toContain('data-largeur');
    expect(dessinModele(M, null, V, o({ largeurs: true }))).not.toContain('data-largeur');
  });

  it('cotes : les lignes de cote du moteur, seulement si demande', () => {
    const svg = dessinModele(M, R, V, o({ cotes: true }));
    const dims = calculateStmDimensions(M.beton, M.noeuds);
    expect(toutes(svg, 'data-cote').map((g) => attr(g, 'data-cote'))).toEqual(dims.map((d) => d.id));
    expect(dessinModele(M, R, V, o())).not.toContain('data-cote');
  });

  it('identifiants echappes', () => {
    const m: ModeleMbt = { ...M, noeuds: M.noeuds.map((n, i) => (i === 0 ? { ...n, id: 'N"<1' } : n)), barres: [] };
    const svg = dessinModele(m, null, V, o());
    expect(svg).toContain('data-noeud="N&quot;&lt;1"');
    expect(svg).not.toContain('N"<1');
  });
});
