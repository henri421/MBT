/**
 * Exporteur de schéma vectoriel SVG pour les modèles de bielles et tirants (Eurocode 2).
 * Génère un fichier SVG autonome, ultra-net, directement exploitable dans CAD, Word, Illustrator
 * avec cotations, efforts Fc,Ed et TEd, sections d'acier As, et cartouche d'ingénierie.
 */

import {
  STMNode,
  STMMember,
  ConcreteOutline,
  SolverResult,
  ConcreteMaterial,
  SteelMaterial
} from '../types/stm';
import { COMMERCIAL_DIAMETERS, getBarAreaCm2 } from './rebarCalculator';
import { calculateStmDimensions } from './dimensionHelper';

export interface ExportSvgOptions {
  modelTitle?: string;
  showStrutWidths?: boolean;
  showForceLabels?: boolean;
  showAngles?: boolean;
  showDimensions?: boolean;
}

export function generateStmSvg(
  nodes: STMNode[],
  members: STMMember[],
  concrete: ConcreteOutline,
  solverResult: SolverResult | null,
  concreteMat: ConcreteMaterial,
  steelMat: SteelMaterial,
  options: ExportSvgOptions = {}
): string {
  const {
    modelTitle = 'Modèle de Bielles et Tirants (STM)',
    showStrutWidths = true,
    showForceLabels = true,
    showAngles = true,
    showDimensions = true
  } = options;

  // 1. Calcul de la boîte englobante (Bounding Box)
  const allX = [...concrete.points2D.map(p => p[0]), ...nodes.map(n => n.x)];
  const allY = [...concrete.points2D.map(p => p[1]), ...nodes.map(n => n.y)];

  const minX = allX.length > 0 ? Math.min(...allX) : 0;
  const maxX = allX.length > 0 ? Math.max(...allX) : 3.0;
  const minY = allY.length > 0 ? Math.min(...allY) : 0;
  const maxY = allY.length > 0 ? Math.max(...allY) : 1.5;

  const widthM = Math.max(maxX - minX, 0.8);
  const heightM = Math.max(maxY - minY, 0.6);

  // Échelle graphique en pixels par mètre
  const svgWidth = 1200;
  const marginX = 140;
  const marginY = 160;
  const scale = (svgWidth - marginX * 2) / widthM;
  const svgHeight = Math.round(heightM * scale + marginY * 2);

  // Fonction de transformation world -> svg
  const toSvgX = (wx: number) => marginX + (wx - minX) * scale;
  const toSvgY = (wy: number) => svgHeight - marginY - (wy - minY) * scale;

  // Contraste et styles graphiques
  const fcd = ((concreteMat.alphaCc * concreteMat.fck) / concreteMat.gammaC).toFixed(1);
  const fyd = (steelMat.fyk / steelMat.gammaS).toFixed(1);

  // Construction du tracé contour béton
  let concreteSvgPath = '';
  if (concrete.points2D.length > 0) {
    concreteSvgPath = concrete.points2D
      .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${toSvgX(pt[0]).toFixed(1)},${toSvgY(pt[1]).toFixed(1)}`)
      .join(' ') + ' Z';
  }

  // Éléments SVG
  const strutPolygons: string[] = [];
  const memberLines: string[] = [];
  const forceLabels: string[] = [];
  const nodeMarkers: string[] = [];
  const supportGraphics: string[] = [];
  const loadVectors: string[] = [];
  const angleArcs: string[] = [];

  // Mappe des nœuds
  const nodeMap = new Map<string, STMNode>();
  nodes.forEach(n => nodeMap.set(n.id, n));

  // Traitement des barres
  members.forEach(m => {
    const n1 = nodeMap.get(m.fromNodeId);
    const n2 = nodeMap.get(m.toNodeId);
    if (!n1 || !n2) return;

    const x1 = toSvgX(n1.x);
    const y1 = toSvgY(n1.y);
    const x2 = toSvgX(n2.x);
    const y2 = toSvgY(n2.y);

    const mRes = solverResult?.memberResults?.get(m.id);
    const force = mRes ? mRes.force : (m.type === 'strut' ? -100 : 100);
    const isCompression = force < -0.01;
    const isTension = force > 0.01;

    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthPx = Math.sqrt(dx * dx + dy * dy);
    if (lengthPx < 1) return;

    const nx = -dy / lengthPx;
    const ny = dx / lengthPx;

    // Prise en compte de la largeur efficace de bielle
    if (showStrutWidths && isCompression) {
      const weffM = mRes?.effectiveWidthRequired ? mRes.effectiveWidthRequired / 1000 : (m.effectiveWidth || 0.15);
      const halfW = (weffM * scale) / 2;

      const p1x = (x1 + nx * halfW).toFixed(1);
      const p1y = (y1 + ny * halfW).toFixed(1);
      const p2x = (x2 + nx * halfW).toFixed(1);
      const p2y = (y2 + ny * halfW).toFixed(1);
      const p3x = (x2 - nx * halfW).toFixed(1);
      const p3y = (y2 - ny * halfW).toFixed(1);
      const p4x = (x1 - nx * halfW).toFixed(1);
      const p4y = (y1 - ny * halfW).toFixed(1);

      strutPolygons.push(
        `<polygon points="${p1x},${p1y} ${p2x},${p2y} ${p3x},${p3y} ${p4x},${p4y}" fill="#3b82f6" fill-opacity="0.12" stroke="#2563eb" stroke-width="1.2" stroke-dasharray="4,4" />`
      );
    }

    // Ligne axiale
    const strokeColor = isCompression ? '#1d4ed8' : '#dc2626';
    const strokeWidth = isCompression ? '4' : '3.5';
    memberLines.push(
      `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linecap="round" />`
    );

    // Si tirant, ajouter des repères aux extrémités
    if (isTension) {
      memberLines.push(
        `<circle cx="${x1.toFixed(1)}" cy="${y1.toFixed(1)}" r="4.5" fill="#dc2626" />`,
        `<circle cx="${x2.toFixed(1)}" cy="${y2.toFixed(1)}" r="4.5" fill="#dc2626" />`
      );
    }

    // Labels des efforts
    if (showForceLabels && mRes) {
      const midX = (x1 + x2) / 2 + nx * 14;
      const midY = (y1 + y2) / 2 + ny * 14;
      const forceText = isCompression
        ? `Fc,Ed = ${Math.abs(force).toFixed(1)} kN`
        : `TEd = +${force.toFixed(1)} kN`;

      const subText = isTension && mRes.requiredAs
        ? `As = ${mRes.requiredAs.toFixed(2)} cm²`
        : `σ = ${mRes.stress.toFixed(1)} MPa`;

      const textColor = isCompression ? '#1e40af' : '#b91c1c';
      const bgColor = isCompression ? '#eff6ff' : '#fef2f2';
      const borderColor = isCompression ? '#bfdbfe' : '#fecaca';

      forceLabels.push(`
        <g transform="translate(${midX.toFixed(1)}, ${midY.toFixed(1)})">
          <rect x="-65" y="-18" width="130" height="28" rx="4" fill="${bgColor}" stroke="${borderColor}" stroke-width="1" filter="drop-shadow(0 1px 2px rgba(0,0,0,0.05))" />
          <text x="0" y="-4" font-size="11" font-weight="bold" fill="${textColor}" text-anchor="middle" font-family="monospace">${forceText}</text>
          <text x="0" y="7" font-size="9.5" fill="#475569" text-anchor="middle">${subText}</text>
        </g>
      `);
    }
  });

  // Traitement des nœuds et appuis
  nodes.forEach(n => {
    const sx = toSvgX(n.x);
    const sy = toSvgY(n.y);
    const nRes = solverResult?.nodeResults?.get(n.id);
    const isSupport = n.isSupport;
    const isBlocked = n.isBlockedNearSupport || isSupport;

    // Représentation des appuis et nœuds bloqués
    if (isBlocked) {
      // Symbole d'appui
      supportGraphics.push(`
        <g transform="translate(${sx.toFixed(1)}, ${sy.toFixed(1)})">
          <!-- Triangle d'appui -->
          <polygon points="0,0 -12,18 12,18" fill="#475569" stroke="#1e293b" stroke-width="1.5" />
          <!-- Plaque d'assise -->
          <line x1="-16" y1="18" x2="16" y2="18" stroke="#1e293b" stroke-width="2.5" />
          <!-- Hachures de sol encastré -->
          <line x1="-14" y1="23" x2="-8" y2="18" stroke="#64748b" stroke-width="1.5" />
          <line x1="-8" y1="23" x2="-2" y2="18" stroke="#64748b" stroke-width="1.5" />
          <line x1="-2" y1="23" x2="4" y2="18" stroke="#64748b" stroke-width="1.5" />
          <line x1="4" y1="23" x2="10" y2="18" stroke="#64748b" stroke-width="1.5" />
          <line x1="10" y1="23" x2="16" y2="18" stroke="#64748b" stroke-width="1.5" />
          ${n.isBlockedNearSupport ? '<text x="0" y="32" font-size="9" font-weight="bold" fill="#047857" text-anchor="middle">BLOQUÉ</text>' : ''}
        </g>
      `);

      // Vecteurs de réaction si disponibles
      if (nRes && (Math.abs(nRes.rx) > 0.5 || Math.abs(nRes.ry) > 0.5)) {
        if (Math.abs(nRes.ry) > 0.5) {
          const arrowLen = Math.min(Math.abs(nRes.ry) * 0.25 + 30, 70);
          const dirY = nRes.ry > 0 ? -1 : 1;
          const ryText = `Ry = ${nRes.ry.toFixed(1)} kN`;
          supportGraphics.push(`
            <g transform="translate(${sx.toFixed(1)}, ${(sy + (dirY > 0 ? 25 : 0)).toFixed(1)})">
              <line x1="0" y1="${arrowLen * dirY}" x2="0" y2="0" stroke="#059669" stroke-width="2.5" marker-end="url(#arrow-rx-ry)" />
              <text x="14" y="${(arrowLen * dirY) / 2}" font-size="10" font-weight="bold" fill="#065f46" font-family="monospace">${ryText}</text>
            </g>
          `);
        }
      }
    }

    // Charges extérieures appliquées
    if (n.fy && Math.abs(n.fy) > 0.1) {
      const arrowLen = 50;
      const loadText = `F = ${Math.abs(n.fy).toFixed(0)} kN`;
      loadVectors.push(`
        <g transform="translate(${sx.toFixed(1)}, ${sy.toFixed(1)})">
          <line x1="0" y1="-${arrowLen}" x2="0" y2="-6" stroke="#b91c1c" stroke-width="3" marker-end="url(#arrow-load)" />
          <rect x="-35" y="-${arrowLen + 16}" width="70" height="18" rx="3" fill="#fef2f2" stroke="#f87171" stroke-width="1" />
          <text x="0" y="-${arrowLen + 3}" font-size="10" font-weight="bold" fill="#991b1b" text-anchor="middle" font-family="monospace">${loadText}</text>
        </g>
      `);
    }

    // Pastille du nœud
    const nodeType = nRes?.nodeType || n.nodeType || 'CCC';
    const nodeBgColor = nodeType === 'CCC' ? '#1e293b' : nodeType === 'CCT' ? '#4338ca' : '#b91c1c';

    nodeMarkers.push(`
      <g transform="translate(${sx.toFixed(1)}, ${sy.toFixed(1)})">
        <circle cx="0" cy="0" r="9" fill="${nodeBgColor}" stroke="#ffffff" stroke-width="2" filter="drop-shadow(0 1px 3px rgba(0,0,0,0.2))" />
        <text x="0" y="3.5" font-size="8.5" font-weight="bold" fill="#ffffff" text-anchor="middle">${n.id}</text>
        <text x="0" y="-13" font-size="9" font-weight="bold" fill="#475569" text-anchor="middle">${nodeType}</text>
      </g>
    `);
  });

  // Date actuelle
  const nowStr = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  // Lignes de cotes techniques automatiques
  const dimensionSvgs: string[] = [];
  if (showDimensions) {
    const dims = calculateStmDimensions(concrete, nodes);
    for (const d of dims) {
      if (d.type === 'horizontal' || d.type === 'span') {
        const x1 = toSvgX(d.x1);
        const x2 = toSvgX(d.x2);
        const y = toSvgY(d.y1 + d.offsetM);
        const yOrig = toSvgY(d.y1);
        dimensionSvgs.push(`
          <line x1="${x1}" y1="${yOrig}" x2="${x1}" y2="${y + 6}" stroke="#94a3b8" stroke-width="1" stroke-dasharray="2,2" />
          <line x1="${x2}" y1="${yOrig}" x2="${x2}" y2="${y + 6}" stroke="#94a3b8" stroke-width="1" stroke-dasharray="2,2" />
          <line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="#475569" stroke-width="1.2" />
          <line x1="${x1 - 4}" y1="${y + 4}" x2="${x1 + 4}" y2="${y - 4}" stroke="#1e293b" stroke-width="1.5" />
          <line x1="${x2 - 4}" y1="${y + 4}" x2="${x2 + 4}" y2="${y - 4}" stroke="#1e293b" stroke-width="1.5" />
          <rect x="${(x1 + x2) / 2 - 45}" y="${y - 14}" width="90" height="15" rx="3" fill="#ffffff" fill-opacity="0.95" stroke="#cbd5e1" stroke-width="0.75" />
          <text x="${(x1 + x2) / 2}" y="${y - 3}" font-size="9" font-family="monospace" font-weight="bold" fill="#0f172a" text-anchor="middle">${d.label}</text>
        `);
      } else if (d.type === 'vertical') {
        const x = toSvgX(d.x1 + d.offsetM);
        const xOrig = toSvgX(d.x1);
        const y1 = toSvgY(d.y1);
        const y2 = toSvgY(d.y2);
        dimensionSvgs.push(`
          <line x1="${xOrig}" y1="${y1}" x2="${x - 6}" y2="${y1}" stroke="#94a3b8" stroke-width="1" stroke-dasharray="2,2" />
          <line x1="${xOrig}" y1="${y2}" x2="${x - 6}" y2="${y2}" stroke="#94a3b8" stroke-width="1" stroke-dasharray="2,2" />
          <line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="#475569" stroke-width="1.2" />
          <line x1="${x - 4}" y1="${y1 + 4}" x2="${x + 4}" y2="${y1 - 4}" stroke="#1e293b" stroke-width="1.5" />
          <line x1="${x - 4}" y1="${y2 + 4}" x2="${x + 4}" y2="${y2 - 4}" stroke="#1e293b" stroke-width="1.5" />
          <rect x="${x - 45}" y="${(y1 + y2) / 2 - 8}" width="90" height="15" rx="3" fill="#ffffff" fill-opacity="0.95" stroke="#cbd5e1" stroke-width="0.75" />
          <text x="${x}" y="${(y1 + y2) / 2 + 3}" font-size="9" font-family="monospace" font-weight="bold" fill="#0f172a" text-anchor="middle">${d.label}</text>
        `);
      }
    }
  }

  // Cartouche d'ingénierie (Title Block) en bas à droite
  const titleBlockX = svgWidth - 360;
  const titleBlockY = svgHeight - 115;

  const titleBlockSvg = `
    <g transform="translate(${titleBlockX}, ${titleBlockY})">
      <rect x="0" y="0" width="340" height="100" rx="6" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.06))" />
      <line x1="0" y1="28" x2="340" y2="28" stroke="#e2e8f0" stroke-width="1" />
      <line x1="0" y1="64" x2="340" y2="64" stroke="#e2e8f0" stroke-width="1" />
      <line x1="170" y1="64" x2="170" y2="100" stroke="#e2e8f0" stroke-width="1" />
      
      <!-- Titre principal -->
      <text x="12" y="19" font-size="12" font-weight="bold" fill="#0f172a">${modelTitle}</text>
      
      <!-- Norme et matériaux -->
      <text x="12" y="44" font-size="9.5" fill="#334155"><tspan font-weight="bold">Norme :</tspan> NF EN 1992-1-1 (Eurocode 2 §6.5)</text>
      <text x="12" y="56" font-size="9.5" fill="#334155"><tspan font-weight="bold">Béton :</tspan> ${concreteMat.name} (fcd = ${fcd} MPa) | <tspan font-weight="bold">Acier :</tspan> ${steelMat.name} (fyd = ${fyd} MPa)</text>
      
      <!-- Données géométriques et énergétiques -->
      <text x="12" y="80" font-size="9" fill="#64748b">Épaisseur bw = ${(concrete.thickness * 100).toFixed(0)} cm</text>
      <text x="12" y="92" font-size="9" fill="#047857" font-weight="bold">Énergie : ${solverResult?.totalStrainEnergy.toFixed(1) || 0} J</text>
      
      <text x="182" y="80" font-size="9" fill="#64748b">Date : ${nowStr}</text>
      <text x="182" y="92" font-size="9" fill="#b91c1c" font-weight="bold">Acier requis : ${solverResult?.totalSteelWeightEst.toFixed(1) || 0} kg</text>
    </g>
  `;

  // Légende graphique en haut à gauche
  const legendSvg = `
    <g transform="translate(24, 24)">
      <rect x="0" y="0" width="240" height="90" rx="6" fill="#ffffff" fill-opacity="0.95" stroke="#cbd5e1" stroke-width="1" />
      <text x="10" y="16" font-size="10" font-weight="bold" fill="#1e293b">LÉGENDE DES EFFORTS</text>
      
      <!-- Bielle -->
      <line x1="12" y1="32" x2="36" y2="32" stroke="#1d4ed8" stroke-width="4" stroke-linecap="round" />
      <text x="44" y="35" font-size="9.5" fill="#1e40af" font-weight="600">Bielles comprimées (Fc,Ed)</text>
      
      <!-- Tirant -->
      <line x1="12" y1="52" x2="36" y2="52" stroke="#dc2626" stroke-width="3" />
      <circle cx="12" cy="52" r="3.5" fill="#dc2626" />
      <circle cx="36" cy="52" r="3.5" fill="#dc2626" />
      <text x="44" y="55" font-size="9.5" fill="#dc2626" font-weight="600">Tirants tendus (TEd / Armatures HA)</text>
      
      <!-- Nœud bloqué / appui -->
      <polygon points="20,68 14,80 26,80" fill="#475569" />
      <text x="44" y="76" font-size="9" fill="#475569">Appuis &amp; Nœuds bloqués</text>
    </g>
  `;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" xmlns="http://www.w3.org/2000/svg" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif">
  <defs>
    <!-- Flèche pour charges extérieures -->
    <marker id="arrow-load" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#b91c1c" />
    </marker>
    <!-- Flèche pour réactions d'appuis -->
    <marker id="arrow-rx-ry" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
      <path d="M 0 1 L 10 5 L 0 9 z" fill="#059669" />
    </marker>
    <!-- Motif de hachures légères pour le béton -->
    <pattern id="concrete-hatch" width="16" height="16" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
      <line x1="0" y1="0" x2="0" y2="16" stroke="#e2e8f0" stroke-width="0.8" />
    </pattern>
  </defs>

  <!-- Fond blanc de dessin -->
  <rect width="${svgWidth}" height="${svgHeight}" fill="#ffffff" />

  <!-- Contour et masse du béton armé -->
  ${concreteSvgPath ? `
    <path d="${concreteSvgPath}" fill="#f8fafc" stroke="#64748b" stroke-width="2" stroke-linejoin="round" />
    <path d="${concreteSvgPath}" fill="url(#concrete-hatch)" />
  ` : ''}

  <!-- Bielles (largeurs efficaces) -->
  <g id="strut-widths">
    ${strutPolygons.join('\n    ')}
  </g>

  <!-- Barres axiales du treillis -->
  <g id="members">
    ${memberLines.join('\n    ')}
  </g>

  <!-- Angles entre barres -->
  <g id="angles">
    ${angleArcs.join('\n    ')}
  </g>

  <!-- Appuis et blocages -->
  <g id="supports">
    ${supportGraphics.join('\n    ')}
  </g>

  <!-- Charges appliquées -->
  <g id="loads">
    ${loadVectors.join('\n    ')}
  </g>

  <!-- Nœuds -->
  <g id="nodes">
    ${nodeMarkers.join('\n    ')}
  </g>

  <!-- Labels des efforts normaux -->
  <g id="force-labels">
    ${forceLabels.join('\n    ')}
  </g>

  <!-- Lignes de cotes techniques -->
  <g id="dimension-lines">
    ${dimensionSvgs.join('\n    ')}
  </g>

  <!-- Légende -->
  ${legendSvg}

  <!-- Cartouche d'ingénierie -->
  ${titleBlockSvg}
</svg>`;
}

/**
 * Déclenche le téléchargement direct du fichier SVG dans le navigateur
 */
export function downloadSvgFile(svgContent: string, filename: string = 'schema-bielles-tirants.svg') {
  const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
