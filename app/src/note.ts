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
import { LIBELLES_APPUI } from './form';

const LIBELLE_APPUI = new Map(LIBELLES_APPUI);
import {
  tableauBielles,
  tableauNoeuds,
  tableauReactions,
  tableauTirants,
  verdictsDuCalcul,
} from './vue';

export const HYPOTHESES: readonly string[] = [
  'Le treillis est isostatique ou hyperstatique, résolu par la méthode des rigidités.',
  "Les coefficients k_1, k_2, k_3 et ν' du §6.5 sont pris à leurs valeurs recommandées.",
  "La géométrie du modèle est fixée par l'ingénieur.",
];

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
  const troisD = m.dimension === '3D';
  const verdicts = verdictsDuCalcul(r);
  const equilibre = verdicts.find((v) => v.famille === 'equilibre');
  const motif = equilibre?.motif ?? r.message;
  const instable = !r.success || !r.isStable;

  // Geometrie : epaisseur du beton, noeuds, puis le dessin de la page.
  const lignesBeton = [
    { symbole: 'b_w', libelle: 'Épaisseur', valeur: `${nombre(m.beton.thickness)} m` },
  ];
  const blocBeton: BlocResultat = { titre: 'Béton', lignes: lignesBeton, note: null };
  const entetesNoeuds = ['Nœud', 'x (m)', 'y (m)', ...(troisD ? ['z (m)'] : [])];
  const lignesNoeuds = m.noeuds.map((n) => [
    n.id,
    nombre(n.x),
    nombre(n.y),
    ...(troisD ? [nombre(n.z ?? 0)] : []),
  ]);
  const geometrie: ElementNote[] = [
    { type: 'bloc', bloc: blocBeton },
    { type: 'tableau', titre: 'Nœuds', entetes: entetesNoeuds, lignes: lignesNoeuds },
    { type: 'figure', svg: dessin, legende: m.nom },
  ];

  // Materiaux : les cinq symboles du §6.5, dans l'ordre du plan.
  const lignesMateriaux = [
    { symbole: 'f_ck', libelle: 'Résistance caractéristique du béton', valeur: `${nombre(m.materiauBeton.fck)} MPa` },
    { symbole: 'γ_c', libelle: 'Coefficient partiel du béton', valeur: nombre(m.materiauBeton.gammaC) },
    { symbole: 'α_cc', libelle: 'Coefficient de charge de longue durée', valeur: nombre(m.materiauBeton.alphaCc) },
    { symbole: 'f_yk', libelle: "Limite d'élasticité de l'acier", valeur: `${nombre(m.acier.fyk)} MPa` },
    { symbole: 'γ_s', libelle: "Coefficient partiel de l'acier", valeur: nombre(m.acier.gammaS) },
  ];
  const blocMateriaux: BlocResultat = { titre: 'Matériaux', lignes: lignesMateriaux, note: null };
  const materiaux: ElementNote[] = [{ type: 'bloc', bloc: blocMateriaux }];

  const hypotheses: ElementNote[] = [{ type: 'liste', items: [...HYPOTHESES] }];

  // Charges : forces non nulles puis appuis.
  const chargesNoeuds = m.noeuds.filter(
    (n) => (n.fx ?? 0) !== 0 || (n.fy ?? 0) !== 0 || (n.fz ?? 0) !== 0,
  );
  const entetesForces = ['Nœud', 'F_x (kN)', 'F_y (kN)', ...(troisD ? ['F_z (kN)'] : [])];
  const lignesForces = chargesNoeuds.map((n) => [
    n.id,
    nombre(n.fx ?? 0),
    nombre(n.fy ?? 0),
    ...(troisD ? [nombre(n.fz ?? 0)] : []),
  ]);
  const appuis = m.noeuds.filter((n) => n.isSupport);
  const charges: ElementNote[] = [
    { type: 'tableau', titre: 'Forces appliquées', entetes: entetesForces, lignes: lignesForces },
    { type: 'tableau', titre: 'Appuis', entetes: ['Nœud', 'Type'], lignes: appuis.map((n) => [n.id, LIBELLE_APPUI.get(n.supportType ?? 'pin') ?? String(n.supportType)]) },
  ];

  // Calculs : les tableaux des volets, sans ceux qui sont vides.
  const tableaux = [tableauBielles(m, r), tableauTirants(m, r), tableauNoeuds(m, r), tableauReactions(m, r)]
    .filter((t) => t.lignes.length > 0);
  const calculs: ElementNote[] = instable
    ? [{ type: 'texte', texte: motif }]
    : tableaux.map((t): ElementNote => ({
        type: 'tableau',
        titre: t.clause ? `${t.titre} (${t.clause})` : t.titre,
        entetes: t.entetes,
        lignes: t.lignes,
      }));

  // Verifications : barres, noeuds, pressions localisees, puis equilibre.
  const verifications: VerificationNote[] = [];
  if (instable) {
    verifications.push({ nom: 'Équilibre', taux: null, ok: false });
  } else {
    for (const b of m.barres) {
      const res = r.memberResults.get(b.id);
      if (!res) continue;
      verifications.push({
        nom: `${res.isCompression ? 'Bielle' : 'Tirant'} ${b.id}`,
        clause: res.isCompression ? '§6.5.2' : '§6.5.3',
        taux: res.utilizationRatio,
        ok: res.utilizationRatio <= 1,
      });
    }
    for (const n of m.noeuds) {
      const res = r.nodeResults.get(n.id);
      if (!res) continue;
      verifications.push({
        nom: `Nœud ${n.id}`,
        clause: '§6.5.4',
        taux: res.bearingUtilization,
        ok: res.bearingUtilization <= 1,
      });
    }
    for (const res of r.nodeResults.values()) {
      if (res.localBearingUtilization === undefined) continue;
      verifications.push({
        nom: `Pression localisée ${res.nodeId}`,
        clause: '§6.7',
        taux: res.localBearingUtilization,
        ok: res.localBearingUtilization <= 1,
      });
    }
    verifications.push({ nom: 'Équilibre', taux: null, ok: equilibre?.etat === 'ok' });
  }

  return {
    cartouche: {
      projet: cartouche.projet,
      element: cartouche.element.trim() || m.nom,
      date: cartouche.date,
      norme: 'EN 1992-1-1:2004, §6.5',
      outil: 'bielles et tirants',
    },
    sections: { geometrie, materiaux, hypotheses, charges, calculs },
    verifications,
    avertissements: instable ? [motif] : [],
  };
}
