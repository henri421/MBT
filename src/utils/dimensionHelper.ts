import { ConcreteOutline, STMNode } from '../types/stm';

export interface StmDimension {
  id: string;
  type: 'horizontal' | 'vertical' | 'span';
  label: string;
  valueM: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  offsetM: number;
}

/**
 * Calculates standard structural dimension lines for a given concrete outline and supports
 */
export function calculateStmDimensions(
  concrete: ConcreteOutline,
  nodes: STMNode[]
): StmDimension[] {
  const dims: StmDimension[] = [];
  const pts = concrete.points2D;
  if (!pts || pts.length === 0) return dims;

  const xs = pts.map(p => p[0]);
  const ys = pts.map(p => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const totalWidth = maxX - minX;
  const totalHeight = maxY - minY;

  // 1. Overall Length L (bottom)
  if (totalWidth > 0.05) {
    dims.push({
      id: 'dim-total-length',
      type: 'horizontal',
      label: `L = ${totalWidth.toFixed(2)} m`,
      valueM: totalWidth,
      x1: minX,
      y1: minY,
      x2: maxX,
      y2: minY,
      offsetM: -0.18
    });
  }

  // 2. Overall Height H (left)
  if (totalHeight > 0.05) {
    dims.push({
      id: 'dim-total-height',
      type: 'vertical',
      label: `H = ${totalHeight.toFixed(2)} m`,
      valueM: totalHeight,
      x1: minX,
      y1: minY,
      x2: minX,
      y2: maxY,
      offsetM: -0.18
    });
  }

  // 3. Clear Span between main supports (if 2 supports exist)
  const supports = nodes.filter(n => n.isSupport);
  if (supports.length >= 2) {
    // Sort by X coordinate
    const sorted = [...supports].sort((a, b) => a.x - b.x);
    const s1 = sorted[0];
    const s2 = sorted[sorted.length - 1];
    const span = Math.abs(s2.x - s1.x);
    if (span > 0.15 && Math.abs(span - totalWidth) > 0.10) {
      dims.push({
        id: 'dim-span-supports',
        type: 'horizontal',
        label: `L_appuis = ${span.toFixed(2)} m`,
        valueM: span,
        x1: s1.x,
        y1: Math.min(s1.y, s2.y),
        x2: s2.x,
        y2: Math.min(s1.y, s2.y),
        offsetM: -0.09
      });
    }
  }

  return dims;
}
