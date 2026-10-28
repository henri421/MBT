/**
 * Tests d'acceptation de P5 et P6 : page (app/index.html), cablage
 * (app/src/main.ts) et vue 3D (app/src/vue3d.ts). Controles statiques du
 * source : la page elle-meme se verifie a l'oeil (banc sans DOM ni WebGL).
 */

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { constatsAffichage, texteVisible } from 'aedificium-ui';

const chemin = (c: string) => fileURLToPath(new URL(c, import.meta.url));
const lire = (c: string): string => readFileSync(chemin(c), 'utf8');
const page = existsSync(chemin('../../app/index.html')) ? lire('../../app/index.html') : '';
const main = existsSync(chemin('../../app/src/main.ts')) ? lire('../../app/src/main.ts') : '';
const style = existsSync(chemin('../../app/src/style.css')) ? lire('../../app/src/style.css') : '';
const vue3d = existsSync(chemin('../../app/src/vue3d.ts')) ? lire('../../app/src/vue3d.ts') : '';
const section = (id: string) => {
  const i = page.indexOf(`id="${id}"`);
  return i < 0 ? '' : page.slice(i, page.indexOf('</section>', i));
};

describe('P6 : page', () => {
  it('barre de la suite, un seul lien vers le hub, titre', () => {
    expect(page).toContain('<html lang="fr">');
    expect(page).toContain('Aedificium &middot; Bielles et tirants');
    expect(page.match(/<a [^>]*class="barre-lien"/g)).toHaveLength(1);
    expect(page).toContain('href="https://henri421.github.io/WebAedificium/"');
    expect(page).toMatch(/<h1>Bielles et tirants<\/h1>/);
    expect(page).toContain('<meta name="theme-color" content="#f7f7f6" />');
    expect(page).toContain('<script type="module" src="./src/main.ts"></script>');
  });

  it('trois colonnes : saisie, dessin, verdicts', () => {
    for (const id of ['saisie', 'dessin', 'verdicts']) expect(page, id).toContain(`<section id="${id}"`);
    for (const r of ['modele', 'champs-modele', 'noeuds', 'barres', 'element-choisi']) expect(section('saisie'), r).toContain(`data-role="${r}"`);
    for (const r of ['outils', 'zone', 'zone-3d', 'statut', 'volets']) expect(section('dessin'), r).toContain(`data-role="${r}"`);
    for (const r of ['liste-verdicts', 'projet', 'element']) expect(section('verdicts'), r).toContain(`data-role="${r}"`);
  });

  it('outils de l editeur et options d affichage', () => {
    const outils = section('dessin');
    for (const o of ['selection', 'noeud', 'barre', 'appui', 'charge', 'supprimer']) expect(outils, o).toContain(`data-outil="${o}"`);
    for (const a of ['annuler', 'retablir', 'vue-2d', 'vue-3d']) expect(outils, a).toContain(`data-action="${a}"`);
    for (const o of ['grille', 'angles', 'cotes', 'largeurs']) expect(outils, o).toContain(`data-option="${o}"`);
    expect(outils).toMatch(/<svg[^>]*data-role="zone"/);
  });

  it('sorties', () => {
    const v = section('verdicts');
    for (const a of ['exporter-note', 'exporter-svg', 'exporter-dxf', 'exporter-csv', 'enregistrer-json', 'ouvrir-json']) expect(v, a).toContain(`data-action="${a}"`);
    expect(v).toMatch(/<input[^>]*type="file"[^>]*accept="\.json,application\/json"/);
  });

  it('textes visibles accentues', () => {
    expect(page).not.toBe('');
    expect(constatsAffichage(texteVisible(page))).toEqual([]);
  });

  it('style : theme clair seul, jetons de la suite', () => {
    expect(style).toContain('--fond: #f7f7f6;');
    expect(style).toContain('--compression: #2f5d8a;');
    expect(style).toContain('--traction: #a8442a;');
    expect(style).toContain('color-scheme: light;');
    expect(style).not.toMatch(/prefers-color-scheme:\s*dark/);
  });
});

describe('P6 : cablage', () => {
  it('passe par les modules purs et l editeur commun', () => {
    for (const f of [
      'brancherEditeur(',
      'historique(',
      'pousser(',
      'annuler(',
      'retablir(',
      'appliquerAction(',
      'calculer(',
      'modifierChamp(',
      'dessinModele(',
      'vueDuModele(',
      'verdictsHtml(',
      'verdictsDuCalcul(',
      'tableNoeudsHtml(',
      'tableBarresHtml(',
      'elementChoisiHtml(',
      'champsModeleHtml(',
      'tableauHtml(',
    ]) {
      expect(main, f).toContain(f);
    }
  });

  it('modeles, JSON, optimiseur, sorties', () => {
    for (const f of ['modeleDepuisPrereglage(', 'modeleDepuisJson(', 'modeleEnJson(', 'optimizeSchlaichEnergy(', 'generateStmDxf(', 'noteDuCalcul(', 'noteDeCalculHtml(', 'svgDuDessin(', 'resultatsCsv(', 'ouvrirOuTelecharger(', 'telecharger(']) {
      expect(main, f).toContain(f);
    }
    expect(main).toContain("'mbt:cartouche'");
  });

  it('la 3D est chargee a la demande, jamais au demarrage', () => {
    expect(main).toMatch(/import\(\s*'\.\/vue3d'\s*\)/);
    expect(main).not.toMatch(/^import[^;]*from '\.\/vue3d'/m);
    expect(main).not.toMatch(/from 'three'/);
  });

  it('aucune dependance a React, Tailwind ou lucide', () => {
    for (const s of [main, vue3d]) {
      expect(s).not.toMatch(/from 'react|from 'lucide|tailwind/);
    }
    expect(page).not.toMatch(/class="[^"]*\b(flex|grid-cols|bg-slate|text-slate)\b/);
  });
});

describe('P5 : vue 3D', () => {
  it('module three.js isole, fond clair, couleurs de sens', () => {
    expect(vue3d).toMatch(/from 'three'/);
    expect(vue3d).toMatch(/export function monterVue3d\(/);
    expect(vue3d).toContain('0x2f5d8a');
    expect(vue3d).toContain('0xa8442a');
    expect(vue3d).toMatch(/background = new THREE\.Color\(0x(ffffff|f7f7f6)\)/);
  });

  it('nettoyage : detacher libere le rendu', () => {
    expect(vue3d).toMatch(/detacher\(\)/);
    expect(vue3d).toMatch(/\.dispose\(\)/);
  });
});
