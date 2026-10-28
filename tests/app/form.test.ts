/**
 * Tests d'acceptation de P2 : saisie par tableaux (noeuds, barres), cadre
 * « Element choisi », champs du modele. Rendu HTML pur et lecture d'un champ
 * par modifierChamp, sans DOM.
 */

import { describe, expect, it } from 'vitest';
import { nombreAffiche, texteVisible } from 'aedificium-ui';
import { PRESETS, type ModelPreset } from '../../src/index';
import type { ModeleMbt } from '../../app/src/modele';
import { champsModeleHtml, elementChoisiHtml, modifierChamp, tableBarresHtml, tableNoeudsHtml } from '../../app/src/form';

const modele = (p: ModelPreset): ModeleMbt => ({
  nom: p.title, dimension: p.dimension, beton: p.concrete, materiauBeton: p.concreteMat, acier: p.steelMat, noeuds: p.nodes, barres: p.members,
});
const M = modele(PRESETS[0]);
const M3 = modele(PRESETS.find((p) => p.dimension === '3D')!);
const N = { type: 'noeud', id: 'N3' } as const;
const B = { type: 'barre', id: M.barres[1].id } as const;

const ok = (r: ReturnType<typeof modifierChamp>): ModeleMbt => {
  if (!('modele' in r)) throw new Error(`modele attendu, recu ${r.erreur}`);
  return r.modele;
};
const noeud = (m: ModeleMbt, id: string) => m.noeuds.find((n) => n.id === id)!;
const barre = (m: ModeleMbt, id: string) => m.barres.find((b) => b.id === id)!;
/** Champ de saisie (input ou select) d'une cible et d'un nom donnes. */
const champ = (h: string, cible: string, nom: string) =>
  h.match(new RegExp(`<(input|select)[^>]*data-cible="${cible}"[^>]*data-champ="${nom}"[^>]*>|<(input|select)[^>]*data-champ="${nom}"[^>]*data-cible="${cible}"[^>]*>`))?.[0];
const valeur = (b: string | undefined) => b?.match(/\svalue="([^"]*)"/)?.[1];

describe('modifierChamp : noeuds', () => {
  it('coordonnees et forces, virgule decimale acceptee ; le modele recu reste intact', () => {
    const m = ok(modifierChamp(M, N, 'x', '0,42'));
    expect(noeud(m, 'N3').x).toBeCloseTo(0.42, 12);
    expect(noeud(M, 'N3').x).toBe(0.35);
    expect(noeud(ok(modifierChamp(M, N, 'y', '-0.1')), 'N3').y).toBeCloseTo(-0.1, 12);
    expect(noeud(ok(modifierChamp(M, N, 'fy', '-250')), 'N3').fy).toBe(-250);
    expect(noeud(ok(modifierChamp(M3, { type: 'noeud', id: M3.noeuds[0].id }, 'z', '1,5')), M3.noeuds[0].id).z).toBe(1.5);
  });

  it('force videe : champ retire ; coordonnee videe ou illisible : erreur', () => {
    const m = ok(modifierChamp(M, { type: 'noeud', id: 'N1' }, 'fy', ''));
    expect(noeud(m, 'N1')).not.toHaveProperty('fy');
    expect(modifierChamp(M, N, 'x', '')).toEqual({ erreur: 'Valeur numérique attendue.' });
    expect(modifierChamp(M, N, 'fx', 'abc')).toEqual({ erreur: 'Valeur numérique attendue.' });
  });

  it('appui : choix de la liste ; vide le retire ; autre valeur refusee', () => {
    const m = ok(modifierChamp(M, N, 'appui', 'roller_y'));
    expect(noeud(m, 'N3')).toMatchObject({ isSupport: true, supportType: 'roller_y' });
    const sans = ok(modifierChamp(M, { type: 'noeud', id: 'N4' }, 'appui', ''));
    expect(noeud(sans, 'N4')).not.toHaveProperty('isSupport');
    expect(noeud(sans, 'N4')).not.toHaveProperty('supportType');
    expect(modifierChamp(M, N, 'appui', 'encastrement')).toEqual({ erreur: 'Choix inconnu.' });
  });

  it('plaque d appui, type de noeud, fixe pour l optimiseur', () => {
    expect(noeud(ok(modifierChamp(M, N, 'plaque', '0,25')), 'N3').bearingWidth).toBe(0.25);
    expect(noeud(ok(modifierChamp(M, N, 'plaque', '')), 'N3')).not.toHaveProperty('bearingWidth');
    expect(modifierChamp(M, N, 'plaque', '0')).toEqual({ erreur: 'Valeur strictement positive attendue.' });
    expect(noeud(ok(modifierChamp(M, N, 'typeNoeud', 'CTT')), 'N3').nodeType).toBe('CTT');
    expect(modifierChamp(M, N, 'typeNoeud', 'XYZ')).toEqual({ erreur: 'Choix inconnu.' });
    expect(noeud(ok(modifierChamp(M, N, 'fixe', 'oui')), 'N3').isFixedInOpt).toBe(true);
    expect(noeud(ok(modifierChamp(M, N, 'fixe', 'non')), 'N3').isFixedInOpt).toBe(false);
  });
});

describe('modifierChamp : barres et modele', () => {
  it('type, traction transversale', () => {
    expect(barre(ok(modifierChamp(M, B, 'type', 'tie')), B.id).type).toBe('tie');
    expect(modifierChamp(M, B, 'type', 'poutre')).toEqual({ erreur: 'Choix inconnu.' });
    expect(barre(ok(modifierChamp(M, B, 'traction', 'oui')), B.id).hasTransverseTension).toBe(true);
    expect(barre(ok(modifierChamp(M, B, 'traction', 'non')), B.id).hasTransverseTension).toBe(false);
  });

  it('largeur, epaisseur, diametre : positifs, vides = retires', () => {
    expect(barre(ok(modifierChamp(M, B, 'largeur', '0,3')), B.id).effectiveWidth).toBe(0.3);
    expect(barre(ok(modifierChamp(M, B, 'largeur', '')), B.id)).not.toHaveProperty('effectiveWidth');
    expect(barre(ok(modifierChamp(M, B, 'epaisseur', '0,4')), B.id).thickness).toBe(0.4);
    expect(barre(ok(modifierChamp(M, B, 'diametre', '32')), B.id).barDiameter).toBe(32);
    expect(barre(ok(modifierChamp(M, B, 'diametre', '')), B.id)).not.toHaveProperty('barDiameter');
    expect(modifierChamp(M, B, 'largeur', '-1')).toEqual({ erreur: 'Valeur strictement positive attendue.' });
  });

  it('modele : epaisseur et materiaux, positifs et obligatoires', () => {
    const c = { type: 'modele' } as const;
    expect(ok(modifierChamp(M, c, 'epaisseur', '0,5')).beton.thickness).toBe(0.5);
    expect(ok(modifierChamp(M, c, 'fck', '35')).materiauBeton.fck).toBe(35);
    expect(ok(modifierChamp(M, c, 'gammaC', '1,2')).materiauBeton.gammaC).toBe(1.2);
    expect(ok(modifierChamp(M, c, 'alphaCc', '0,85')).materiauBeton.alphaCc).toBe(0.85);
    expect(ok(modifierChamp(M, c, 'fyk', '450')).acier.fyk).toBe(450);
    expect(ok(modifierChamp(M, c, 'gammaS', '1')).acier.gammaS).toBe(1);
    expect(modifierChamp(M, c, 'fck', '')).toEqual({ erreur: 'Valeur numérique attendue.' });
    expect(modifierChamp(M, c, 'epaisseur', '0')).toEqual({ erreur: 'Valeur strictement positive attendue.' });
    expect(M.beton.thickness).toBe(PRESETS[0].concrete.thickness);
  });

  it('cible inconnue : meme modele ; champ inconnu : erreur', () => {
    expect(modifierChamp(M, { type: 'noeud', id: 'N99' }, 'x', '1')).toEqual({ modele: M });
    expect((modifierChamp(M, { type: 'noeud', id: 'N99' }, 'x', '1') as { modele: ModeleMbt }).modele).toBe(M);
    expect(modifierChamp(M, N, 'couleur', 'bleu')).toEqual({ erreur: 'Champ inconnu.' });
  });
});

describe('tableaux de saisie', () => {
  it('noeuds : une ligne par noeud, champs x, y, fx, fy, appui ; z et fz en 3D seulement', () => {
    const h = tableNoeudsHtml(M, null);
    expect(h).toContain('data-table="noeuds"');
    expect([...h.matchAll(/<tr[^>]*data-noeud="([^"]*)"/g)].map((x) => x[1])).toEqual(M.noeuds.map((n) => n.id));
    for (const nom of ['x', 'y', 'fx', 'fy', 'appui']) expect(champ(h, 'noeud:N1', nom), nom).toBeDefined();
    expect(champ(h, 'noeud:N1', 'z')).toBeUndefined();
    expect(valeur(champ(h, 'noeud:N1', 'x'))).toBe(nombreAffiche(noeud(M, 'N1').x));
    expect(valeur(champ(h, 'noeud:N3', 'fy'))).toBe('');
    const h3 = tableNoeudsHtml(M3, null);
    expect(champ(h3, `noeud:${M3.noeuds[0].id}`, 'z')).toBeDefined();
    expect(champ(h3, `noeud:${M3.noeuds[0].id}`, 'fz')).toBeDefined();
  });

  it('appui : option choisie selon le noeud', () => {
    const h = tableNoeudsHtml(M, null);
    const select = h.match(/<select[^>]*data-cible="noeud:N5"[^>]*>[\s\S]*?<\/select>|<select[^>]*data-champ="appui"[^>]*data-cible="noeud:N5"[^>]*>[\s\S]*?<\/select>/)?.[0] ?? '';
    expect(select).toMatch(/<option value="pin" selected>/);
    for (const v of ['', 'pin', 'roller_x', 'roller_y', 'roller_z', 'fixed_3d']) expect(select).toContain(`<option value="${v}"`);
  });

  it('barres : une ligne par barre, extremites, type choisi', () => {
    const h = tableBarresHtml(M, null);
    expect(h).toContain('data-table="barres"');
    expect([...h.matchAll(/<tr[^>]*data-barre="([^"]*)"/g)].map((x) => x[1])).toEqual(M.barres.map((b) => b.id));
    const b = M.barres[0];
    expect(h).toContain(`${b.fromNodeId} → ${b.toNodeId}`);
    expect(champ(h, `barre:${b.id}`, 'type')).toBeDefined();
    expect(h).toMatch(new RegExp(`data-barre="${b.id}"[\\s\\S]*?<option value="${b.type}" selected>`));
  });

  it('ligne choisie surlignee, et elle seule', () => {
    const h = tableNoeudsHtml(M, { type: 'noeud', id: 'N2' });
    expect(h).toMatch(/<tr[^>]*class="choisi"[^>]*data-noeud="N2"|<tr[^>]*data-noeud="N2"[^>]*class="choisi"/);
    expect(h.match(/class="choisi"/g)).toHaveLength(1);
    expect(tableNoeudsHtml(M, { type: 'barre', id: B.id })).not.toContain('choisi');
    expect(tableBarresHtml(M, B).match(/class="choisi"/g)).toHaveLength(1);
  });

  it('element choisi : champs du noeud, ou de la barre, ou rien', () => {
    expect(elementChoisiHtml(M, null)).toBe('');
    const n = elementChoisiHtml(M, N);
    expect(texteVisible(n)).toContain('Élément choisi : N3');
    for (const nom of ['plaque', 'typeNoeud', 'fixe']) expect(champ(n, 'noeud:N3', nom), nom).toBeDefined();
    const b = elementChoisiHtml(M, B);
    for (const nom of ['traction', 'largeur', 'epaisseur', 'diametre']) expect(champ(b, `barre:${B.id}`, nom), nom).toBeDefined();
    expect(elementChoisiHtml(M, { type: 'noeud', id: 'N99' })).toBe('');
  });

  it('champs du modele : epaisseur et materiaux', () => {
    const h = champsModeleHtml(M);
    for (const nom of ['epaisseur', 'fck', 'gammaC', 'alphaCc', 'fyk', 'gammaS']) expect(champ(h, 'modele', nom), nom).toBeDefined();
    expect(valeur(champ(h, 'modele', 'epaisseur'))).toBe(nombreAffiche(M.beton.thickness));
  });

  it('identifiants echappes', () => {
    const m: ModeleMbt = { ...M, noeuds: [{ ...M.noeuds[0], id: 'N"<1' }], barres: [] };
    const h = tableNoeudsHtml(m, null);
    expect(h).toContain('N&quot;&lt;1');
    expect(h).not.toContain('N"<1');
  });
});
