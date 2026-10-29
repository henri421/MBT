# Bielles & Tirants — Eurocode 2 (NF EN 1992-1-1)
> **Modélisation, calcul matriciel EF, vérification réglementaire Eurocode 2 et optimisation énergétique de Schlaich pour les zones de discontinuité (Zones D) en 2D et 3D.**

> **Outil de référence de la suite pour le calcul bielles-tirants.** L'ancien
> dépôt `STM` est archivé et renvoie ici.

[![Eurocode 2](https://img.shields.io/badge/Norme-Eurocode%202%20(NF%20EN%201992--1--1)-blue.svg)](#r%C3%A9f%C3%A9rentiels-th%C3%A9oriques--eurocode-2)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Three.js](https://img.shields.io/badge/Three.js-3D%20WebGL-black.svg)](https://threejs.org/)

Application de la suite [Aedificium](https://henri421.github.io/WebAedificium/) :
même barre, même mise en page en trois colonnes (saisie, dessin, verdicts) et
même note de calcul que les autres outils, grâce à la bibliothèque commune
`aedificium-ui`.

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

Dans les structures en béton armé, les **zones de discontinuité géométrique ou statique** (dites **Zones D**) ne respectent pas l'hypothèse de Navier-Bernoulli des sections planes. L'Eurocode 2 (EN 1992-1-1, chapitre 6.5 et annexe J) préconise pour ces éléments la **méthode des bielles et tirants** (*Strut-and-Tie Method* - STM), fondée sur le **théorème de la borne inférieure de la plasticité** :
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
| **Semelle sur 2 Pieux** | 2D | Répartition bielle-tirant vers 2 pieux d'appui |
| **Semelle sur 3 Pieux** | 3D | Méthode de Blévot — Cône spatial de 3 bielles et ceinture triangulaire fermée |
| **Semelle sur 4 Pieux** | 3D | Tétraèdre spatial sur 4 pieux d'angle |
| **Poutre-Cloison Standard** | 2D | Eurocode 2 §9.7 & CEB-FIP — Arc de décharge et tirant inférieur |
| **Poutre-Cloison avec Excentricité** | 2D | Asymétrie de charge et répartition différentielle des bielles vers les appuis |
| **Nœud de portique (angle)** | 2D | Angle de cadre — bielle diagonale et tirants d'angle |
| **Modèle libre** | 2D | Gabarit vide à compléter |
| **About entaillé** | 2D | Bielle de nez, tirant horizontal de nez et suspente verticale |
| **Poutre-cloison à trémie** | 2D | Linteau en arc avec tirant, bielles de trumeaux, tirant inférieur sous la trémie |

Chaque modèle fourni est vérifié par les tests : il se résout, s'équilibre, et
chaque barre travaille dans le rôle déclaré (bielle comprimée, tirant tendu).
Le modèle « console courte sur poutre » a été retiré le 2026-09-30 : c'était un
mécanisme, résolu faux sans alerte par l'ancien solveur. Les modèles « about
entaillé » et « poutre-cloison à trémie » ont été redessinés le même jour.

---

## Fonctionnalités Clés

- **Saisie par le dessin et par les tableaux** : l'éditeur 2D commun de la
  suite (outils sélection, nœud, barre, appui, charge, suppression, grille
  magnétique) et les tableaux des nœuds et des barres restent synchronisés ;
  un élément choisi dans l'un est surligné dans l'autre.
- **Dessin 2D (SVG)** :
  - Bielles comprimées en **bleu** et tirants tendus en **rouge**.
  - Réseau des **largeurs de bielles** ($w$) en option.
  - **Secteurs angulaires $\theta$** entre bielles et tirants, alerte si $\theta < 30^\circ$.
  - Cotes, efforts et réactions d'appui ($R_x, R_y$).
- **Vue 3D (Three.js)**, chargée à la demande : massifs extrudés, orbite,
  translation, zoom, sélection par clic des barres et des nœuds.
- **Verdicts** : taux d'utilisation de chaque bielle (§6.5.2), tirant (§6.5.3)
  et nœud (§6.5.4), pressions localisées (§6.7) et équilibre, avec le détail
  des calculs dans des volets.
- **Optimiseur de Schlaich** : propose de nouvelles positions des nœuds
  intérieurs, avec l'énergie avant et après ; on applique ou on renonce.
- **Historique et fichiers** : annulation et rétablissement (**Ctrl+Z** /
  **Ctrl+Y**), modèle en JSON (**Ctrl+S** pour enregistrer).
- **Sorties** : note de calcul de la suite (cartouche projet et élément),
  dessin en SVG, plan DXF, résultats en CSV.

---

## Contrôles & Raccourcis Clavier

| Raccourci / Action | Effet |
|---|---|
| `Ctrl + Z` (ou `Cmd + Z`) | Annuler la dernière action |
| `Ctrl + Y` (ou `Ctrl + Maj + Z`) | Rétablir l'action |
| `Ctrl + S` | Enregistrer le modèle en JSON |
| `Suppr` | Supprimer le nœud ou la barre choisie |
| `Échap` | Abandonner la barre en cours de tracé |
| `Clic gauche` glissé (vue 3D) | Rotation orbitale de la vue |
| `Clic droit` glissé (vue 3D) | Déplacement panoramique |
| `Molette de la souris` (vue 3D) | Zoom avant / arrière |

---

## Installation & Démarrage

### Prérequis
- [Node.js](https://nodejs.org/) v18 ou supérieur
- `npm` ou `pnpm`

### Installation
```bash
# Cloner le dépôt
git clone https://github.com/henri421/MBT.git
cd MBT

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
npm run preview   # sert dist/ sur http://localhost:3000
```
Les fichiers compilés et optimisés sont générés dans le dossier `dist/`.

### Application installable et fonctionnement hors-ligne (PWA)

L'application est distribuée comme *Progressive Web App* : elle s'installe sur le
poste de travail ou le téléphone et reste entièrement fonctionnelle sans
connexion, ce qui est cohérent avec le caractère strictement local des calculs
(aucune donnée de projet ne transite par le réseau).

- **Installation** : par le menu du navigateur (*Installer l'application* sous
  Chrome et Edge, *Partager* puis *Sur l'écran d'accueil* sous iOS).
- **Hors-ligne** : le service worker précache la page, ses scripts (dont le
  module 3D) et les icônes. Après une première visite, l'application démarre
  et calcule sans réseau. Aucune requête vers un CDN externe n'est émise.
- **Mises à jour** : le mode `prompt` est retenu plutôt qu'une mise à jour
  silencieuse. Une nouvelle version déclenche une invite explicite, afin de ne
  jamais recharger la page pendant l'édition d'un modèle.
- **Vérification en développement** : le service worker est également actif avec
  `npm run dev` (`devOptions.enabled`), l'installation et le mode hors-ligne
  sont donc testables sans build de production.

### Déploiement sur GitHub Pages

Le workflow `.github/workflows/deploy-pages.yml` compile et publie le dossier
`dist/` à chaque push sur `main`, ainsi qu'à la demande depuis l'onglet
*Actions*. L'application devient alors accessible depuis n'importe quel
navigateur à l'adresse `https://<utilisateur>.github.io/<dépôt>/`, et reste
installable comme PWA depuis cette adresse.

Activation, à effectuer une seule fois : dans *Settings* puis *Pages* du dépôt,
choisir **GitHub Actions** comme source. Le premier déploiement se déclenche au
push suivant sur `main`, ou manuellement via *Actions* puis *Déploiement GitHub
Pages* puis *Run workflow*.

La configuration Vite utilise une base relative (`base: './'`), si bien que le
site fonctionne indifféremment à la racine d'un domaine ou dans le sous-chemin
`/<dépôt>/` propre à Pages : les chemins des ressources, la portée du service
worker et le `start_url` du manifeste s'y résolvent correctement.

---

## Architecture du Code

```text
├── src/                         # Moteur, sans DOM
│   ├── index.ts                 # Point d'entrée public du moteur
│   ├── stm.ts                   # Types (nœuds, barres, matériaux, résultats)
│   ├── matrixSolver.ts          # Solveur matriciel du treillis 2D et 3D
│   ├── eurocode2.ts             # Vérifications EN 1992-1-1 (bielles, tirants, nœuds)
│   ├── rebarCalculator.ts       # Choix des armatures des tirants
│   ├── schlaichOptimizer.ts     # Optimisation énergétique de Schlaich
│   ├── geometryHelpers.ts       # Contours paramétriques du béton
│   ├── dimensionHelper.ts       # Cotes du dessin
│   ├── dxfExporter.ts           # Plan DXF
│   ├── svgExporter.ts           # Schéma SVG avec cartouche
│   └── templates.ts             # Catalogue des modèles
├── app/                         # La page
│   ├── index.html               # Trois colonnes : saisie, dessin, verdicts
│   ├── public/                  # Icônes de la PWA
│   └── src/
│       ├── main.ts              # Câblage : état, historique, éditeur, sorties
│       ├── modele.ts            # Modèle, actions de l'éditeur, JSON, calcul
│       ├── form.ts              # Champs du modèle, tableaux des nœuds et barres
│       ├── dessin.ts            # Dessin SVG 2D
│       ├── vue.ts               # Verdicts et tableaux des volets
│       ├── vue3d.ts             # Vue 3D three.js, chargée à la demande
│       ├── note.ts              # Note de calcul
│       ├── export.ts            # SVG autonome, CSV, noms de fichier
│       ├── pwa.ts               # Enregistrement du service worker
│       └── style.css            # Jetons et mise en page de la suite
├── tests/                       # Moteur (tests/*.test.ts) et page (tests/app/)
├── vite.config.ts               # Racine app/, PWA, configuration de Vitest
└── tsconfig.json                # Configuration TypeScript
```

---

## Licence

MIT — voir [LICENSE](LICENSE). Le logiciel est fourni « tel quel », **sans garantie
d'aucune sorte**, expresse ou implicite. C'est une aide au calcul selon
l'EN 1992-1-1 : les résultats relèvent de la responsabilité de l'ingénieur qui les
emploie et doivent être vérifiés.
