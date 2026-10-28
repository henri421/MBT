/**
 * Noyau de calcul de MBT (bielles et tirants, EN 1992-1-1 §6.5) : module PUR,
 * sans dependance a l'interface. Longueurs du modele en m, efforts en kN,
 * contraintes en MPa.
 */

export type * from './stm';
export { calculateStmDimensions, type StmDimension } from './dimensionHelper';
export { generateStmDxf } from './dxfExporter';
export {
  calculateSkinRebar,
  checkElsStress,
  checkEurocodeMember,
  checkEurocodeNode,
  checkStrutAngle,
  type EurocodeMemberCheckResult,
  type EurocodeNodeCheckResult,
  type SkinRebarCalculation,
  type StrutAngleDiagnostic,
} from './eurocode2';
export { buildParametricConcrete, findBoundaryIntersection, type BoundaryIntersection } from './geometryHelpers';
export { solveTruss } from './matrixSolver';
export {
  COMMERCIAL_DIAMETERS,
  calculateAnchorageLengths,
  calculateSuspensionStirrups,
  findCommercialRebarOptions,
  getBarAreaCm2,
  getLinearMassKgPerM,
  type CommercialBarOption,
  type RebarScheduleItem,
  type TieRebarDesign,
} from './rebarCalculator';
export { isPointInPolygon, optimizeSchlaichEnergy } from './schlaichOptimizer';
export { generateStmSvg, type ExportSvgOptions } from './svgExporter';
export { PRESETS } from './templates';
