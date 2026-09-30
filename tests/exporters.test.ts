// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import { solveTruss } from '../src/utils/matrixSolver';
import { downloadDxfFile, generateStmDxf } from '../src/utils/dxfExporter';
import { downloadSvgFile, generateStmSvg } from '../src/utils/svgExporter';
import type { ConcreteOutline } from '../src/types/stm';
import { B500, C30, triangle } from './fixtures';

const contour: ConcreteOutline = { points2D: [[-0.3, -0.3], [4.3, -0.3], [4.3, 2.3], [-0.3, 2.3]], thickness: 0.3 };

describe('generateStmDxf', () => {
  const { nodes, members } = triangle();
  const r = solveTruss(nodes, members, C30, B500);

  it('fichier DXF R12 complet : en-tete, entites, fin', () => {
    const dxf = generateStmDxf(nodes, members, contour, r);
    const lignes = dxf.split('\n');
    expect(lignes.slice(0, 4)).toEqual(['0', 'SECTION', '2', 'HEADER']);
    expect(dxf).toMatch(/AC1009/);
    expect(dxf).toMatch(/ENTITIES/);
    expect(lignes.slice(-2)).toEqual(['0', 'EOF']);
    // Codes de groupe et valeurs alternent : nombre de lignes pair.
    expect(lignes.length % 2).toBe(0);
  });

  it('conversion en millimetres : les coordonnees sont multipliees par 1000', () => {
    const m = generateStmDxf(nodes, members, contour, r, { scaleToMm: true });
    expect(m).toMatch(/\n4000(\.0+)?\n/);
    expect(generateStmDxf(nodes, members, contour, r)).not.toMatch(/\n4000(\.0+)?\n/);
  });

  it('sans resultat de calcul, le dessin est tout de meme produit', () => {
    expect(generateStmDxf(nodes, members, contour, null)).toMatch(/EOF$/);
  });
});

describe('generateStmSvg', () => {
  const { nodes, members } = triangle();
  const r = solveTruss(nodes, members, C30, B500);

  it('SVG autonome, efforts et cartouche', () => {
    const svg = generateStmSvg(nodes, members, contour, r, C30, B500, { modelTitle: 'Essai' });
    expect(svg.trim().startsWith('<svg') || svg.trim().startsWith('<?xml')).toBe(true);
    expect(svg.trim().endsWith('</svg>')).toBe(true);
    expect(svg).toMatch(/Essai/);
    expect(svg).not.toMatch(/NaN|undefined/);
  });

  it('options : sans cotes ni efforts', () => {
    const svg = generateStmSvg(nodes, members, contour, r, C30, B500, { showDimensions: false, showForceLabels: false });
    expect(svg).not.toMatch(/NaN|undefined/);
  });

  it('sans resultat de calcul', () => {
    expect(generateStmSvg(nodes, members, contour, null, C30, B500)).toMatch(/<\/svg>$/);
  });
});

describe('telechargements', () => {
  afterEach(() => vi.restoreAllMocks());

  it('SVG et DXF passent par un lien temporaire, puis liberent l URL', () => {
    const creer = vi.fn(() => 'blob:x');
    const liberer = vi.fn();
    Object.assign(URL, { createObjectURL: creer, revokeObjectURL: liberer });
    const clic = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const { nodes, members } = triangle();
    downloadSvgFile('<svg/>', 'a.svg');
    downloadDxfFile(nodes, members, contour, null, 'plan');
    expect(clic).toHaveBeenCalledTimes(2);
    expect(creer).toHaveBeenCalledTimes(2);
    expect(liberer).toHaveBeenCalledTimes(2);
    expect(document.querySelectorAll('a').length).toBe(0);
  });
});
