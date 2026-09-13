import {
  STMNode,
  STMMember,
  ConcreteMaterial,
  SteelMaterial,
  OptimizationResult,
  OptimizationStep,
  ConcreteOutline
} from '../types/stm';
import { solveTruss } from './matrixSolver';

// Helper to check if point is inside 2D polygon (ray-casting algorithm)
export function isPointInPolygon(point: [number, number], vs: [number, number][]): boolean {
  if (vs.length < 3) return true;
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][0], yi = vs[i][1];
    const xj = vs[j][0], yj = vs[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// Distance minimale du point à chaque arête du polygone (0 si le polygone a moins de 2 sommets)
function distanceToPolygonBoundary(point: [number, number], vs: [number, number][]): number {
  if (vs.length < 2) return Infinity;
  const [px, py] = point;
  let minDist = Infinity;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const [x1, y1] = vs[j];
    const [x2, y2] = vs[i];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    let t = lenSq > 0 ? ((px - x1) * dx + (py - y1) * dy) / lenSq : 0;
    t = Math.max(0, Math.min(1, t));
    const closestX = x1 + t * dx;
    const closestY = y1 + t * dy;
    const dist = Math.hypot(px - closestX, py - closestY);
    if (dist < minDist) minDist = dist;
  }
  return minDist;
}

export function optimizeSchlaichEnergy(
  nodes: STMNode[],
  members: STMMember[],
  concreteMat: ConcreteMaterial,
  steelMat: SteelMaterial,
  concreteOutline: ConcreteOutline,
  dimension: '2D' | '3D' = '2D',
  maxIterations: number = 30
): OptimizationResult {
  // 1. Compute initial energy
  const initialSol = solveTruss(nodes, members, concreteMat, steelMat, concreteOutline.thickness, dimension);
  const initialEnergy = initialSol.totalStrainEnergy || 100;

  // 2. Identify movable nodes
  // A node is movable if it is not a support, not heavily loaded, and not explicitly marked fixed
  const movableNodeIds: string[] = [];
  nodes.forEach(n => {
    const hasExternalLoad = Math.abs(n.fx || 0) > 0.1 || Math.abs(n.fy || 0) > 0.1 || Math.abs(n.fz || 0) > 0.1;
    if (!n.isFixedInOpt && !n.isSupport && !n.isBlockedNearSupport && !hasExternalLoad) {
      movableNodeIds.push(n.id);
    }
  });

  // If no internal nodes found without loads, allow moving nodes that are not supports
  if (movableNodeIds.length === 0) {
    nodes.forEach(n => {
      if (!n.isFixedInOpt && !n.isSupport && !n.isBlockedNearSupport) {
        movableNodeIds.push(n.id);
      }
    });
  }

  // Clone nodes
  let currentNodes: STMNode[] = nodes.map(n => ({ ...n }));
  let bestEnergy = initialEnergy;
  let bestNodes = currentNodes.map(n => ({ ...n }));

  const steps: OptimizationStep[] = [
    {
      iteration: 0,
      totalEnergy: initialEnergy,
      nodePositions: currentNodes.map(n => ({ id: n.id, x: n.x, y: n.y, z: n.z }))
    }
  ];

  if (movableNodeIds.length === 0) {
    return {
      initialEnergy,
      optimizedEnergy: initialEnergy,
      reductionPercentage: 0,
      initialSteelWeight: initialSol.totalSteelWeightEst,
      optimizedSteelWeight: initialSol.totalSteelWeightEst,
      steelWeightReductionPercentage: 0,
      iterations: 0,
      optimizedNodes: nodes,
      steps
    };
  }

  // Polygon margin for safety
  const margin = 0.05; // 5 cm from border

  // Step size schedule
  let stepSize = 0.08; // 8 cm initial step

  for (let iter = 1; iter <= maxIterations; iter++) {
    let improvedInIter = false;

    // Shuffle or iterate over movable nodes
    for (const nodeId of movableNodeIds) {
      const nodeIndex = currentNodes.findIndex(n => n.id === nodeId);
      if (nodeIndex === -1) continue;

      const origNode = { ...currentNodes[nodeIndex] };

      // Try candidate directions
      const deltas2D = [
        [stepSize, 0],
        [-stepSize, 0],
        [0, stepSize],
        [0, -stepSize],
        [stepSize * 0.7, stepSize * 0.7],
        [-stepSize * 0.7, stepSize * 0.7],
        [stepSize * 0.7, -stepSize * 0.7],
        [-stepSize * 0.7, -stepSize * 0.7]
      ];

      const deltas3D = [
        ...deltas2D.map(([dx, dy]) => [dx, dy, 0]),
        [0, 0, stepSize],
        [0, 0, -stepSize]
      ];

      const candidateDeltas = dimension === '3D' ? deltas3D : deltas2D.map(([dx, dy]) => [dx, dy, 0]);

      let bestDelta: number[] | null = null;
      let minCandidateEnergy = bestEnergy;

      for (const [dx, dy, dz] of candidateDeltas) {
        const testX = origNode.x + dx;
        const testY = origNode.y + dy;
        const testZ = dimension === '3D' ? (origNode.z || 0) + (dz || 0) : 0;

        // Check if test point is inside concrete outline, with a safety margin from the boundary
        if (concreteOutline.points2D && concreteOutline.points2D.length >= 3) {
          if (!isPointInPolygon([testX, testY], concreteOutline.points2D)) {
            continue;
          }
          if (distanceToPolygonBoundary([testX, testY], concreteOutline.points2D) < margin) {
            continue;
          }
        }

        // Check 3D bounds
        if (dimension === '3D' && concreteOutline.bounds3D) {
          const b = concreteOutline.bounds3D;
          if (testX < b.minX || testX > b.maxX || testY < b.minY || testY > b.maxY || testZ < b.minZ || testZ > b.maxZ) {
            continue;
          }
        }

        // Apply temporary position
        currentNodes[nodeIndex].x = testX;
        currentNodes[nodeIndex].y = testY;
        if (dimension === '3D') currentNodes[nodeIndex].z = testZ;

        // Solve truss with candidate geometry
        const testSol = solveTruss(currentNodes, members, concreteMat, steelMat, concreteOutline.thickness, dimension);

        if (testSol.success && testSol.totalStrainEnergy < minCandidateEnergy - 0.01) {
          minCandidateEnergy = testSol.totalStrainEnergy;
          bestDelta = [dx, dy, dz];
        }
      }

      if (bestDelta) {
        currentNodes[nodeIndex].x = origNode.x + bestDelta[0];
        currentNodes[nodeIndex].y = origNode.y + bestDelta[1];
        if (dimension === '3D') currentNodes[nodeIndex].z = (origNode.z || 0) + (bestDelta[2] || 0);

        bestEnergy = minCandidateEnergy;
        bestNodes = currentNodes.map(n => ({ ...n }));
        improvedInIter = true;
      } else {
        // Revert to original
        currentNodes[nodeIndex].x = origNode.x;
        currentNodes[nodeIndex].y = origNode.y;
        if (dimension === '3D') currentNodes[nodeIndex].z = origNode.z;
      }
    }

    steps.push({
      iteration: iter,
      totalEnergy: bestEnergy,
      nodePositions: bestNodes.map(n => ({ id: n.id, x: n.x, y: n.y, z: n.z }))
    });

    // Decay step size
    if (!improvedInIter) {
      stepSize *= 0.6;
      if (stepSize < 0.005) {
        break; // Converged
      }
    }
  }

  const reductionPercentage = initialEnergy > 0 ? ((initialEnergy - bestEnergy) / initialEnergy) * 100 : 0;

  // Recalcule le poids d'acier réel sur la géométrie optimisée pour un gain non fictif
  const finalSol = solveTruss(bestNodes, members, concreteMat, steelMat, concreteOutline.thickness, dimension);
  const initialSteelWeight = initialSol.totalSteelWeightEst;
  const optimizedSteelWeight = finalSol.success ? finalSol.totalSteelWeightEst : initialSteelWeight;
  const steelWeightReductionPercentage = initialSteelWeight > 0
    ? Math.max(0, ((initialSteelWeight - optimizedSteelWeight) / initialSteelWeight) * 100)
    : 0;

  return {
    initialEnergy,
    optimizedEnergy: bestEnergy,
    reductionPercentage: Math.max(0, reductionPercentage),
    initialSteelWeight,
    optimizedSteelWeight,
    steelWeightReductionPercentage,
    iterations: steps.length - 1,
    optimizedNodes: bestNodes,
    steps
  };
}
