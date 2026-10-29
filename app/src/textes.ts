/**
 * Les textes affiches, en francais et en anglais. PUR.
 *
 * Deux sources :
 * - les textes de l'app (`FR`, `EN`), types : une cle oubliee en anglais ne
 *   compile pas ;
 * - les phrases du noyau (`src/`), ecrites en francais, traduites a
 *   l'affichage par `phrase` : titres des modeles, motifs d'instabilite,
 *   messages de l'optimiseur, armatures proposees, cotes.
 *
 * ⚠ Aucun texte ne se lit au chargement d'un module : toujours `textes()` ou
 * `phrase()` AU MOMENT DU RENDU, apres `definirLangue` (main.ts).
 */

import { langueCourante, traducteur } from 'aedificium-ui';

const FR = {
  verdicts: {
    bielles: 'Bielles',
    tirants: 'Tirants',
    noeuds: 'Nœuds',
    pressions: 'Pressions localisées',
    equilibre: 'Équilibre',
    instable: "Treillis instable : le calcul n'a pas abouti.",
    stable: (residu: string): string => `Treillis stable, résidu ${residu} kN`,
  },
  clauses: { bielles: '§6.5.2', tirants: '§6.5.3', noeuds: '§6.5.4', pressions: '§6.7' },
  tableaux: {
    barre: 'Barre',
    noeuds: 'Nœuds',
    noeud: 'Nœud',
    type: 'Type',
    taux: 'Taux',
    wRequise: 'w requise (mm)',
    armatures: 'Armatures',
    reactions: "Réactions d'appui",
  },
  note: {
    hypotheses: [
      'Le treillis est isostatique ou hyperstatique, résolu par la méthode des rigidités.',
      "Les coefficients k_1, k_2, k_3 et ν' du §6.5 sont pris à leurs valeurs recommandées.",
      "La géométrie du modèle est fixée par l'ingénieur.",
    ] as readonly string[],
    epaisseur: 'Épaisseur',
    beton: 'Béton',
    materiaux: 'Matériaux',
    fck: 'Résistance caractéristique du béton',
    gammaC: 'Coefficient partiel du béton',
    alphaCc: 'Coefficient de charge de longue durée',
    fyk: "Limite d'élasticité de l'acier",
    gammaS: "Coefficient partiel de l'acier",
    forces: 'Forces appliquées',
    appuis: 'Appuis',
    bielle: 'Bielle',
    tirant: 'Tirant',
    pression: 'Pression localisée',
    norme: 'EN 1992-1-1:2004, §6.5',
    outil: 'bielles et tirants',
  },
  saisie: {
    nombre: 'Valeur numérique attendue.',
    positif: 'Valeur strictement positive attendue.',
    choix: 'Choix inconnu.',
    champ: 'Champ inconnu.',
    appuis: {
      '': 'aucun',
      pin: 'appui simple',
      roller_x: 'rouleau x',
      roller_y: 'rouleau y',
      roller_z: 'rouleau z',
      fixed_3d: 'encastrement 3D',
    } as Record<string, string>,
    typesBarre: { strut: 'bielle', tie: 'tirant', auto: 'auto' } as Record<string, string>,
    oui: 'oui',
    non: 'non',
    plaque: 'Plaque (m)',
    typeNoeud: 'Type de nœud',
    fixe: 'Fixe (optimiseur)',
    traction: 'Traction transversale',
    largeur: 'Largeur (m)',
    epaisseur: 'Épaisseur (m)',
    diametre: 'Diamètre (mm)',
    elementChoisi: (id: string): string => `Élément choisi : ${id}`,
    barreHa: (d: string): string => `HA ${d}`,
  },
  dessin: { aria: (nom: string): string => `Dessin du modele : ${nom}` },
  vue3d: {
    beton: 'Volume Béton',
    betonTitre: 'Afficher/Masquer le volume de béton',
    zoomPlusTitre: 'Zoomer (+)',
    zoomMoinsTitre: 'Dézoomer (-)',
    rotation: 'Rotation',
    rotationTitre: 'Rotation automatique à 360°',
    recadrer: 'Recadrer',
    recadrerTitre: 'Recadrer la vue sur l’élément',
  },
  page: {
    aimante: (n: string): string => ` · aimanté sur ${n}`,
    optimisationIntro: "Déplace les nœuds libres pour réduire l'énergie du treillis.",
    optimiser: 'Optimiser (Schlaich)',
    energie: (avant: string, apres: string, reduction: string, iterations: number): string =>
      `Énergie de déformation : ${avant} → ${apres} J (−${reduction} %), ${iterations} itérations.`,
    appliquer: 'Appliquer',
    annuler: 'Annuler',
    optimisationImpossible: (motif: string): string => `Optimisation impossible : ${motif}`,
    appliquees: 'Positions optimisées appliquées.',
  },
  fichier: {
    illisible: "Fichier illisible : ce n'est pas du JSON.",
    pasUnModele: "Ce fichier n'est pas un modèle bielles-tirants.",
    noeud: 'Fichier incomplet : un nœud est mal décrit.',
    barre: 'Fichier incomplet : une barre relie un nœud absent.',
    contour: 'Contour ou épaisseur du béton invalide.',
    materiau: 'Fichier incomplet : un matériau est mal décrit.',
    importe: 'Modèle importé',
  },
  messages: {
    nouvelleVersion: 'Une nouvelle version est disponible. Recharger maintenant ?',
    elementAbsent: (role: string): string => `Élément [data-role="${role}"] introuvable dans la page.`,
  },
};

type Textes = typeof FR;

const EN: Textes = {
  verdicts: {
    bielles: 'Struts',
    tirants: 'Ties',
    noeuds: 'Nodes',
    pressions: 'Partially loaded areas',
    equilibre: 'Equilibrium',
    instable: 'Unstable truss: the calculation did not converge.',
    stable: (residu) => `Stable truss, residual ${residu} kN`,
  },
  clauses: { bielles: '6.5.2', tirants: '6.5.3', noeuds: '6.5.4', pressions: '6.7' },
  tableaux: {
    barre: 'Bar',
    noeuds: 'Nodes',
    noeud: 'Node',
    type: 'Type',
    taux: 'Ratio',
    wRequise: 'required w (mm)',
    armatures: 'Reinforcement',
    reactions: 'Support reactions',
  },
  note: {
    hypotheses: [
      'The truss is statically determinate or indeterminate, solved by the stiffness method.',
      "The factors k_1, k_2, k_3 and ν' of 6.5 take their recommended values.",
      'The geometry of the model is set by the engineer.',
    ],
    epaisseur: 'Thickness',
    beton: 'Concrete',
    materiaux: 'Materials',
    fck: 'Characteristic strength of the concrete',
    gammaC: 'Partial factor for concrete',
    alphaCc: 'Coefficient for long-term effects',
    fyk: 'Yield strength of the steel',
    gammaS: 'Partial factor for steel',
    forces: 'Applied forces',
    appuis: 'Supports',
    bielle: 'Strut',
    tirant: 'Tie',
    pression: 'Partially loaded area',
    norme: 'EN 1992-1-1:2004, 6.5',
    outil: 'strut-and-tie',
  },
  saisie: {
    nombre: 'Numerical value expected.',
    positif: 'Strictly positive value expected.',
    choix: 'Unknown choice.',
    champ: 'Unknown field.',
    appuis: {
      '': 'none',
      pin: 'pinned support',
      roller_x: 'roller x',
      roller_y: 'roller y',
      roller_z: 'roller z',
      fixed_3d: '3D fixed support',
    },
    typesBarre: { strut: 'strut', tie: 'tie', auto: 'auto' },
    oui: 'yes',
    non: 'no',
    plaque: 'Plate (m)',
    typeNoeud: 'Node type',
    fixe: 'Fixed (optimiser)',
    traction: 'Transverse tension',
    largeur: 'Width (m)',
    epaisseur: 'Thickness (m)',
    diametre: 'Diameter (mm)',
    elementChoisi: (id) => `Selected element: ${id}`,
    barreHa: (d) => `H${d}`,
  },
  dessin: { aria: (nom) => `Drawing of the model: ${nom}` },
  vue3d: {
    beton: 'Concrete volume',
    betonTitre: 'Show/hide the concrete volume',
    zoomPlusTitre: 'Zoom in (+)',
    zoomMoinsTitre: 'Zoom out (-)',
    rotation: 'Rotate',
    rotationTitre: 'Automatic 360° rotation',
    recadrer: 'Fit',
    recadrerTitre: 'Fit the view to the element',
  },
  page: {
    aimante: (n) => ` · snapped to ${n}`,
    optimisationIntro: 'Moves the free nodes to reduce the strain energy of the truss.',
    optimiser: 'Optimise (Schlaich)',
    energie: (avant, apres, reduction, iterations) =>
      `Strain energy: ${avant} → ${apres} J (−${reduction} %), ${iterations} iterations.`,
    appliquer: 'Apply',
    annuler: 'Cancel',
    optimisationImpossible: (motif) => `Optimisation impossible: ${motif}`,
    appliquees: 'Optimised positions applied.',
  },
  fichier: {
    illisible: 'Unreadable file: this is not JSON.',
    pasUnModele: 'This file is not a strut-and-tie model.',
    noeud: 'Incomplete file: a node is badly described.',
    barre: 'Incomplete file: a bar connects a missing node.',
    contour: 'Invalid concrete outline or thickness.',
    materiau: 'Incomplete file: a material is badly described.',
    importe: 'Imported model',
  },
  messages: {
    nouvelleVersion: 'A new version is available. Reload now?',
    elementAbsent: (role) => `Element [data-role="${role}"] not found in the page.`,
  },
};

export function textes(): Textes {
  return langueCourante() === 'en' ? EN : FR;
}

/** Causes d'instabilite d'un noeud, ecrites par le solveur. */
const RAISONS: Record<string, string> = {
  'aucun membre connecté': 'no connected member',
  "la seule barre connectée est verticale (dx = 0) et l'appui glisse en X": 'the only connected bar is vertical (dx = 0) and the support slides in X',
  'rigidité axiale nulle selon cet axe': 'zero axial stiffness along this axis',
  'degré de liberté non repris': 'unrestrained degree of freedom',
};

const EXACTES: Record<string, string> = {
  // Titres des modeles de depart.
  'Console Courte sur Poteau (Corbel EC2)': 'Short corbel on a column (EC2)',
  'Semelle sur 2 Pieux': 'Pile cap on 2 piles',
  'Semelle sur 3 Pieux (3D)': 'Pile cap on 3 piles (3D)',
  'Semelle sur 4 Pieux (3D)': 'Pile cap on 4 piles (3D)',
  'Poutre-Cloison (Deep Beam)': 'Deep beam',
  'Poutre-Cloison avec Excentricité': 'Deep beam with an eccentric load',
  "About d'Entaille (Dapped-End Beam)": 'Dapped-end beam',
  'Poutre-Cloison avec Trémie (EC2 §9.7)': 'Deep beam with an opening (EC2 9.7)',
  "Nœud d'Angle de Portique (EC2 Annexe J)": 'Frame corner joint (EC2 Annex J)',
  'Modèle 2D Libre': 'Free 2D model',
  'Modèle importé': 'Imported model',
  // Solveur.
  'Le modèle doit comporter au moins 2 nœuds et 1 barre.': 'The model must have at least 2 nodes and 1 bar.',
  'Tous les nœuds sont bloqués. Aucune résolution possible.': 'All nodes are restrained. No solution possible.',
  'Système instable ou mécanisme cinématique détecté (matrice de rigidité singulière).':
    'Unstable system or kinematic mechanism detected (singular stiffness matrix).',
  'Résolution par éléments finis du treillis réussie. Équilibre nodal vérifié.': 'Finite element solution of the truss succeeded. Nodal equilibrium checked.',
  // Optimiseur.
  "Le modèle initial ne se résout pas (treillis instable) : il n'y a pas d'énergie à minimiser. Corriger la triangulation d'abord.":
    'The initial model cannot be solved (unstable truss): there is no energy to minimise. Correct the triangulation first.',
  "Aucun nœud libre et non chargé : appuis, points de charge et nœuds verrouillés ne sont jamais déplacés, il n'y a donc rien à optimiser.":
    'No free, unloaded node: supports, load points and locked nodes are never moved, so there is nothing to optimise.',
  '> 8 HA 32 (Forte nappe)': '> 8 H32 (heavy layer)',
};

/**
 * Traduit une phrase du noyau (titres, motifs, armatures, cotes).
 * En francais, la phrase sort intacte.
 */
export const phrase = traducteur(EXACTES, [
  [
    /^Conditions d'appui insuffisantes \((\d+) bloquages trouvés, minimum (\d+) requis pour empêcher les mouvements de corps rigide\)\.$/,
    'Insufficient support conditions ($1 restraints found, at least $2 required to prevent rigid-body motion).',
  ],
  [/^Instabilité détectée sur le nœud (.+) : (.+)\.$/, (_t, n: string, r: string) => `Instability detected at node ${n}: ${RAISONS[r] ?? r}.`],
  [
    /^Treillis sous-contraint : (\d+) barres pour (\d+) nœuds\. Il manque (\d+) barre\(s\) de triangulation\.$/,
    'Under-constrained truss: $1 bars for $2 nodes. $3 triangulation bar(s) missing.',
  ],
  [/^(\d+) HA (\d+)( \(.+\))?$/, '$1 H$2$3'],
  [/^L_appuis = (.+)$/, 'Span = $1'],
]);
