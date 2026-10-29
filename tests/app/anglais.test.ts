/**
 * Version anglaise (lot 8.8) : page `en/index.html` de meme squelette que la
 * page francaise, et AUCUN reste de francais dans ce qui s'affiche en anglais
 * (ecran, dessin, note, CSV, messages). Le francais, lui, est couvert par les
 * autres tests, inchanges.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { constatsAffichage, contenuBalise, definirLangue, noteDeCalculHtml, texteVisible } from 'aedificium-ui';
import { PRESETS, optimizeSchlaichEnergy } from '../../src/index';
import { calculer, modeleDepuisJson, modeleDepuisPrereglage, modeleEnJson, type ModeleMbt } from '../../app/src/modele';
import { champsModeleHtml, elementChoisiHtml, modifierChamp, tableBarresHtml, tableNoeudsHtml } from '../../app/src/form';
import { OPTIONS_DESSIN, dessinModele, vueDuModele } from '../../app/src/dessin';
import { tableauBielles, tableauHtml, tableauNoeuds, tableauReactions, tableauTirants, verdictsDuCalcul, verdictsHtml } from '../../app/src/vue';
import { STYLES_TRACE, resultatsCsv } from '../../app/src/export';
import { noteDuCalcul } from '../../app/src/note';
import { phrase, textes } from '../../app/src/textes';

const lire = (chemin: string): string => readFileSync(fileURLToPath(new URL(chemin, import.meta.url)), 'utf8');
const controler = (nom: string, html: string): string[] => constatsAffichage(texteVisible(html), { langue: 'en' }).map((c) => `${nom} : ${c}`);
/** CSV : le point-virgule y est le separateur, la virgule n'y est pas decimale. */
const controlerCsv = (nom: string, csv: string): string[] =>
  constatsAffichage(csv, { langue: 'en' })
    .filter((c) => !c.startsWith('virgule decimale'))
    .map((c) => `${nom} : ${c}`);

/**
 * Les identifiants des noeuds et des barres (`N_Load`, `M_BielleNez`) sont
 * des donnees du modele, pas des textes de l'app : on les masque.
 */
function masquer(html: string, m: ModeleMbt): string {
  const ids = [...m.noeuds.map((n) => n.id), ...m.barres.map((b) => b.id)].sort((a, b) => b.length - a.length);
  return ids.reduce((h, id) => h.split(id).join('ID'), html);
}

/** Squelette d'une page : les attributs que lit le script, dans l'ordre. */
function squelette(html: string): string[] {
  return [...html.matchAll(/\s(id|data-[a-z-]+|type|inputmode|accept|value)="([^"]*)"/g)].map((m) => `${m[1]}=${m[2]}`);
}

describe('page anglaise', () => {
  const fr = lire('../../app/index.html');
  const en = lire('../../app/en/index.html');

  it('meme squelette que la page francaise', () => {
    expect(squelette(en)).toEqual(squelette(fr));
  });

  it('langue, script commun, liens entre les deux versions', () => {
    expect(en).toContain('<html lang="en">');
    expect(en).toContain('src="../src/main.ts"');
    expect(en).toMatch(/class="barre-langue" href="\.\.\/"/);
    expect(fr).toMatch(/class="barre-langue" href="en\/"/);
  });

  it('titre anglais, aucun reste de francais', () => {
    expect(contenuBalise(en, 'h1')).toBe('Strut-and-tie models');
    expect(controler('page', en.replace(/lang="fr"[^>]*>FR</, '>'))).toEqual([]);
  });
});

describe('affichage en anglais', () => {
  beforeEach(() => definirLangue('en'));
  afterEach(() => definirLangue('fr'));

  const CARTOUCHE = { projet: 'Hall', element: '', date: '2026-10-30' };

  /** Les modeles de depart, puis des treillis instables. */
  function modeles(): ModeleMbt[] {
    const depart = PRESETS.map(modeleDepuisPrereglage);
    const m = depart[0];
    return [
      ...depart,
      { ...m, barres: [] },
      { ...m, noeuds: m.noeuds.map((n) => ({ ...n, isSupport: false })) },
      { ...m, noeuds: m.noeuds.map((n) => ({ ...n, isSupport: true, supportType: 'pin' as const })) },
      { ...m, barres: m.barres.slice(1) },
      { ...m, noeuds: [...m.noeuds, { id: 'NX', x: 0.05, y: 0.05 }] },
      { ...m, noeuds: m.noeuds.map((n) => (n.isSupport ? { ...n, supportType: 'roller_x' as const } : n)) },
    ];
  }

  it('ecran, dessin, note et CSV', () => {
    const constats: string[] = [];
    modeles().forEach((m, i) => {
      const r = calculer(m);
      const vue = vueDuModele(m, 640, 520);
      const dessin = dessinModele(m, r, vue, { ...OPTIONS_DESSIN, cotes: true, largeurs: true });
      const tableaux = [tableauBielles(m, r), tableauTirants(m, r), tableauNoeuds(m, r), tableauReactions(m, r)];
      const premierNoeud = m.noeuds[0];
      const premiereBarre = m.barres[0];
      const ecran = [
        dessin,
        `<p>${phrase(m.nom)}</p>`,
        verdictsHtml(verdictsDuCalcul(r)),
        ...tableaux.map((t) => `<h3>${t.titre} ${t.clause}</h3>${tableauHtml(t)}`),
        champsModeleHtml(m),
        tableNoeudsHtml(m, null),
        tableBarresHtml(m, null),
        premierNoeud ? elementChoisiHtml(m, { type: 'noeud', id: premierNoeud.id }) : '',
        premiereBarre ? elementChoisiHtml(m, { type: 'barre', id: premiereBarre.id }) : '',
      ];
      constats.push(...ecran.flatMap((h, j) => controler(`modele ${i} ecran ${j}`, masquer(h, m))));
      constats.push(...controler(`modele ${i} note`, masquer(noteDeCalculHtml(noteDuCalcul(m, r, CARTOUCHE, dessin), STYLES_TRACE), m)));
      // Le CSV garde la notation brute des en-tetes (`σ_Rd,max`), comme en francais.
      constats.push(...controlerCsv(`modele ${i} csv`, masquer(resultatsCsv(m, r), m)).filter((c) => !c.includes('« _ »')));
      try {
        const o = optimizeSchlaichEnergy(m.noeuds, m.barres, m.materiauBeton, m.acier, m.beton, m.dimension);
        if (o.message) constats.push(...controler(`modele ${i} optimisation`, masquer(`<p>${phrase(o.message)}</p>`, m)));
      } catch (e) {
        constats.push(...controler(`modele ${i} optimisation`, masquer(`<p>${phrase(e instanceof Error ? e.message : String(e))}</p>`, m)));
      }
    });
    expect(constats).toEqual([]);
  });

  it('messages et erreurs', () => {
    const m = modeleDepuisPrereglage(PRESETS[0]);
    const n = { type: 'noeud' as const, id: m.noeuds[0].id };
    const erreur = (r: ReturnType<typeof modifierChamp>): string => ('erreur' in r ? r.erreur : '');
    const json = JSON.parse(modeleEnJson(m, '2026-10-30')) as Record<string, unknown>;
    const fichier = (o: unknown): string => {
      const r = modeleDepuisJson(typeof o === 'string' ? o : JSON.stringify(o));
      return 'erreur' in r ? r.erreur : '';
    };
    const messages = [
      erreur(modifierChamp(m, n, 'x', 'abc')),
      erreur(modifierChamp(m, n, 'plaque', '-1')),
      erreur(modifierChamp(m, n, 'appui', 'zz')),
      erreur(modifierChamp(m, n, 'zz', '1')),
      fichier('{'),
      fichier({ app: 'autre' }),
      fichier({ ...json, nodes: [{ id: 'A' }] }),
      fichier({ ...json, members: [{ id: 'B', fromNodeId: 'A', toNodeId: 'Z' }] }),
      fichier({ ...json, concreteOutline: null }),
      fichier({ ...json, concreteMat: null }),
      phrase('Modèle importé'),
      textes().messages.nouvelleVersion,
      textes().messages.elementAbsent('#x'),
      textes().page.optimisationIntro,
      textes().page.optimiser,
      textes().page.energie('1.2', '1.0', '16.7', 12),
      textes().page.appliquer,
      textes().page.annuler,
      textes().page.appliquees,
      textes().page.optimisationImpossible('x'),
      textes().page.aimante('N1'),
      ...Object.values(textes().vue3d),
    ];
    expect(messages.flatMap((t, i) => controler(`message ${i}`, `<p>${t}</p>`))).toEqual([]);
    // Les erreurs de lecture sont bien produites (pas de chaine vide).
    expect(messages.slice(0, 10).filter((t) => t === '')).toEqual([]);
  });
});
