/**
 * P2 — saisie par tableaux : édition d'un champ du modèle et rendu HTML des
 * tableaux de nœuds, de barres, du cadre « Élément choisi » et des champs du
 * modèle. Module pur, sans DOM.
 */

import { echapper, lireNombre, nombreAffiche, type Selection } from 'aedificium-ui';
import type { ModeleMbt } from './modele';

export type Cible = { type: 'modele' } | { type: 'noeud'; id: string } | { type: 'barre'; id: string };

const MSG_NOMBRE = 'Valeur numérique attendue.';
const MSG_POSITIF = 'Valeur strictement positive attendue.';
const MSG_CHOIX = 'Choix inconnu.';
const MSG_CHAMP = 'Champ inconnu.';

const APPUIS: readonly string[] = ['', 'pin', 'roller_x', 'roller_y', 'roller_z', 'fixed_3d'];
const TYPES_NOEUD: readonly string[] = ['AUTO', 'CCC', 'CCT', 'CTT'];
const TYPES_BARRE: readonly string[] = ['strut', 'tie', 'auto'];

type LectureNombre =
  | { defini: true; valeur: number }
  | { defini: false }
  | { erreur: string };

function estVide(texte: string): boolean {
  return texte.trim() === '';
}

/** Lit un nombre ; `obligatoire` interdit le vide, `positif` interdit ≤ 0. */
function lireChampNombre(texte: string, obligatoire: boolean, positif: boolean): LectureNombre {
  if (estVide(texte)) {
    return obligatoire ? { erreur: MSG_NOMBRE } : { defini: false };
  }
  const valeur = lireNombre(texte.trim());
  if (valeur === null || !Number.isFinite(valeur)) return { erreur: MSG_NOMBRE };
  if (positif && valeur <= 0) return { erreur: MSG_POSITIF };
  return { defini: true, valeur };
}

function ouiNon(texte: string): { valeur: boolean } | { erreur: string } {
  if (texte === 'oui') return { valeur: true };
  if (texte === 'non') return { valeur: false };
  return { erreur: MSG_CHOIX };
}

export function modifierChamp(
  m: ModeleMbt,
  c: Cible,
  champ: string,
  texte: string,
): { modele: ModeleMbt } | { erreur: string } {
  if (c.type === 'modele') {
    switch (champ) {
      case 'epaisseur': {
        const r = lireChampNombre(texte, true, true);
        if ('erreur' in r) return { erreur: r.erreur };
        if (!r.defini) return { erreur: MSG_NOMBRE };
        const copie = structuredClone(m);
        copie.beton.thickness = r.valeur;
        return { modele: copie };
      }
      case 'fck':
      case 'gammaC':
      case 'alphaCc': {
        const r = lireChampNombre(texte, true, true);
        if ('erreur' in r) return { erreur: r.erreur };
        if (!r.defini) return { erreur: MSG_NOMBRE };
        const copie = structuredClone(m);
        copie.materiauBeton[champ] = r.valeur;
        return { modele: copie };
      }
      case 'fyk':
      case 'gammaS': {
        const r = lireChampNombre(texte, true, true);
        if ('erreur' in r) return { erreur: r.erreur };
        if (!r.defini) return { erreur: MSG_NOMBRE };
        const copie = structuredClone(m);
        copie.acier[champ] = r.valeur;
        return { modele: copie };
      }
      default:
        return { erreur: MSG_CHAMP };
    }
  }

  if (c.type === 'noeud') {
    const index = m.noeuds.findIndex((n) => n.id === c.id);
    if (index < 0) return { modele: m };
    switch (champ) {
      case 'x':
      case 'y':
      case 'z': {
        const r = lireChampNombre(texte, true, false);
        if ('erreur' in r) return { erreur: r.erreur };
        if (!r.defini) return { erreur: MSG_NOMBRE };
        const copie = structuredClone(m);
        copie.noeuds[index][champ] = r.valeur;
        return { modele: copie };
      }
      case 'fx':
      case 'fy':
      case 'fz': {
        const r = lireChampNombre(texte, false, false);
        if ('erreur' in r) return { erreur: r.erreur };
        const copie = structuredClone(m);
        const n = copie.noeuds[index];
        if (r.defini) n[champ] = r.valeur;
        else delete n[champ];
        return { modele: copie };
      }
      case 'appui': {
        if (!APPUIS.includes(texte)) return { erreur: MSG_CHOIX };
        const copie = structuredClone(m);
        const n = copie.noeuds[index];
        if (texte === '') {
          delete n.isSupport;
          delete n.supportType;
        } else {
          n.isSupport = true;
          n.supportType = texte as NonNullable<typeof n.supportType>;
        }
        return { modele: copie };
      }
      case 'plaque': {
        const r = lireChampNombre(texte, false, true);
        if ('erreur' in r) return { erreur: r.erreur };
        const copie = structuredClone(m);
        const n = copie.noeuds[index];
        if (r.defini) n.bearingWidth = r.valeur;
        else delete n.bearingWidth;
        return { modele: copie };
      }
      case 'typeNoeud': {
        if (!TYPES_NOEUD.includes(texte)) return { erreur: MSG_CHOIX };
        const copie = structuredClone(m);
        copie.noeuds[index].nodeType = texte as NonNullable<ModeleMbt['noeuds'][number]['nodeType']>;
        return { modele: copie };
      }
      case 'fixe': {
        const r = ouiNon(texte);
        if ('erreur' in r) return { erreur: r.erreur };
        const copie = structuredClone(m);
        copie.noeuds[index].isFixedInOpt = r.valeur;
        return { modele: copie };
      }
      default:
        return { erreur: MSG_CHAMP };
    }
  }

  const index = m.barres.findIndex((b) => b.id === c.id);
  if (index < 0) return { modele: m };
  switch (champ) {
    case 'type': {
      if (!TYPES_BARRE.includes(texte)) return { erreur: MSG_CHOIX };
      const copie = structuredClone(m);
      copie.barres[index].type = texte as ModeleMbt['barres'][number]['type'];
      return { modele: copie };
    }
    case 'traction': {
      const r = ouiNon(texte);
      if ('erreur' in r) return { erreur: r.erreur };
      const copie = structuredClone(m);
      copie.barres[index].hasTransverseTension = r.valeur;
      return { modele: copie };
    }
    case 'largeur':
    case 'epaisseur':
    case 'diametre': {
      const r = lireChampNombre(texte, false, true);
      if ('erreur' in r) return { erreur: r.erreur };
      const copie = structuredClone(m);
      const b = copie.barres[index];
      const nom = champ === 'largeur' ? 'effectiveWidth' : champ === 'epaisseur' ? 'thickness' : 'barDiameter';
      if (r.defini) b[nom] = r.valeur;
      else delete b[nom];
      return { modele: copie };
    }
    default:
      return { erreur: MSG_CHAMP };
  }
}

// ---------------------------------------------------------------------------
// Rendu HTML
// ---------------------------------------------------------------------------

export const LIBELLES_APPUI: readonly (readonly [string, string])[] = [
  ['', 'aucun'],
  ['pin', 'appui simple'],
  ['roller_x', 'rouleau x'],
  ['roller_y', 'rouleau y'],
  ['roller_z', 'rouleau z'],
  ['fixed_3d', 'encastrement 3D'],
];

const LIBELLES_TYPE_NOEUD: readonly (readonly [string, string])[] = [
  ['AUTO', 'auto'],
  ['CCC', 'CCC'],
  ['CCT', 'CCT'],
  ['CTT', 'CTT'],
];

const LIBELLES_TYPE_BARRE: readonly (readonly [string, string])[] = [
  ['strut', 'bielle'],
  ['tie', 'tirant'],
  ['auto', 'auto'],
];

const LIBELLES_OUI_NON: readonly (readonly [string, string])[] = [
  ['oui', 'oui'],
  ['non', 'non'],
];

function attributs(cible: string, champ: string): string {
  return `data-cible="${echapper(cible)}" data-champ="${echapper(champ)}"`;
}

function champNombreHtml(cible: string, champ: string, valeur: number | undefined): string {
  const texte = valeur === undefined ? '' : nombreAffiche(valeur);
  return `<input type="number" step="any" ${attributs(cible, champ)} value="${echapper(texte)}">`;
}

function champChoixHtml(
  cible: string,
  champ: string,
  options: readonly (readonly [string, string])[],
  courant: string,
): string {
  const contenu = options
    .map(([valeur, libelle]) => {
      const selection = valeur === courant ? ' selected' : '';
      return `<option value="${echapper(valeur)}"${selection}>${echapper(libelle)}</option>`;
    })
    .join('');
  return `<select ${attributs(cible, champ)}>${contenu}</select>`;
}

function ligne(texte: string, controle: string): string {
  return `<label class="ligne"><span>${echapper(texte)}</span>${controle}</label>`;
}

function classeChoisi(selection: Selection, type: 'noeud' | 'barre', id: string): string {
  return selection !== null && selection.type === type && selection.id === id ? ' class="choisi"' : '';
}

export function tableNoeudsHtml(m: ModeleMbt, s: Selection): string {
  const troisD = m.dimension === '3D';
  const lignes = m.noeuds
    .map((n) => {
      const cible = `noeud:${n.id}`;
      const cellules = [
        `<td>${echapper(n.id)}</td>`,
        `<td>${champNombreHtml(cible, 'x', n.x)}</td>`,
        `<td>${champNombreHtml(cible, 'y', n.y)}</td>`,
      ];
      if (troisD) cellules.push(`<td>${champNombreHtml(cible, 'z', n.z)}</td>`);
      cellules.push(`<td>${champNombreHtml(cible, 'fx', n.fx)}</td>`);
      cellules.push(`<td>${champNombreHtml(cible, 'fy', n.fy)}</td>`);
      if (troisD) cellules.push(`<td>${champNombreHtml(cible, 'fz', n.fz)}</td>`);
      cellules.push(
        `<td>${champChoixHtml(cible, 'appui', LIBELLES_APPUI, n.supportType ?? '')}</td>`,
      );
      return `<tr data-noeud="${echapper(n.id)}"${classeChoisi(s, 'noeud', n.id)}>${cellules.join('')}</tr>`;
    })
    .join('');
  return `<table data-table="noeuds"><tbody>${lignes}</tbody></table>`;
}

function detailBarre(b: ModeleMbt['barres'][number]): string {
  if (b.type === 'tie' && b.barDiameter !== undefined) {
    return `HA ${nombreAffiche(b.barDiameter)}`;
  }
  if (b.type === 'strut' && b.effectiveWidth !== undefined) {
    return `w = ${nombreAffiche(b.effectiveWidth)} m`;
  }
  return '—';
}

export function tableBarresHtml(m: ModeleMbt, s: Selection): string {
  const lignes = m.barres
    .map((b) => {
      const cible = `barre:${b.id}`;
      const cellules = [
        `<td>${echapper(b.id)}</td>`,
        `<td>${echapper(b.fromNodeId)} → ${echapper(b.toNodeId)}</td>`,
        `<td>${champChoixHtml(cible, 'type', LIBELLES_TYPE_BARRE, b.type)}</td>`,
        `<td>${echapper(detailBarre(b))}</td>`,
      ];
      return `<tr data-barre="${echapper(b.id)}"${classeChoisi(s, 'barre', b.id)}>${cellules.join('')}</tr>`;
    })
    .join('');
  return `<table data-table="barres"><tbody>${lignes}</tbody></table>`;
}

export function elementChoisiHtml(m: ModeleMbt, s: Selection): string {
  if (s === null) return '';
  if (s.type === 'noeud') {
    const n = m.noeuds.find((x) => x.id === s.id);
    if (!n) return '';
    const cible = `noeud:${n.id}`;
    const champs = [
      ligne('Plaque (m)', champNombreHtml(cible, 'plaque', n.bearingWidth)),
      ligne(
        'Type de nœud',
        champChoixHtml(cible, 'typeNoeud', LIBELLES_TYPE_NOEUD, n.nodeType ?? 'AUTO'),
      ),
      ligne(
        'Fixe (optimiseur)',
        champChoixHtml(cible, 'fixe', LIBELLES_OUI_NON, n.isFixedInOpt ? 'oui' : 'non'),
      ),
    ].join('');
    return `<fieldset><legend>Élément choisi : ${echapper(n.id)}</legend>${champs}</fieldset>`;
  }
  const b = m.barres.find((x) => x.id === s.id);
  if (!b) return '';
  const cible = `barre:${b.id}`;
  const champs = [
    ligne(
      'Traction transversale',
      champChoixHtml(cible, 'traction', LIBELLES_OUI_NON, b.hasTransverseTension ? 'oui' : 'non'),
    ),
    ligne('Largeur (m)', champNombreHtml(cible, 'largeur', b.effectiveWidth)),
    ligne('Épaisseur (m)', champNombreHtml(cible, 'epaisseur', b.thickness)),
    ligne('Diamètre (mm)', champNombreHtml(cible, 'diametre', b.barDiameter)),
  ].join('');
  return `<fieldset><legend>Élément choisi : ${echapper(b.id)}</legend>${champs}</fieldset>`;
}

export function champsModeleHtml(m: ModeleMbt): string {
  const champs = [
    ligne('Épaisseur (m)', champNombreHtml('modele', 'epaisseur', m.beton.thickness)),
    ligne('fck (MPa)', champNombreHtml('modele', 'fck', m.materiauBeton.fck)),
    ligne('γc', champNombreHtml('modele', 'gammaC', m.materiauBeton.gammaC)),
    ligne('αcc', champNombreHtml('modele', 'alphaCc', m.materiauBeton.alphaCc)),
    ligne('fyk (MPa)', champNombreHtml('modele', 'fyk', m.acier.fyk)),
    ligne('γs', champNombreHtml('modele', 'gammaS', m.acier.gammaS)),
  ].join('');
  return `<div class="champs-modele">${champs}</div>`;
}
