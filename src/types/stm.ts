export type DimensionMode = '2D' | '3D';

export type NodeType = 'CCC' | 'CCT' | 'CTT' | 'AUTO';

export interface STMNode {
  id: string;
  x: number; // meters
  y: number; // meters
  z?: number; // meters (0 for 2D)
  isSupport?: boolean;
  supportType?: 'pin' | 'roller_x' | 'roller_y' | 'roller_z' | 'fixed_3d';
  // Applied external forces in kN
  fx?: number;
  fy?: number;
  fz?: number;
  // Bearing plate / support dimensions (meters)
  bearingShape?: 'rectangular' | 'circular';
  bearingDiameter?: number; // meters (e.g. 0.40 for 40cm circular pile or column)
  bearingWidth?: number; // a1 (length along member/support)
  bearingDepth?: number; // a2 (out of plane, defaults to beam width)
  // Calculated or assigned node type
  nodeType?: NodeType;
  isFixedInOpt?: boolean; // If true, optimizer cannot move this node (e.g. load point, support point)
  isBlockedNearSupport?: boolean; // Bloqué aux appuis pour éviter d'ajouter des bielles/tirants fictifs
}

export type MemberType = 'strut' | 'tie' | 'auto'; // strut = bielle (C), tie = tirant (T)

export interface STMMember {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  type: MemberType;
  // Transverse tension present for struts (EN 1992-1-1 6.5.2)
  hasTransverseTension?: boolean;
  // Out of plane width (defaults to concrete thickness bw)
  thickness?: number; // m
  // In-plane effective width of strut or steel rebar layout (calculated or user override)
  effectiveWidth?: number; // m
  // Number of rebar layers or diameter for ties
  barDiameter?: number; // mm (e.g. 20, 25, 32)
  rebarConfig?: {
    barDiameter: number; // mm
    barCount: number;
    layers: number;
    totalAreaCm2: number; // cm²
    anchorageLengthCm?: number;
    hookAnchorageLengthCm?: number;
  };
}

export interface ConcreteMaterial {
  name: string;
  fck: number; // MPa (ex: 30)
  gammaC: number; // 1.5
  alphaCc: number; // 1.0 (or 0.85 depending on national annex)
  aggregateSize: number; // dg in mm (ex: 20)
}

export interface SteelMaterial {
  name: string;
  fyk: number; // MPa (ex: 500)
  gammaS: number; // 1.15
  Es: number; // GPa (200)
}

export interface ConcreteOutline {
  // 2D polygon vertices in meters: [[x0, y0], [x1, y1], ...]
  points2D: [number, number][];
  // 3D bounding box / extruded volume: min and max coordinates
  bounds3D?: {
    minX: number; maxX: number;
    minY: number; maxY: number;
    minZ: number; maxZ: number;
  };
  thickness: number; // bw in meters (ex: 0.30 m)
  name?: string;
}

export interface SolverMemberResult {
  memberId: string;
  force: number; // kN (negative = compression / bielle, positive = tension / tirant)
  stress: number; // MPa
  axialStrain: number; // mm/m
  length: number; // m
  isCompression: boolean;
  // Eurocode check
  designCapacity: number; // kN
  utilizationRatio: number; // force / designCapacity (0 to 1+)
  requiredAs?: number; // cm² for ties
  providedAs?: number; // cm² for ties, from real rebarConfig or suggested rebar
  suggestedRebar?: string;
  anchorageLengthMm?: number; // lbd straight (mm), for ties
  designStressLimit: number; // sigma_Rd,max (MPa)
  effectiveWidthRequired: number; // mm
  effectiveWidthActual?: number; // mm, for struts
  status: 'OK' | 'WARNING' | 'EXCEEDED';
  notes: string;
}

export interface SolverNodeResult {
  nodeId: string;
  rx: number; // Reaction kN
  ry: number;
  rz: number;
  equilibriumResidual: number; // kN (should be ~0)
  nodeType: NodeType;
  designStressLimit: number; // sigma_Rd,max (MPa) from EC2 6.5.4
  bearingStress: number; // MPa
  bearingUtilization: number;
  requiredBearingArea: number; // cm²
  actualBearingArea: number; // cm²
  localBearingLimit?: number; // MPa, EC2 §6.7, pieux circulaires uniquement
  localBearingUtilization?: number;
  status: 'OK' | 'WARNING' | 'EXCEEDED';
}

export interface SolverResult {
  success: boolean;
  message?: string;
  memberResults: Map<string, SolverMemberResult>;
  nodeResults: Map<string, SolverNodeResult>;
  totalStrainEnergy: number; // Joules = sum(0.5 * F_i * deltaL_i)
  totalSteelWeightEst: number; // kg
  maxUtilization: number;
  isStable: boolean;
  totalRx?: number;
  totalRy?: number;
  totalRz?: number;
  totalFx?: number;
  totalFy?: number;
  totalFz?: number;
  unstableDetails?: {
    cause: 'zero_dof_stiffness' | 'underconstrained_truss' | 'general_mechanism';
    problematicNodeIds: string[];
    details: string[];
    suggestedFixes: string[];
    missingBarCount?: number;
  };
}

export interface OptimizationStep {
  iteration: number;
  totalEnergy: number;
  nodePositions: { id: string; x: number; y: number; z?: number }[];
}

export interface OptimizationResult {
  initialEnergy: number;
  optimizedEnergy: number;
  reductionPercentage: number;
  initialSteelWeight: number; // kg
  optimizedSteelWeight: number; // kg
  steelWeightReductionPercentage: number;
  iterations: number;
  optimizedNodes: STMNode[];
  steps: OptimizationStep[];
}

export interface ModelPreset {
  id: string;
  title: string;
  subtitle: string;
  dimension: DimensionMode;
  description: string;
  concrete: ConcreteOutline;
  concreteMat: ConcreteMaterial;
  steelMat: SteelMaterial;
  nodes: STMNode[];
  members: STMMember[];
}
