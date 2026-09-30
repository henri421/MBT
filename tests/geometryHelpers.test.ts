import { describe, expect, it } from 'vitest';

import { buildParametricConcrete, findBoundaryIntersection } from '../src/utils/geometryHelpers';

const CARRE: [number, number][] = [
  [0, 0],
  [2, 0],
  [2, 1],
  [0, 1],
];

describe('findBoundaryIntersection', () => {
  it('vers le bas, le haut, la gauche, la droite', () => {
    expect(findBoundaryIntersection(CARRE, 0.5, 0.4, 'down')).toMatchObject({ x: 0.5, y: 0, normal: { x: 0, y: -1 } });
    expect(findBoundaryIntersection(CARRE, 0.5, 0.4, 'up')).toMatchObject({ x: 0.5, y: 1, normal: { x: 0, y: 1 } });
    expect(findBoundaryIntersection(CARRE, 0.5, 0.4, 'left')).toMatchObject({ x: 0, y: 0.4, normal: { x: -1, y: 0 } });
    expect(findBoundaryIntersection(CARRE, 0.5, 0.4, 'right')).toMatchObject({ x: 2, y: 0.4, normal: { x: 1, y: 0 } });
  });

  it('bord incline : intersection sur le segment, angle du bord', () => {
    const talus: [number, number][] = [[0, 0], [2, 0], [2, 1], [0, 2]];
    const r = findBoundaryIntersection(talus, 1, 0.5, 'up');
    expect(r?.y).toBeCloseTo(1.5, 12);
    expect(r?.edgeAngle).toBeCloseTo(Math.atan2(1, -2), 12);
  });

  it('hors d atteinte du rayon : projection sur l arete la plus proche', () => {
    const r = findBoundaryIntersection(CARRE, 3, 0.5, 'down');
    expect(r).toMatchObject({ x: 2, y: 0.5 });
  });

  it('contour de moins de trois sommets : null', () => {
    expect(findBoundaryIntersection([[0, 0], [1, 0]], 0.5, 0.5)).toBeNull();
  });
});

describe('buildParametricConcrete', () => {
  it('rectangle par defaut L x H', () => {
    expect(buildParametricConcrete('inconnu', { length: 3, height: 1.5 })).toEqual([[0, 0], [3, 0], [3, 1.5], [0, 1.5]]);
  });

  it('corbeau : colonne, corbeau, hauteurs parametrees', () => {
    const p = buildParametricConcrete('corbel', { columnWidth: 0.4, corbelLength: 0.45, height: 0.85, corbelTipHeight: 0.5 });
    expect(p).toHaveLength(8);
    // 0,40 + 0,45 = 0,85 a l arrondi flottant pres
    expect(p[3][0]).toBeCloseTo(0.85, 12);
    expect(p[3][1]).toBe(0.5);
    expect(p[4][1]).toBe(0.85);
  });

  it('semelles sur pieux : carre de cote L', () => {
    expect(buildParametricConcrete('pile_cap_3_piles', { length: 2 })).toEqual([[0, 0], [2, 0], [2, 2], [0, 2]]);
  });

  it('about entaille : six sommets', () => {
    expect(buildParametricConcrete('dapped_end', {})).toHaveLength(6);
  });

  it('chaque forme est un polygone simple d aire positive', () => {
    for (const id of ['corbel', 'corbel_on_beam', 'deep_beam', 'deep_beam_eccentric', 'pile_cap_2_piles', 'pile_cap_4_piles', 'dapped_end', 'x']) {
      const p = buildParametricConcrete(id, {});
      let aire = 0;
      for (let i = 0; i < p.length; i++) {
        const [x1, y1] = p[i];
        const [x2, y2] = p[(i + 1) % p.length];
        aire += x1 * y2 - x2 * y1;
      }
      expect(aire / 2, id).toBeGreaterThan(0);
    }
  });
});
