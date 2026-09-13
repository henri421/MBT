# Bielles & Tirants — Eurocode 2 (NF EN 1992-1-1)
> **Modélisation, calcul matriciel EF, vérification réglementaire Eurocode 2 et optimisation énergétique de Schlaich pour les zones de discontinuité (Zones D) en 2D et 3D.**

[![Eurocode 2](https://img.shields.io/badge/Norme-Eurocode%202%20(NF%20EN%201992--1--1)-blue.svg)](#r%C3%A9f%C3%A9rentiels-th%C3%A9oriques--eurocode-2)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61dafb.svg)](https://reactjs.org/)
[![Three.js](https://img.shields.io/badge/Three.js-3D%20WebGL-black.svg)](https://threejs.org/)
[![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-v4-38bdf8.svg)](https://tailwindcss.com/)

---

## Sommaire
1. [Présentation générale](#pr%C3%A9sentation-g%C3%A9n%C3%A9rale)
2. [Référentiels théoriques & Eurocode 2](#r%C3%A9f%C3%A9rentiels-th%C3%A9oriques--eurocode-2)
3. [Catalogue des Modèles Inclus](#catalogue-des-mod%C3%A8les-inclus)
4. [Fonctionnalités Clés](#fonctionnalit%C3%A9s-cl%C3%A9s)
5. [Contrôles & Raccourcis Clavier](#contr%C3%B4les--raccourcis-clavier)
6. [Installation & Démarrage](#installation--d%C3%A9marrage)
7. [Architecture du Code](#architecture-du-code)

---

## Présentation générale

Dans les structures en béton armé, les **zones de discontinuité géométrique ou statique** (dites **Zones D**) ne respectent pas l'hypothèse de Navier-Bernoulli des sections planes. L'Eurocode 2 (NF EN 1992-1-1, chapitre 6.5 et annexe J) préconise pour ces éléments la **méthode des bielles et tirants** (*Strut-and-Tie Method* - STM), fondée sur le **théorème de la borne inférieure de la plasticité** :
- **Les bielles (en bleu)** représentent les champs de compression dans le béton.
- **Les tirants (en rouge)** représentent les armatures d'acier tendues.
- **Les nœuds** constituent les zones de convergence et d'équilibrage des efforts.

Cette application web permet aux ingénieurs structure, bureaux d'études techniques (BET) et étudiants de génie civil de concevoir, paramétrer, résoudre et vérifier les modèles bielles-tirants en temps réel.

---

## Référentiels théoriques & Eurocode 2

### 1. Résolution matricielle par éléments finis (Treillis 2D & 3D)
Le modèle est résolu par la méthode directe des rigidités :
$$[K] \cdot \{u\} = \{F_{ext}\}$$
avec pour chaque barre la matrice de rigidité élémentaire calculée en fonction de son module élastique ($E_c$ pour le béton, $E_s = 200\text{ GPa}$ pour l'acier) et de sa section représentative.
Les réactions d'appui réelles $(\sum R_x, \sum R_y, \sum R_z)$ sont extraites directement pour vérifier l'équilibre global :
$$\sum F_{ext} + \sum R = 0$$

### 2. Vérification des bielles de compression (§6.5.2)
Le coefficient de fragilité du béton sous compression biaxiale/triaxiale est calculé selon :
$$\nu' = 1 - \frac{f_{ck}}{250} \quad (f_{ck} \text{ en MPa})$$
- **Bielle sans traction transversale (§6.5.2.1)** :
  $$\sigma_{Rd,max} = k_1 \cdot \nu' \cdot f_{cd} \quad (k_1 = 1{,}0)$$
- **Bielle avec fissuration transversale par traction (§6.5.2.2)** :
  $$\sigma_{Rd,max} = k_2 \cdot \nu' \cdot f_{cd} \quad (k_2 = 0{,}60)$$
- **Largeur efficace requise** pour chaque bielle :
  $$b_{eff,req} = \frac{|F_{c,Ed}|}{t \cdot \sigma_{Rd,max}}$$
  où $t$ est l'épaisseur de l'élément en béton.

### 3. Dimensionnement des tirants (§6.5.3)
Pour tout tirant sous traction $T_{Ed}$ :
$$A_{s,req} = \frac{T_{Ed}}{f_{yd}} = \frac{T_{Ed}}{f_{yk} / \gamma_s} \quad (\gamma_s = 1{,}15)$$

### 4. Vérification des contraintes dans les nœuds (§6.5.4)
- **Nœud CCC** (compression pure) : $\sigma_{Rd,max} = k_1 \cdot \nu' \cdot f_{cd} = 1{,}0 \cdot \nu' \cdot f_{cd}$
- **Nœud CCT** (compression avec tirant ancré dans une direction) : $\sigma_{Rd,max} = k_2 \cdot \nu' \cdot f_{cd} = 0{,}85 \cdot \nu' \cdot f_{cd}$
- **Nœud CTT** (tirants ancrés dans plusieurs directions) : $\sigma_{Rd,max} = k_3 \cdot \nu' \cdot f_{cd} = 0{,}75 \cdot \nu' \cdot f_{cd}$

### 5. Optimisation selon le critère énergétique de J. Schlaich
Selon les travaux du Pr. Jörg Schlaich, le modèle bielle-tirant optimal est celui qui minimise le travail de déformation élastique global :
$$\min W = \sum_{i=1}^{m} \frac{F_i^2 \cdot L_i}{E_i \cdot A_i}$$
L'application propose un algorithme de descente de gradient avec projection pour optimiser la position des nœuds intérieurs tout en respectant l'enveloppe de béton et les angles minimaux ($\theta \ge 30^\circ$).

---

## Catalogue des Modèles Inclus

| Modèle | Dimension | Référence normative / Guide |
|---|---|---|
| **Console Courte sur Poteau** | 2D | Eurocode 2 §J.3 — Tirant principal supérieur + bielle inclinée directe |
| **Console Courte sur Poutre (Suspension)** | 2D | EC2 §J.3 & Guide SETRA — Reprise indirecte par étriers verticaux de suspension |
| **Semelle sur 2 Pieux** | 2D | Répartition bielle-tirant vers 2 pieux d'appui |
| **Semelle sur 3 Pieux** | 3D | Méthode de Blévot — Cône spatial de 3 bielles et ceinture triangulaire fermée |
| **Semelle sur 4 Pieux** | 3D | Tétraèdre spatial sur 4 pieux d'angle |
| **Poutre-Cloison Standard** | 2D | Eurocode 2 §9.7 & CEB-FIP — Arc de décharge et tirant inférieur |
| **Poutre-Cloison avec Excentricité** | 2D | Asymétrie de charge et répartition différentielle des bielles vers les appuis |
| **About de Poutre à Redent** | 2D | Dapped-end beam — Étriers de suspension verticaux et tirant d'about |

---

## Fonctionnalités Clés

- **Visualisation 2D Vectorielle (SVG dynamique)** :
  - Bielles comprimées en **bleu** et tirants tendus en **rouge**.
  - Affichage en pointillés de la **largeur efficace réelle des bielles** ($w_{eff}$).
  - Tracé automatique des **secteurs angulaires $\theta$** entre bielles et tirants avec alerte si $\theta < 30^\circ$.
  - Affichage des réactions d'appui réelles avec composantes horizontales et verticales ($R_x, R_y$).
- **Visualisation 3D Interactive (Three.js WebGL)** :
  - Rendu tridimensionnel des massifs de fondation et des volumes de béton extrudés.
  - Orbite 360°, translation (pan), zoom molette et recadrage automatique sur l'élément.
  - Sélection interactive par clic (raycasting) des barres et des nœuds.
- **Paramétrage géométrique direct** :
  - Dimensions réelles de coffrage modifiables par saisie numérique directe (portée, hauteur, épaisseur sans slider, position des charges).
- **Historique & Sauvegarde** :
  - Annulation / Rétablissement complets (**Ctrl+Z** / **Ctrl+Y**).
  - Export et import de modèles complets en format JSON.
- **Note de Calcul Réglementaire** :
  - Modal d'audit détaillant le ratio d'utilisation $\eta$, les contraintes admissibles $\sigma_{Rd,max}$, et la section d'acier $A_s$.

---

## Contrôles & Raccourcis Clavier

| Raccourci / Action | Effet |
|---|---|
| `Ctrl + Z` (ou `Cmd + Z`) | Annuler la dernière action |
| `Ctrl + Y` (ou `Cmd + Shift + Z`) | Rétablir l'action |
| `Suppr` ou `Retour arrière` | Supprimer le nœud ou la barre sélectionnée |
| `Clic gauche` (vue 3D) | Rotation orbitale de la vue |
| `Clic droit` ou `Shift + Clic` (3D) | Déplacement panoramique (Pan) |
| `Molette de la souris` | Zoom avant / arrière |
| `Double clic` ou bouton `Cadre` | Recentrer et ajuster la vue sur le modèle |

---

## Installation & Démarrage

### Prérequis
- [Node.js](https://nodejs.org/) v18 ou supérieur
- `npm` ou `pnpm`

### Installation
```bash
# Cloner le dépôt
git clone https://github.com/votre-nom-d-utilisateur/bielles-et-tirants-eurocode2.git
cd bielles-et-tirants-eurocode2

# Installer les dépendances
npm install
```

### Démarrage en mode développement
```bash
npm run dev
```
L'application démarre et est accessible sur `http://localhost:3000`.

### Compilation de production
```bash
npm run build
```
Les fichiers compilés et optimisés sont générés dans le dossier `dist/`.

---

## Architecture du Code

```text
├── index.html                   # Point d'entrée HTML, balises SEO et polices
├── metadata.json                # Métadonnées de l'application
├── package.json                 # Dépendances et scripts de build
├── src/
│   ├── main.tsx                 # Point d'entrée React
│   ├── App.tsx                  # Composant racine, machine d'état et historique
│   ├── types/
│   │   └── stm.ts               # Types TypeScript (Nœuds, Barres, Matériaux, Solveur)
│   ├── components/
│   │   ├── Toolbar.tsx          # Barre d'outils, sélecteur de modèle et bascule 2D/3D
│   │   ├── Canvas2D.tsx         # Moteur de rendu vectoriel SVG 2D interactif
│   │   ├── Canvas3D.tsx         # Rendu spatial 3D WebGL (Three.js) avec raycasting
│   │   ├── PropertyPanel.tsx    # Panneau d'inspection et saisie géométrique/matériaux
│   │   ├── SchlaichOptimizer.tsx# Algorithme d'optimisation énergétique de Schlaich
│   │   └── EurocodeReport.tsx   # Note de calcul de conformité Eurocode 2
│   └── utils/
│       ├── templates.ts         # Catalogue de préconfigurations 2D et 3D
│       ├── matrixSolver.ts      # Solveur matriciel par éléments finis
│       ├── eurocode2.ts         # Formulations Eurocode 2 (bielles, tirants, nœuds)
│       └── geometryHelpers.ts   # Générateur paramétrique des contours de béton
└── tsconfig.json                # Configuration TypeScript
```

---

## Licence & Auteur
Développé pour les ingénieurs en calcul de structures et les passionnés de génie civil selon la norme européenne **NF EN 1992-1-1**.
Distribué sous licence MIT.
