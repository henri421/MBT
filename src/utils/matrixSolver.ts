import {
  STMNode,
  STMMember,
  ConcreteMaterial,
  SteelMaterial,
  SolverResult,
  SolverMemberResult,
  SolverNodeResult,
  NodeType
} from '../types/stm';
import { checkEurocodeMember, checkEurocodeNode } from './eurocode2';

export function solveTruss(
  nodes: STMNode[],
  members: STMMember[],
  concreteMat: ConcreteMaterial,
  steelMat: SteelMaterial,
  concreteThickness: number = 0.30,
  dimension: '2D' | '3D' = '2D'
): SolverResult {
  const memberResultMap = new Map<string, SolverMemberResult>();
  const nodeResultMap = new Map<string, SolverNodeResult>();

  if (nodes.length < 2 || members.length < 1) {
    return {
      success: false,
      message: 'Le modèle doit comporter au moins 2 nœuds et 1 barre.',
      memberResults: memberResultMap,
      nodeResults: nodeResultMap,
      totalStrainEnergy: 0,
      totalSteelWeightEst: 0,
      maxUtilization: 0,
      isStable: false
    };
  }

  const dofPerNode = dimension === '2D' ? 2 : 3;
  const numNodes = nodes.length;
  const totalDofs = numNodes * dofPerNode;

  // Node ID to index mapping
  const nodeIndexMap = new Map<string, number>();
  nodes.forEach((n, idx) => nodeIndexMap.set(n.id, idx));

  // Determine fixed/constrained DOFs
  const isDofConstrained = new Array<boolean>(totalDofs).fill(false);
  let totalRestraints = 0;

  nodes.forEach((n, idx) => {
    const baseDof = idx * dofPerNode;
    const isBlocked = n.isSupport || n.isBlockedNearSupport;
    if (isBlocked) {
      if (dimension === '2D') {
        if (n.isBlockedNearSupport) {
          // Nœud bloqué à l'interface d'appui (bloque Rx et Ry pour éviter les bielles/tirants fictifs)
          isDofConstrained[baseDof] = true;     // Rx
          isDofConstrained[baseDof + 1] = true; // Ry
          totalRestraints += 2;
        } else {
          switch (n.supportType) {
            case 'roller_x':
              isDofConstrained[baseDof + 1] = true; // Ry contraint (glisse horizontalement)
              totalRestraints += 1;
              break;
            case 'roller_y':
              isDofConstrained[baseDof] = true;     // Rx contraint (glisse verticalement)
              totalRestraints += 1;
              break;
            case 'pin':
            default:
              isDofConstrained[baseDof] = true;     // Rx
              isDofConstrained[baseDof + 1] = true; // Ry
              totalRestraints += 2;
              break;
          }
        }
      } else {
        // 3D
        if (n.isBlockedNearSupport) {
          isDofConstrained[baseDof] = true;
          isDofConstrained[baseDof + 1] = true;
          isDofConstrained[baseDof + 2] = true;
          totalRestraints += 3;
        } else {
          switch (n.supportType) {
            case 'roller_z':
              isDofConstrained[baseDof + 2] = true; // Rz
              totalRestraints += 1;
              break;
            case 'roller_x':
              isDofConstrained[baseDof + 1] = true; // Ry
              isDofConstrained[baseDof + 2] = true; // Rz
              totalRestraints += 2;
              break;
            case 'roller_y':
              isDofConstrained[baseDof] = true;     // Rx
              isDofConstrained[baseDof + 2] = true; // Rz
              totalRestraints += 2;
              break;
            case 'pin':
            case 'fixed_3d':
            default:
              isDofConstrained[baseDof] = true;
              isDofConstrained[baseDof + 1] = true;
              isDofConstrained[baseDof + 2] = true;
              totalRestraints += 3;
              break;
          }
        }
      }
    }
  });

  const minRequiredRestraints = dimension === '2D' ? 3 : 6;
  if (totalRestraints < minRequiredRestraints) {
    return {
      success: false,
      message: `Conditions d'appui insuffisantes (${totalRestraints} bloquages trouvés, minimum ${minRequiredRestraints} requis pour empêcher les mouvements de corps rigide).`,
      memberResults: memberResultMap,
      nodeResults: nodeResultMap,
      totalStrainEnergy: 0,
      totalSteelWeightEst: 0,
      maxUtilization: 0,
      isStable: false
    };
  }

  // Global stiffness matrix
  const K: number[][] = Array.from({ length: totalDofs }, () => new Array<number>(totalDofs).fill(0));
  // External load vector
  const Fext: number[] = new Array<number>(totalDofs).fill(0);

  nodes.forEach((n, idx) => {
    const baseDof = idx * dofPerNode;
    Fext[baseDof] = n.fx || 0;
    Fext[baseDof + 1] = n.fy || 0;
    if (dimension === '3D') {
      Fext[baseDof + 2] = n.fz || 0;
    }
  });

  // Calculate Member properties and assemble K
  interface MemberGeometry {
    length: number;
    dir: number[]; // [cx, cy, cz]
    EA: number;
    idx1: number;
    idx2: number;
  }

  const memberGeom = new Map<string, MemberGeometry>();

  // Young modulus estimates:
  // Es = 200 GPa = 200,000 N/mm² = 200,000,000 kN/m²
  // Ec = 33 GPa = 33,000,000 kN/m²
  // Default representative cross section area for strut/tie:
  const defaultStrutArea = concreteThickness * 0.20; // e.g. 300mm x 200mm = 0.06 m²
  const Ec = 33e6; // kN/m²
  const Es = 200e6; // kN/m²
  // For initial stiffness, tie cross-section area in steel ~ 10-20 cm²
  const defaultTieArea = 0.0015; // 15 cm² = 0.0015 m²

  members.forEach((m) => {
    const n1 = nodes[nodeIndexMap.get(m.fromNodeId)!];
    const n2 = nodes[nodeIndexMap.get(m.toNodeId)!];
    if (!n1 || !n2) return;

    const dx = n2.x - n1.x;
    const dy = n2.y - n1.y;
    const dz = dimension === '3D' ? (n2.z || 0) - (n1.z || 0) : 0;
    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (len < 1e-4) return;

    const cx = dx / len;
    const cy = dy / len;
    const cz = dz / len;

    // Stiffness EA
    let EA = Ec * defaultStrutArea;
    if (m.type === 'tie') {
      EA = Es * defaultTieArea;
    }

    const idx1 = nodeIndexMap.get(m.fromNodeId)!;
    const idx2 = nodeIndexMap.get(m.toNodeId)!;

    memberGeom.set(m.id, {
      length: len,
      dir: [cx, cy, cz],
      EA,
      idx1,
      idx2
    });

    const kVal = EA / len;

    const dofs1 = [idx1 * dofPerNode, idx1 * dofPerNode + 1];
    const dofs2 = [idx2 * dofPerNode, idx2 * dofPerNode + 1];
    if (dimension === '3D') {
      dofs1.push(idx1 * dofPerNode + 2);
      dofs2.push(idx2 * dofPerNode + 2);
    }

    const c = dimension === '2D' ? [cx, cy] : [cx, cy, cz];
    const allDofs = [...dofs1, ...dofs2];
    const sign = [...c.map(v => -v), ...c]; // n2 - n1 direction

    for (let i = 0; i < allDofs.length; i++) {
      for (let j = 0; j < allDofs.length; j++) {
        K[allDofs[i]][allDofs[j]] += kVal * sign[i] * sign[j];
      }
    }
  });

  // Free DOFs mapping
  const freeDofs: number[] = [];
  for (let i = 0; i < totalDofs; i++) {
    if (!isDofConstrained[i]) {
      freeDofs.push(i);
    }
  }

  const numFree = freeDofs.length;
  if (numFree === 0) {
    return {
      success: false,
      message: 'Tous les nœuds sont bloqués. Aucune résolution possible.',
      memberResults: memberResultMap,
      nodeResults: nodeResultMap,
      totalStrainEnergy: 0,
      totalSteelWeightEst: 0,
      maxUtilization: 0,
      isStable: false
    };
  }

  // Build reduced system K_free * U_free = F_free
  const K_red: number[][] = Array.from({ length: numFree }, () => new Array<number>(numFree).fill(0));
  const F_red: number[] = new Array<number>(numFree).fill(0);

  for (let i = 0; i < numFree; i++) {
    const dofI = freeDofs[i];
    F_red[i] = Fext[dofI];
    for (let j = 0; j < numFree; j++) {
      const dofJ = freeDofs[j];
      K_red[i][j] = K[dofI][dofJ];
    }
  }

  // Solve with Gaussian Elimination with partial pivoting
  const U_red = solveLinearSystem(K_red, F_red);

  if (!U_red) {
    return {
      success: false,
      message: 'Système instable ou mécanisme cinématique détecté (matrice de rigidité singulière). Vérifiez le contreventement des barres ou les appuis.',
      memberResults: memberResultMap,
      nodeResults: nodeResultMap,
      totalStrainEnergy: 0,
      totalSteelWeightEst: 0,
      maxUtilization: 0,
      isStable: false
    };
  }

  // Full displacement vector U
  const U: number[] = new Array<number>(totalDofs).fill(0);
  for (let i = 0; i < numFree; i++) {
    U[freeDofs[i]] = U_red[i];
  }

  // Reactions: R = K * U - Fext
  const Reactions: number[] = new Array<number>(totalDofs).fill(0);
  for (let i = 0; i < totalDofs; i++) {
    let sum = 0;
    for (let j = 0; j < totalDofs; j++) {
      sum += K[i][j] * U[j];
    }
    Reactions[i] = sum - Fext[i];
  }

  // Calculate member normal forces N and strain energy
  let totalEnergy = 0;
  let totalSteelWeight = 0;
  let maxUtil = 0;

  // Node connected forces accumulator for equilibrium check and node classification
  const nodeForces = new Map<string, { fx: number; fy: number; fz: number; memberForces: { memberId: string; force: number; dir: number[] }[] }>();
  nodes.forEach(n => {
    nodeForces.set(n.id, { fx: 0, fy: 0, fz: 0, memberForces: [] });
  });

  members.forEach((m) => {
    const geom = memberGeom.get(m.id);
    if (!geom) return;

    const base1 = geom.idx1 * dofPerNode;
    const base2 = geom.idx2 * dofPerNode;

    const u1 = [U[base1], U[base1 + 1], dimension === '3D' ? U[base1 + 2] : 0];
    const u2 = [U[base2], U[base2 + 1], dimension === '3D' ? U[base2 + 2] : 0];

    const deltaU = (u2[0] - u1[0]) * geom.dir[0] +
                   (u2[1] - u1[1]) * geom.dir[1] +
                   (u2[2] - u1[2]) * geom.dir[2];

    const force = (geom.EA / geom.length) * deltaU; // kN (+ = tension, - = compression)
    const isCompression = force < -0.001;
    const isTension = force > 0.001;

    // Strain: deltaL / L in mm/m
    const axialStrain = (deltaU / geom.length) * 1000;

    // Work / Strain Energy: 0.5 * |F| * |deltaL| (in Joules = kN * m * 1000)
    const energy = 0.5 * Math.abs(force) * Math.abs(deltaU) * 1000;
    totalEnergy += energy;

    // Eurocode 2 verification
    const ecCheck = checkEurocodeMember(
      force,
      geom.length,
      m,
      concreteMat,
      steelMat,
      concreteThickness
    );

    if (ecCheck.utilizationRatio > maxUtil) {
      maxUtil = ecCheck.utilizationRatio;
    }

    if (ecCheck.requiredAs) {
      // Estimate steel mass: density = 7850 kg/m³
      // As in cm² -> m²: As * 1e-4
      const volumeM3 = (ecCheck.requiredAs * 1e-4) * geom.length;
      totalSteelWeight += volumeM3 * 7850;
    }

    memberResultMap.set(m.id, {
      memberId: m.id,
      force,
      stress: ecCheck.stress,
      axialStrain,
      length: geom.length,
      isCompression,
      designCapacity: ecCheck.designCapacity,
      utilizationRatio: ecCheck.utilizationRatio,
      requiredAs: ecCheck.requiredAs,
      suggestedRebar: ecCheck.suggestedRebar,
      designStressLimit: ecCheck.designStressLimit,
      effectiveWidthRequired: ecCheck.effectiveWidthRequired,
      status: ecCheck.status,
      notes: ecCheck.notes
    });

    // Record force on node 1 (pulls towards node 2 if tension force > 0)
    const nf1 = nodeForces.get(m.fromNodeId);
    if (nf1) {
      nf1.fx += force * geom.dir[0];
      nf1.fy += force * geom.dir[1];
      nf1.fz += force * geom.dir[2];
      nf1.memberForces.push({ memberId: m.id, force, dir: [geom.dir[0], geom.dir[1], geom.dir[2]] });
    }

    // Record force on node 2 (pulls towards node 1 if tension force > 0)
    const nf2 = nodeForces.get(m.toNodeId);
    if (nf2) {
      nf2.fx -= force * geom.dir[0];
      nf2.fy -= force * geom.dir[1];
      nf2.fz -= force * geom.dir[2];
      nf2.memberForces.push({ memberId: m.id, force, dir: [-geom.dir[0], -geom.dir[1], -geom.dir[2]] });
    }
  });

  // Process nodes, calculate equilibrium residual and verify nodal stress
  let totalRx = 0;
  let totalRy = 0;
  let totalRz = 0;
  let totalFx = 0;
  let totalFy = 0;
  let totalFz = 0;

  nodes.forEach((n, idx) => {
    const baseDof = idx * dofPerNode;
    const rx = isDofConstrained[baseDof] ? Reactions[baseDof] : 0;
    const ry = isDofConstrained[baseDof + 1] ? Reactions[baseDof + 1] : 0;
    const rz = (dimension === '3D' && isDofConstrained[baseDof + 2]) ? Reactions[baseDof + 2] : 0;

    totalRx += rx;
    totalRy += ry;
    totalRz += rz;
    totalFx += n.fx || 0;
    totalFy += n.fy || 0;
    totalFz += n.fz || 0;

    const nf = nodeForces.get(n.id);
    const sumFx = (n.fx || 0) + rx - (nf ? nf.fx : 0);
    const sumFy = (n.fy || 0) + ry - (nf ? nf.fy : 0);
    const sumFz = (n.fz || 0) + rz - (nf ? nf.fz : 0);
    const residual = Math.sqrt(sumFx * sumFx + sumFy * sumFy + sumFz * sumFz);

    // Auto classify node type (CCC, CCT, CTT, TTT) based on incident member forces
    let tensionCount = 0;
    let compressionCount = 0;
    if (nf) {
      nf.memberForces.forEach(mf => {
        if (mf.force > 0.05) tensionCount++;
        else if (mf.force < -0.05) compressionCount++;
      });
    }

    let detectedType: NodeType = 'CCC';
    if (tensionCount === 0) detectedType = 'CCC';
    else if (tensionCount === 1) detectedType = 'CCT';
    else if (tensionCount === 2) detectedType = 'CTT';
    else if (tensionCount >= 3) detectedType = 'TTT';

    const finalNodeType = (n.nodeType && n.nodeType !== 'AUTO') ? n.nodeType : detectedType;

    // Verify Eurocode nodal stress
    const nodeCheck = checkEurocodeNode(
      n,
      finalNodeType,
      rx,
      ry,
      rz,
      nf ? nf.memberForces : [],
      concreteMat,
      concreteThickness
    );

    nodeResultMap.set(n.id, {
      nodeId: n.id,
      rx,
      ry,
      rz,
      equilibriumResidual: residual,
      nodeType: finalNodeType,
      designStressLimit: nodeCheck.designStressLimit,
      bearingStress: nodeCheck.bearingStress,
      bearingUtilization: nodeCheck.bearingUtilization,
      requiredBearingArea: nodeCheck.requiredBearingArea,
      actualBearingArea: nodeCheck.actualBearingArea,
      status: nodeCheck.status
    });
  });

  return {
    success: true,
    message: 'Résolution par éléments finis du treillis réussie. Équilibre nodal vérifié.',
    memberResults: memberResultMap,
    nodeResults: nodeResultMap,
    totalStrainEnergy: totalEnergy,
    totalSteelWeightEst: totalSteelWeight,
    maxUtilization: maxUtil,
    isStable: true,
    totalRx,
    totalRy,
    totalRz,
    totalFx,
    totalFy,
    totalFz
  };
}

// Gaussian elimination solver with partial pivoting
function solveLinearSystem(A: number[][], b: number[]): number[] | null {
  const n = b.length;
  const M = A.map(row => [...row]);
  const x = [...b];

  for (let p = 0; p < n; p++) {
    // Find pivot
    let maxRow = p;
    let maxVal = Math.abs(M[p][p]);
    for (let i = p + 1; i < n; i++) {
      if (Math.abs(M[i][p]) > maxVal) {
        maxVal = Math.abs(M[i][p]);
        maxRow = i;
      }
    }

    if (maxVal < 1e-10) {
      return null; // Singular matrix
    }

    // Swap rows
    if (maxRow !== p) {
      const tmpRow = M[p];
      M[p] = M[maxRow];
      M[maxRow] = tmpRow;

      const tmpB = x[p];
      x[p] = x[maxRow];
      x[maxRow] = tmpB;
    }

    // Eliminate below
    for (let i = p + 1; i < n; i++) {
      const alpha = M[i][p] / M[p][p];
      x[i] -= alpha * x[p];
      for (let j = p; j < n; j++) {
        M[i][j] -= alpha * M[p][j];
      }
    }
  }

  // Back substitution
  const res = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = 0;
    for (let j = i + 1; j < n; j++) {
      sum += M[i][j] * res[j];
    }
    res[i] = (x[i] - sum) / M[i][i];
  }

  return res;
}
