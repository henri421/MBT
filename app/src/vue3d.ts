/**
 * Vue 3D three.js du modele bielles-tirants.
 *
 * Portage SANS React de `src/components/Canvas3D.tsx` : scene, lumieres,
 * grille, beton, barres, noeuds, appuis, charges, rotation et zoom a la souris.
 * Ce module doit etre charge a la demande (import dynamique) : three.js est
 * lourd et n'est pas necessaire au premier affichage.
 */

import * as THREE from 'three';
import type { Selection } from 'aedificium-ui';
import type { ConcreteOutline, STMMember, STMNode, SolverResult } from '../../src/index';
import { findBoundaryIntersection } from '../../src/geometryHelpers';
import type { ModeleMbt } from './modele';
import { textes } from './textes';

const COULEUR_FOND = 0xffffff;
const COULEUR_BIELLE = 0x2f5d8a;
const COULEUR_TIRANT = 0xa8442a;
const COULEUR_BARRE_NEUTRE = 0x9a978f;
const COULEUR_BETON = 0xe7eaee;
const COULEUR_ARETE = 0x475569;

interface ObjetSelectionnable {
  mesh: THREE.Object3D;
  type: 'node' | 'member';
  id: string;
}

interface ObjetDisposable extends THREE.Object3D {
  geometry?: THREE.BufferGeometry;
  material?: THREE.Material | THREE.Material[];
}

function idNoeudChoisi(selection: Selection): string | null {
  return selection !== null && selection.type === 'noeud' ? selection.id : null;
}

function idBarreChoisie(selection: Selection): string | null {
  return selection !== null && selection.type === 'barre' ? selection.id : null;
}

/** Libere les geometries et materiaux d'un objet et de ses descendants. */
function libererObjet(objet: THREE.Object3D): void {
  objet.traverse((enfant) => {
    const o = enfant as ObjetDisposable;
    o.geometry?.dispose();
    const materiau = o.material;
    if (Array.isArray(materiau)) {
      materiau.forEach((mat) => mat.dispose());
    } else {
      materiau?.dispose();
    }
  });
}

/**
 * Monte la vue 3D dans `conteneur` et renvoie les fonctions de mise a jour et
 * de demontage. La selection courante est fournie par `o.selection`; un clic
 * sur un noeud, une barre ou le fond declenche `o.surChoix`.
 */
export function monterVue3d(
  conteneur: HTMLElement,
  m: ModeleMbt,
  r: SolverResult | null,
  o: { selection: Selection; surChoix(s: Selection): void },
): {
  mettreAJour(m: ModeleMbt, r: SolverResult | null, selection: Selection): void;
  detacher(): void;
} {
  let modele = m;
  let resultat = r;
  let selection = o.selection;

  let volumeBeton = true;
  let rotationAuto = false;
  let detache = false;

  conteneur.innerHTML = '';
  conteneur.style.position = conteneur.style.position || 'relative';
  conteneur.style.overflow = 'hidden';
  conteneur.style.userSelect = 'none';
  conteneur.style.cursor = 'grab';

  // Zone dediee au canvas three.js ; les evenements souris sont geres par le
  // conteneur (les boutons de controle restent cliquables).
  const montage = document.createElement('div');
  montage.style.position = 'absolute';
  montage.style.inset = '0';
  montage.style.width = '100%';
  montage.style.height = '100%';
  montage.style.pointerEvents = 'none';
  conteneur.appendChild(montage);

  const largeur = conteneur.clientWidth || 800;
  const hauteur = conteneur.clientHeight || 600;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xffffff);

  const camera = new THREE.PerspectiveCamera(45, largeur / hauteur, 0.05, 500);

  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setSize(largeur, hauteur);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.display = 'block';
  montage.appendChild(renderer.domElement);

  // Eclairage : lisibilite maximale du modele d'ingenierie.
  const lumiereAmbiante = new THREE.AmbientLight(0xffffff, 0.7);
  scene.add(lumiereAmbiante);

  const lumiereHemisphere = new THREE.HemisphereLight(0xffffff, 0xe2e8f0, 0.65);
  scene.add(lumiereHemisphere);

  const lumiereDirectionnelle1 = new THREE.DirectionalLight(0xffffff, 0.85);
  lumiereDirectionnelle1.position.set(10, 15, 10);
  lumiereDirectionnelle1.castShadow = true;
  lumiereDirectionnelle1.shadow.mapSize.width = 1024;
  lumiereDirectionnelle1.shadow.mapSize.height = 1024;
  scene.add(lumiereDirectionnelle1);

  const lumiereDirectionnelle2 = new THREE.DirectionalLight(0xffffff, 0.45);
  lumiereDirectionnelle2.position.set(-10, 8, -8);
  scene.add(lumiereDirectionnelle2);

  const lumiereDirectionnelle3 = new THREE.DirectionalLight(0xffffff, 0.35);
  lumiereDirectionnelle3.position.set(0, -10, 0);
  scene.add(lumiereDirectionnelle3);

  const grille = new THREE.GridHelper(8, 16, 0x94a3b8, 0xe2e8f0);
  grille.position.set(1.5, 0, 1.0);
  scene.add(grille);

  // Etat de l'orbite.
  const orbite = { radius: 4.5, theta: Math.PI / 4, phi: Math.PI / 3.2 };
  const cible = new THREE.Vector3(1.2, 0.6, 0.6);
  let premierCadrage = false;

  const rayon = { actif: false, mode: 'rotate' as 'rotate' | 'pan' };
  const sourisPrecedente = { x: 0, y: 0 };
  const sourisClic = { x: 0, y: 0 };
  const raycaster = new THREE.Raycaster();
  let objetsCliquables: ObjetSelectionnable[] = [];
  let groupeDynamique: THREE.Group | null = null;
  let idAnimation: number | null = null;

  const majCamera = (): void => {
    const { radius, theta, phi } = orbite;
    camera.position.x = cible.x + radius * Math.sin(phi) * Math.sin(theta);
    camera.position.y = cible.y + radius * Math.cos(phi);
    camera.position.z = cible.z + radius * Math.sin(phi) * Math.cos(theta);
    camera.lookAt(cible);
  };

  const cadrerModele = (force = false): void => {
    if (!force && premierCadrage) return;

    const est3D =
      modele.noeuds.some((n) => n.z !== undefined && Math.abs(n.z) > 0.001) ||
      !!modele.beton.bounds3D;
    const min = new THREE.Vector3(Infinity, Infinity, Infinity);
    const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);

    modele.noeuds.forEach((n) => {
      const px = n.x;
      const py = est3D ? n.z || 0 : n.y;
      const pz = est3D ? n.y : 0;
      min.min(new THREE.Vector3(px, py, pz));
      max.max(new THREE.Vector3(px, py, pz));
    });

    if (modele.beton.bounds3D) {
      const b = modele.beton.bounds3D;
      min.min(new THREE.Vector3(b.minX, b.minZ, b.minY));
      max.max(new THREE.Vector3(b.maxX, b.maxZ, b.maxY));
    } else if (modele.beton.points2D && modele.beton.points2D.length > 0) {
      const epaisseur = modele.beton.thickness || 0.3;
      modele.beton.points2D.forEach((pt) => {
        min.min(new THREE.Vector3(pt[0], pt[1], -epaisseur / 2));
        max.max(new THREE.Vector3(pt[0], pt[1], epaisseur / 2));
      });
    }

    if (!isFinite(min.x) || !isFinite(max.x)) {
      min.set(0, 0, 0);
      max.set(2, 1, 1);
    }

    const centre = new THREE.Vector3().addVectors(min, max).multiplyScalar(0.5);
    const taille = new THREE.Vector3().subVectors(max, min);
    const maxDim = Math.max(taille.x, taille.y, taille.z, 0.8);

    cible.copy(centre);
    orbite.radius = Math.max(maxDim * 2.2, 2.0);
    orbite.theta = Math.PI / 4.2;
    orbite.phi = Math.PI / 3.4;
    majCamera();

    grille.position.set(centre.x, 0, centre.z);
    premierCadrage = true;
  };

  /** Reconstruit le groupe des elements dynamiques (beton, barres, noeuds). */
  const construire = (): void => {
    if (groupeDynamique) {
      scene.remove(groupeDynamique);
      libererObjet(groupeDynamique);
      groupeDynamique = null;
    }

    const groupe = new THREE.Group();
    groupe.name = 'dynamic_stm';
    objetsCliquables = [];

    const beton: ConcreteOutline = modele.beton;
    const noeuds: STMNode[] = modele.noeuds;
    const barres: STMMember[] = modele.barres;
    const resultats = resultat;
    const idNoeud = idNoeudChoisi(selection);
    const idBarre = idBarreChoisie(selection);

    const est3D =
      noeuds.some((n) => n.z !== undefined && Math.abs(n.z) > 0.001) || !!beton.bounds3D;

    // En 3D : X civil = X three, Z civil (hauteur) = Y three, Y civil
    // (profondeur) = Z three. En 2D : X et Y civils dans le plan X/Y.
    const mapperPoint = (x: number, y: number, z?: number): THREE.Vector3 => {
      if (est3D) return new THREE.Vector3(x, z || 0, y);
      return new THREE.Vector3(x, y, 0);
    };

    // 1. Volume de beton.
    if (volumeBeton) {
      if (beton.bounds3D) {
        const b = beton.bounds3D;
        const tailleX = b.maxX - b.minX;
        const tailleY = b.maxZ - b.minZ;
        const tailleZ = b.maxY - b.minY;

        const geometrie = new THREE.BoxGeometry(tailleX, tailleY, tailleZ);
        const materiau = new THREE.MeshStandardMaterial({
          color: COULEUR_BETON,
          transparent: true,
          opacity: 0.22,
          roughness: 0.8,
          metalness: 0.1,
        });
        const mesh = new THREE.Mesh(geometrie, materiau);
        mesh.position.set(
          (b.minX + b.maxX) / 2,
          (b.minZ + b.maxZ) / 2,
          (b.minY + b.maxY) / 2,
        );
        groupe.add(mesh);

        const aretes = new THREE.EdgesGeometry(geometrie);
        const ligne = new THREE.LineSegments(
          aretes,
          new THREE.LineBasicMaterial({ color: COULEUR_ARETE, linewidth: 2 }),
        );
        ligne.position.copy(mesh.position);
        groupe.add(ligne);
      } else if (beton.points2D && beton.points2D.length >= 3) {
        try {
          const forme = new THREE.Shape();
          beton.points2D.forEach((p, index) => {
            if (index === 0) forme.moveTo(p[0], p[1]);
            else forme.lineTo(p[0], p[1]);
          });
          forme.closePath();

          const epaisseur = beton.thickness || 0.3;
          const geometrie = new THREE.ExtrudeGeometry(forme, {
            depth: epaisseur,
            bevelEnabled: false,
          });

          const materiau = new THREE.MeshStandardMaterial({
            color: COULEUR_BETON,
            transparent: true,
            opacity: 0.22,
            roughness: 0.75,
            metalness: 0.05,
          });
          const mesh = new THREE.Mesh(geometrie, materiau);
          mesh.position.set(0, 0, -epaisseur / 2);
          groupe.add(mesh);

          const aretes = new THREE.EdgesGeometry(geometrie);
          const ligne = new THREE.LineSegments(
            aretes,
            new THREE.LineBasicMaterial({ color: COULEUR_ARETE, linewidth: 2 }),
          );
          ligne.position.set(0, 0, -epaisseur / 2);
          groupe.add(ligne);
        } catch (err) {
          console.warn('3D ExtrudeGeometry fallback:', err);
        }
      }
    }

    // 2. Barres : bielles en bleu, tirants en rouge, neutres en gris.
    barres.forEach((barre) => {
      const n1 = noeuds.find((n) => n.id === barre.fromNodeId);
      const n2 = noeuds.find((n) => n.id === barre.toNodeId);
      if (!n1 || !n2) return;

      const p1 = mapperPoint(n1.x, n1.y, n1.z);
      const p2 = mapperPoint(n2.x, n2.y, n2.z);
      const direction = new THREE.Vector3().subVectors(p2, p1);
      const longueur = direction.length();
      if (longueur < 1e-4) return;

      const res = resultats?.memberResults.get(barre.id);
      const force = res?.force ?? 0;
      const estCompression =
        force < -0.01 || (res === undefined && barre.type === 'strut');
      const estTension = force > 0.01 || (res === undefined && barre.type === 'tie');

      let rayonBarre = estCompression ? 0.045 : 0.03;
      if (res?.effectiveWidthRequired) {
        rayonBarre = Math.min(Math.max(res.effectiveWidthRequired / 2000, 0.025), 0.12);
      }

      const geometrie = new THREE.CylinderGeometry(rayonBarre, rayonBarre, longueur, 24);
      const estChoisie = idBarre === barre.id;

      let couleur = COULEUR_BARRE_NEUTRE;
      if (estCompression) couleur = COULEUR_BIELLE;
      else if (estTension) couleur = COULEUR_TIRANT;

      const materiau = new THREE.MeshStandardMaterial({
        color: couleur,
        roughness: 0.35,
        metalness: estTension ? 0.65 : 0.2,
        emissive: estChoisie ? 0xffffff : 0x000000,
        emissiveIntensity: estChoisie ? 0.35 : 0.0,
      });

      const cylindre = new THREE.Mesh(geometrie, materiau);
      const milieu = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
      cylindre.position.copy(milieu);

      const haut = new THREE.Vector3(0, 1, 0);
      const sens = direction.clone().normalize();
      const quaternion = new THREE.Quaternion().setFromUnitVectors(haut, sens);
      cylindre.quaternion.copy(quaternion);

      groupe.add(cylindre);
      objetsCliquables.push({ mesh: cylindre, type: 'member', id: barre.id });

      // Anneaux d'acier le long des tirants tendus.
      if (estTension) {
        const geometrieAnneau = new THREE.TorusGeometry(rayonBarre * 1.35, 0.007, 8, 20);
        const materiauAnneau = new THREE.MeshStandardMaterial({
          color: 0xfdba74,
          metalness: 0.8,
          roughness: 0.2,
        });
        for (let t = 0.2; t <= 0.8; t += 0.2) {
          const anneau = new THREE.Mesh(geometrieAnneau, materiauAnneau);
          anneau.position.copy(p1).lerp(p2, t);
          anneau.quaternion.copy(quaternion);
          anneau.rotateX(Math.PI / 2);
          groupe.add(anneau);
        }
      }
    });

    // 3. Noeuds : spheres, appuis et fleches de charge.
    noeuds.forEach((noeud) => {
      const pos = mapperPoint(noeud.x, noeud.y, noeud.z);
      const estChoisi = idNoeud === noeud.id;
      const resNoeud = resultats?.nodeResults.get(noeud.id);
      const typeNoeud = resNoeud?.nodeType || noeud.nodeType || 'CCC';

      let couleurNoeud = 0x0284c7; // CCC
      if (typeNoeud === 'CCT') couleurNoeud = 0xd97706;
      if (typeNoeud === 'CTT') couleurNoeud = 0xdc2626;

      const rayonNoeud = estChoisi ? 0.065 : 0.048;
      const geometrieSphere = new THREE.SphereGeometry(rayonNoeud, 24, 24);
      const materiauSphere = new THREE.MeshStandardMaterial({
        color: couleurNoeud,
        roughness: 0.3,
        metalness: 0.2,
        emissive: estChoisi ? 0xffffff : 0x000000,
        emissiveIntensity: estChoisi ? 0.4 : 0.0,
      });
      const sphere = new THREE.Mesh(geometrieSphere, materiauSphere);
      sphere.position.copy(pos);
      groupe.add(sphere);
      objetsCliquables.push({ mesh: sphere, type: 'node', id: noeud.id });

      const fVert = est3D ? noeud.fz || noeud.fy || 0 : noeud.fy || 0;
      const fHoriz = noeud.fx || 0;
      const aCharge = Math.abs(fVert) > 1 || Math.abs(fHoriz) > 1;

      // 3.1 Surface d'appui (pieu ou plaque sous l'element).
      if (noeud.isSupport) {
        let posAppui = pos.clone();
        if (!est3D && beton.points2D && beton.points2D.length >= 3) {
          const estRouleauY = noeud.supportType === 'roller_y';
          const directionAppui = estRouleauY ? 'left' : 'down';
          const pointLimite = findBoundaryIntersection(
            beton.points2D,
            noeud.x,
            noeud.y,
            directionAppui,
          );
          if (pointLimite) {
            posAppui = mapperPoint(pointLimite.x, pointLimite.y, noeud.z);
            if (pos.distanceTo(posAppui) > 0.005) {
              const geometrieDiffusion = new THREE.BufferGeometry().setFromPoints([
                pos,
                posAppui,
              ]);
              const materiauDiffusion = new THREE.LineDashedMaterial({
                color: COULEUR_ARETE,
                dashSize: 0.03,
                gapSize: 0.02,
              });
              const ligneDiffusion = new THREE.Line(geometrieDiffusion, materiauDiffusion);
              ligneDiffusion.computeLineDistances();
              groupe.add(ligneDiffusion);
            }
          }
        }

        if (noeud.bearingShape === 'circular') {
          const diametre = noeud.bearingDiameter || noeud.bearingWidth || 0.4;
          const rayonPieu = diametre / 2;
          const hauteurPieu = 0.38;
          const geometriePieu = new THREE.CylinderGeometry(rayonPieu, rayonPieu, hauteurPieu, 24);
          const materiauPieu = new THREE.MeshStandardMaterial({
            color: 0x475569,
            metalness: 0.3,
            roughness: 0.6,
          });
          const pieu = new THREE.Mesh(geometriePieu, materiauPieu);
          pieu.position.set(posAppui.x, posAppui.y - hauteurPieu / 2 - 0.01, posAppui.z);
          groupe.add(pieu);

          const geometrieBague = new THREE.CylinderGeometry(
            rayonPieu * 1.02,
            rayonPieu * 1.02,
            0.02,
            24,
          );
          const materiauBague = new THREE.MeshStandardMaterial({
            color: 0x1e293b,
            metalness: 0.5,
            roughness: 0.3,
          });
          const bague = new THREE.Mesh(geometrieBague, materiauBague);
          bague.position.set(posAppui.x, posAppui.y - 0.01, posAppui.z);
          groupe.add(bague);
        } else {
          const largeurPlaque = noeud.bearingWidth || 0.3;
          const profondeurPlaque =
            noeud.bearingDepth || (est3D ? largeurPlaque : beton.thickness || 0.3);
          const geometriePlaque = new THREE.BoxGeometry(largeurPlaque, 0.04, profondeurPlaque);
          const materiauPlaque = new THREE.MeshStandardMaterial({
            color: 0x334155,
            metalness: 0.6,
            roughness: 0.4,
          });
          const plaque = new THREE.Mesh(geometriePlaque, materiauPlaque);
          plaque.position.set(posAppui.x, posAppui.y - 0.025, posAppui.z);
          groupe.add(plaque);
        }
      }

      // 3.2 Surface de contact des noeuds charges.
      if (
        !noeud.isSupport &&
        (aCharge || noeud.bearingWidth !== undefined || noeud.bearingDiameter !== undefined)
      ) {
        let posContact = pos.clone();
        let directionContact: 'up' | 'down' | 'left' | 'right' = 'up';

        if (fVert < -1) directionContact = 'up';
        else if (fVert > 1) directionContact = 'down';
        else if (fHoriz > 1) directionContact = 'right';
        else if (fHoriz < -1) directionContact = 'left';

        if (!est3D && beton.points2D && beton.points2D.length >= 3) {
          const pointLimite = findBoundaryIntersection(
            beton.points2D,
            noeud.x,
            noeud.y,
            directionContact,
          );
          if (pointLimite) {
            posContact = mapperPoint(pointLimite.x, pointLimite.y, noeud.z);
            if (pos.distanceTo(posContact) > 0.005) {
              const geometrieDiffusion = new THREE.BufferGeometry().setFromPoints([
                pos,
                posContact,
              ]);
              const materiauDiffusion = new THREE.LineDashedMaterial({
                color: 0xdc2626,
                dashSize: 0.03,
                gapSize: 0.02,
              });
              const ligneDiffusion = new THREE.Line(geometrieDiffusion, materiauDiffusion);
              ligneDiffusion.computeLineDistances();
              groupe.add(ligneDiffusion);
            }
          }
        } else if (est3D && beton.bounds3D) {
          posContact = new THREE.Vector3(pos.x, beton.bounds3D.maxZ, pos.z);
        }

        if (noeud.bearingShape === 'circular') {
          const diametre = noeud.bearingDiameter || noeud.bearingWidth || 0.4;
          const rayonColonne = diametre / 2;
          const hauteurColonne = 0.16;
          const geometrieColonne = new THREE.CylinderGeometry(
            rayonColonne,
            rayonColonne,
            hauteurColonne,
            24,
          );
          const materiauColonne = new THREE.MeshStandardMaterial({
            color: 0x334155,
            metalness: 0.4,
            roughness: 0.4,
          });
          const colonne = new THREE.Mesh(geometrieColonne, materiauColonne);
          colonne.position.set(
            posContact.x,
            posContact.y + hauteurColonne / 2 + 0.005,
            posContact.z,
          );
          groupe.add(colonne);
        } else {
          const largeurPlaque = noeud.bearingWidth || 0.3;
          const profondeurPlaque =
            noeud.bearingDepth || (est3D ? largeurPlaque : beton.thickness || 0.3);
          const hauteurPlaque = 0.06;
          const geometriePlaque = new THREE.BoxGeometry(
            largeurPlaque,
            hauteurPlaque,
            profondeurPlaque,
          );
          const materiauPlaque = new THREE.MeshStandardMaterial({
            color: 0x334155,
            metalness: 0.5,
            roughness: 0.35,
          });
          const plaque = new THREE.Mesh(geometriePlaque, materiauPlaque);
          plaque.position.set(
            posContact.x,
            posContact.y + hauteurPlaque / 2 + 0.005,
            posContact.z,
          );
          groupe.add(plaque);
        }
      }

      // 3.3 Fleche de la force exterieure appliquee.
      if (aCharge) {
        const direction3D = new THREE.Vector3(
          fHoriz !== 0 ? (fHoriz > 0 ? 1 : -1) : 0,
          fVert !== 0 ? (fVert > 0 ? 1 : -1) : 0,
          0,
        ).normalize();

        let pointCible = pos;
        if (!est3D && beton.points2D && fVert < -1) {
          const pointLimite = findBoundaryIntersection(
            beton.points2D,
            noeud.x,
            noeud.y,
            'up',
          );
          if (pointLimite) {
            const surplombPlaque = noeud.bearingShape === 'circular' ? 0.16 : 0.06;
            pointCible = new THREE.Vector3(pointLimite.x, pointLimite.y + surplombPlaque, 0);
          }
        }

        const origineFleche = new THREE.Vector3(
          pointCible.x - direction3D.x * 0.45,
          pointCible.y - direction3D.y * 0.45,
          pointCible.z,
        );
        const fleche = new THREE.ArrowHelper(direction3D, origineFleche, 0.45, 0xdc2626, 0.13, 0.08);
        groupe.add(fleche);
      }
    });

    scene.add(groupe);
    groupeDynamique = groupe;
  };

  const vientDesControles = (evenement: Event): boolean =>
    evenement.target instanceof Element &&
    evenement.target.closest('[data-vue3d-controle]') !== null;

  const surSourisBas = (evenement: MouseEvent): void => {
    if (vientDesControles(evenement)) return;
    rayon.actif = true;
    rayon.mode = evenement.button === 2 || evenement.shiftKey ? 'pan' : 'rotate';
    sourisPrecedente.x = evenement.clientX;
    sourisPrecedente.y = evenement.clientY;
    sourisClic.x = evenement.clientX;
    sourisClic.y = evenement.clientY;
  };

  const surSourisDeplacement = (evenement: MouseEvent): void => {
    if (!rayon.actif) return;
    const dx = evenement.clientX - sourisPrecedente.x;
    const dy = evenement.clientY - sourisPrecedente.y;
    sourisPrecedente.x = evenement.clientX;
    sourisPrecedente.y = evenement.clientY;

    if (rayon.mode === 'rotate') {
      orbite.theta -= dx * 0.007;
      orbite.phi = Math.max(0.05, Math.min(Math.PI - 0.05, orbite.phi - dy * 0.007));
      majCamera();
    } else {
      const facteur = orbite.radius * 0.0015;
      const droite = new THREE.Vector3();
      const haut = new THREE.Vector3(0, 1, 0);
      droite.crossVectors(camera.getWorldDirection(new THREE.Vector3()), haut).normalize();
      cible.addScaledVector(droite, -dx * facteur);
      cible.y += dy * facteur;
      majCamera();
    }
  };

  const surSourisHaut = (evenement: MouseEvent): void => {
    if (vientDesControles(evenement)) {
      rayon.actif = false;
      return;
    }
    rayon.actif = false;

    const distanceCarree =
      Math.pow(evenement.clientX - sourisClic.x, 2) +
      Math.pow(evenement.clientY - sourisClic.y, 2);

    if (distanceCarree < 16) {
      const rect = conteneur.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const sourisX = ((evenement.clientX - rect.left) / rect.width) * 2 - 1;
      const sourisY = -((evenement.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(new THREE.Vector2(sourisX, sourisY), camera);
      const maillages = objetsCliquables.map((objet) => objet.mesh);
      const intersections = raycaster.intersectObjects(maillages, false);

      if (intersections.length > 0) {
        const touche = objetsCliquables.find(
          (objet) => objet.mesh === intersections[0].object,
        );
        if (touche) {
          o.surChoix(
            touche.type === 'node'
              ? { type: 'noeud', id: touche.id }
              : { type: 'barre', id: touche.id },
          );
          return;
        }
      }

      o.surChoix(null);
    }
  };

  const surMolette = (evenement: WheelEvent): void => {
    evenement.preventDefault();
    const facteurZoom = evenement.deltaY > 0 ? 1.08 : 0.92;
    orbite.radius = Math.max(0.8, Math.min(30.0, orbite.radius * facteurZoom));
    majCamera();
  };

  const surMenuContextuel = (evenement: Event): void => {
    evenement.preventDefault();
  };

  const zoomer = (facteur: number): void => {
    orbite.radius = Math.max(0.8, Math.min(30.0, orbite.radius * facteur));
    majCamera();
  };

  const recadrer = (): void => {
    premierCadrage = false;
    cadrerModele(true);
  };

  conteneur.addEventListener('mousedown', surSourisBas);
  conteneur.addEventListener('mousemove', surSourisDeplacement);
  conteneur.addEventListener('mouseup', surSourisHaut);
  conteneur.addEventListener('wheel', surMolette, { passive: false });
  conteneur.addEventListener('contextmenu', surMenuContextuel);

  // Barre de controle : simples boutons HTML, sans icone ni React.
  const controles = document.createElement('div');
  controles.dataset.vue3dControle = '';
  controles.style.position = 'absolute';
  controles.style.top = '16px';
  controles.style.right = '16px';
  controles.style.display = 'flex';
  controles.style.alignItems = 'center';
  controles.style.gap = '6px';
  controles.style.padding = '4px';
  controles.style.background = 'rgba(255, 255, 255, 0.92)';
  controles.style.border = '1px solid #e2e8f0';
  controles.style.borderRadius = '8px';
  controles.style.boxShadow = '0 2px 8px rgba(15, 23, 42, 0.12)';
  controles.style.zIndex = '10';
  conteneur.appendChild(controles);

  const creerBouton = (id: string, texte: string, titre: string): HTMLButtonElement => {
    const bouton = document.createElement('button');
    bouton.id = id;
    bouton.type = 'button';
    bouton.textContent = texte;
    bouton.title = titre;
    bouton.style.font = '600 12px system-ui, sans-serif';
    bouton.style.color = '#334155';
    bouton.style.background = '#ffffff';
    bouton.style.border = '1px solid #e2e8f0';
    bouton.style.borderRadius = '6px';
    bouton.style.padding = '4px 8px';
    bouton.style.cursor = 'pointer';
    controles.appendChild(bouton);
    return bouton;
  };

  const boutonBeton = creerBouton(
    'btn-3d-toggle-concrete',
    textes().vue3d.beton,
    textes().vue3d.betonTitre,
  );
  boutonBeton.addEventListener('click', () => {
    volumeBeton = !volumeBeton;
    boutonBeton.style.background = volumeBeton ? '#0f172a' : '#ffffff';
    boutonBeton.style.color = volumeBeton ? '#ffffff' : '#334155';
    construire();
    cadrerModele(true);
  });

  const boutonZoomPlus = creerBouton('btn-3d-zoom-in', 'Zoom +', textes().vue3d.zoomPlusTitre);
  boutonZoomPlus.addEventListener('click', () => zoomer(0.85));

  const boutonZoomMoins = creerBouton('btn-3d-zoom-out', 'Zoom −', textes().vue3d.zoomMoinsTitre);
  boutonZoomMoins.addEventListener('click', () => zoomer(1.15));

  const boutonRotation = creerBouton(
    'btn-3d-autorotate',
    textes().vue3d.rotation,
    textes().vue3d.rotationTitre,
  );
  boutonRotation.addEventListener('click', () => {
    rotationAuto = !rotationAuto;
    boutonRotation.style.background = rotationAuto ? '#fee2e2' : '#ffffff';
    boutonRotation.style.color = rotationAuto ? '#b91c1c' : '#334155';
  });

  const boutonRecadrer = creerBouton(
    'btn-3d-reset-view',
    textes().vue3d.recadrer,
    textes().vue3d.recadrerTitre,
  );
  boutonRecadrer.addEventListener('click', recadrer);

  const observateurRedimension = new ResizeObserver((entrees) => {
    for (const entree of entrees) {
      const { width, height } = entree.contentRect;
      if (width > 0 && height > 0) {
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height);
      }
    }
  });
  observateurRedimension.observe(conteneur);

  const animer = (): void => {
    if (detache) return;
    if (rotationAuto) {
      orbite.theta += 0.006;
      majCamera();
    }
    renderer.render(scene, camera);
    idAnimation = requestAnimationFrame(animer);
  };

  majCamera();
  construire();
  cadrerModele(true);
  animer();

  return {
    mettreAJour(modeleSuivant: ModeleMbt, resultatSuivant: SolverResult | null, selectionSuivante: Selection): void {
      if (detache) return;
      modele = modeleSuivant;
      resultat = resultatSuivant;
      selection = selectionSuivante;
      construire();
      cadrerModele(true);
    },

    detacher(): void {
      if (detache) return;
      detache = true;

      if (idAnimation !== null) {
        cancelAnimationFrame(idAnimation);
        idAnimation = null;
      }

      observateurRedimension.disconnect();

      conteneur.removeEventListener('mousedown', surSourisBas);
      conteneur.removeEventListener('mousemove', surSourisDeplacement);
      conteneur.removeEventListener('mouseup', surSourisHaut);
      conteneur.removeEventListener('wheel', surMolette);
      conteneur.removeEventListener('contextmenu', surMenuContextuel);

      if (groupeDynamique) {
        scene.remove(groupeDynamique);
        libererObjet(groupeDynamique);
        groupeDynamique = null;
      }
      libererObjet(scene);

      renderer.dispose();
      if (montage.contains(renderer.domElement)) {
        montage.removeChild(renderer.domElement);
      }
      if (conteneur.contains(controles)) {
        conteneur.removeChild(controles);
      }
      if (conteneur.contains(montage)) {
        conteneur.removeChild(montage);
      }
    },
  };
}
