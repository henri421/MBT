/**
 * Note de calcul MBT : mise en forme d'un ModeleMbt et d'un SolverResult au
 * format commun d'aedificium-ui. Module PUR, sans dependance a React.
 */

import type {
  BlocResultat,
  ElementNote,
  NoteDeCalcul,
  VerificationNote,
} from 'aedificium-ui';
import type { SolverResult } from '../../src/index';
import type { ModeleMbt } from './modele';
import { libelleAppui } from './form';
import { phrase, textes } from './textes';
import {
  tableauBielles,
  tableauNoeuds,
  tableauReactions,
  tableauTirants,
  verdictsDuCalcul,
} from './vue';

/** Hypotheses de la note, en francais (les tests les lisent). */
export const HYPOTHESES: readonly string[] = textes().note.hypotheses;

/** Affichage sobre d'une valeur numerique, sans notation exponentielle inutile. */
function nombre(valeur: number): string {
  return Number.isFinite(valeur) ? String(valeur) : '—';
}

export function noteDuCalcul(
  m: ModeleMbt,
  r: SolverResult,
  cartouche: { projet: string; element: string; date: string },
  dessin: string,
): NoteDeCalcul {
  const t = textes();
  const nom = phrase(m.nom);
  const troisD = m.dimension === '3D';
  const verdicts = verdictsDuCalcul(r);
  const equilibre = verdicts.find((v) => v.famille === 'equilibre');
  const motif = equilibre?.motif ?? phrase(r.message ?? '');
  const instable = !r.success || !r.isStable;

  // Geometrie : epaisseur du beton, noeuds, puis le dessin de la page.
  const lignesBeton = [
    { symbole: 'b_w', libelle: t.note.epaisseur, valeur: `${nombre(m.beton.thickness)} m` },
  ];
  const blocBeton: BlocResultat = { titre: t.note.beton, lignes: lignesBeton, note: null };
  const entetesNoeuds = [t.tableaux.noeud, 'x (m)', 'y (m)', ...(troisD ? ['z (m)'] : [])];
  const lignesNoeuds = m.noeuds.map((n) => [
    n.id,
    nombre(n.x),
    nombre(n.y),
    ...(troisD ? [nombre(n.z ?? 0)] : []),
  ]);
  const geometrie: ElementNote[] = [
    { type: 'bloc', bloc: blocBeton },
    { type: 'tableau', titre: t.tableaux.noeuds, entetes: entetesNoeuds, lignes: lignesNoeuds },
    { type: 'figure', svg: dessin, legende: nom },
  ];

  // Materiaux : les cinq symboles du §6.5, dans l'ordre du plan.
  const lignesMateriaux = [
    { symbole: 'f_ck', libelle: t.note.fck, valeur: `${nombre(m.materiauBeton.fck)} MPa` },
    { symbole: 'γ_c', libelle: t.note.gammaC, valeur: nombre(m.materiauBeton.gammaC) },
    { symbole: 'α_cc', libelle: t.note.alphaCc, valeur: nombre(m.materiauBeton.alphaCc) },
    { symbole: 'f_yk', libelle: t.note.fyk, valeur: `${nombre(m.acier.fyk)} MPa` },
    { symbole: 'γ_s', libelle: t.note.gammaS, valeur: nombre(m.acier.gammaS) },
  ];
  const blocMateriaux: BlocResultat = { titre: t.note.materiaux, lignes: lignesMateriaux, note: null };
  const materiaux: ElementNote[] = [{ type: 'bloc', bloc: blocMateriaux }];

  const hypotheses: ElementNote[] = [{ type: 'liste', items: [...t.note.hypotheses] }];

  // Charges : forces non nulles puis appuis.
  const chargesNoeuds = m.noeuds.filter(
    (n) => (n.fx ?? 0) !== 0 || (n.fy ?? 0) !== 0 || (n.fz ?? 0) !== 0,
  );
  const entetesForces = [t.tableaux.noeud, 'F_x (kN)', 'F_y (kN)', ...(troisD ? ['F_z (kN)'] : [])];
  const lignesForces = chargesNoeuds.map((n) => [
    n.id,
    nombre(n.fx ?? 0),
    nombre(n.fy ?? 0),
    ...(troisD ? [nombre(n.fz ?? 0)] : []),
  ]);
  const appuis = m.noeuds.filter((n) => n.isSupport);
  const charges: ElementNote[] = [
    { type: 'tableau', titre: t.note.forces, entetes: entetesForces, lignes: lignesForces },
    { type: 'tableau', titre: t.note.appuis, entetes: [t.tableaux.noeud, t.tableaux.type], lignes: appuis.map((n) => [n.id, libelleAppui(n.supportType ?? 'pin')]) },
  ];

  // Calculs : les tableaux des volets, sans ceux qui sont vides.
  const tableaux = [tableauBielles(m, r), tableauTirants(m, r), tableauNoeuds(m, r), tableauReactions(m, r)]
    .filter((t) => t.lignes.length > 0);
  const calculs: ElementNote[] = instable
    ? [{ type: 'texte', texte: motif }]
    : tableaux.map((tab): ElementNote => ({
        type: 'tableau',
        titre: tab.clause ? `${tab.titre} (${tab.clause})` : tab.titre,
        entetes: tab.entetes,
        lignes: tab.lignes,
      }));

  // Verifications : barres, noeuds, pressions localisees, puis equilibre.
  const verifications: VerificationNote[] = [];
  if (instable) {
    verifications.push({ nom: t.verdicts.equilibre, taux: null, ok: false });
  } else {
    for (const b of m.barres) {
      const res = r.memberResults.get(b.id);
      if (!res) continue;
      verifications.push({
        nom: `${res.isCompression ? t.note.bielle : t.note.tirant} ${b.id}`,
        clause: res.isCompression ? t.clauses.bielles : t.clauses.tirants,
        taux: res.utilizationRatio,
        ok: res.utilizationRatio <= 1,
      });
    }
    for (const n of m.noeuds) {
      const res = r.nodeResults.get(n.id);
      if (!res) continue;
      verifications.push({
        nom: `${t.tableaux.noeud} ${n.id}`,
        clause: t.clauses.noeuds,
        taux: res.bearingUtilization,
        ok: res.bearingUtilization <= 1,
      });
    }
    for (const res of r.nodeResults.values()) {
      if (res.localBearingUtilization === undefined) continue;
      verifications.push({
        nom: `${t.note.pression} ${res.nodeId}`,
        clause: t.clauses.pressions,
        taux: res.localBearingUtilization,
        ok: res.localBearingUtilization <= 1,
      });
    }
    verifications.push({ nom: t.verdicts.equilibre, taux: null, ok: equilibre?.etat === 'ok' });
  }

  return {
    cartouche: {
      projet: cartouche.projet,
      element: cartouche.element.trim() || nom,
      date: cartouche.date,
      norme: t.note.norme,
      outil: t.note.outil,
    },
    sections: { geometrie, materiaux, hypotheses, charges, calculs },
    verifications,
    avertissements: instable ? [motif] : [],
  };
}
