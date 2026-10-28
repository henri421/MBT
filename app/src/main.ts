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
import { PRESETS, generateStmDxf, optimizeSchlaichEnergy } from '../../src/index';
import {
  appliquerAction,
  calculer,
  grapheDuModele,
  modeleAvecGraphe,
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

interface ChampsMoteur {
  noeuds: any[];
  barres: any[];
  beton: any;
  materiauBeton: any;
  acier: any;
  dimension?: '2D' | '3D';
}

/** Les champs moteur du modèle, hors du contrat exposé par `modele.ts`. */
function champsMoteur(m: ModeleMbt): ChampsMoteur {
  return m as unknown as ChampsMoteur;
}

const premier = PRESETS[0];
let hist = historique(premier ? modeleDepuisPrereglage(premier) : modeleParDefaut());
let selection: Selection = null;
let outil: Outil = 'selection';
let dernierResultat: ReturnType<typeof calculer> | null = null;
let mode3d = false;
let instance3d: { detacher(): void } | null = null;

const options = { ...OPTIONS_DESSIN } as unknown as OptionsDessin & Record<string, boolean>;

interface OptimisationAffichee {
  initial: number;
  final: number;
  noeuds: { id: string; x: number; y: number }[] | null;
}
let derniereOptimisation: OptimisationAffichee | null = null;

const CLE_CARTOUCHE = 'mbt:cartouche';

// --- Formatage --------------------------------------------------------------

function fr(valeur: number, decimales = 1): string {
  return valeur.toFixed(decimales).replace('.', ',');
}

function nombreDepuis(valeur: unknown): number {
  return typeof valeur === 'number' && Number.isFinite(valeur) ? valeur : 0;
}

function nomPreset(p: unknown, i: number): string {
  const o = p as { nom?: unknown; name?: unknown };
  if (typeof o.nom === 'string') return o.nom;
  if (typeof o.name === 'string') return o.name;
  return `Modèle ${i + 1}`;
}

// --- Éditeur -----------------------------------------------------------------

const editeur = brancherEditeur(zone, {
  contexte: () => {
    const contexte: Record<string, unknown> = {
      vue: vueDuModele(hist.present, 640, 520),
      outil,
      graphe: grapheDuModele(hist.present),
      pas: options.grille ? 0.05 : null,
      tolerance: 0.05,
    };
    return contexte as unknown as ContexteEditeur;
  },
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
    statutEl.textContent = `x = ${fr(p.x, 2)} m · y = ${fr(p.y, 2)} m${aimante}`;
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
  const dessin = dessinModele(m, r, vue, options);
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
  const moteur = champsMoteur(m);
  const dxf = generateStmDxf(moteur.noeuds, moteur.barres, moteur.beton, r, {
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

function noeudsOptimises(valeur: unknown): { id: string; x: number; y: number }[] | null {
  if (!Array.isArray(valeur)) return null;
  const noeuds: { id: string; x: number; y: number }[] = [];
  for (const n of valeur) {
    if (!n || typeof n !== 'object') continue;
    const o = n as { id?: unknown; x?: unknown; y?: unknown };
    if (typeof o.id === 'string' && typeof o.x === 'number' && typeof o.y === 'number') {
      noeuds.push({ id: o.id, x: o.x, y: o.y });
    }
  }
  return noeuds.length > 0 ? noeuds : null;
}

function lancerOptimisation(): void {
  const conteneur = document.querySelector<HTMLElement>('[data-role="resultat-optimisation"]');
  const m = hist.present;
  const moteur = champsMoteur(m);
  try {
    const brut = optimizeSchlaichEnergy(
      moteur.noeuds,
      moteur.barres,
      moteur.materiauBeton,
      moteur.acier,
      moteur.beton,
      moteur.dimension ?? '2D',
    ) as unknown as Record<string, unknown>;

    const initial = nombreDepuis(brut.initialEnergy ?? brut.energieInitiale);
    const final = nombreDepuis(brut.finalEnergy ?? brut.optimizedEnergy ?? brut.energieFinale);
    const noeuds = noeudsOptimises(brut.optimizedNodes ?? brut.noeudsOptimises ?? brut.nodes ?? brut.noeuds);
    const reduction = initial > 0 ? ((initial - final) / initial) * 100 : 0;
    derniereOptimisation = { initial, final, noeuds };

    const motif = [brut.motif, brut.reason, brut.message].find(
      (v): v is string => typeof v === 'string',
    );
    if (conteneur) {
      conteneur.innerHTML =
        '<div class="resultat-optimisation">' +
        `<p>Énergie : ${fr(initial)} → ${fr(final)} kN·m (${fr(reduction)} %)</p>` +
        (motif ? `<p>${echapper(motif)}</p>` : '') +
        '<div class="boutons">' +
        `<button type="button" data-action="optimiser-appliquer"${noeuds ? '' : ' disabled'}>Appliquer</button>` +
        '<button type="button" data-action="optimiser-fermer">Annuler</button>' +
        '</div></div>';
    }
  } catch (erreur) {
    derniereOptimisation = null;
    if (conteneur) {
      conteneur.textContent = `Optimisation impossible : ${
        erreur instanceof Error ? erreur.message : String(erreur)
      }`;
    }
  }
}

function appliquerOptimisation(): void {
  if (!derniereOptimisation?.noeuds) {
    statutEl.textContent = 'Aucune position optimisée à appliquer.';
    return;
  }
  const graphe = grapheDuModele(hist.present);
  const positions = new Map<string, { id: string; x: number; y: number }>();
  for (const n of derniereOptimisation.noeuds) positions.set(n.id, n);
  const noeuds = graphe.noeuds.map((n) => {
    const p = positions.get(n.id);
    return p ? { ...n, x: p.x, y: p.y } : n;
  });
  hist = pousser(hist, modeleAvecGraphe(hist.present, { ...graphe, noeuds }));
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
  options[option] = cible.checked;
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

remplirSelecteur();
chargerCartouche();
outilsEl.querySelectorAll<HTMLInputElement>('[data-option]').forEach((el) => {
  const option = el.dataset.option;
  if (option) options[option] = el.checked;
});
installerVoletOptimisation();
redessiner();

function remplirSelecteur(): void {
  selectModele.innerHTML = PRESETS.map(
    (p, i) => `<option value="${i}">${echapper(nomPreset(p, i))}</option>`,
  ).join('');
}
