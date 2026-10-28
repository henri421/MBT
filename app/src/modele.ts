/**
 * Etat de l'application MBT : le modele bielles-tirants (ModeleMbt) et les
 * operations qui le concernent. Module PUR, sans dependance a React :
 * passage au graphe de l'editeur commun, application des actions, JSON.
 */

import {
  ajouterNoeud,
  deplacerNoeud,
  relier,
  supprimer,
  type ActionEditeur,
  type Graphe,
  type Selection,
} from 'aedificium-ui';
import {
  PRESETS,
  solveTruss,
  type ConcreteMaterial,
  type ConcreteOutline,
  type DimensionMode,
  type ModelPreset,
  type SolverResult,
  type SteelMaterial,
  type STMMember,
  type STMNode,
} from '../../src/index';

export interface ModeleMbt {
  nom: string;
  dimension: DimensionMode;
  beton: ConcreteOutline;
  materiauBeton: ConcreteMaterial;
  acier: SteelMaterial;
  noeuds: STMNode[];
  barres: STMMember[];
}

export type DonneesNoeud = Omit<STMNode, 'id' | 'x' | 'y'>;
export type DonneesBarre = Omit<STMMember, 'id' | 'fromNodeId' | 'toNodeId'>;

/** Charge verticale par defaut, en kN (vers le bas, donc selon -y). */
export const CHARGE_PAR_DEFAUT = -100;

function copieProfonde<T>(v: T): T {
  return structuredClone(v);
}

export function modeleDepuisPrereglage(p: ModelPreset): ModeleMbt {
  return {
    nom: p.title,
    dimension: p.dimension,
    beton: copieProfonde(p.concrete),
    materiauBeton: copieProfonde(p.concreteMat),
    acier: copieProfonde(p.steelMat),
    noeuds: copieProfonde(p.nodes),
    barres: copieProfonde(p.members),
  };
}

export function modeleParDefaut(): ModeleMbt {
  return modeleDepuisPrereglage(PRESETS[0]);
}

export function calculer(m: ModeleMbt): SolverResult {
  return solveTruss(
    m.noeuds,
    m.barres,
    m.materiauBeton,
    m.acier,
    m.beton.thickness,
    m.dimension,
  );
}

function donneesNoeud(n: STMNode): DonneesNoeud {
  const { id: _id, x: _x, y: _y, ...reste } = n;
  return reste;
}

function donneesBarre(b: STMMember): DonneesBarre {
  const { id: _id, fromNodeId: _de, toNodeId: _a, ...reste } = b;
  return reste;
}

export function grapheDuModele(m: ModeleMbt): Graphe<DonneesNoeud, DonneesBarre> {
  return {
    noeuds: m.noeuds.map((n) => ({ id: n.id, x: n.x, y: n.y, donnees: donneesNoeud(n) })),
    barres: m.barres.map((b) => ({
      id: b.id,
      de: b.fromNodeId,
      a: b.toNodeId,
      donnees: donneesBarre(b),
    })),
  };
}

export function modeleAvecGraphe(
  m: ModeleMbt,
  g: Graphe<DonneesNoeud, DonneesBarre>,
): ModeleMbt {
  return {
    ...m,
    noeuds: g.noeuds.map((n) => ({ id: n.id, x: n.x, y: n.y, ...n.donnees })),
    barres: g.barres.map((b) => ({
      id: b.id,
      fromNodeId: b.de,
      toNodeId: b.a,
      ...b.donnees,
    })),
  };
}

/** Remplace un noeud en conservant l'ordre des noeuds. */
function remplacerNoeud(
  m: ModeleMbt,
  id: string,
  transformer: (n: STMNode) => STMNode,
): { modele: ModeleMbt; trouve: boolean } {
  const index = m.noeuds.findIndex((n) => n.id === id);
  if (index < 0) return { modele: m, trouve: false };
  const noeuds = [...m.noeuds];
  noeuds[index] = transformer(noeuds[index]);
  return { modele: { ...m, noeuds }, trouve: true };
}

export function appliquerAction(
  m: ModeleMbt,
  a: ActionEditeur,
): { modele: ModeleMbt; historiser: boolean; selection?: Selection } {
  switch (a.type) {
    case 'ajouter-noeud': {
      const g = grapheDuModele(m);
      const donnees: DonneesNoeud = m.dimension === '3D' ? { z: 0 } : {};
      const r = ajouterNoeud(g, a.point, donnees);
      return {
        modele: modeleAvecGraphe(m, r.graphe),
        historiser: true,
        selection: { type: 'noeud', id: r.id },
      };
    }

    case 'deplacer': {
      const g = deplacerNoeud(grapheDuModele(m), a.id, a.point);
      return { modele: modeleAvecGraphe(m, g), historiser: a.fin };
    }

    case 'relier': {
      const r = relier(grapheDuModele(m), a.de, a.a, { type: 'auto' });
      if (r.id === null) return { modele: m, historiser: false };
      return {
        modele: modeleAvecGraphe(m, r.graphe),
        historiser: true,
        selection: { type: 'barre', id: r.id },
      };
    }

    case 'appui': {
      const r = remplacerNoeud(m, a.id, (n) => {
        if (n.isSupport) {
          const { isSupport: _s, supportType: _t, ...reste } = n;
          return reste;
        }
        return { ...n, isSupport: true, supportType: 'pin' };
      });
      if (!r.trouve) return { modele: m, historiser: false };
      return { modele: r.modele, historiser: true };
    }

    case 'charge': {
      const r = remplacerNoeud(m, a.id, (n) => {
        const charge =
          (n.fx ?? 0) !== 0 || (n.fy ?? 0) !== 0 || (n.fz ?? 0) !== 0;
        if (charge) {
          const { fx: _x, fy: _y, fz: _z, ...reste } = n;
          return reste;
        }
        return { ...n, fy: CHARGE_PAR_DEFAUT };
      });
      if (!r.trouve) return { modele: m, historiser: false };
      return { modele: r.modele, historiser: true };
    }

    case 'supprimer': {
      const g = supprimer(grapheDuModele(m), a.selection);
      return { modele: modeleAvecGraphe(m, g), historiser: true, selection: null };
    }

    case 'choisir':
      return { modele: m, historiser: false, selection: a.selection };

    case 'survol':
    case 'annuler':
    case 'retablir':
      return { modele: m, historiser: false };
  }
}

export function modeleEnJson(m: ModeleMbt, date: string): string {
  const o = {
    app: 'CivilEngineering-STM',
    version: '1.0.0',
    exportDate: date,
    name: m.nom,
    dimensionMode: m.dimension,
    concreteOutline: m.beton,
    concreteMat: m.materiauBeton,
    steelMat: m.acier,
    nodes: m.noeuds,
    members: m.barres,
  };
  return JSON.stringify(o, null, 2);
}

function estPositif(v: unknown): boolean {
  return typeof v === 'number' && Number.isFinite(v) && v > 0;
}

function estObjet(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

export function modeleDepuisJson(texte: string): { modele: ModeleMbt } | { erreur: string } {
  let o: unknown;
  try {
    o = JSON.parse(texte);
  } catch {
    return { erreur: "Fichier illisible : ce n'est pas du JSON." };
  }

  if (!estObjet(o) || o.app !== 'CivilEngineering-STM') {
    return { erreur: "Ce fichier n'est pas un modèle bielles-tirants." };
  }

  const nodes = o.nodes;
  if (
    !Array.isArray(nodes) ||
    !nodes.every(
      (n) => estObjet(n) && typeof n.id === 'string' && Number.isFinite(n.x) && Number.isFinite(n.y),
    )
  ) {
    return { erreur: 'Fichier incomplet : un nœud est mal décrit.' };
  }

  const idsNoeuds = new Set(nodes.map((n) => (n as Record<string, unknown>).id as string));
  const members = o.members;
  if (
    !Array.isArray(members) ||
    !members.every(
      (b) =>
        estObjet(b) &&
        typeof b.id === 'string' &&
        typeof b.fromNodeId === 'string' &&
        typeof b.toNodeId === 'string' &&
        idsNoeuds.has(b.fromNodeId) &&
        idsNoeuds.has(b.toNodeId),
    )
  ) {
    return { erreur: 'Fichier incomplet : une barre relie un nœud absent.' };
  }

  const contour = o.concreteOutline;
  if (
    !estObjet(contour) ||
    !Array.isArray(contour.points2D) ||
    typeof contour.thickness !== 'number' ||
    !(contour.thickness > 0)
  ) {
    return { erreur: 'Contour ou épaisseur du béton invalide.' };
  }

  const beton = o.concreteMat;
  const acier = o.steelMat;
  if (
    !estObjet(beton) ||
    !estPositif(beton.fck) ||
    !estPositif(beton.gammaC) ||
    !estPositif(beton.alphaCc) ||
    !estObjet(acier) ||
    !estPositif(acier.fyk) ||
    !estPositif(acier.gammaS)
  ) {
    return { erreur: 'Fichier incomplet : un matériau est mal décrit.' };
  }

  return {
    modele: {
      nom: typeof o.name === 'string' ? o.name : 'Modèle importé',
      dimension: (o.dimensionMode ?? '2D') as DimensionMode,
      beton: contour as unknown as ConcreteOutline,
      materiauBeton: beton as unknown as ConcreteMaterial,
      acier: acier as unknown as SteelMaterial,
      noeuds: nodes as STMNode[],
      barres: members as STMMember[],
    },
  };
}
