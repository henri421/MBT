/**
 * Tests d'acceptation de P1 : l'etat de l'app (ModeleMbt), son passage au
 * graphe de l'editeur commun, l'application des actions de l'editeur et le
 * format JSON (compatible avec les fichiers de l'ancienne interface React).
 */

import { describe, expect, it } from 'vitest';
import { PRESETS, solveTruss } from '../../src/index';
import {
  CHARGE_PAR_DEFAUT,
  appliquerAction,
  calculer,
  grapheDuModele,
  modeleAvecGraphe,
  modeleDepuisJson,
  modeleDepuisPrereglage,
  modeleEnJson,
  modeleParDefaut,
  type ModeleMbt,
} from '../../app/src/modele';

const M = modeleParDefaut();
const noeud = (m: ModeleMbt, id: string) => m.noeuds.find((n) => n.id === id);

describe('modeles predefinis', () => {
  it('le modele par defaut est le premier predefini', () => {
    expect(M).toEqual(modeleDepuisPrereglage(PRESETS[0]));
    expect(M.nom).toBe(PRESETS[0].title);
    expect(M.dimension).toBe(PRESETS[0].dimension);
    expect(M.beton).toEqual(PRESETS[0].concrete);
    expect(M.materiauBeton).toEqual(PRESETS[0].concreteMat);
    expect(M.acier).toEqual(PRESETS[0].steelMat);
    expect(M.noeuds).toEqual(PRESETS[0].nodes);
    expect(M.barres).toEqual(PRESETS[0].members);
  });

  it('copie profonde : modifier le modele ne touche pas les predefinis', () => {
    const m = modeleDepuisPrereglage(PRESETS[0]);
    m.noeuds[0].x = 99;
    m.beton.points2D[0][0] = 99;
    m.materiauBeton.fck = 99;
    expect(PRESETS[0].nodes[0].x).not.toBe(99);
    expect(PRESETS[0].concrete.points2D[0][0]).not.toBe(99);
    expect(PRESETS[0].concreteMat.fck).not.toBe(99);
  });

  it('calculer : le solveur du moteur avec les donnees du modele', () => {
    for (const p of PRESETS) {
      const m = modeleDepuisPrereglage(p);
      const attendu = solveTruss(p.nodes, p.members, p.concreteMat, p.steelMat, p.concrete.thickness, p.dimension);
      const r = calculer(m);
      expect(r.success, p.id).toBe(attendu.success);
      expect(r.maxUtilization, p.id).toBeCloseTo(attendu.maxUtilization, 10);
      expect([...r.memberResults.keys()], p.id).toEqual([...attendu.memberResults.keys()]);
    }
  });
});

describe('graphe de l editeur', () => {
  it('noeuds et barres repris dans l ordre, donnees sans id ni coordonnees du plan', () => {
    const g = grapheDuModele(M);
    expect(g.noeuds.map((n) => [n.id, n.x, n.y])).toEqual(M.noeuds.map((n) => [n.id, n.x, n.y]));
    expect(g.barres.map((b) => [b.id, b.de, b.a])).toEqual(M.barres.map((b) => [b.id, b.fromNodeId, b.toNodeId]));
    const d = g.noeuds[0].donnees as Record<string, unknown>;
    expect(d).not.toHaveProperty('id');
    expect(d).not.toHaveProperty('x');
    expect(d).not.toHaveProperty('y');
    expect(g.barres[0].donnees).not.toHaveProperty('fromNodeId');
  });

  it('aller-retour sans perte, en 2D comme en 3D', () => {
    for (const p of PRESETS) {
      const m = modeleDepuisPrereglage(p);
      expect(modeleAvecGraphe(m, grapheDuModele(m)), p.id).toEqual(m);
    }
  });
});

describe('actions de l editeur', () => {
  it('ajouter-noeud : nouveau noeud libre, choisi, historise', () => {
    const r = appliquerAction(M, { type: 'ajouter-noeud', point: { x: 0.2, y: 0.4 } });
    const n = r.modele.noeuds.at(-1);
    expect(n).toEqual({ id: 'N6', x: 0.2, y: 0.4 });
    expect(r.selection).toEqual({ type: 'noeud', id: 'N6' });
    expect(r.historiser).toBe(true);
    expect(M.noeuds).toHaveLength(5);
  });

  it('deplacer : historise seulement en fin de glissement', () => {
    const pendant = appliquerAction(M, { type: 'deplacer', id: 'N3', point: { x: 0.3, y: 0.25 }, fin: false });
    expect(noeud(pendant.modele, 'N3')).toMatchObject({ x: 0.3, y: 0.25 });
    expect(pendant.historiser).toBe(false);
    expect(appliquerAction(M, { type: 'deplacer', id: 'N3', point: { x: 0.3, y: 0.25 }, fin: true }).historiser).toBe(true);
  });

  it('relier : nouvelle barre de type auto, choisie ; doublon refuse sans historique', () => {
    const r = appliquerAction(M, { type: 'relier', de: 'N1', a: 'N4' });
    const b = r.modele.barres.at(-1);
    expect(b).toEqual({ id: 'B1', fromNodeId: 'N1', toNodeId: 'N4', type: 'auto' });
    expect(r.selection).toEqual({ type: 'barre', id: 'B1' });
    expect(r.historiser).toBe(true);
    const doublon = appliquerAction(M, { type: 'relier', de: 'N2', a: 'N1' });
    expect(doublon.modele).toBe(M);
    expect(doublon.historiser).toBe(false);
  });

  it('appui : bascule ; un nouvel appui est une rotule', () => {
    const pose = appliquerAction(M, { type: 'appui', id: 'N3' });
    expect(noeud(pose.modele, 'N3')).toMatchObject({ isSupport: true, supportType: 'pin' });
    expect(pose.historiser).toBe(true);
    const retire = appliquerAction(pose.modele, { type: 'appui', id: 'N3' });
    expect(noeud(retire.modele, 'N3')).not.toHaveProperty('isSupport');
    expect(noeud(retire.modele, 'N3')).not.toHaveProperty('supportType');
  });

  it('charge : bascule ; une nouvelle charge vaut CHARGE_PAR_DEFAUT vers le bas', () => {
    expect(CHARGE_PAR_DEFAUT).toBe(-100);
    const pose = appliquerAction(M, { type: 'charge', id: 'N3' });
    expect(noeud(pose.modele, 'N3')).toMatchObject({ fy: -100 });
    const retire = appliquerAction(M, { type: 'charge', id: 'N1' });
    const n1 = noeud(retire.modele, 'N1');
    expect([n1?.fx ?? 0, n1?.fy ?? 0, n1?.fz ?? 0]).toEqual([0, 0, 0]);
  });

  it('supprimer : noeud et ses barres, selection videe', () => {
    const r = appliquerAction(M, { type: 'supprimer', selection: { type: 'noeud', id: 'N1' } });
    expect(r.modele.noeuds.map((n) => n.id)).toEqual(['N2', 'N3', 'N4', 'N5']);
    expect(r.modele.barres.some((b) => b.fromNodeId === 'N1' || b.toNodeId === 'N1')).toBe(false);
    expect(r.selection).toBeNull();
    expect(r.historiser).toBe(true);
  });

  it('choisir, survol, annuler, retablir : le modele ne change pas', () => {
    for (const a of [
      { type: 'choisir', selection: { type: 'noeud', id: 'N2' } },
      { type: 'survol', point: { x: 0, y: 0 }, noeud: null },
      { type: 'annuler' },
      { type: 'retablir' },
    ] as const) {
      const r = appliquerAction(M, a);
      expect(r.modele, a.type).toBe(M);
      expect(r.historiser, a.type).toBe(false);
    }
    expect(appliquerAction(M, { type: 'choisir', selection: { type: 'noeud', id: 'N2' } }).selection).toEqual({ type: 'noeud', id: 'N2' });
    expect(appliquerAction(M, { type: 'survol', point: { x: 0, y: 0 }, noeud: null })).not.toHaveProperty('selection');
  });
});

describe('JSON', () => {
  it('format de l ancienne interface', () => {
    const o = JSON.parse(modeleEnJson(M, '2026-10-28T20:00:00.000Z'));
    expect(o).toEqual({
      app: 'CivilEngineering-STM',
      version: '1.0.0',
      exportDate: '2026-10-28T20:00:00.000Z',
      name: M.nom,
      dimensionMode: M.dimension,
      concreteOutline: M.beton,
      concreteMat: M.materiauBeton,
      steelMat: M.acier,
      nodes: M.noeuds,
      members: M.barres,
    });
  });

  it('aller-retour pour chaque modele predefini', () => {
    for (const p of PRESETS) {
      const m = modeleDepuisPrereglage(p);
      expect(modeleDepuisJson(modeleEnJson(m, '2026-10-28')), p.id).toEqual({ modele: m });
    }
  });

  it('nom absent : Modele importe', () => {
    const o = JSON.parse(modeleEnJson(M, 'x'));
    delete o.name;
    const r = modeleDepuisJson(JSON.stringify(o));
    expect('modele' in r && r.modele.nom).toBe('Modèle importé');
  });

  it('fichiers refuses, avec un message', () => {
    const base = JSON.parse(modeleEnJson(M, 'x'));
    const cas: [string, string, RegExp][] = [
      ['pas du JSON', '{ pas du json', /JSON/],
      ['autre application', JSON.stringify({ ...base, app: 'autre' }), /bielles-tirants/],
      ['noeuds absents', JSON.stringify({ ...base, nodes: undefined }), /nœud/],
      ['coordonnee non numerique', JSON.stringify({ ...base, nodes: [{ ...base.nodes[0], x: 'a' }, ...base.nodes.slice(1)] }), /nœud/],
      ['barre vers un noeud inconnu', JSON.stringify({ ...base, members: [{ ...base.members[0], toNodeId: 'N99' }] }), /barre/],
      ['epaisseur nulle', JSON.stringify({ ...base, concreteOutline: { ...base.concreteOutline, thickness: 0 } }), /épaisseur/],
      ['materiau incomplet', JSON.stringify({ ...base, concreteMat: { ...base.concreteMat, fck: null } }), /matériau/],
    ];
    for (const [nom, texte, motif] of cas) {
      const r = modeleDepuisJson(texte);
      expect('erreur' in r, nom).toBe(true);
      if ('erreur' in r) expect(r.erreur, nom).toMatch(motif);
    }
  });
});
