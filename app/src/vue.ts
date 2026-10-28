/**
 * Vue du calcul MBT : verdicts par famille (colonne de droite) et tableaux des
 * volets sous le dessin. Module PUR, sans dependance a React, qui ne fait que
 * mettre en forme un SolverResult et un ModeleMbt.
 */

import { echapper, nombreAffiche, notationHtml, tauxAffiche } from 'aedificium-ui';
import type { SolverResult } from '../../src/index';
import type { ModeleMbt } from './modele';

export type EtatVerdict = 'ok' | 'alerte' | 'refus';

export interface VerdictFamille {
  famille: 'bielles' | 'tirants' | 'noeuds' | 'pressions' | 'equilibre';
  titre: string;
  clause: string;
  taux: number | null;
  element: string | null;
  etat: EtatVerdict;
  motif: string;
}

export interface Tableau {
  titre: string;
  clause: string;
  entetes: string[];
  lignes: string[][];
}

/** Premier element de taux maximal (le premier en cas d'egalite). */
function meilleur<T>(elements: T[], taux: (x: T) => number): T | undefined {
  let best: T | undefined;
  for (const x of elements) {
    if (best === undefined || taux(x) > taux(best)) best = x;
  }
  return best;
}

function etatDeTaux(taux: number): EtatVerdict {
  return taux <= 1 ? 'ok' : 'refus';
}

export function verdictsDuCalcul(r: SolverResult): VerdictFamille[] {
  if (!r.success || !r.isStable) {
    return [{
      famille: 'equilibre',
      titre: 'Équilibre',
      clause: '',
      taux: null,
      element: null,
      etat: 'refus',
      motif: r.message || "Treillis instable : le calcul n'a pas abouti.",
    }];
  }

  const verdicts: VerdictFamille[] = [];
  const membres = [...r.memberResults.values()];

  const bielles = membres.filter((m) => m.isCompression);
  if (bielles.length > 0) {
    const b = meilleur(bielles, (m) => m.utilizationRatio)!;
    verdicts.push({
      famille: 'bielles', titre: 'Bielles', clause: '§6.5.2',
      taux: b.utilizationRatio, element: b.memberId,
      etat: etatDeTaux(b.utilizationRatio), motif: b.memberId,
    });
  }

  const tirants = membres.filter((m) => !m.isCompression);
  if (tirants.length > 0) {
    const t = meilleur(tirants, (m) => m.utilizationRatio)!;
    verdicts.push({
      famille: 'tirants', titre: 'Tirants', clause: '§6.5.3',
      taux: t.utilizationRatio, element: t.memberId,
      etat: etatDeTaux(t.utilizationRatio), motif: t.memberId,
    });
  }

  const noeuds = [...r.nodeResults.values()];
  if (noeuds.length > 0) {
    const n = meilleur(noeuds, (x) => x.bearingUtilization)!;
    verdicts.push({
      famille: 'noeuds', titre: 'Nœuds', clause: '§6.5.4',
      taux: n.bearingUtilization, element: n.nodeId,
      etat: etatDeTaux(n.bearingUtilization), motif: n.nodeId,
    });
  }

  const pressions = noeuds.filter((n) => n.localBearingUtilization !== undefined);
  if (pressions.length > 0) {
    const n = meilleur(pressions, (x) => x.localBearingUtilization as number)!;
    verdicts.push({
      famille: 'pressions', titre: 'Pressions localisées', clause: '§6.7',
      taux: n.localBearingUtilization as number, element: n.nodeId,
      etat: etatDeTaux(n.localBearingUtilization as number), motif: n.nodeId,
    });
  }

  let residu = 0;
  for (const n of noeuds) residu = Math.max(residu, Math.abs(n.equilibriumResidual));
  verdicts.push({
    famille: 'equilibre', titre: 'Équilibre', clause: '',
    taux: null, element: null,
    etat: residu <= 0.01 ? 'ok' : 'alerte',
    motif: `Treillis stable, résidu ${nombreAffiche(residu)} kN`,
  });

  return verdicts;
}

export function verdictsHtml(v: readonly VerdictFamille[]): string {
  return v.map((verdict) => {
    const element = verdict.element === null ? '' : ` data-element="${echapper(verdict.element)}"`;
    const titre = `<h3>${echapper(verdict.titre)} <span class="clause">${echapper(verdict.clause)}</span></h3>`;
    let jauge = '';
    if (verdict.taux !== null) {
      const pourcent = Math.round(Math.min(100, verdict.taux * 100));
      jauge = `<div class="jauge"><i style="width:${pourcent}%"></i></div><span class="taux">${echapper(tauxAffiche(verdict.taux))}</span>`;
    }
    return `<div class="verdict ${verdict.etat}"${element}>${titre}${jauge}<p>${echapper(verdict.motif)}</p></div>`;
  }).join('');
}

function nombreOuTiret(x: number | undefined): string {
  return x === undefined ? '—' : nombreAffiche(x);
}

export function tableauBielles(m: ModeleMbt, r: SolverResult): Tableau {
  const lignes: string[][] = [];
  for (const b of m.barres) {
    const membre = r.memberResults.get(b.id);
    if (!membre || !membre.isCompression) continue;
    lignes.push([
      b.id,
      `${b.fromNodeId} → ${b.toNodeId}`,
      nombreAffiche(Math.abs(membre.force)),
      nombreAffiche(membre.designStressLimit),
      nombreAffiche(membre.effectiveWidthRequired),
      nombreOuTiret(membre.effectiveWidthActual),
      tauxAffiche(membre.utilizationRatio),
    ]);
  }
  return {
    titre: 'Bielles',
    clause: '§6.5.2',
    entetes: ['Barre', 'Nœuds', 'F_Ed (kN)', 'σ_Rd,max (MPa)', 'w requise (mm)', 'w (mm)', 'Taux'],
    lignes,
  };
}

export function tableauTirants(m: ModeleMbt, r: SolverResult): Tableau {
  const lignes: string[][] = [];
  for (const b of m.barres) {
    const membre = r.memberResults.get(b.id);
    if (!membre || membre.isCompression) continue;
    lignes.push([
      b.id,
      `${b.fromNodeId} → ${b.toNodeId}`,
      nombreAffiche(Math.abs(membre.force)),
      nombreOuTiret(membre.requiredAs),
      nombreOuTiret(membre.providedAs),
      membre.suggestedRebar ?? '—',
      nombreOuTiret(membre.anchorageLengthMm),
      tauxAffiche(membre.utilizationRatio),
    ]);
  }
  return {
    titre: 'Tirants',
    clause: '§6.5.3',
    entetes: ['Barre', 'Nœuds', 'F_Ed (kN)', 'A_s,req (cm²)', 'A_s (cm²)', 'Armatures', 'l_bd (mm)', 'Taux'],
    lignes,
  };
}

export function tableauNoeuds(m: ModeleMbt, r: SolverResult): Tableau {
  const lignes: string[][] = [];
  for (const n of m.noeuds) {
    const noeud = r.nodeResults.get(n.id);
    if (!noeud) continue;
    lignes.push([
      noeud.nodeId,
      noeud.nodeType,
      nombreAffiche(noeud.bearingStress),
      nombreAffiche(noeud.designStressLimit),
      tauxAffiche(noeud.bearingUtilization),
    ]);
  }
  return {
    titre: 'Nœuds',
    clause: '§6.5.4',
    entetes: ['Nœud', 'Type', 'σ (MPa)', 'σ_Rd,max (MPa)', 'Taux'],
    lignes,
  };
}

export function tableauReactions(m: ModeleMbt, r: SolverResult): Tableau {
  const en3d = m.dimension === '3D';
  const lignes: string[][] = [];
  for (const n of m.noeuds) {
    if (!n.isSupport) continue;
    const noeud = r.nodeResults.get(n.id);
    if (!noeud) continue;
    const ligne = [noeud.nodeId, nombreAffiche(noeud.rx), nombreAffiche(noeud.ry)];
    if (en3d) ligne.push(nombreAffiche(noeud.rz));
    lignes.push(ligne);
  }
  const entetes = ['Nœud', 'R_x (kN)', 'R_y (kN)'];
  if (en3d) entetes.push('R_z (kN)');
  return { titre: "Réactions d'appui", clause: '', entetes, lignes };
}

export function tableauHtml(t: Tableau): string {
  const entetes = t.entetes.map((e) => `<th>${notationHtml(e)}</th>`).join('');
  const lignes = t.lignes
    .map((l) => `<tr>${l.map((c) => `<td>${echapper(c)}</td>`).join('')}</tr>`)
    .join('');
  return `<table><thead><tr>${entetes}</tr></thead><tbody>${lignes}</tbody></table>`;
}
