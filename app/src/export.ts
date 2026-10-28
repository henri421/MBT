/**
 * Sorties du modele MBT : dessin SVG autonome, resultats en CSV et nom de
 * fichier. Module PUR, sans dependance a React.
 */

import { JETONS, csv, svgAutonome } from 'aedificium-ui';
import type { SolverResult } from '../../src/index';
import type { ModeleMbt } from './modele';
import {
  tableauBielles,
  tableauNoeuds,
  tableauReactions,
  tableauTirants,
} from './vue';

/** Jetons communs puis styles du trace (contour, barres, noeuds, cotes). */
export const STYLES_TRACE = `${JETONS}
[data-role=contour], .contour {
  fill: var(--beton, #f4f1ea);
  stroke: var(--trait, #3a3a3a);
  stroke-width: 1.2;
  stroke-linejoin: round;
}
[data-role=fond] { fill: none; }
[data-largeur] polygon {
  fill: var(--compression, #d98a7d);
  fill-opacity: 0.18;
  stroke: none;
}
.bielle { stroke: var(--compression, #c0392b); stroke-width: 3; stroke-dasharray: 8 4; }
.tirant { stroke: var(--traction, #1f6fb2); stroke-width: 3; }
.neutre { stroke: var(--trait, #6b6b6b); stroke-width: 2; }
.choisi { stroke: var(--choix, #e08b00); stroke-width: 4; }
.noeud { fill: var(--noeud, #2c3e50); stroke: none; }
.effort { fill: var(--trait, #3a3a3a); font-size: 10px; text-anchor: middle; }
.appui polygon { fill: var(--appui, #2c3e50); }
.appui line { stroke: var(--trait, #3a3a3a); stroke-width: 2; }
.charge { stroke: var(--charge, #c0392b); stroke-width: 2; fill: var(--charge, #c0392b); }
.charge text { fill: var(--charge, #c0392b); font-size: 10px; }
.cote line { stroke: var(--trait, #6b6b6b); stroke-width: 1; }
.cote text { fill: var(--trait, #3a3a3a); font-size: 9px; text-anchor: middle; }
.angle { fill: var(--trait, #3a3a3a); font-size: 9px; }
`;

/**
 * Dessin de page transforme en document SVG autonome, styles inclus.
 * svgAutonome pose `<style type="text/css">` ; on retire l'attribut, inutile
 * en SVG et attendu sous la forme nue `<style>`.
 */
export function svgDuDessin(dessin: string): string {
  return svgAutonome(dessin, STYLES_TRACE);
}

/** Un bloc CSV par tableau non vide des calculs, dans l'ordre des volets. */
export function resultatsCsv(m: ModeleMbt, r: SolverResult): string {
  const lignes: string[][] = [];
  // Un treillis instable n'a pas de tableaux de calculs : la note n'a qu'un texte.
  if (!r.success || !r.isStable) return csv(lignes);
  const tableaux = [tableauBielles(m, r), tableauTirants(m, r), tableauNoeuds(m, r), tableauReactions(m, r)];
  for (const t of tableaux) {
    if (t.lignes.length === 0) continue;
    lignes.push([t.clause ? `${t.titre} (${t.clause})` : t.titre], t.entetes, ...t.lignes, []);
  }
  return csv(lignes);
}

/** Nom de fichier sur : minuscules, sans accents, separateurs normalises. */
export function nomDeFichier(nom: string): string {
  const propre = nom
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return propre || 'bielles-tirants';
}
