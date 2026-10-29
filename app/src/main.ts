/**
 * Câblage de la page : état, éditeur commun, rendu et sorties.
 *
 * Ce module ne calcule rien lui-même : il assemble les modules purs
 * (`modele`, `form`, `dessin`, `vue`, `note`, `export`) et l'éditeur commun
 * d'`aedificium-ui`. La vue 3D n'est chargée qu'à la demande.
 */

import {
  annuler,
  brancherEditeur,
  echapper,
  historique,
  nombreAffiche,
  noteDeCalculHtml,
  ouvrirOuTelecharger,
  pousser,
  retablir,
  telecharger,
  type ActionEditeur,
  type ContexteEditeur,
  type Outil,
  type Selection,
} from 'aedificium-ui';
import { PRESETS, generateStmDxf, optimizeSchlaichEnergy, type OptimizationResult } from '../../src/index';
import {
  appliquerAction,
  calculer,
  grapheDuModele,
  modeleDepuisJson,
  modeleDepuisPrereglage,
  modeleEnJson,
  modeleParDefaut,
  type ModeleMbt,
} from './modele';
import {
  champsModeleHtml,
  elementChoisiHtml,
  modifierChamp,
  tableBarresHtml,
  tableNoeudsHtml,
  type Cible,
} from './form';
import { OPTIONS_DESSIN, dessinModele, vueDuModele, type OptionsDessin } from './dessin';
import {
  tableauBielles,
  tableauHtml,
  tableauNoeuds,
  tableauReactions,
  tableauTirants,
  verdictsDuCalcul,
  verdictsHtml,
} from './vue';
import { noteDuCalcul } from './note';
import { STYLES_TRACE, nomDeFichier, resultatsCsv, svgDuDessin } from './export';

// --- Accès au DOM -----------------------------------------------------------

function parRole<T extends Element = HTMLElement>(role: string): T {
  const el = document.querySelector<T>(`[data-role="${role}"]`);
  if (!el) throw new Error(`Élément [data-role="${role}"] introuvable dans la page.`);
  return el;
}

const selectModele = parRole<HTMLSelectElement>('modele');
const champsModeleEl = parRole('champs-modele');
const noeudsEl = parRole('noeuds');
const barresEl = parRole('barres');
const elementChoisiEl = parRole('element-choisi');
const outilsEl = parRole('outils');
const zone = parRole<SVGSVGElement>('zone');
const zone3d = parRole('zone-3d');
const statutEl = parRole('statut');
const voletsEl = parRole('volets');
const listeVerdictsEl = parRole('liste-verdicts');
const projetEl = parRole<HTMLInputElement>('projet');
const elementEl = parRole<HTMLInputElement>('element');
const fichierJsonEl = parRole<HTMLInputElement>('fichier-json');

// --- État -------------------------------------------------------------------

const premier = PRESETS[0];
let hist = historique(premier ? modeleDepuisPrereglage(premier) : modeleParDefaut());
let selection: Selection = null;
let outil: Outil = 'selection';
let dernierResultat: ReturnType<typeof calculer> | null = null;
let mode3d = false;
let instance3d: { detacher(): void } | null = null;

/** Pas de la grille aimantee (m) quand l'option est cochee. */
const PAS_GRILLE = 0.05;
let grilleActive = true;
const options: OptionsDessin = { ...OPTIONS_DESSIN };

/** Options du dessin courantes : la grille porte son pas, ou null. */
function optionsDessin(): OptionsDessin {
  return { ...options, selection, grille: grilleActive ? PAS_GRILLE : null };
}

let derniereOptimisation: OptimizationResult | null = null;

const CLE_CARTOUCHE = 'mbt:cartouche';

// --- Éditeur -----------------------------------------------------------------

const editeur = brancherEditeur(zone, {
  contexte: (): ContexteEditeur => ({
    vue: vueDuModele(hist.present, 640, 520),
    outil,
    graphe: grapheDuModele(hist.present),
    pas: grilleActive ? PAS_GRILLE : null,
    tolerancePx: 8,
  }),
  surAction: (action) => traiterAction(action),
});

function synchroniserSelection(): void {
  editeur.definirEtat({ ...editeur.etat(), selection });
}

function traiterAction(action: ActionEditeur): void {
  if (action.type === 'annuler') {
    hist = annuler(hist);
    synchroniserSelection();
    redessiner();
    return;
  }
  if (action.type === 'retablir') {
    hist = retablir(hist);
    synchroniserSelection();
    redessiner();
    return;
  }
  if (action.type === 'survol') {
    const p = action.point;
    const aimante = action.noeud ? ` · aimanté sur ${action.noeud}` : '';
    statutEl.textContent = `x = ${nombreAffiche(p.x)} m · y = ${nombreAffiche(p.y)} m${aimante}`;
    return;
  }

  const resultat = appliquerAction(hist.present, action);
  hist = resultat.historiser ? pousser(hist, resultat.modele) : { ...hist, present: resultat.modele };
  selection = resultat.selection === undefined ? selection : resultat.selection;
  synchroniserSelection();
  redessiner();
}

// --- Rendu ------------------------------------------------------------------

function etatDessin(): {
  m: ModeleMbt;
  r: ReturnType<typeof calculer>;
  vue: ReturnType<typeof vueDuModele>;
  dessin: string;
} {
  const m = hist.present;
  const r = calculer(m);
  const vue = vueDuModele(m, 640, 520);
  const dessin = dessinModele(m, r, vue, optionsDessin());
  return { m, r, vue, dessin };
}

function redessiner(): void {
  const { m, r, dessin } = etatDessin();
  dernierResultat = r;

  zone.innerHTML = dessin;
  champsModeleEl.innerHTML = champsModeleHtml(m);
  noeudsEl.innerHTML = tableNoeudsHtml(m, selection);
  barresEl.innerHTML = tableBarresHtml(m, selection);
  elementChoisiEl.innerHTML = elementChoisiHtml(m, selection);
  listeVerdictsEl.innerHTML = verdictsHtml(verdictsDuCalcul(r));

  const tableaux = [
    tableauBielles(m, r),
    tableauTirants(m, r),
    tableauNoeuds(m, r),
    tableauReactions(m, r),
  ];
  const conteneurs = voletsEl.querySelectorAll<HTMLElement>('details > div');
  tableaux.forEach((tableau, i) => {
    const conteneur = conteneurs[i];
    if (conteneur) conteneur.innerHTML = tableauHtml(tableau);
  });

  if (mode3d) void monter3d();
}

// --- Vue 3D chargée à la demande --------------------------------------------

async function monter3d(): Promise<void> {
  if (!mode3d) return;
  const module = await import('./vue3d');
  if (!mode3d) return;
  instance3d?.detacher();
  instance3d = module.monterVue3d(zone3d, hist.present, dernierResultat, {
    selection,
    surChoix(s: Selection) {
      selection = s;
      synchroniserSelection();
      redessiner();
    },
  });
}

function afficherVue3d(): void {
  mode3d = true;
  zone.style.display = 'none';
  zone3d.hidden = false;
  majBoutonsVue();
  void monter3d();
}

function afficherVue2d(): void {
  mode3d = false;
  instance3d?.detacher();
  instance3d = null;
  zone.style.display = '';
  zone3d.hidden = true;
  majBoutonsVue();
}

function majBoutonsVue(): void {
  outilsEl.querySelector<HTMLElement>('[data-action="vue-2d"]')?.classList.toggle('actif', !mode3d);
  outilsEl.querySelector<HTMLElement>('[data-action="vue-3d"]')?.classList.toggle('actif', mode3d);
}

// --- Outils et actions -------------------------------------------------------

function choisirOutil(nouvelOutil: Outil): void {
  outil = nouvelOutil;
  outilsEl.querySelectorAll<HTMLElement>('[data-outil]').forEach((b) => {
    b.classList.toggle('actif', b.dataset.outil === outil);
  });
}

function choisirElement(valeur: string): void {
  const g = grapheDuModele(hist.present);
  const [prefixe, ...reste] = valeur.split(':');
  const id = reste.join(':');
  if ((prefixe === 'noeud' || prefixe === 'barre') && id) {
    selection = { type: prefixe, id };
  } else if (g.noeuds.some((n) => n.id === valeur)) {
    selection = { type: 'noeud', id: valeur };
  } else if (g.barres.some((b) => b.id === valeur)) {
    selection = { type: 'barre', id: valeur };
  } else {
    return;
  }
  synchroniserSelection();
  redessiner();
}

function cibleDuChamp(el: HTMLElement): Cible | null {
  const brut = el.dataset.cible;
  if (!brut) return null;
  if (brut === 'modele') return { type: 'modele' };
  const [prefixe, ...reste] = brut.split(':');
  const id = reste.join(':') || el.dataset.id || '';
  if ((prefixe === 'noeud' || prefixe === 'barre') && id) return { type: prefixe, id };
  const type = el.dataset.type;
  if (type === 'noeud' || type === 'barre') return { type, id: brut };
  return null;
}

function afficherErreurChamp(el: HTMLElement, message: string): void {
  el.parentElement?.querySelector('.erreur-champ')?.remove();
  const erreur = document.createElement('span');
  erreur.className = 'erreur-champ';
  erreur.textContent = message;
  el.insertAdjacentElement('afterend', erreur);
  el.setAttribute('aria-invalid', 'true');
}

function appliquerPrereglage(index: number): void {
  const preset = PRESETS[index];
  if (!preset) return;
  hist = historique(modeleDepuisPrereglage(preset));
  selection = null;
  derniereOptimisation = null;
  synchroniserSelection();
  redessiner();
}

function executerAction(action: string): void {
  switch (action) {
    case 'annuler':
      hist = annuler(hist);
      synchroniserSelection();
      redessiner();
      break;
    case 'retablir':
      hist = retablir(hist);
      synchroniserSelection();
      redessiner();
      break;
    case 'vue-2d':
      afficherVue2d();
      break;
    case 'vue-3d':
      afficherVue3d();
      break;
    case 'exporter-note':
      exporterNote();
      break;
    case 'exporter-svg':
      exporterSvg();
      break;
    case 'exporter-dxf':
      exporterDxf();
      break;
    case 'exporter-csv':
      exporterCsv();
      break;
    case 'enregistrer-json':
      enregistrerJson();
      break;
    case 'ouvrir-json':
      fichierJsonEl.click();
      break;
    case 'optimiser':
      lancerOptimisation();
      break;
    case 'optimiser-appliquer':
      appliquerOptimisation();
      break;
    case 'optimiser-fermer':
      fermerOptimisation();
      break;
    default:
      break;
  }
}

// --- Sorties ----------------------------------------------------------------

function nomBase(): string {
  return nomDeFichier(hist.present.nom);
}

function enregistrerJson(): void {
  const m = hist.present;
  telecharger(`${nomBase()}.json`, modeleEnJson(m, new Date().toISOString()), 'application/json');
}

function exporterNote(): void {
  const { m, r, dessin } = etatDessin();
  enregistrerCartouche();
  const cartouche = {
    projet: projetEl.value,
    element: elementEl.value || m.nom,
    date: new Date().toISOString().slice(0, 10),
  };
  const note = noteDuCalcul(m, r, cartouche, dessin);
  ouvrirOuTelecharger(`${nomBase()}-note.html`, noteDeCalculHtml(note, STYLES_TRACE));
}

function exporterSvg(): void {
  const { dessin } = etatDessin();
  telecharger(`${nomBase()}.svg`, svgDuDessin(dessin), 'image/svg+xml');
}

function exporterDxf(): void {
  const { m, r } = etatDessin();
  const dxf = generateStmDxf(m.noeuds, m.barres, m.beton, r, {
    modelTitle: m.nom,
    scaleToMm: true,
  });
  telecharger(`${nomBase()}.dxf`, dxf, 'application/dxf');
}

function exporterCsv(): void {
  const { m, r } = etatDessin();
  telecharger(`${nomBase()}.csv`, resultatsCsv(m, r), 'text/csv');
}

// --- Cartouche mémorisé -----------------------------------------------------

function chargerCartouche(): void {
  try {
    const brut = localStorage.getItem(CLE_CARTOUCHE);
    if (!brut) return;
    const o = JSON.parse(brut) as { projet?: unknown; element?: unknown };
    if (typeof o.projet === 'string') projetEl.value = o.projet;
    if (typeof o.element === 'string') elementEl.value = o.element;
  } catch {
    // Stockage indisponible : on garde les champs vides.
  }
}

function enregistrerCartouche(): void {
  try {
    localStorage.setItem(CLE_CARTOUCHE, JSON.stringify({ projet: projetEl.value, element: elementEl.value }));
  } catch {
    // Stockage indisponible : sans conséquence sur le calcul.
  }
}

// --- Optimiseur de Schlaich -------------------------------------------------

function installerVoletOptimisation(): void {
  const volet = voletsEl.querySelectorAll('details')[4];
  const conteneur = volet?.querySelector('div');
  if (!conteneur) return;
  conteneur.innerHTML =
    '<p>Déplace les nœuds libres pour réduire l\'énergie du treillis.</p>' +
    '<button type="button" data-action="optimiser">Optimiser (Schlaich)</button>' +
    '<div data-role="resultat-optimisation"></div>';
}

function lancerOptimisation(): void {
  const conteneur = document.querySelector<HTMLElement>('[data-role="resultat-optimisation"]');
  const m = hist.present;
  try {
    const o = optimizeSchlaichEnergy(m.noeuds, m.barres, m.materiauBeton, m.acier, m.beton, m.dimension);
    derniereOptimisation = o;
    const deplaces = o.optimizedNodes.some((n) => {
      const avant = m.noeuds.find((x) => x.id === n.id);
      return avant !== undefined && (avant.x !== n.x || avant.y !== n.y || (avant.z ?? 0) !== (n.z ?? 0));
    });
    if (conteneur) {
      conteneur.innerHTML =
        '<div class="resultat-optimisation">' +
        `<p>Énergie de déformation : ${nombreAffiche(o.initialEnergy)} → ${nombreAffiche(o.optimizedEnergy)} J ` +
        `(−${nombreAffiche(o.reductionPercentage, 1)} %), ${o.iterations} itérations.</p>` +
        (o.message ? `<p>${echapper(o.message)}</p>` : '') +
        '<div class="boutons">' +
        `<button type="button" data-action="optimiser-appliquer"${deplaces ? '' : ' disabled'}>Appliquer</button>` +
        '<button type="button" data-action="optimiser-fermer">Annuler</button>' +
        '</div></div>';
    }
  } catch (erreur) {
    derniereOptimisation = null;
    if (conteneur) {
      conteneur.textContent = `Optimisation impossible : ${erreur instanceof Error ? erreur.message : String(erreur)}`;
    }
  }
}

function appliquerOptimisation(): void {
  if (derniereOptimisation === null) return;
  const positions = new Map(derniereOptimisation.optimizedNodes.map((n) => [n.id, n]));
  const m = hist.present;
  const noeuds = m.noeuds.map((n) => {
    const p = positions.get(n.id);
    return p ? { ...n, x: p.x, y: p.y, ...(p.z === undefined ? {} : { z: p.z }) } : n;
  });
  hist = pousser(hist, { ...m, noeuds });
  derniereOptimisation = null;
  const conteneur = document.querySelector<HTMLElement>('[data-role="resultat-optimisation"]');
  if (conteneur) conteneur.textContent = 'Positions optimisées appliquées.';
  redessiner();
}

function fermerOptimisation(): void {
  derniereOptimisation = null;
  const conteneur = document.querySelector<HTMLElement>('[data-role="resultat-optimisation"]');
  if (conteneur) conteneur.innerHTML = '';
}

// --- Écouteurs ---------------------------------------------------------------

document.addEventListener('click', (ev) => {
  const cible = ev.target;
  if (!(cible instanceof Element)) return;

  const boutonAction = cible.closest<HTMLElement>('[data-action]');
  if (boutonAction?.dataset.action) {
    ev.preventDefault();
    executerAction(boutonAction.dataset.action);
    return;
  }

  const boutonOutil = cible.closest<HTMLElement>('[data-outil]');
  if (boutonOutil?.dataset.outil) {
    choisirOutil(boutonOutil.dataset.outil as Outil);
    return;
  }

  const ligne = cible.closest<HTMLElement>('tr[data-noeud], tr[data-barre]');
  if (ligne) {
    const idNoeud = ligne.dataset.noeud;
    const idBarre = ligne.dataset.barre;
    if (idNoeud) selection = { type: 'noeud', id: idNoeud };
    else if (idBarre) selection = { type: 'barre', id: idBarre };
    synchroniserSelection();
    redessiner();
    return;
  }

  const verdict = cible.closest<HTMLElement>('[data-element]');
  if (verdict?.dataset.element) choisirElement(verdict.dataset.element);
});

selectModele.addEventListener('change', () => {
  appliquerPrereglage(Number(selectModele.value));
});

outilsEl.addEventListener('change', (ev) => {
  const cible = ev.target;
  if (!(cible instanceof HTMLInputElement)) return;
  const option = cible.dataset.option;
  if (!option) return;
  if (option === 'grille') grilleActive = cible.checked;
  else if (option === 'angles' || option === 'cotes' || option === 'largeurs') options[option] = cible.checked;
  redessiner();
});

document.querySelector('#saisie')?.addEventListener('change', (ev) => {
  const cible = ev.target;
  if (!(cible instanceof HTMLInputElement || cible instanceof HTMLTextAreaElement || cible instanceof HTMLSelectElement)) {
    return;
  }
  const champCible = cibleDuChamp(cible);
  if (!champCible) return;
  const champ = cible.dataset.champ ?? cible.dataset.nom ?? cible.name;
  if (!champ) return;
  const resultat = modifierChamp(hist.present, champCible, champ, cible.value);
  if ('erreur' in resultat) {
    afficherErreurChamp(cible, resultat.erreur);
    return;
  }
  hist = pousser(hist, resultat.modele);
  redessiner();
});

fichierJsonEl.addEventListener('change', () => {
  const fichier = fichierJsonEl.files?.[0];
  if (!fichier) return;
  void fichier.text().then((texte) => {
    const resultat = modeleDepuisJson(texte);
    fichierJsonEl.value = '';
    if ('erreur' in resultat) {
      statutEl.textContent = resultat.erreur;
      return;
    }
    hist = historique(resultat.modele);
    selection = null;
    derniereOptimisation = null;
    synchroniserSelection();
    redessiner();
  });
});

projetEl.addEventListener('change', enregistrerCartouche);
elementEl.addEventListener('change', enregistrerCartouche);

window.addEventListener('keydown', (ev) => {
  if ((ev.ctrlKey || ev.metaKey) && !ev.shiftKey && ev.key.toLowerCase() === 's') {
    ev.preventDefault();
    enregistrerJson();
  }
});

// --- Démarrage ---------------------------------------------------------------

// Les classes du dessin sont stylees par les memes regles que le SVG exporte.
document.head.insertAdjacentHTML('beforeend', `<style>${STYLES_TRACE}</style>`);
remplirSelecteur();
chargerCartouche();
outilsEl.querySelectorAll<HTMLInputElement>('[data-option]').forEach((el) => {
  const option = el.dataset.option;
  if (option === 'grille') grilleActive = el.checked;
  else if (option === 'angles' || option === 'cotes' || option === 'largeurs') options[option] = el.checked;
});
installerVoletOptimisation();
redessiner();

function remplirSelecteur(): void {
  selectModele.innerHTML = PRESETS.map(
    (p, i) => `<option value="${i}">${echapper(p.title)}</option>`,
  ).join('');
}

if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
  void import('./pwa').then((m) => m.enregistrerServiceWorker());
}
