import { describe, expect, it } from 'vitest';

import type { ConcreteOutline, STMNode } from '../src/types/stm';
import { calculateStmDimensions } from '../src/utils/dimensionHelper';

const contour: ConcreteOutline = { points2D: [[0, 0], [3.2, 0], [3.2, 2], [0, 2]], thickness: 0.3 };

describe('calculateStmDimensions', () => {
  it('longueur, hauteur et portee entre appuis', () => {
    const appuis: STMNode[] = [
      { id: 'a', x: 0.3, y: 0.1, isSupport: true },
      { id: 'b', x: 2.9, y: 0.1, isSupport: true },
    ];
    const d = calculateStmDimensions(contour, appuis);
    expect(d.map((x) => x.id)).toEqual(['dim-total-length', 'dim-total-height', 'dim-span-supports']);
    expect(d[0].valueM).toBeCloseTo(3.2, 12);
    expect(d[1].valueM).toBeCloseTo(2, 12);
    expect(d[2].valueM).toBeCloseTo(2.6, 12);
    expect(d[2].label).toBe('L_appuis = 2.60 m');
  });

  it('pas de cote de portee quand elle egale la longueur totale', () => {
    const appuis: STMNode[] = [
      { id: 'a', x: 0, y: 0, isSupport: true },
      { id: 'b', x: 3.2, y: 0, isSupport: true },
    ];
    expect(calculateStmDimensions(contour, appuis)).toHaveLength(2);
  });

  it('contour vide : aucune cote', () => {
    expect(calculateStmDimensions({ points2D: [], thickness: 0.3 }, [])).toEqual([]);
  });
});
