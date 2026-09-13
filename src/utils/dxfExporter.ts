import { STMNode, STMMember, ConcreteOutline, SolverResult } from '../types/stm';

/**
 * Generates an AutoCAD DXF (Release 12/2000 compatible ASCII format)
 * representing the Strut-and-Tie model, concrete envelope, member forces,
 * and key dimension lines for civil/structural CAD drafting.
 */
export function generateStmDxf(
  nodes: STMNode[],
  members: STMMember[],
  concrete: ConcreteOutline,
  solverResult: SolverResult | null,
  options: {
    modelTitle?: string;
    scaleToMm?: boolean; // If true, converts meter coordinates to mm (x 1000) for standard CAD drafting
    includeDimensions?: boolean;
  } = {}
): string {
  const scale = options.scaleToMm ? 1000 : 1;
  const unitFactor = options.scaleToMm ? 1000 : 1;
  const title = options.modelTitle || 'Modele_Bielles_Tirants_EC2';

  const nodeMap = new Map<string, STMNode>();
  nodes.forEach(n => nodeMap.set(n.id, n));

  const lines: string[] = [];

  const add = (...strings: (string | number)[]) => {
    for (const s of strings) {
      lines.push(String(s));
    }
  };

  // 1. HEADER SECTION
  add('0', 'SECTION');
  add('2', 'HEADER');
  add('9', '$ACADVER');
  add('1', 'AC1009'); // AutoCAD Release 12 ASCII standard
  add('9', '$INSUNITS');
  add('70', options.scaleToMm ? '4' : '6'); // 4 = mm, 6 = meters
  add('9', '$PROJECT');
  add('1', title);
  add('0', 'ENDSEC');

  // 2. TABLES SECTION
  add('0', 'SECTION');
  add('2', 'TABLES');

  // LTYPE Table
  add('0', 'TABLE');
  add('2', 'LTYPE');
  add('70', '2');
  // Continuous
  add('0', 'LTYPE');
  add('2', 'CONTINUOUS');
  add('70', '64');
  add('3', 'Solid line');
  add('72', '65');
  add('73', '0');
  add('40', '0.0');
  // Dashed
  add('0', 'LTYPE');
  add('2', 'DASHED');
  add('70', '64');
  add('3', '__ __ __ __');
  add('72', '65');
  add('73', '2');
  add('40', '0.5');
  add('49', '0.35');
  add('49', '-0.15');
  add('0', 'ENDTAB');

  // LAYER Table
  add('0', 'TABLE');
  add('2', 'LAYER');
  add('70', '7');

  const layers = [
    { name: 'BETON', color: 7 },         // White / Black
    { name: 'BIELLES', color: 5 },       // Blue
    { name: 'TIRANTS', color: 1 },       // Red
    { name: 'NOEUDS', color: 2 },        // Yellow
    { name: 'CHARGES_APPUIS', color: 3 }, // Green
    { name: 'TEXTES_EFFORTS', color: 4 }, // Cyan
    { name: 'COTES', color: 6 }          // Magenta
  ];

  for (const lyr of layers) {
    add('0', 'LAYER');
    add('2', lyr.name);
    add('70', '64');
    add('62', lyr.color);
    add('6', 'CONTINUOUS');
  }
  add('0', 'ENDTAB');
  add('0', 'ENDSEC');

  // 3. ENTITIES SECTION
  add('0', 'SECTION');
  add('2', 'ENTITIES');

  // Concrete Outline Entities
  const pts = concrete.points2D;
  if (pts && pts.length >= 3) {
    for (let i = 0; i < pts.length; i++) {
      const p1 = pts[i];
      const p2 = pts[(i + 1) % pts.length];
      add('0', 'LINE');
      add('8', 'BETON');
      add('10', (p1[0] * scale).toFixed(4));
      add('20', (p1[1] * scale).toFixed(4));
      add('30', '0.0');
      add('11', (p2[0] * scale).toFixed(4));
      add('21', (p2[1] * scale).toFixed(4));
      add('31', '0.0');
    }
  }

  // Members (Struts & Ties)
  for (const m of members) {
    const fn = nodeMap.get(m.fromNodeId);
    const tn = nodeMap.get(m.toNodeId);
    if (!fn || !tn) continue;

    const res = solverResult?.memberResults.get(m.id);
    const force = res ? res.force : (m.type === 'tie' ? 100 : -100);
    const isTie = force > 0.001 || m.type === 'tie';
    const layerName = isTie ? 'TIRANTS' : 'BIELLES';

    const x1 = fn.x * scale;
    const y1 = fn.y * scale;
    const z1 = (fn.z || 0) * scale;
    const x2 = tn.x * scale;
    const y2 = tn.y * scale;
    const z2 = (tn.z || 0) * scale;

    add('0', 'LINE');
    add('8', layerName);
    add('10', x1.toFixed(4));
    add('20', y1.toFixed(4));
    add('30', z1.toFixed(4));
    add('11', x2.toFixed(4));
    add('21', y2.toFixed(4));
    add('31', z2.toFixed(4));

    // Midpoint force label
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const mz = (z1 + z2) / 2;
    const forceLabel = res
      ? `${m.id}: ${force > 0 ? '+' : ''}${force.toFixed(1)} kN`
      : m.id;

    add('0', 'TEXT');
    add('8', 'TEXTES_EFFORTS');
    add('10', mx.toFixed(4));
    add('20', (my + 0.03 * unitFactor).toFixed(4));
    add('30', mz.toFixed(4));
    add('40', (0.05 * unitFactor).toFixed(4)); // Text height
    add('1', forceLabel);
  }

  // Nodes & Support Plates
  for (const n of nodes) {
    const nx = n.x * scale;
    const ny = n.y * scale;
    const nz = (n.z || 0) * scale;
    const r = 0.035 * unitFactor;

    // Circle for Node
    add('0', 'CIRCLE');
    add('8', 'NOEUDS');
    add('10', nx.toFixed(4));
    add('20', ny.toFixed(4));
    add('30', nz.toFixed(4));
    add('40', r.toFixed(4));

    // Node Label
    add('0', 'TEXT');
    add('8', 'NOEUDS');
    add('10', (nx + r * 1.2).toFixed(4));
    add('20', (ny + r * 1.2).toFixed(4));
    add('30', nz.toFixed(4));
    add('40', (0.05 * unitFactor).toFixed(4));
    add('1', n.id);

    // Support indicator
    if (n.isSupport) {
      const bw = (n.bearingWidth || 0.20) * scale;
      add('0', 'LINE');
      add('8', 'CHARGES_APPUIS');
      add('10', (nx - bw / 2).toFixed(4));
      add('20', (ny - 0.04 * unitFactor).toFixed(4));
      add('30', nz.toFixed(4));
      add('11', (nx + bw / 2).toFixed(4));
      add('21', (ny - 0.04 * unitFactor).toFixed(4));
      add('31', nz.toFixed(4));
    }

    // Applied Loads
    if ((n.fx && Math.abs(n.fx) > 0.1) || (n.fy && Math.abs(n.fy) > 0.1)) {
      const fx = n.fx || 0;
      const fy = n.fy || 0;
      const loadMag = Math.sqrt(fx * fx + fy * fy);
      const arrowLen = 0.25 * unitFactor;
      const dirX = -fx / loadMag;
      const dirY = -fy / loadMag;

      add('0', 'LINE');
      add('8', 'CHARGES_APPUIS');
      add('10', nx.toFixed(4));
      add('20', ny.toFixed(4));
      add('30', nz.toFixed(4));
      add('11', (nx + dirX * arrowLen).toFixed(4));
      add('21', (ny + dirY * arrowLen).toFixed(4));
      add('31', nz.toFixed(4));

      add('0', 'TEXT');
      add('8', 'CHARGES_APPUIS');
      add('10', (nx + dirX * arrowLen * 1.1).toFixed(4));
      add('20', (ny + dirY * arrowLen * 1.1).toFixed(4));
      add('30', nz.toFixed(4));
      add('40', (0.055 * unitFactor).toFixed(4));
      add('1', `F = ${loadMag.toFixed(1)} kN`);
    }
  }

  // Automatic Dimension Lines
  if (options.includeDimensions !== false && pts && pts.length >= 2) {
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    pts.forEach(p => {
      if (p[0] < minX) minX = p[0];
      if (p[0] > maxX) maxX = p[0];
      if (p[1] < minY) minY = p[1];
      if (p[1] > maxY) maxY = p[1];
    });

    const totalWidthM = maxX - minX;
    const totalHeightM = maxY - minY;
    const offset = 0.15 * unitFactor;

    // Bottom horizontal dimension
    const dimY = (minY * scale) - offset;
    add('0', 'LINE');
    add('8', 'COTES');
    add('10', (minX * scale).toFixed(4));
    add('20', dimY.toFixed(4));
    add('30', '0.0');
    add('11', (maxX * scale).toFixed(4));
    add('21', dimY.toFixed(4));
    add('31', '0.0');

    add('0', 'TEXT');
    add('8', 'COTES');
    add('10', (((minX + maxX) / 2) * scale).toFixed(4));
    add('20', (dimY - 0.05 * unitFactor).toFixed(4));
    add('30', '0.0');
    add('40', (0.05 * unitFactor).toFixed(4));
    add('1', `L = ${totalWidthM.toFixed(2)} m`);

    // Left vertical dimension
    const dimX = (minX * scale) - offset;
    add('0', 'LINE');
    add('8', 'COTES');
    add('10', dimX.toFixed(4));
    add('20', (minY * scale).toFixed(4));
    add('30', '0.0');
    add('11', dimX.toFixed(4));
    add('21', (maxY * scale).toFixed(4));
    add('31', '0.0');

    add('0', 'TEXT');
    add('8', 'COTES');
    add('10', (dimX - 0.08 * unitFactor).toFixed(4));
    add('20', (((minY + maxY) / 2) * scale).toFixed(4));
    add('30', '0.0');
    add('40', (0.05 * unitFactor).toFixed(4));
    add('1', `H = ${totalHeightM.toFixed(2)} m`);
  }

  add('0', 'ENDSEC');
  add('0', 'EOF');

  return lines.join('\n');
}

/**
 * Utility to trigger browser file download of DXF
 */
export function downloadDxfFile(
  nodes: STMNode[],
  members: STMMember[],
  concrete: ConcreteOutline,
  solverResult: SolverResult | null,
  filename: string,
  options?: { scaleToMm?: boolean; includeDimensions?: boolean }
) {
  const dxfContent = generateStmDxf(nodes, members, concrete, solverResult, {
    modelTitle: filename.replace('.dxf', ''),
    ...options
  });
  const blob = new Blob([dxfContent], { type: 'application/dxf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.dxf') ? filename : `${filename}.dxf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
