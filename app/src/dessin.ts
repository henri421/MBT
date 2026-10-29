/**
 * Dessin SVG 2D du modele bielles-tirants. Module PUR : il rend une chaine et
 * ne touche ni au DOM ni a React. Les couleurs viennent des classes ; la mise
 * en forme est laissee a la CSS de la page (et a STYLES_TRACE a l'export).
 */

import {
  echapper,
  nombreAffiche,
  versEcran,
  vueAjustee,
  type Selection,
  type Vue,
} from 'aedificium-ui';
import { phrase, textes } from './textes';
import { calculateStmDimensions, type SolverResult } from '../../src/index';
import type { ModeleMbt } from './modele';

/** Marge, en pixels, entre le dessin et le bord de la zone. */
export const MARGE_DESSIN = 40;

export interface OptionsDessin {
  largeur: number;
  hauteur: number;
  selection: Selection;
  grille: number | null;
  angles: boolean;
  cotes: boolean;
  largeurs: boolean;
}

export const OPTIONS_DESSIN: OptionsDessin = {
  largeur: 640,
  hauteur: 520,
  selection: null,
  grille: null,
  angles: true,
  cotes: false,
  largeurs: false,
};

/** Coordonnee arrondie a 0,1 px. */
const px = (v: number): number => Math.round(v * 10) / 10;

/** Couple de coordonnees ecran « x,y ». */
const xy = (x: number, y: number): string => `${px(x)},${px(y)}`;

/** Vue qui cadre le contour du beton et les noeuds dans la zone. */
export function vueDuModele(m: ModeleMbt, largeur: number, hauteur: number): Vue {
  const points = [
    ...m.beton.points2D.map(([x, y]) => ({ x, y })),
    ...m.noeuds.map((n) => ({ x: n.x, y: n.y })),
  ];
  return vueAjustee(points, largeur, hauteur, MARGE_DESSIN);
}

/** Dessine le modele en SVG ; `r` est le resultat du calcul, ou `null`. */
export function dessinModele(
  m: ModeleMbt,
  r: SolverResult | null,
  vue: Vue,
  o: OptionsDessin,
): string {
  const parts: string[] = [];

  const estChoisi = (type: 'noeud' | 'barre', id: string): boolean =>
    o.selection !== null && o.selection.type === type && o.selection.id === id;
  const classe = (base: string, choisi: boolean): string => (choisi ? `${base} choisi` : base);
  const noeud = (id: string) => m.noeuds.find((n) => n.id === id);
  const autreBout = (b: (typeof m.barres)[number], id: string): string =>
    b.fromNodeId === id ? b.toNodeId : b.fromNodeId;

  // Grille.
  if (o.grille !== null) {
    const pas = px(o.grille * vue.echelle);
    parts.push(
      `<defs><pattern id="grille" width="${pas}" height="${pas}" patternUnits="userSpaceOnUse">` +
        `<path d="M ${pas} 0 L 0 0 0 ${pas}" fill="none" stroke="#e5e7eb" stroke-width="1"/>` +
        `</pattern></defs>`,
    );
    parts.push(
      `<rect data-role="fond" width="${px(o.largeur)}" height="${px(o.hauteur)}" fill="url(#grille)"/>`,
    );
  }

  // Contour du beton.
  const contour = m.beton.points2D
    .map(([x, y]) => {
      const e = versEcran({ x, y }, vue);
      return xy(e.x, e.y);
    })
    .join(' ');
  parts.push(`<polygon data-role="contour" points="${contour}"/>`);

  // Bandes de largeur des bielles.
  if (o.largeurs && r) {
    for (const b of m.barres) {
      const res = r.memberResults.get(b.id);
      if (!res?.isCompression) continue;
      const de = noeud(b.fromNodeId);
      const a = noeud(b.toNodeId);
      if (!de || !a) continue;
      const demi = (res.effectiveWidthActual ?? res.effectiveWidthRequired) / 1000 / 2;
      const dx = a.x - de.x;
      const dy = a.y - de.y;
      const longueur = Math.hypot(dx, dy);
      if (!(longueur > 0)) continue;
      const nx = (-dy / longueur) * demi;
      const ny = (dx / longueur) * demi;
      const sommets = [
        { x: de.x + nx, y: de.y + ny },
        { x: a.x + nx, y: a.y + ny },
        { x: a.x - nx, y: a.y - ny },
        { x: de.x - nx, y: de.y - ny },
      ]
        .map((p) => {
          const e = versEcran(p, vue);
          return xy(e.x, e.y);
        })
        .join(' ');
      parts.push(`<g data-largeur="${echapper(b.id)}"><polygon points="${sommets}"/></g>`);
    }
  }

  // Barres.
  for (const b of m.barres) {
    const de = noeud(b.fromNodeId);
    const a = noeud(b.toNodeId);
    if (!de || !a) continue;
    const res = r?.memberResults.get(b.id);
    const type = res
      ? res.isCompression
        ? 'bielle'
        : 'tirant'
      : b.type === 'strut'
        ? 'bielle'
        : b.type === 'tie'
          ? 'tirant'
          : 'neutre';
    const e1 = versEcran(de, vue);
    const e2 = versEcran(a, vue);
    parts.push(
      `<line data-barre="${echapper(b.id)}" class="${classe(type, estChoisi('barre', b.id))}" ` +
        `x1="${px(e1.x)}" y1="${px(e1.y)}" x2="${px(e2.x)}" y2="${px(e2.y)}"/>`,
    );
  }

  // Efforts normaux, au milieu de chaque barre.
  if (r) {
    for (const b of m.barres) {
      const res = r.memberResults.get(b.id);
      if (!res) continue;
      const de = noeud(b.fromNodeId);
      const a = noeud(b.toNodeId);
      if (!de || !a) continue;
      const mid = versEcran({ x: (de.x + a.x) / 2, y: (de.y + a.y) / 2 }, vue);
      const effort =
        Math.abs(res.force) < 1e-9
          ? '0'
          : `${res.force > 0 ? '+' : '−'}${nombreAffiche(Math.abs(res.force), 1)}`;
      parts.push(
        `<text data-effort="${echapper(b.id)}" class="effort" x="${px(mid.x)}" y="${px(mid.y)}" ` +
          `text-anchor="middle">${echapper(effort)}</text>`,
      );
    }
  }

  // Lignes de cote du moteur.
  if (o.cotes) {
    for (const d of calculateStmDimensions(m.beton, m.noeuds)) {
      const e1 = versEcran({ x: d.x1, y: d.y1 }, vue);
      const e2 = versEcran({ x: d.x2, y: d.y2 }, vue);
      const mid = versEcran({ x: (d.x1 + d.x2) / 2, y: (d.y1 + d.y2) / 2 }, vue);
      parts.push(
        `<g data-cote="${echapper(d.id)}" class="cote">` +
          `<line x1="${px(e1.x)}" y1="${px(e1.y)}" x2="${px(e2.x)}" y2="${px(e2.y)}"/>` +
          `<text x="${px(mid.x)}" y="${px(mid.y)}" text-anchor="middle">${echapper(phrase(d.label))}</text>` +
          `</g>`,
      );
    }
  }

  // Angles aigus entre une bielle et un tirant qui se rejoignent a un noeud.
  if (o.angles && r) {
    for (const n of m.noeuds) {
      const incidents = m.barres.filter(
        (b) => b.fromNodeId === n.id || b.toNodeId === n.id,
      );
      const bielles = incidents.filter(
        (b) => r.memberResults.get(b.id)?.isCompression === true,
      );
      const tirants = incidents.filter(
        (b) => r.memberResults.get(b.id)?.isCompression === false,
      );
      for (const bi of bielles) {
        for (const ti of tirants) {
          if (bi.id === ti.id) continue;
          const u = noeud(autreBout(bi, n.id));
          const v = noeud(autreBout(ti, n.id));
          if (!u || !v) continue;
          const ux = u.x - n.x;
          const uy = u.y - n.y;
          const vx = v.x - n.x;
          const vy = v.y - n.y;
          const den = Math.hypot(ux, uy) * Math.hypot(vx, vy);
          if (!(den > 0)) continue;
          const cos = (ux * vx + uy * vy) / den;
          let angle = (Math.acos(Math.max(-1, Math.min(1, cos))) * 180) / Math.PI;
          if (angle > 90) angle = 180 - angle;
          const e = versEcran(n, vue);
          parts.push(
            `<text data-angle="${echapper(n.id)}|${echapper(bi.id)}|${echapper(ti.id)}" ` +
              `class="angle" x="${px(e.x + 8)}" y="${px(e.y - 8)}">` +
              `θ = ${nombreAffiche(angle, 1)}°</text>`,
          );
        }
      }
    }
  }

  // Appuis.
  for (const n of m.noeuds) {
    if (!n.isSupport) continue;
    const e = versEcran(n, vue);
    const t = 8;
    const triangle = `${px(e.x - t)},${px(e.y + t)} ${px(e.x + t)},${px(e.y + t)} ${px(e.x)},${px(e.y)}`;
    parts.push(`<g data-appui="${echapper(n.id)}" class="appui"><polygon points="${triangle}"/></g>`);
  }

  // Charges appliquees.
  for (const n of m.noeuds) {
    const fx = n.fx ?? 0;
    const fy = n.fy ?? 0;
    const valeur = Math.hypot(fx, fy);
    if (!(valeur > 0)) continue;
    const e = versEcran(n, vue);
    const longueur = 30;
    const sx = e.x - (fx / valeur) * longueur;
    const sy = e.y + (fy / valeur) * longueur;
    parts.push(
      `<g data-charge="${echapper(n.id)}" class="charge">` +
        `<line x1="${px(sx)}" y1="${px(sy)}" x2="${px(e.x)}" y2="${px(e.y)}"/>` +
        `<text x="${px(sx)}" y="${px(sy - 6)}" text-anchor="middle">` +
        `${echapper(nombreAffiche(valeur, 1))} kN</text>` +
        `</g>`,
    );
  }

  // Noeuds, au-dessus de tout le reste.
  for (const n of m.noeuds) {
    const e = versEcran(n, vue);
    parts.push(
      `<circle data-noeud="${echapper(n.id)}" class="${classe('noeud', estChoisi('noeud', n.id))}" ` +
        `cx="${px(e.x)}" cy="${px(e.y)}" r="4"/>`,
    );
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${o.largeur} ${o.hauteur}" ` +
    `role="img" aria-label="${echapper(textes().dessin.aria(phrase(m.nom)))}">` +
    `${parts.join('')}</svg>`
  );
}
