import { ModelPreset } from '../types/stm';

export const PRESETS: ModelPreset[] = [
  {
    id: 'corbel',
    title: 'Console Courte sur Poteau (Corbel EC2)',
    subtitle: 'Eurocode 2 §J.3 - Rapport ac/d < 1.0, tirant ancré et bielle directe',
    dimension: '2D',
    description: 'Modèle réaliste conforme Eurocode 2 : transmission par bielle inclinée θ = 47.7°, tirant supérieur ancré dans le poteau avec enrobages respectés (aucun élément hors béton), et équilibre par ferraillage vertical arrière de poteau.',
    concrete: {
      name: 'Console Courte 45x70 cm sur Poteau 40x130 cm',
      thickness: 0.35, // 35 cm d'épaisseur
      points2D: [
        [0.0, 0.0],       // Base poteau gauche
        [0.40, 0.0],      // Base poteau droite
        [0.40, 0.15],     // Raccordement sous-face console au poteau
        [0.85, 0.50],     // Nez inférieur console
        [0.85, 0.85],     // Nez supérieur console
        [0.40, 0.85],     // Angle supérieur console-poteau
        [0.40, 1.30],     // Poteau supérieur droit
        [0.0, 1.30]       // Poteau supérieur gauche
      ]
    },
    concreteMat: {
      name: 'C30/37',
      fck: 30,
      gammaC: 1.5,
      alphaCc: 1.0,
      aggregateSize: 20
    },
    steelMat: {
      name: 'B500B',
      fyk: 500,
      gammaS: 1.15,
      Es: 200
    },
    nodes: [
      {
        id: 'N1',
        x: 0.65,
        y: 0.77,
        fx: 0,
        fy: -350, // Charge verticale 350 kN sur plaque de répartition 15x35 cm
        bearingWidth: 0.15,
        nodeType: 'CCC',
        isFixedInOpt: true
      },
      {
        id: 'N2',
        x: 0.08,
        y: 0.77,
        bearingWidth: 0.20,
        nodeType: 'CCT',
        isFixedInOpt: false
      },
      {
        id: 'N3',
        x: 0.35,
        y: 0.22,
        bearingWidth: 0.20,
        nodeType: 'CCC',
        isFixedInOpt: false
      },
      {
        id: 'N4',
        x: 0.08,
        y: 0.08,
        isSupport: true,
        supportType: 'roller_x',
        bearingWidth: 0.20,
        nodeType: 'CCT',
        isFixedInOpt: true,
        isBlockedNearSupport: true
      },
      {
        id: 'N5',
        x: 0.35,
        y: 0.08,
        isSupport: true,
        supportType: 'pin',
        bearingWidth: 0.20,
        nodeType: 'CCC',
        isFixedInOpt: true,
        isBlockedNearSupport: true
      }
    ],
    members: [
      {
        id: 'M_tie_top',
        fromNodeId: 'N1',
        toNodeId: 'N2',
        type: 'tie',
        barDiameter: 25 // Tirant supérieur principal dans le béton
      },
      {
        id: 'M_strut_main',
        fromNodeId: 'N1',
        toNodeId: 'N3',
        type: 'strut',
        hasTransverseTension: false,
        effectiveWidth: 0.22 // Bielle comprimée principale θ = 47.7°
      },
      {
        id: 'M_col_back_vert',
        fromNodeId: 'N2',
        toNodeId: 'N4',
        type: 'tie',
        barDiameter: 25 // Armature verticale arrière de poteau (reprise moment renversement)
      },
      {
        id: 'M_col_front_vert',
        fromNodeId: 'N3',
        toNodeId: 'N5',
        type: 'strut',
        hasTransverseTension: false,
        effectiveWidth: 0.25 // Descente de charge comprimée en pied de poteau
      },
      {
        id: 'M_col_diag_inner',
        fromNodeId: 'N2',
        toNodeId: 'N3',
        type: 'strut',
        hasTransverseTension: true,
        effectiveWidth: 0.20
      },
      {
        id: 'M_col_diag_bot',
        fromNodeId: 'N2',
        toNodeId: 'N5',
        type: 'strut',
        hasTransverseTension: true,
        effectiveWidth: 0.20
      },
      {
        id: 'M_col_bot_link',
        fromNodeId: 'N4',
        toNodeId: 'N5',
        type: 'tie',
        barDiameter: 20
      }
    ]
  },
  {
    id: 'corbel_on_beam',
    title: 'Console Courte sur Poutre (Suspension)',
    subtitle: 'Eurocode 2 §J.3 - Reprise indirecte par étriers verticaux de suspension',
    dimension: '2D',
    description: 'Console greffée sur le flanc d’une poutre : la charge appliquée sur la console crée un effort tranchant indirect qui doit être obligatoirement suspendu en tête de poutre par des étriers verticaux avant de se transmettre vers l’appui droit.',
    concrete: {
      name: 'Poutre 3.20x1.20 m avec Console 60x55 cm',
      thickness: 0.35,
      points2D: [
        [0.0, 0.20],   // Nez inférieur console
        [0.60, 0.20],  // Angle console-poutre bas
        [0.60, 0.0],   // Sous-face poutre gauche
        [3.20, 0.0],   // Sous-face poutre droite
        [3.20, 1.20],  // Face supérieure poutre droite
        [0.60, 1.20],  // Face supérieure poutre gauche
        [0.60, 0.75],  // Raccordement haut console
        [0.0, 0.75]    // Nez supérieur console
      ]
    },
    concreteMat: {
      name: 'C30/37',
      fck: 30,
      gammaC: 1.5,
      alphaCc: 1.0,
      aggregateSize: 20
    },
    steelMat: {
      name: 'B500B',
      fyk: 500,
      gammaS: 1.15,
      Es: 200
    },
    nodes: [
      {
        id: 'N_Corb_Load',
        x: 0.25,
        y: 0.65,
        fx: 0,
        fy: -350, // Charge 350 kN sur console
        bearingWidth: 0.15,
        nodeType: 'CCC',
        isFixedInOpt: true
      },
      {
        id: 'N_Corb_Tie',
        x: 0.75,
        y: 0.65,
        bearingWidth: 0.20,
        nodeType: 'CCT',
        isFixedInOpt: false
      },
      {
        id: 'N_Corb_Root',
        x: 0.65,
        y: 0.25,
        bearingWidth: 0.20,
        nodeType: 'CCC',
        isFixedInOpt: false
      },
      {
        id: 'N_Susp_Top',
        x: 0.75,
        y: 1.08,
        bearingWidth: 0.25,
        nodeType: 'CCT',
        isFixedInOpt: false
      },
      {
        id: 'N_Beam_Bot_Left',
        x: 0.75,
        y: 0.16,
        isSupport: true,
        supportType: 'pin',
        bearingWidth: 0.25,
        nodeType: 'CCT',
        isFixedInOpt: true,
        isBlockedNearSupport: true
      },
      {
        id: 'N_Beam_Top_Mid',
        x: 1.90,
        y: 1.08,
        bearingWidth: 0.25,
        nodeType: 'CCC',
        isFixedInOpt: false
      },
      {
        id: 'N_Beam_Bot_Mid',
        x: 1.90,
        y: 0.16,
        bearingWidth: 0.20,
        nodeType: 'CCT',
        isFixedInOpt: false
      },
      {
        id: 'N_Beam_Bot_Right',
        x: 2.95,
        y: 0.16,
        isSupport: true,
        supportType: 'roller_x',
        bearingWidth: 0.25,
        nodeType: 'CCT',
        isFixedInOpt: true,
        isBlockedNearSupport: true
      }
    ],
    members: [
      {
        id: 'M_corb_tie',
        fromNodeId: 'N_Corb_Load',
        toNodeId: 'N_Corb_Tie',
        type: 'tie',
        barDiameter: 25
      },
      {
        id: 'M_corb_strut',
        fromNodeId: 'N_Corb_Load',
        toNodeId: 'N_Corb_Root',
        type: 'strut',
        hasTransverseTension: false,
        effectiveWidth: 0.20
      },
      {
        id: 'M_corb_root_diag',
        fromNodeId: 'N_Corb_Root',
        toNodeId: 'N_Corb_Tie',
        type: 'strut',
        hasTransverseTension: true,
        effectiveWidth: 0.18
      },
      {
        id: 'M_corb_root_down',
        fromNodeId: 'N_Corb_Root',
        toNodeId: 'N_Beam_Bot_Left',
        type: 'strut',
        hasTransverseTension: false,
        effectiveWidth: 0.22
      },
      {
        id: 'M_susp_tie_vert',
        fromNodeId: 'N_Beam_Bot_Left',
        toNodeId: 'N_Susp_Top',
        type: 'tie',
        barDiameter: 25 // Étriers verticaux majeurs de suspension
      },
      {
        id: 'M_susp_link',
        fromNodeId: 'N_Corb_Tie',
        toNodeId: 'N_Susp_Top',
        type: 'tie',
        barDiameter: 20
      },
      {
        id: 'M_beam_top_chord',
        fromNodeId: 'N_Susp_Top',
        toNodeId: 'N_Beam_Top_Mid',
        type: 'strut',
        hasTransverseTension: false,
        effectiveWidth: 0.25
      },
      {
        id: 'M_beam_diag_mid',
        fromNodeId: 'N_Susp_Top',
        toNodeId: 'N_Beam_Bot_Mid',
        type: 'strut',
        hasTransverseTension: true,
        effectiveWidth: 0.20
      },
      {
        id: 'M_beam_vert_mid',
        fromNodeId: 'N_Beam_Top_Mid',
        toNodeId: 'N_Beam_Bot_Mid',
        type: 'strut',
        hasTransverseTension: true,
        effectiveWidth: 0.18
      },
      {
        id: 'M_beam_diag_right',
        fromNodeId: 'N_Beam_Top_Mid',
        toNodeId: 'N_Beam_Bot_Right',
        type: 'strut',
        hasTransverseTension: false,
        effectiveWidth: 0.22
      },
      {
        id: 'M_beam_bot_tie1',
        fromNodeId: 'N_Beam_Bot_Left',
        toNodeId: 'N_Beam_Bot_Mid',
        type: 'tie',
        barDiameter: 25
      },
      {
        id: 'M_beam_bot_tie2',
        fromNodeId: 'N_Beam_Bot_Mid',
        toNodeId: 'N_Beam_Bot_Right',
        type: 'tie',
        barDiameter: 25
      }
    ]
  },
  {
    id: 'pile_cap_2_piles',
    title: 'Semelle sur 2 Pieux',
    subtitle: 'Eurocode 2 §J.3 & Fascicule 62 - Bielle directe en V et tirant inférieur',
    dimension: '2D',
    description: 'Massif de fondation rigide transmettant une charge axiale de poteau de 1000 kN vers 2 pieux écartés de 1.40 m. Les deux bielles inclinées compriment le béton et induisent une traction pure dans le tirant principal en nappe basse.',
    concrete: {
      name: 'Semelle 2 Pieux 2.40 x 0.90 m (Ep. 55 cm)',
      thickness: 0.55,
      points2D: [
        [0.0, 0.0],
        [2.40, 0.0],
        [2.40, 0.90],
        [0.0, 0.90]
      ]
    },
    concreteMat: {
      name: 'C30/37',
      fck: 30,
      gammaC: 1.5,
      alphaCc: 1.0,
      aggregateSize: 20
    },
    steelMat: {
      name: 'B500B',
      fyk: 500,
      gammaS: 1.15,
      Es: 200
    },
    nodes: [
      {
        id: 'N_Col',
        x: 1.20,
        y: 0.78,
        fx: 0,
        fy: -1000, // 1000 kN axiale
        bearingWidth: 0.40,
        bearingDepth: 0.40,
        nodeType: 'CCC',
        isFixedInOpt: true
      },
      {
        id: 'N_Pile1',
        x: 0.50,
        y: 0.16,
        isSupport: true,
        supportType: 'pin',
        bearingShape: 'circular',
        bearingDiameter: 0.40,
        bearingWidth: 0.40,
        nodeType: 'CCT',
        isFixedInOpt: true,
        isBlockedNearSupport: false
      },
      {
        id: 'N_Pile2',
        x: 1.90,
        y: 0.16,
        isSupport: true,
        supportType: 'roller_x',
        bearingShape: 'circular',
        bearingDiameter: 0.40,
        bearingWidth: 0.40,
        nodeType: 'CCT',
        isFixedInOpt: true,
        isBlockedNearSupport: false
      }
    ],
    members: [
      {
        id: 'M_Strut_P1',
        fromNodeId: 'N_Col',
        toNodeId: 'N_Pile1',
        type: 'strut',
        hasTransverseTension: false,
        effectiveWidth: 0.28
      },
      {
        id: 'M_Strut_P2',
        fromNodeId: 'N_Col',
        toNodeId: 'N_Pile2',
        type: 'strut',
        hasTransverseTension: false,
        effectiveWidth: 0.28
      },
      {
        id: 'M_Tie_Main',
        fromNodeId: 'N_Pile1',
        toNodeId: 'N_Pile2',
        type: 'tie',
        barDiameter: 25 // Tirant principal d'armatures à 16 cm d'enrobage sous-face
      }
    ]
  },
  {
    id: 'pile_cap_3_piles',
    title: 'Semelle sur 3 Pieux (3D)',
    subtitle: 'Eurocode 2 & Méthode de Blévot - Massif triangulaire à 3 bielles spatiales',
    dimension: '3D',
    description: 'Massif tridimensionnel sur 3 pieux disposés en triangle équilatéral. La charge centrale de 1200 kN est reprise par un cône de 3 bielles de compression spatiales équilibrées par une ceinture triangulaire fermée de tirants horizontaux en partie basse.',
    concrete: {
      name: 'Semelle Triangulaire 2.40 x 2.40 x 0.90 m',
      thickness: 2.40,
      points2D: [
        [0.0, 0.0],
        [2.40, 0.0],
        [2.40, 2.40],
        [0.0, 2.40]
      ],
      bounds3D: {
        minX: 0, maxX: 2.40,
        minY: 0, maxY: 2.40,
        minZ: 0, maxZ: 0.90
      }
    },
    concreteMat: {
      name: 'C30/37',
      fck: 30,
      gammaC: 1.5,
      alphaCc: 1.0,
      aggregateSize: 20
    },
    steelMat: {
      name: 'B500B',
      fyk: 500,
      gammaS: 1.15,
      Es: 200
    },
    nodes: [
      {
        id: 'N_Col',
        x: 1.20,
        y: 1.20,
        z: 0.78,
        fx: 0,
        fy: 0,
        fz: -1200, // 1200 kN poteau central
        bearingWidth: 0.40,
        bearingDepth: 0.40,
        nodeType: 'CCC',
        isFixedInOpt: true
      },
      {
        id: 'N_Pile1',
        x: 1.20,
        y: 1.95,
        z: 0.16,
        isSupport: true,
        supportType: 'pin',
        bearingShape: 'circular',
        bearingDiameter: 0.35,
        bearingWidth: 0.35,
        nodeType: 'CCT',
        isFixedInOpt: true,
        isBlockedNearSupport: false
      },
      {
        id: 'N_Pile2',
        x: 0.55,
        y: 0.825,
        z: 0.16,
        isSupport: true,
        supportType: 'roller_x',
        bearingShape: 'circular',
        bearingDiameter: 0.35,
        bearingWidth: 0.35,
        nodeType: 'CCT',
        isFixedInOpt: true,
        isBlockedNearSupport: false
      },
      {
        id: 'N_Pile3',
        x: 1.85,
        y: 0.825,
        z: 0.16,
        isSupport: true,
        supportType: 'roller_y',
        bearingShape: 'circular',
        bearingDiameter: 0.35,
        bearingWidth: 0.35,
        nodeType: 'CCT',
        isFixedInOpt: true,
        isBlockedNearSupport: false
      }
    ],
    members: [
      {
        id: 'M_Strut_P1',
        fromNodeId: 'N_Col',
        toNodeId: 'N_Pile1',
        type: 'strut',
        hasTransverseTension: false,
        effectiveWidth: 0.26
      },
      {
        id: 'M_Strut_P2',
        fromNodeId: 'N_Col',
        toNodeId: 'N_Pile2',
        type: 'strut',
        hasTransverseTension: false,
        effectiveWidth: 0.26
      },
      {
        id: 'M_Strut_P3',
        fromNodeId: 'N_Col',
        toNodeId: 'N_Pile3',
        type: 'strut',
        hasTransverseTension: false,
        effectiveWidth: 0.26
      },
      {
        id: 'M_Tie_12',
        fromNodeId: 'N_Pile1',
        toNodeId: 'N_Pile2',
        type: 'tie',
        barDiameter: 25
      },
      {
        id: 'M_Tie_23',
        fromNodeId: 'N_Pile2',
        toNodeId: 'N_Pile3',
        type: 'tie',
        barDiameter: 25
      },
      {
        id: 'M_Tie_31',
        fromNodeId: 'N_Pile3',
        toNodeId: 'N_Pile1',
        type: 'tie',
        barDiameter: 25
      }
    ]
  },
  {
    id: 'pile_cap_4_piles',
    title: 'Semelle sur 4 Pieux (3D)',
    subtitle: 'Eurocode 2 §J.3 - Massif carré sur 4 pieux et ceinture de tirants',
    dimension: '3D',
    description: 'Massif tridimensionnel sur 4 pieux carrés. Charge axiale de poteau de 1600 kN transmise par 4 bielles spatiales en cône vers les 4 pieux, équilibrées par une ceinture de tirants carrée et des tirants diagonaux en partie basse.',
    concrete: {
      name: 'Semelle 4 Pieux 2.40 x 2.40 x 0.90 m',
      thickness: 2.40,
      points2D: [
        [0.0, 0.0],
        [2.40, 0.0],
        [2.40, 2.40],
        [0.0, 2.40]
      ],
      bounds3D: {
        minX: 0, maxX: 2.40,
        minY: 0, maxY: 2.40,
        minZ: 0, maxZ: 0.90
      }
    },
    concreteMat: {
      name: 'C30/37',
      fck: 30,
      gammaC: 1.5,
      alphaCc: 1.0,
      aggregateSize: 20
    },
    steelMat: {
      name: 'B500B',
      fyk: 500,
      gammaS: 1.15,
      Es: 200
    },
    nodes: [
      {
        id: 'N_Col',
        x: 1.20,
        y: 1.20,
        z: 0.78,
        fx: 0,
        fy: 0,
        fz: -1600, // 1600 kN poteau central
        bearingWidth: 0.40,
        bearingDepth: 0.40,
        nodeType: 'CCC',
        isFixedInOpt: true
      },
      {
        id: 'N_Pile1',
        x: 0.50,
        y: 0.50,
        z: 0.16,
        isSupport: true,
        supportType: 'pin',
        bearingShape: 'circular',
        bearingDiameter: 0.35,
        bearingWidth: 0.35,
        nodeType: 'CCT',
        isFixedInOpt: true,
        isBlockedNearSupport: false
      },
      {
        id: 'N_Pile2',
        x: 1.90,
        y: 0.50,
        z: 0.16,
        isSupport: true,
        supportType: 'roller_x',
        bearingShape: 'circular',
        bearingDiameter: 0.35,
        bearingWidth: 0.35,
        nodeType: 'CCT',
        isFixedInOpt: true,
        isBlockedNearSupport: false
      },
      {
        id: 'N_Pile3',
        x: 1.90,
        y: 1.90,
        z: 0.16,
        isSupport: true,
        supportType: 'roller_z',
        bearingShape: 'circular',
        bearingDiameter: 0.35,
        bearingWidth: 0.35,
        nodeType: 'CCT',
        isFixedInOpt: true,
        isBlockedNearSupport: false
      },
      {
        id: 'N_Pile4',
        x: 0.50,
        y: 1.90,
        z: 0.16,
        isSupport: true,
        supportType: 'roller_y',
        bearingShape: 'circular',
        bearingDiameter: 0.35,
        bearingWidth: 0.35,
        nodeType: 'CCT',
        isFixedInOpt: true,
        isBlockedNearSupport: false
      }
    ],
    members: [
      {
        id: 'M_Strut_P1',
        fromNodeId: 'N_Col',
        toNodeId: 'N_Pile1',
        type: 'strut',
        hasTransverseTension: false,
        effectiveWidth: 0.26
      },
      {
        id: 'M_Strut_P2',
        fromNodeId: 'N_Col',
        toNodeId: 'N_Pile2',
        type: 'strut',
        hasTransverseTension: false,
        effectiveWidth: 0.26
      },
      {
        id: 'M_Strut_P3',
        fromNodeId: 'N_Col',
        toNodeId: 'N_Pile3',
        type: 'strut',
        hasTransverseTension: false,
        effectiveWidth: 0.26
      },
      {
        id: 'M_Strut_P4',
        fromNodeId: 'N_Col',
        toNodeId: 'N_Pile4',
        type: 'strut',
        hasTransverseTension: false,
        effectiveWidth: 0.26
      },
      {
        id: 'M_Tie_12',
        fromNodeId: 'N_Pile1',
        toNodeId: 'N_Pile2',
        type: 'tie',
        barDiameter: 25
      },
      {
        id: 'M_Tie_23',
        fromNodeId: 'N_Pile2',
        toNodeId: 'N_Pile3',
        type: 'tie',
        barDiameter: 25
      },
      {
        id: 'M_Tie_34',
        fromNodeId: 'N_Pile3',
        toNodeId: 'N_Pile4',
        type: 'tie',
        barDiameter: 25
      },
      {
        id: 'M_Tie_41',
        fromNodeId: 'N_Pile4',
        toNodeId: 'N_Pile1',
        type: 'tie',
        barDiameter: 25
      },
      {
        id: 'M_Tie_13',
        fromNodeId: 'N_Pile1',
        toNodeId: 'N_Pile3',
        type: 'tie',
        barDiameter: 20
      },
      {
        id: 'M_Tie_24',
        fromNodeId: 'N_Pile2',
        toNodeId: 'N_Pile4',
        type: 'tie',
        barDiameter: 20
      }
    ]
  },
  {
    id: 'deep_beam',
    title: 'Poutre-Cloison (Deep Beam)',
    subtitle: 'Eurocode 2 §9.7 & §J.3 - L/H = 1.6, arche comprimée et tirant continu',
    dimension: '2D',
    description: 'Poutre haute sous charge ponctuelle centrée de 800 kN. Transmission des efforts par arche de bielles directes (θ = 53.7°) vers les appuis d’extrémité et tirant inférieur continu en armatures d’acier à enrobage vérifié.',
    concrete: {
      name: 'Poutre-Voile 3.20 x 2.00 m (Ep. 30 cm)',
      thickness: 0.30,
      points2D: [
        [0.0, 0.0],
        [3.20, 0.0],
        [3.20, 2.00],
        [0.0, 2.00]
      ]
    },
    concreteMat: {
      name: 'C25/30',
      fck: 25,
      gammaC: 1.5,
      alphaCc: 1.0,
      aggregateSize: 20
    },
    steelMat: {
      name: 'B500B',
      fyk: 500,
      gammaS: 1.15,
      Es: 200
    },
    nodes: [
      {
        id: 'N_Load',
        x: 1.60,
        y: 1.86,
        fx: 0,
        fy: -800, // Charge ponctuelle 800 kN
        bearingWidth: 0.40,
        nodeType: 'CCC',
        isFixedInOpt: true
      },
      {
        id: 'N_SuppLeft',
        x: 0.35,
        y: 0.16,
        isSupport: true,
        supportType: 'pin',
        bearingWidth: 0.30,
        nodeType: 'CCT',
        isFixedInOpt: true,
        isBlockedNearSupport: true
      },
      {
        id: 'N_SuppRight',
        x: 2.85,
        y: 0.16,
        isSupport: true,
        supportType: 'roller_x',
        bearingWidth: 0.30,
        nodeType: 'CCT',
        isFixedInOpt: true,
        isBlockedNearSupport: true
      },
      {
        id: 'N_MidBottom',
        x: 1.60,
        y: 0.16,
        bearingWidth: 0.25,
        nodeType: 'CCT',
        isFixedInOpt: false
      }
    ],
    members: [
      {
        id: 'M_StrutLeft',
        fromNodeId: 'N_Load',
        toNodeId: 'N_SuppLeft',
        type: 'strut',
        hasTransverseTension: false,
        effectiveWidth: 0.24
      },
      {
        id: 'M_StrutRight',
        fromNodeId: 'N_Load',
        toNodeId: 'N_SuppRight',
        type: 'strut',
        hasTransverseTension: false,
        effectiveWidth: 0.24
      },
      {
        id: 'M_TieLeft',
        fromNodeId: 'N_SuppLeft',
        toNodeId: 'N_MidBottom',
        type: 'tie',
        barDiameter: 25
      },
      {
        id: 'M_TieRight',
        fromNodeId: 'N_MidBottom',
        toNodeId: 'N_SuppRight',
        type: 'tie',
        barDiameter: 25
      },
      {
        id: 'M_CentralHanger',
        fromNodeId: 'N_Load',
        toNodeId: 'N_MidBottom',
        type: 'strut',
        hasTransverseTension: true,
        effectiveWidth: 0.20
      }
    ]
  },
  {
    id: 'deep_beam_eccentric',
    title: 'Poutre-Cloison avec Excentricité',
    subtitle: 'Eurocode 2 - Charge dissymétrique, bielles asymétriques & treillis multi-panneaux',
    dimension: '2D',
    description: 'Poutre-cloison de 3.60 m avec charge de 750 kN fortement décalée à x = 1.05 m. Présente une bielle raide directe vers l’appui proche (θ1 = 69.1°) et un treillis de diffusion avec bielle inclinée et montants verticaux vers l’appui lointain.',
    concrete: {
      name: 'Poutre-Voile Excentrée 3.60 x 2.00 m (Ep. 30 cm)',
      thickness: 0.30,
      points2D: [
        [0.0, 0.0],
        [3.60, 0.0],
        [3.60, 2.00],
        [0.0, 2.00]
      ]
    },
    concreteMat: {
      name: 'C30/37',
      fck: 30,
      gammaC: 1.5,
      alphaCc: 1.0,
      aggregateSize: 20
    },
    steelMat: {
      name: 'B500B',
      fyk: 500,
      gammaS: 1.15,
      Es: 200
    },
    nodes: [
      {
        id: 'N_Load',
        x: 1.05,
        y: 1.86,
        fx: 0,
        fy: -750, // Charge excentrée 750 kN
        bearingWidth: 0.35,
        nodeType: 'CCC',
        isFixedInOpt: true
      },
      {
        id: 'N_SuppLeft',
        x: 0.35,
        y: 0.16,
        isSupport: true,
        supportType: 'pin',
        bearingWidth: 0.30,
        nodeType: 'CCT',
        isFixedInOpt: true,
        isBlockedNearSupport: true
      },
      {
        id: 'N_SuppRight',
        x: 3.25,
        y: 0.16,
        isSupport: true,
        supportType: 'roller_x',
        bearingWidth: 0.30,
        nodeType: 'CCT',
        isFixedInOpt: true,
        isBlockedNearSupport: true
      },
      {
        id: 'N_Bot_UnderLoad',
        x: 1.05,
        y: 0.16,
        bearingWidth: 0.25,
        nodeType: 'CCT',
        isFixedInOpt: false
      },
      {
        id: 'N_Top_MidRight',
        x: 2.15,
        y: 1.86,
        bearingWidth: 0.25,
        nodeType: 'CCC',
        isFixedInOpt: false
      },
      {
        id: 'N_Bot_MidRight',
        x: 2.15,
        y: 0.16,
        bearingWidth: 0.25,
        nodeType: 'CCT',
        isFixedInOpt: false
      }
    ],
    members: [
      {
        id: 'M_StrutLeftDirect',
        fromNodeId: 'N_Load',
        toNodeId: 'N_SuppLeft',
        type: 'strut',
        hasTransverseTension: false,
        effectiveWidth: 0.26
      },
      {
        id: 'M_HangerUnderLoad',
        fromNodeId: 'N_Load',
        toNodeId: 'N_Bot_UnderLoad',
        type: 'strut',
        hasTransverseTension: true,
        effectiveWidth: 0.20
      },
      {
        id: 'M_StrutTopChord',
        fromNodeId: 'N_Load',
        toNodeId: 'N_Top_MidRight',
        type: 'strut',
        hasTransverseTension: false,
        effectiveWidth: 0.24
      },
      {
        id: 'M_StrutDiagMid',
        fromNodeId: 'N_Top_MidRight',
        toNodeId: 'N_Bot_UnderLoad',
        type: 'strut',
        hasTransverseTension: true,
        effectiveWidth: 0.22
      },
      {
        id: 'M_TieHangerMid',
        fromNodeId: 'N_Top_MidRight',
        toNodeId: 'N_Bot_MidRight',
        type: 'tie',
        barDiameter: 20
      },
      {
        id: 'M_StrutRightDiag',
        fromNodeId: 'N_Top_MidRight',
        toNodeId: 'N_SuppRight',
        type: 'strut',
        hasTransverseTension: false,
        effectiveWidth: 0.24
      },
      {
        id: 'M_TieBot1',
        fromNodeId: 'N_SuppLeft',
        toNodeId: 'N_Bot_UnderLoad',
        type: 'tie',
        barDiameter: 25
      },
      {
        id: 'M_TieBot2',
        fromNodeId: 'N_Bot_UnderLoad',
        toNodeId: 'N_Bot_MidRight',
        type: 'tie',
        barDiameter: 25
      },
      {
        id: 'M_TieBot3',
        fromNodeId: 'N_Bot_MidRight',
        toNodeId: 'N_SuppRight',
        type: 'tie',
        barDiameter: 25
      }
    ]
  },
  {
    id: 'dapped_end',
    title: "About d'Entaille (Dapped-End Beam)",
    subtitle: 'About de poutre avec épaulement / redent d’appui',
    dimension: '2D',
    description: 'Zone de forte concentration d’efforts au droit du redent, nécessitant une bielle d’angle, un tirant vertical de suspension et des tirants horizontaux parfaitement enrobés.',
    concrete: {
      name: 'Poutre à Redent',
      thickness: 0.30,
      points2D: [
        [0.0, 0.40],
        [0.50, 0.40],
        [0.50, 0.0],
        [2.20, 0.0],
        [2.20, 1.20],
        [0.0, 1.20]
      ]
    },
    concreteMat: {
      name: 'C30/37',
      fck: 30,
      gammaC: 1.5,
      alphaCc: 1.0,
      aggregateSize: 20
    },
    steelMat: {
      name: 'B500B',
      fyk: 500,
      gammaS: 1.15,
      Es: 200
    },
    nodes: [
      {
        id: 'N_Appui',
        x: 0.25,
        y: 0.48,
        isSupport: true,
        supportType: 'pin',
        bearingWidth: 0.20,
        nodeType: 'CCT',
        isFixedInOpt: true,
        isBlockedNearSupport: true
      },
      {
        id: 'N_SuspTop',
        x: 0.65,
        y: 1.10,
        bearingWidth: 0.20,
        nodeType: 'CCT',
        isFixedInOpt: false
      },
      {
        id: 'N_CornerBot',
        x: 0.65,
        y: 0.15,
        bearingWidth: 0.20,
        nodeType: 'CCT',
        isFixedInOpt: false
      },
      {
        id: 'N_BeamTopRight',
        x: 1.95,
        y: 1.10,
        fx: 0,
        fy: -280,
        bearingWidth: 0.20,
        nodeType: 'CCC',
        isFixedInOpt: true
      },
      {
        id: 'N_BeamBotRight',
        x: 1.95,
        y: 0.15,
        isSupport: true,
        supportType: 'roller_x',
        bearingWidth: 0.20,
        nodeType: 'CCT',
        isFixedInOpt: true,
        isBlockedNearSupport: true
      }
    ],
    members: [
      {
        id: 'M_StrutNib',
        fromNodeId: 'N_Appui',
        toNodeId: 'N_SuspTop',
        type: 'strut',
        hasTransverseTension: false,
        effectiveWidth: 0.18
      },
      {
        id: 'M_TieHanger',
        fromNodeId: 'N_SuspTop',
        toNodeId: 'N_CornerBot',
        type: 'tie',
        barDiameter: 20
      },
      {
        id: 'M_StrutDiagonal',
        fromNodeId: 'N_SuspTop',
        toNodeId: 'N_BeamBotRight',
        type: 'strut',
        hasTransverseTension: true,
        effectiveWidth: 0.20
      },
      {
        id: 'M_TieBottom',
        fromNodeId: 'N_CornerBot',
        toNodeId: 'N_BeamBotRight',
        type: 'tie',
        barDiameter: 25
      },
      {
        id: 'M_TopStrut',
        fromNodeId: 'N_SuspTop',
        toNodeId: 'N_BeamTopRight',
        type: 'strut',
        hasTransverseTension: false,
        effectiveWidth: 0.20
      }
    ]
  },
  {
    id: 'deep_beam_opening',
    title: 'Poutre-Cloison avec Trémie (EC2 §9.7)',
    subtitle: 'Eurocode 2 §9.7 - Contournement de baie par linteau, bielles et étriers de suspension',
    dimension: '2D',
    description: 'Modèle Eurocode 2 pour poutre-cloison avec réservation centrale (80x70 cm). La charge supérieure est déviée par un linteau comprimé supérieur, reprise par des étriers verticaux de suspension latéraux, puis acheminée aux appuis par des bielles de trumeau et un tirant inférieur continu.',
    concrete: {
      name: 'Poutre-Cloison 3.60 x 2.20 m avec Trémie Centrale',
      thickness: 0.30,
      points2D: [
        [0.0, 0.0],
        [3.60, 0.0],
        [3.60, 2.20],
        [0.0, 2.20]
      ]
    },
    concreteMat: {
      name: 'C30/37',
      fck: 30,
      gammaC: 1.5,
      alphaCc: 1.0,
      aggregateSize: 20
    },
    steelMat: {
      name: 'B500B',
      fyk: 500,
      gammaS: 1.15,
      Es: 200
    },
    nodes: [
      {
        id: 'N_SuppL',
        x: 0.35,
        y: 0.16,
        isSupport: true,
        supportType: 'pin',
        bearingWidth: 0.35,
        nodeType: 'CCT',
        isFixedInOpt: true,
        isBlockedNearSupport: true
      },
      {
        id: 'N_SuppR',
        x: 3.25,
        y: 0.16,
        isSupport: true,
        supportType: 'roller_x',
        bearingWidth: 0.35,
        nodeType: 'CCT',
        isFixedInOpt: true,
        isBlockedNearSupport: true
      },
      {
        id: 'N_LoadMid',
        x: 1.80,
        y: 2.05,
        fx: 0,
        fy: -500,
        bearingWidth: 0.40,
        nodeType: 'CCC',
        isFixedInOpt: true
      },
      {
        id: 'N_CornerTopL',
        x: 0.35,
        y: 1.65,
        bearingWidth: 0.30,
        nodeType: 'CCC',
        isFixedInOpt: false
      },
      {
        id: 'N_PierTopL',
        x: 1.10,
        y: 1.65,
        bearingWidth: 0.30,
        nodeType: 'CCC',
        isFixedInOpt: false
      },
      {
        id: 'N_PierBotL',
        x: 1.10,
        y: 0.16,
        bearingWidth: 0.30,
        nodeType: 'CCT',
        isFixedInOpt: false
      },
      {
        id: 'N_CornerTopR',
        x: 3.25,
        y: 1.65,
        bearingWidth: 0.30,
        nodeType: 'CCC',
        isFixedInOpt: false
      },
      {
        id: 'N_PierTopR',
        x: 2.50,
        y: 1.65,
        bearingWidth: 0.30,
        nodeType: 'CCC',
        isFixedInOpt: false
      },
      {
        id: 'N_PierBotR',
        x: 2.50,
        y: 0.16,
        bearingWidth: 0.30,
        nodeType: 'CCT',
        isFixedInOpt: false
      }
    ],
    members: [
      {
        id: 'M_LintelStrut_L',
        fromNodeId: 'N_LoadMid',
        toNodeId: 'N_PierTopL',
        type: 'strut',
        effectiveWidth: 0.28
      },
      {
        id: 'M_LintelStrut_R',
        fromNodeId: 'N_LoadMid',
        toNodeId: 'N_PierTopR',
        type: 'strut',
        effectiveWidth: 0.28
      },
      {
        id: 'M_PierStrut_L',
        fromNodeId: 'N_PierTopL',
        toNodeId: 'N_SuppL',
        type: 'strut',
        effectiveWidth: 0.30
      },
      {
        id: 'M_PierStrut_R',
        fromNodeId: 'N_PierTopR',
        toNodeId: 'N_SuppR',
        type: 'strut',
        effectiveWidth: 0.30
      },
      {
        id: 'M_ColL_Vert',
        fromNodeId: 'N_SuppL',
        toNodeId: 'N_CornerTopL',
        type: 'strut',
        effectiveWidth: 0.25
      },
      {
        id: 'M_TopL_Horiz',
        fromNodeId: 'N_CornerTopL',
        toNodeId: 'N_PierTopL',
        type: 'strut',
        effectiveWidth: 0.25
      },
      {
        id: 'M_DiagL',
        fromNodeId: 'N_CornerTopL',
        toNodeId: 'N_PierBotL',
        type: 'strut',
        effectiveWidth: 0.22
      },
      {
        id: 'M_HangerL',
        fromNodeId: 'N_PierTopL',
        toNodeId: 'N_PierBotL',
        type: 'tie',
        barDiameter: 20
      },
      {
        id: 'M_ColR_Vert',
        fromNodeId: 'N_SuppR',
        toNodeId: 'N_CornerTopR',
        type: 'strut',
        effectiveWidth: 0.25
      },
      {
        id: 'M_TopR_Horiz',
        fromNodeId: 'N_CornerTopR',
        toNodeId: 'N_PierTopR',
        type: 'strut',
        effectiveWidth: 0.25
      },
      {
        id: 'M_DiagR',
        fromNodeId: 'N_CornerTopR',
        toNodeId: 'N_PierBotR',
        type: 'strut',
        effectiveWidth: 0.22
      },
      {
        id: 'M_HangerR',
        fromNodeId: 'N_PierTopR',
        toNodeId: 'N_PierBotR',
        type: 'tie',
        barDiameter: 20
      },
      {
        id: 'M_TieBot_L',
        fromNodeId: 'N_SuppL',
        toNodeId: 'N_PierBotL',
        type: 'tie',
        barDiameter: 25
      },
      {
        id: 'M_TieBot_Mid',
        fromNodeId: 'N_PierBotL',
        toNodeId: 'N_PierBotR',
        type: 'tie',
        barDiameter: 25
      },
      {
        id: 'M_TieBot_R',
        fromNodeId: 'N_PierBotR',
        toNodeId: 'N_SuppR',
        type: 'tie',
        barDiameter: 25
      }
    ]
  },
  {
    id: 'frame_corner',
    title: 'Nœud d\'Angle de Portique (EC2 Annexe J)',
    subtitle: 'Eurocode 2 Annexe J.4 - Transmission de moment d\'angle, bielle diagonale et tirants d\'armatures',
    dimension: '2D',
    description: 'Modèle réglementaire Eurocode 2 Annexe J pour nœud d\'angle de portique soumis à un moment de fermeture. La résultante diagonale de compression intérieure équilibre les tirants extérieurs de poteau et de poutre.',
    concrete: {
      name: 'Angle de Cadre Poteau-Poutre 60x60 cm',
      thickness: 0.35,
      points2D: [
        [0.0, 0.0],
        [0.60, 0.0],
        [0.60, 1.20],
        [2.00, 1.20],
        [2.00, 1.80],
        [0.0, 1.80]
      ]
    },
    concreteMat: {
      name: 'C30/37',
      fck: 30,
      gammaC: 1.5,
      alphaCc: 1.0,
      aggregateSize: 20
    },
    steelMat: {
      name: 'B500B',
      fyk: 500,
      gammaS: 1.15,
      Es: 200
    },
    nodes: [
      {
        id: 'N_Col_Outer',
        x: 0.12,
        y: 0.12,
        isSupport: true,
        supportType: 'roller_x',
        bearingWidth: 0.25,
        nodeType: 'CCT',
        isFixedInOpt: true,
        isBlockedNearSupport: true
      },
      {
        id: 'N_Col_Inner',
        x: 0.48,
        y: 0.12,
        isSupport: true,
        supportType: 'pin',
        bearingWidth: 0.25,
        nodeType: 'CCC',
        isFixedInOpt: true,
        isBlockedNearSupport: true
      },
      {
        id: 'N_Col_Mid_Outer',
        x: 0.12,
        y: 0.70,
        bearingWidth: 0.20,
        nodeType: 'CCT',
        isFixedInOpt: false
      },
      {
        id: 'N_Col_Mid_Inner',
        x: 0.48,
        y: 0.70,
        bearingWidth: 0.20,
        nodeType: 'CCC',
        isFixedInOpt: false
      },
      {
        id: 'N_Corner_Outer',
        x: 0.12,
        y: 1.68,
        bearingWidth: 0.25,
        nodeType: 'CCT',
        isFixedInOpt: false
      },
      {
        id: 'N_Corner_Inner',
        x: 0.48,
        y: 1.32,
        bearingWidth: 0.25,
        nodeType: 'CCC',
        isFixedInOpt: false
      },
      {
        id: 'N_Beam_Mid_Top',
        x: 1.20,
        y: 1.68,
        bearingWidth: 0.20,
        nodeType: 'CCT',
        isFixedInOpt: false
      },
      {
        id: 'N_Beam_Mid_Bot',
        x: 1.20,
        y: 1.32,
        bearingWidth: 0.20,
        nodeType: 'CCC',
        isFixedInOpt: false
      },
      {
        id: 'N_Beam_Tip_Top',
        x: 1.85,
        y: 1.68,
        fx: 0,
        fy: -200,
        bearingWidth: 0.20,
        nodeType: 'CCT',
        isFixedInOpt: true
      },
      {
        id: 'N_Beam_Tip_Bot',
        x: 1.85,
        y: 1.32,
        bearingWidth: 0.20,
        nodeType: 'CCC',
        isFixedInOpt: true
      }
    ],
    members: [
      {
        id: 'M_Corner_DiagStrut',
        fromNodeId: 'N_Corner_Inner',
        toNodeId: 'N_Corner_Outer',
        type: 'strut',
        effectiveWidth: 0.32
      },
      {
        id: 'M_Beam_TopTie1',
        fromNodeId: 'N_Corner_Outer',
        toNodeId: 'N_Beam_Mid_Top',
        type: 'tie',
        barDiameter: 25
      },
      {
        id: 'M_Beam_TopTie2',
        fromNodeId: 'N_Beam_Mid_Top',
        toNodeId: 'N_Beam_Tip_Top',
        type: 'tie',
        barDiameter: 25
      },
      {
        id: 'M_Col_OuterTie1',
        fromNodeId: 'N_Corner_Outer',
        toNodeId: 'N_Col_Mid_Outer',
        type: 'tie',
        barDiameter: 25
      },
      {
        id: 'M_Col_OuterTie2',
        fromNodeId: 'N_Col_Mid_Outer',
        toNodeId: 'N_Col_Outer',
        type: 'tie',
        barDiameter: 25
      },
      {
        id: 'M_Beam_BotStrut1',
        fromNodeId: 'N_Corner_Inner',
        toNodeId: 'N_Beam_Mid_Bot',
        type: 'strut',
        effectiveWidth: 0.28
      },
      {
        id: 'M_Beam_BotStrut2',
        fromNodeId: 'N_Beam_Mid_Bot',
        toNodeId: 'N_Beam_Tip_Bot',
        type: 'strut',
        effectiveWidth: 0.28
      },
      {
        id: 'M_Col_InnerStrut1',
        fromNodeId: 'N_Corner_Inner',
        toNodeId: 'N_Col_Mid_Inner',
        type: 'strut',
        effectiveWidth: 0.28
      },
      {
        id: 'M_Col_InnerStrut2',
        fromNodeId: 'N_Col_Mid_Inner',
        toNodeId: 'N_Col_Inner',
        type: 'strut',
        effectiveWidth: 0.28
      },
      {
        id: 'M_Beam_Hanger1',
        fromNodeId: 'N_Beam_Mid_Top',
        toNodeId: 'N_Beam_Mid_Bot',
        type: 'tie',
        barDiameter: 16
      },
      {
        id: 'M_Beam_Hanger2',
        fromNodeId: 'N_Beam_Tip_Top',
        toNodeId: 'N_Beam_Tip_Bot',
        type: 'tie',
        barDiameter: 16
      },
      {
        id: 'M_Beam_DiagStrut1',
        fromNodeId: 'N_Corner_Outer',
        toNodeId: 'N_Beam_Mid_Bot',
        type: 'strut',
        effectiveWidth: 0.22
      },
      {
        id: 'M_Beam_DiagStrut2',
        fromNodeId: 'N_Beam_Mid_Top',
        toNodeId: 'N_Beam_Tip_Bot',
        type: 'strut',
        effectiveWidth: 0.22
      },
      {
        id: 'M_Col_Stirrup1',
        fromNodeId: 'N_Col_Mid_Outer',
        toNodeId: 'N_Col_Mid_Inner',
        type: 'tie',
        barDiameter: 16
      },
      {
        id: 'M_Col_DiagStrut1',
        fromNodeId: 'N_Corner_Inner',
        toNodeId: 'N_Col_Mid_Outer',
        type: 'strut',
        effectiveWidth: 0.22
      },
      {
        id: 'M_Col_DiagStrut2',
        fromNodeId: 'N_Col_Mid_Inner',
        toNodeId: 'N_Col_Outer',
        type: 'strut',
        effectiveWidth: 0.22
      }
    ]
  },
  {
    id: 'free_2d',
    title: 'Modèle 2D Libre',
    subtitle: 'Espace de conception libre pour zone D personnalisée',
    dimension: '2D',
    description: 'Dessinez et configurez librement vos nœuds, bielles de compression, tirants en acier et charges.',
    concrete: {
      name: 'Bloc Béton 3.0 x 1.5 m',
      thickness: 0.30,
      points2D: [
        [0.0, 0.0],
        [3.0, 0.0],
        [3.0, 1.5],
        [0.0, 1.5]
      ]
    },
    concreteMat: {
      name: 'C30/37',
      fck: 30,
      gammaC: 1.5,
      alphaCc: 1.0,
      aggregateSize: 20
    },
    steelMat: {
      name: 'B500B',
      fyk: 500,
      gammaS: 1.15,
      Es: 200
    },
    nodes: [
      {
        id: 'N1',
        x: 0.35,
        y: 0.16,
        isSupport: true,
        supportType: 'pin',
        bearingWidth: 0.20
      },
      {
        id: 'N2',
        x: 2.65,
        y: 0.16,
        isSupport: true,
        supportType: 'roller_x',
        bearingWidth: 0.20
      },
      {
        id: 'N3',
        x: 1.50,
        y: 1.34,
        fx: 0,
        fy: -400,
        bearingWidth: 0.25
      }
    ],
    members: [
      {
        id: 'M1',
        fromNodeId: 'N3',
        toNodeId: 'N1',
        type: 'strut',
        effectiveWidth: 0.20
      },
      {
        id: 'M2',
        fromNodeId: 'N3',
        toNodeId: 'N2',
        type: 'strut',
        effectiveWidth: 0.20
      },
      {
        id: 'M3',
        fromNodeId: 'N1',
        toNodeId: 'N2',
        type: 'tie',
        barDiameter: 20
      }
    ]
  }
];
