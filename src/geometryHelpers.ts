/**
 * Utilitaires géométriques pour le tracé, les frontières et le paramétrage
 * des modèles de bielles et tirants (Eurocode 2).
 */

export interface BoundaryIntersection {
  x: number;
  y: number;
  normal: { x: number; y: number }; // Vecteur normal sortant
  edgeAngle: number; // Angle du bord (en radians)
}

/**
 * Trouve l'intersection d'un rayon depuis un nœud intérieur vers la frontière du béton.
 * Direction:
 *  - 'down': pour appuis inférieurs verticaux
 *  - 'up': pour charges supérieures descendantes
 *  - 'left': pour appuis horizontaux sur face gauche
 *  - 'right': pour appuis sur face droite
 */
export function findBoundaryIntersection(
  polygon: [number, number][],
  nodeX: number,
  nodeY: number,
  direction: 'down' | 'up' | 'left' | 'right' = 'down'
): BoundaryIntersection | null {
  if (!polygon || polygon.length < 3) return null;

  let bestPoint: BoundaryIntersection | null = null;
  let minDistance = Infinity;

  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const p1 = polygon[i];
    const p2 = polygon[(i + 1) % n];

    const x1 = p1[0];
    const y1 = p1[1];
    const x2 = p2[0];
    const y2 = p2[1];

    if (direction === 'down' || direction === 'up') {
      const minX = Math.min(x1, x2);
      const maxX = Math.max(x1, x2);

      // Le rayon vertical x = nodeX coupe-t-il le segment ?
      if (nodeX >= minX - 1e-5 && nodeX <= maxX + 1e-5 && Math.abs(x2 - x1) > 1e-6) {
        const t = (nodeX - x1) / (x2 - x1);
        const yInter = y1 + t * (y2 - y1);

        if (direction === 'down' && yInter <= nodeY + 1e-4) {
          const dist = nodeY - yInter;
          if (dist < minDistance) {
            minDistance = dist;
            bestPoint = {
              x: nodeX,
              y: yInter,
              normal: { x: 0, y: -1 },
              edgeAngle: Math.atan2(y2 - y1, x2 - x1)
            };
          }
        } else if (direction === 'up' && yInter >= nodeY - 1e-4) {
          const dist = yInter - nodeY;
          if (dist < minDistance) {
            minDistance = dist;
            bestPoint = {
              x: nodeX,
              y: yInter,
              normal: { x: 0, y: 1 },
              edgeAngle: Math.atan2(y2 - y1, x2 - x1)
            };
          }
        }
      }
    } else if (direction === 'left' || direction === 'right') {
      const minY = Math.min(y1, y2);
      const maxY = Math.max(y1, y2);

      // Le rayon horizontal y = nodeY coupe-t-il le segment ?
      if (nodeY >= minY - 1e-5 && nodeY <= maxY + 1e-5 && Math.abs(y2 - y1) > 1e-6) {
        const t = (nodeY - y1) / (y2 - y1);
        const xInter = x1 + t * (x2 - x1);

        if (direction === 'left' && xInter <= nodeX + 1e-4) {
          const dist = nodeX - xInter;
          if (dist < minDistance) {
            minDistance = dist;
            bestPoint = {
              x: xInter,
              y: nodeY,
              normal: { x: -1, y: 0 },
              edgeAngle: Math.atan2(y2 - y1, x2 - x1)
            };
          }
        } else if (direction === 'right' && xInter >= nodeX - 1e-4) {
          const dist = xInter - nodeX;
          if (dist < minDistance) {
            minDistance = dist;
            bestPoint = {
              x: xInter,
              y: nodeY,
              normal: { x: 1, y: 0 },
              edgeAngle: Math.atan2(y2 - y1, x2 - x1)
            };
          }
        }
      }
    }
  }

  // Fallback: si aucun rayon direct ne coupe, projeter sur le segment le plus proche
  if (!bestPoint) {
    for (let i = 0; i < n; i++) {
      const p1 = polygon[i];
      const p2 = polygon[(i + 1) % n];
      const proj = projectPointOnSegment(nodeX, nodeY, p1[0], p1[1], p2[0], p2[1]);
      const dist = Math.hypot(nodeX - proj.x, nodeY - proj.y);
      if (dist < minDistance) {
        minDistance = dist;
        bestPoint = {
          x: proj.x,
          y: proj.y,
          normal: { x: 0, y: direction === 'down' ? -1 : 1 },
          edgeAngle: Math.atan2(p2[1] - p1[1], p2[0] - p1[0])
        };
      }
    }
  }

  return bestPoint;
}

function projectPointOnSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): { x: number; y: number } {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return { x: x1, y: y1 };

  let t = ((px - x1) * dx + (py - y1) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  return { x: x1 + t * dx, y: y1 + t * dy };
}

/**
 * Recalcule les coordonnées du contour béton selon des dimensions paramétriques.
 */
export function buildParametricConcrete(
  presetId: string,
  params: {
    length?: number;
    height?: number;
    thickness?: number;
    corbelLength?: number;
    corbelHeight?: number;
    corbelTipHeight?: number;
    columnWidth?: number;
    dappedHeight?: number;
    dappedLength?: number;
  }
): [number, number][] {
  if (presetId === 'corbel') {
    const colW = params.columnWidth ?? 0.40;
    const ac = params.corbelLength ?? 0.45;
    const hCol = 1.30;
    const hCorbTop = params.height ?? 0.85;
    const hTip = params.corbelTipHeight ?? 0.50;
    const hRoot = 0.15;
    return [
      [0.0, 0.0],
      [colW, 0.0],
      [colW, hRoot],
      [colW + ac, hTip],
      [colW + ac, hCorbTop],
      [colW, hCorbTop],
      [colW, hCol],
      [0.0, hCol]
    ];
  }

  if (presetId === 'corbel_on_beam') {
    const L = params.length ?? 3.20;
    const H = params.height ?? 1.20;
    const corbL = params.corbelLength ?? 0.60;
    const corbTop = 0.75;
    const corbBot = 0.20;
    return [
      [0.0, corbBot],
      [corbL, corbBot],
      [corbL, 0.0],
      [L, 0.0],
      [L, H],
      [corbL, H],
      [corbL, corbTop],
      [0.0, corbTop]
    ];
  }

  if (presetId === 'deep_beam') {
    const L = params.length ?? 3.20;
    const H = params.height ?? 2.00;
    return [
      [0.0, 0.0],
      [L, 0.0],
      [L, H],
      [0.0, H]
    ];
  }

  if (presetId === 'deep_beam_eccentric') {
    const L = params.length ?? 3.60;
    const H = params.height ?? 2.00;
    return [
      [0.0, 0.0],
      [L, 0.0],
      [L, H],
      [0.0, H]
    ];
  }

  if (presetId === 'pile_cap_2_piles') {
    const L = params.length ?? 2.40;
    const H = params.height ?? 0.90;
    return [
      [0.0, 0.0],
      [L, 0.0],
      [L, H],
      [0.0, H]
    ];
  }

  if (presetId === 'pile_cap_3_piles' || presetId === 'pile_cap_4_piles') {
    const L = params.length ?? 2.40;
    const W = params.length ?? 2.40;
    return [
      [0.0, 0.0],
      [L, 0.0],
      [L, W],
      [0.0, W]
    ];
  }

  if (presetId === 'dapped_end') {
    const L = params.length ?? 2.20;
    const H = params.height ?? 1.20;
    const dH = params.dappedHeight ?? 0.40;
    const dL = params.dappedLength ?? 0.50;
    return [
      [0.0, dH],
      [dL, dH],
      [dL, 0.0],
      [L, 0.0],
      [L, H],
      [0.0, H]
    ];
  }

  // Par défaut rectangle L x H
  const L = params.length ?? 3.0;
  const H = params.height ?? 2.0;
  return [
    [0.0, 0.0],
    [L, 0.0],
    [L, H],
    [0.0, H]
  ];
}
