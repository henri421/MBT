import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  STMNode,
  STMMember,
  ConcreteOutline,
  SolverResult,
  MemberType
} from '../types/stm';
import { findBoundaryIntersection } from '../utils/geometryHelpers';
import { calculateStmDimensions } from '../utils/dimensionHelper';
import { ZoomIn, ZoomOut, Maximize2, Trash2 } from 'lucide-react';

interface Canvas2DProps {
  nodes: STMNode[];
  members: STMMember[];
  concrete: ConcreteOutline;
  solverResult: SolverResult | null;
  activeTool: 'select' | 'add_node' | 'add_member' | 'add_support' | 'add_load';
  selectedNodeId: string | null;
  selectedMemberId: string | null;
  onSelectNode: (id: string | null) => void;
  onSelectMember: (id: string | null) => void;
  onUpdateNode: (updatedNode: STMNode) => void;
  onAddNode: (newNode: STMNode) => void;
  onAddMember: (fromId: string, toId: string, type: MemberType) => void;
  onDeleteNode: (id: string) => void;
  onDeleteMember: (id: string) => void;
  showStrutWidths: boolean;
  showForceLabels: boolean;
  showAngles: boolean;
  showDimensions?: boolean;
  snapGrid: boolean;
  gridSize: number; // in meters (e.g. 0.05)
}

export const Canvas2D: React.FC<Canvas2DProps> = ({
  nodes,
  members,
  concrete,
  solverResult,
  activeTool,
  selectedNodeId,
  selectedMemberId,
  onSelectNode,
  onSelectMember,
  onUpdateNode,
  onAddNode,
  onAddMember,
  onDeleteNode,
  onDeleteMember,
  showStrutWidths,
  showForceLabels,
  showAngles,
  showDimensions = true,
  snapGrid,
  gridSize
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [pan, setPan] = useState({ x: 140, y: 480 });
  const [scale, setScale] = useState(250); // pixels per meter
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [memberStartNodeId, setMemberStartNodeId] = useState<string | null>(null);
  const [hoverPos, setHoverPos] = useState<{ x: number; y: number } | null>(null);

  // Resize observer
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({ width: rect.width, height: rect.height });
      }
    };
    handleResize();
    const observer = new ResizeObserver(handleResize);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Fit view automatically on preset load or first mount
  const autoFitView = useCallback(() => {
    if (concrete.points2D.length === 0) return;
    const xs = concrete.points2D.map(p => p[0]);
    const ys = concrete.points2D.map(p => p[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const modelWidth = Math.max(maxX - minX, 0.6);
    const modelHeight = Math.max(maxY - minY, 0.6);

    const margin = 90;
    const availableWidth = dimensions.width - margin * 2;
    const availableHeight = dimensions.height - margin * 2;

    const newScale = Math.min(availableWidth / modelWidth, availableHeight / modelHeight, 380);
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    const newPanX = dimensions.width / 2 - centerX * newScale;
    const newPanY = dimensions.height / 2 + centerY * newScale;

    setScale(newScale);
    setPan({ x: newPanX, y: newPanY });
  }, [concrete.points2D, dimensions]);

  // Initial fit when dimensions are ready
  useEffect(() => {
    if (dimensions.width > 200 && dimensions.height > 200) {
      autoFitView();
    }
  }, [autoFitView]);

  // Coordinate transformations
  const worldToScreen = (wx: number, wy: number) => ({
    sx: pan.x + wx * scale,
    sy: pan.y - wy * scale
  });

  const screenToWorld = (sx: number, sy: number) => {
    let wx = (sx - pan.x) / scale;
    let wy = (pan.y - sy) / scale;
    if (snapGrid && gridSize > 0) {
      wx = Math.round(wx / gridSize) * gridSize;
      wy = Math.round(wy / gridSize) * gridSize;
    }
    return { wx, wy };
  };

  // Angles θ between struts (bielles en compression) and ties (tirants en traction) at nodes
  const strutTieAngles = useMemo(() => {
    if (!showAngles) return [];

    const anglesList: {
      nodeId: string;
      sx: number;
      sy: number;
      strutId: string;
      tieId: string;
      thetaDeg: number;
      arcPath: string;
      labelX: number;
      labelY: number;
      isWarning: boolean;
    }[] = [];

    nodes.forEach(n => {
      const pN = worldToScreen(n.x, n.y);
      const incident = members.filter(m => m.fromNodeId === n.id || m.toNodeId === n.id);

      const incidentStruts: { member: STMMember; otherNode: STMNode; screenAngle: number }[] = [];
      const incidentTies: { member: STMMember; otherNode: STMNode; screenAngle: number }[] = [];

      incident.forEach(m => {
        const otherId = m.fromNodeId === n.id ? m.toNodeId : m.fromNodeId;
        const otherNode = nodes.find(other => other.id === otherId);
        if (!otherNode) return;

        const res = solverResult?.memberResults.get(m.id);
        const force = res?.force ?? 0;
        const isComp = force < -0.01 || (res === undefined && m.type === 'strut');
        const isTens = force > 0.01 || (res === undefined && m.type === 'tie');

        const pOther = worldToScreen(otherNode.x, otherNode.y);
        const sAngle = Math.atan2(pOther.sy - pN.sy, pOther.sx - pN.sx);

        if (isComp) incidentStruts.push({ member: m, otherNode, screenAngle: sAngle });
        if (isTens) incidentTies.push({ member: m, otherNode, screenAngle: sAngle });
      });

      incidentStruts.forEach(strut => {
        incidentTies.forEach(tie => {
          const dxS = strut.otherNode.x - n.x;
          const dyS = strut.otherNode.y - n.y;
          const dxT = tie.otherNode.x - n.x;
          const dyT = tie.otherNode.y - n.y;

          const dot = dxS * dxT + dyS * dyT;
          const magS = Math.hypot(dxS, dyS);
          const magT = Math.hypot(dxT, dyT);
          if (magS < 1e-4 || magT < 1e-4) return;

          const cosVal = Math.max(-1, Math.min(1, dot / (magS * magT)));
          const thetaDeg = Math.acos(cosVal) * (180 / Math.PI);

          const r = 28; // Arc radius in pixels
          const a1 = strut.screenAngle;
          const a2 = tie.screenAngle;

          let dAngle = a2 - a1;
          while (dAngle > Math.PI) dAngle -= 2 * Math.PI;
          while (dAngle < -Math.PI) dAngle += 2 * Math.PI;

          const sweepFlag = dAngle > 0 ? 1 : 0;
          const startX = pN.sx + r * Math.cos(a1);
          const startY = pN.sy + r * Math.sin(a1);
          const endX = pN.sx + r * Math.cos(a2);
          const endY = pN.sy + r * Math.sin(a2);

          const arcPath = `M ${startX} ${startY} A ${r} ${r} 0 0 ${sweepFlag} ${endX} ${endY}`;

          const midAngle = a1 + dAngle / 2;
          const labelDist = r + 14;
          const labelX = pN.sx + labelDist * Math.cos(midAngle);
          const labelY = pN.sy + labelDist * Math.sin(midAngle);

          // Eurocode 2 recommended limits: 21.8° <= theta <= 65°
          const isWarning = thetaDeg < 21.8 || thetaDeg > 68.0;

          anglesList.push({
            nodeId: n.id,
            sx: pN.sx,
            sy: pN.sy,
            strutId: strut.member.id,
            tieId: tie.member.id,
            thetaDeg,
            arcPath,
            labelX,
            labelY,
            isWarning
          });
        });
      });
    });

    return anglesList;
  }, [nodes, members, solverResult, showAngles, scale, pan]);

  // Pan / Zoom handlers
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const newScale = Math.max(40, Math.min(scale * zoomFactor, 1400));
    const newPanX = mouseX - (mouseX - pan.x) * (newScale / scale);
    const newPanY = mouseY - (mouseY - pan.y) * (newScale / scale);

    setScale(newScale);
    setPan({ x: newPanX, y: newPanY });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      // Middle click or Alt+Click for panning
      setIsPanning(true);
      setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      return;
    }

    if (activeTool === 'add_node') {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const { wx, wy } = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
      const newId = `N${nodes.length + 1}`;
      onAddNode({
        id: newId,
        x: parseFloat(wx.toFixed(3)),
        y: parseFloat(wy.toFixed(3)),
        bearingWidth: 0.20
      });
      return;
    }

    if (activeTool === 'select') {
      setIsPanning(true);
      setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (isPanning && !draggingNodeId) {
      setPan({
        x: e.clientX - startPan.x,
        y: e.clientY - startPan.y
      });
      return;
    }

    if (draggingNodeId) {
      const { wx, wy } = screenToWorld(mouseX, mouseY);
      const node = nodes.find(n => n.id === draggingNodeId);
      if (node) {
        onUpdateNode({
          ...node,
          x: parseFloat(wx.toFixed(3)),
          y: parseFloat(wy.toFixed(3))
        });
      }
      return;
    }

    if (activeTool === 'add_member' && memberStartNodeId) {
      const { wx, wy } = screenToWorld(mouseX, mouseY);
      setHoverPos({ x: wx, y: wy });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggingNodeId(null);
  };

  const handleNodeClick = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();

    if (activeTool === 'select') {
      onSelectNode(nodeId);
      onSelectMember(null);
      return;
    }

    if (activeTool === 'add_member') {
      if (!memberStartNodeId) {
        setMemberStartNodeId(nodeId);
      } else if (memberStartNodeId !== nodeId) {
        onAddMember(memberStartNodeId, nodeId, 'auto');
        setMemberStartNodeId(null);
        setHoverPos(null);
      }
      return;
    }

    if (activeTool === 'add_support') {
      const node = nodes.find(n => n.id === nodeId);
      if (node) {
        onUpdateNode({
          ...node,
          isSupport: !node.isSupport,
          supportType: node.isSupport ? undefined : 'pin'
        });
      }
      return;
    }

    if (activeTool === 'add_load') {
      const node = nodes.find(n => n.id === nodeId);
      if (node) {
        onUpdateNode({
          ...node,
          fy: (node.fy || 0) !== 0 ? 0 : -250
        });
      }
      return;
    }
  };

  // SVG Concrete boundary path
  const concretePath = concrete.points2D.length > 0
    ? concrete.points2D.map((p, i) => {
        const { sx, sy } = worldToScreen(p[0], p[1]);
        return `${i === 0 ? 'M' : 'L'} ${sx} ${sy}`;
      }).join(' ') + ' Z'
    : '';

  // Clean light grid lines
  const gridLines = [];
  const minWorldX = (0 - pan.x) / scale;
  const maxWorldX = (dimensions.width - pan.x) / scale;
  const minWorldY = (pan.y - dimensions.height) / scale;
  const maxWorldY = (pan.y - 0) / scale;

  const startGridX = Math.floor(minWorldX / 0.5) * 0.5;
  const endGridX = Math.ceil(maxWorldX / 0.5) * 0.5;
  const startGridY = Math.floor(minWorldY / 0.5) * 0.5;
  const endGridY = Math.ceil(maxWorldY / 0.5) * 0.5;

  for (let gx = startGridX; gx <= endGridX; gx += 0.5) {
    const { sx } = worldToScreen(gx, 0);
    const isMajor = Math.abs(gx % 1.0) < 0.01;
    gridLines.push(
      <line
        key={`gx_${gx.toFixed(1)}`}
        x1={sx}
        y1={0}
        x2={sx}
        y2={dimensions.height}
        stroke={isMajor ? '#e2e8f0' : '#f1f5f9'}
        strokeWidth={isMajor ? 1 : 0.75}
      />
    );
  }

  for (let gy = startGridY; gy <= endGridY; gy += 0.5) {
    const { sy } = worldToScreen(0, gy);
    const isMajor = Math.abs(gy % 1.0) < 0.01;
    gridLines.push(
      <line
        key={`gy_${gy.toFixed(1)}`}
        x1={0}
        y1={sy}
        x2={dimensions.width}
        y2={sy}
        stroke={isMajor ? '#e2e8f0' : '#f1f5f9'}
        strokeWidth={isMajor ? 1 : 0.75}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      id="canvas-2d-container"
      className="w-full h-full relative overflow-hidden bg-white select-none cursor-default"
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      <svg className="w-full h-full block">
        <defs>
          {/* Subtle clean concrete pattern for light theme */}
          <pattern id="concreteHatchLight" width="24" height="24" patternUnits="userSpaceOnUse">
            <rect width="24" height="24" fill="#f8fafc" />
            <circle cx="5" cy="5" r="1" fill="#cbd5e1" opacity="0.6" />
            <circle cx="17" cy="17" r="1.2" fill="#cbd5e1" opacity="0.6" />
            <circle cx="19" cy="7" r="0.8" fill="#94a3b8" opacity="0.5" />
            <circle cx="7" cy="19" r="1" fill="#94a3b8" opacity="0.5" />
          </pattern>

          {/* External load arrow red */}
          <marker id="arrowLoadRed" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#dc2626" />
          </marker>

          {/* Reaction arrow emerald */}
          <marker id="arrowReactionGreen" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#16a34a" />
          </marker>
        </defs>

        {/* 1. Background Grid (Clean light lines) */}
        <g id="grid-layer">{gridLines}</g>

        {/* 2. Concrete boundary polygon (Lignes gris foncé, intérieur épuré) */}
        {concretePath && (
          <g id="concrete-layer">
            <path
              d={concretePath}
              fill="url(#concreteHatchLight)"
              stroke="#334155" // Gris foncé net
              strokeWidth="2.5"
              strokeLinejoin="round"
            />

            {/* Lignes de cotes techniques d'ingénierie */}
            {showDimensions && (
              <g id="dimension-lines-layer">
                {calculateStmDimensions(concrete, nodes).map((dim) => {
                  if (dim.type === 'horizontal' || dim.type === 'span') {
                    const p1 = worldToScreen(dim.x1, dim.y1 + dim.offsetM);
                    const p2 = worldToScreen(dim.x2, dim.y2 + dim.offsetM);
                    const pOrig1 = worldToScreen(dim.x1, dim.y1);
                    const pOrig2 = worldToScreen(dim.x2, dim.y2);
                    const midX = (p1.sx + p2.sx) / 2;
                    const midY = p1.sy;

                    return (
                      <g key={dim.id} className="pointer-events-none select-none">
                        {/* Lignes de rappel */}
                        <line x1={pOrig1.sx} y1={pOrig1.sy} x2={p1.sx} y2={p1.sy + 5} stroke="#94a3b8" strokeWidth="1" strokeDasharray="3,3" />
                        <line x1={pOrig2.sx} y1={pOrig2.sy} x2={p2.sx} y2={p2.sy + 5} stroke="#94a3b8" strokeWidth="1" strokeDasharray="3,3" />
                        {/* Ligne de cote principale */}
                        <line x1={p1.sx} y1={p1.sy} x2={p2.sx} y2={p2.sy} stroke="#475569" strokeWidth="1.3" />
                        {/* Ticks à 45° */}
                        <line x1={p1.sx - 4} y1={p1.sy + 4} x2={p1.sx + 4} y2={p1.sy - 4} stroke="#1e293b" strokeWidth="1.5" />
                        <line x1={p2.sx - 4} y1={p2.sy + 4} x2={p2.sx + 4} y2={p2.sy - 4} stroke="#1e293b" strokeWidth="1.5" />
                        {/* Badge texte */}
                        <rect
                          x={midX - 38}
                          y={midY - 18}
                          width="76"
                          height="14"
                          rx="3"
                          fill="#ffffff"
                          fillOpacity="0.95"
                          stroke="#cbd5e1"
                          strokeWidth="0.75"
                        />
                        <text
                          x={midX}
                          y={midY - 7}
                          fill="#0f172a"
                          fontSize="9.5"
                          fontFamily="JetBrains Mono, monospace"
                          fontWeight="700"
                          textAnchor="middle"
                        >
                          {dim.label}
                        </text>
                      </g>
                    );
                  } else if (dim.type === 'vertical') {
                    const p1 = worldToScreen(dim.x1 + dim.offsetM, dim.y1);
                    const p2 = worldToScreen(dim.x2 + dim.offsetM, dim.y2);
                    const pOrig1 = worldToScreen(dim.x1, dim.y1);
                    const pOrig2 = worldToScreen(dim.x2, dim.y2);
                    const midX = p1.sx;
                    const midY = (p1.sy + p2.sy) / 2;

                    return (
                      <g key={dim.id} className="pointer-events-none select-none">
                        {/* Lignes de rappel */}
                        <line x1={pOrig1.sx} y1={pOrig1.sy} x2={p1.sx - 5} y2={p1.sy} stroke="#94a3b8" strokeWidth="1" strokeDasharray="3,3" />
                        <line x1={pOrig2.sx} y1={pOrig2.sy} x2={p2.sx - 5} y2={p2.sy} stroke="#94a3b8" strokeWidth="1" strokeDasharray="3,3" />
                        {/* Ligne de cote principale */}
                        <line x1={p1.sx} y1={p1.sy} x2={p2.sx} y2={p2.sy} stroke="#475569" strokeWidth="1.3" />
                        {/* Ticks à 45° */}
                        <line x1={p1.sx - 4} y1={p1.sy + 4} x2={p1.sx + 4} y2={p1.sy - 4} stroke="#1e293b" strokeWidth="1.5" />
                        <line x1={p2.sx - 4} y1={p2.sy + 4} x2={p2.sx + 4} y2={p2.sy - 4} stroke="#1e293b" strokeWidth="1.5" />
                        {/* Badge texte */}
                        <rect
                          x={midX - 42}
                          y={midY - 8}
                          width="78"
                          height="14"
                          rx="3"
                          fill="#ffffff"
                          fillOpacity="0.95"
                          stroke="#cbd5e1"
                          strokeWidth="0.75"
                        />
                        <text
                          x={midX - 3}
                          y={midY + 3}
                          fill="#0f172a"
                          fontSize="9.5"
                          fontFamily="JetBrains Mono, monospace"
                          fontWeight="700"
                          textAnchor="middle"
                        >
                          {dim.label}
                        </text>
                      </g>
                    );
                  }
                  return null;
                })}
              </g>
            )}

            {/* Cotations des segments individuels */}
            {concrete.points2D.map((p, idx) => {
              const nextP = concrete.points2D[(idx + 1) % concrete.points2D.length];
              const dist = Math.hypot(nextP[0] - p[0], nextP[1] - p[1]);
              if (dist < 0.25) return null;
              const midW = { wx: (p[0] + nextP[0]) / 2, wy: (p[1] + nextP[1]) / 2 };
              const { sx, sy } = worldToScreen(midW.wx, midW.wy);
              return (
                <g key={`dim_${idx}`}>
                  <rect
                    x={sx - 20}
                    y={sy - 16}
                    width="40"
                    height="14"
                    rx="3"
                    fill="#ffffff"
                    fillOpacity="0.85"
                    stroke="#cbd5e1"
                    strokeWidth="0.75"
                  />
                  <text
                    x={sx}
                    y={sy - 6}
                    fill="#334155"
                    fontSize="10"
                    fontFamily="JetBrains Mono, monospace"
                    fontWeight="600"
                    textAnchor="middle"
                    className="pointer-events-none select-none"
                  >
                    {dist.toFixed(2)}m
                  </text>
                </g>
              );
            })}
          </g>
        )}

        {/* 3. Réseau de contraintes en pointillés (Couloirs de compression des bielles en bleu) */}
        {showStrutWidths && (
          <g id="stress-network-layer">
            {members.map((m) => {
              const n1 = nodes.find(n => n.id === m.fromNodeId);
              const n2 = nodes.find(n => n.id === m.toNodeId);
              if (!n1 || !n2) return null;

              const res = solverResult?.memberResults.get(m.id);
              const force = res?.force ?? 0;
              const isCompression = force < -0.01 || (res === undefined && m.type === 'strut');
              if (!isCompression) return null;

              const p1 = worldToScreen(n1.x, n1.y);
              const p2 = worldToScreen(n2.x, n2.y);

              const effectiveWidth = res?.effectiveWidthRequired
                ? (res.effectiveWidthRequired / 1000)
                : (m.effectiveWidth || 0.18);

              const widthPixels = Math.max(effectiveWidth * scale, 8);

              const dx = p2.sx - p1.sx;
              const dy = p2.sy - p1.sy;
              const len = Math.hypot(dx, dy);
              if (len < 1) return null;

              const nx = (-dy / len) * (widthPixels / 2);
              const ny = (dx / len) * (widthPixels / 2);

              return (
                <polygon
                  key={`stress-corridor-${m.id}`}
                  points={`
                    ${p1.sx + nx},${p1.sy + ny}
                    ${p2.sx + nx},${p2.sy + ny}
                    ${p2.sx - nx},${p2.sy - ny}
                    ${p1.sx - nx},${p1.sy - ny}
                  `}
                  fill="rgba(37, 99, 235, 0.08)" // Bleu translucide doux pour couloir de bielle
                  stroke="#2563eb" // Bleu bielle
                  strokeWidth="1.5"
                  strokeDasharray="4,4" // Réseau de contraintes en pointillés
                  className="pointer-events-none"
                />
              );
            })}
          </g>
        )}

        {/* 4. Barres du treillis : Bielles (C) en bleu et Tirants (T) en rouge */}
        <g id="members-layer">
          {members.map((m) => {
            const n1 = nodes.find(n => n.id === m.fromNodeId);
            const n2 = nodes.find(n => n.id === m.toNodeId);
            if (!n1 || !n2) return null;

            const p1 = worldToScreen(n1.x, n1.y);
            const p2 = worldToScreen(n2.x, n2.y);
            const isSelected = selectedMemberId === m.id;

            const res = solverResult?.memberResults.get(m.id);
            const force = res?.force ?? 0;
            const isCompression = force < -0.01 || (res === undefined && m.type === 'strut');
            const isTension = force > 0.01 || (res === undefined && m.type === 'tie');

            // Bielles en BLEU, Tirants en ROUGE
            const strokeColor = isCompression ? '#2563eb' : '#dc2626';

            const dx = p2.sx - p1.sx;
            const dy = p2.sy - p1.sy;
            const len = Math.hypot(dx, dy);

            const midX = (p1.sx + p2.sx) / 2;
            const midY = (p1.sy + p2.sy) / 2;

            return (
              <g
                key={m.id}
                id={`member-${m.id}`}
                className="cursor-pointer transition-opacity"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectMember(m.id);
                  onSelectNode(null);
                }}
              >
                {/* Main Member Line (Bleu si Bielle, Rouge si Tirant) */}
                <line
                  x1={p1.sx}
                  y1={p1.sy}
                  x2={p2.sx}
                  y2={p2.sy}
                  stroke={strokeColor}
                  strokeWidth={isSelected ? '5' : isCompression ? '3.5' : '3'}
                  strokeLinecap="round"
                />

                {/* Click target hitbox */}
                <line
                  x1={p1.sx}
                  y1={p1.sy}
                  x2={p2.sx}
                  y2={p2.sy}
                  stroke="transparent"
                  strokeWidth="20"
                />

                {/* Crantage d'armatures transversales pour les tirants en traction */}
                {isTension && len > 35 && (
                  <g>
                    {[-14, 0, 14].map((offset, i) => {
                      const t = 0.5 + offset / len;
                      const hx = p1.sx + dx * t;
                      const hy = p1.sy + dy * t;
                      return (
                        <line
                          key={i}
                          x1={hx - dy * 0.07}
                          y1={hy + dx * 0.07}
                          x2={hx + dy * 0.07}
                          y2={hy - dx * 0.07}
                          stroke="#b91c1c"
                          strokeWidth="2"
                        />
                      );
                    })}
                  </g>
                )}

                {/* Étiquette : Effort N & Rôle */}
                {showForceLabels && (
                  <g transform={`translate(${midX}, ${midY})`}>
                    <rect
                      x="-40"
                      y="-12"
                      width="80"
                      height="24"
                      rx="4"
                      fill="#ffffff"
                      stroke={isSelected ? strokeColor : isCompression ? '#bfdbfe' : '#fecaca'}
                      strokeWidth={isSelected ? '2' : '1'}
                      className="shadow-sm"
                    />
                    <text
                      x="0"
                      y="4"
                      fill={isCompression ? '#1d4ed8' : '#b91c1c'}
                      fontSize="10"
                      fontFamily="JetBrains Mono, monospace"
                      fontWeight="700"
                      textAnchor="middle"
                      className="select-none pointer-events-none"
                    >
                      {res
                        ? `${isCompression ? 'C' : 'T'}: ${Math.abs(res.force).toFixed(0)} kN`
                        : m.type === 'strut' ? 'Bielle' : 'Tirant'}
                    </text>
                  </g>
                )}

                {/* Bouton direct de suppression sur la barre sélectionnée */}
                {isSelected && (
                  <g
                    transform={`translate(${midX + 50}, ${midY})`}
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteMember(m.id);
                    }}
                  >
                    <title>Supprimer cette barre (Touche Suppr)</title>
                    <circle cx="0" cy="0" r="11" fill="#ef4444" stroke="#ffffff" strokeWidth="2" className="shadow-md" />
                    <path
                      d="M -4 -4 h 8 M -3 -4 v 7 a 1 1 0 0 0 1 1 h 4 a 1 1 0 0 0 1 -1 v -7 M -1 -2 v 4 M 1 -2 v 4"
                      stroke="#ffffff"
                      strokeWidth="1.3"
                      fill="none"
                      strokeLinecap="round"
                    />
                  </g>
                )}
              </g>
            );
          })}
        </g>

        {/* 5. Appuis et Charges SUR LA FRONTIÈRE DE L'ÉLÉMENT */}
        <g id="boundary-supports-loads-layer">
          {nodes.map((node) => {
            const { sx, sy } = worldToScreen(node.x, node.y);
            const nodeRes = solverResult?.nodeResults.get(node.id);

            // A. Appuis sur l'élément (pas dans l'élément)
            if (node.isSupport) {
              const isRollerY = node.supportType === 'roller_y';
              const direction = isRollerY ? 'left' : 'down';
              const boundaryPt = findBoundaryIntersection(concrete.points2D, node.x, node.y, direction);

              // Coordonnées du point d'appui sur le bord extérieur
              const bScreen = boundaryPt
                ? worldToScreen(boundaryPt.x, boundaryPt.y)
                : { sx, sy: sy + 25 }; // fallback

              const plateWidthM = node.bearingWidth || 0.25;
              const plateWidthPx = plateWidthM * scale;

              return (
                <g key={`supp_${node.id}`} className="pointer-events-none select-none">
                  {/* Ligne de diffusion / potelet entre nœud STM interne et plaque sur le bord */}
                  <line
                    x1={sx}
                    y1={sy}
                    x2={bScreen.sx}
                    y2={bScreen.sy}
                    stroke="#64748b"
                    strokeWidth="1.5"
                    strokeDasharray="3,3"
                  />

                  {/* Surface d'appui sur la face extérieure : Plaque rectangulaire ou Pieu circulaire */}
                  {node.bearingShape === 'circular' ? (
                    <g>
                      {/* Tête de pieu et fût descendant */}
                      <rect
                        x={bScreen.sx - plateWidthPx / 2}
                        y={bScreen.sy}
                        width={plateWidthPx}
                        height={28}
                        fill="#cbd5e1"
                        fillOpacity="0.45"
                        stroke="#475569"
                        strokeWidth="1.5"
                        strokeDasharray="4,2"
                      />
                      <ellipse
                        cx={bScreen.sx}
                        cy={bScreen.sy}
                        rx={plateWidthPx / 2}
                        ry={3.5}
                        fill="#64748b"
                        stroke="#1e293b"
                        strokeWidth="1.2"
                      />
                      {/* Indication diamètre pieu */}
                      <text
                        x={bScreen.sx}
                        y={bScreen.sy + 18}
                        textAnchor="middle"
                        fill="#1e293b"
                        fontSize="8.5"
                        fontFamily="monospace"
                        fontWeight="bold"
                      >
                        ∅{((node.bearingDiameter || node.bearingWidth || 0.40) * 100).toFixed(0)}cm
                      </text>
                    </g>
                  ) : !isRollerY ? (
                    <rect
                      x={bScreen.sx - plateWidthPx / 2}
                      y={bScreen.sy - 3}
                      width={plateWidthPx}
                      height="6"
                      rx="1"
                      fill="#475569" // Gris acier
                      stroke="#1e293b"
                      strokeWidth="1"
                    />
                  ) : (
                    <rect
                      x={bScreen.sx - 3}
                      y={bScreen.sy - plateWidthPx / 2}
                      width="6"
                      height={plateWidthPx}
                      rx="1"
                      fill="#475569"
                      stroke="#1e293b"
                      strokeWidth="1"
                    />
                  )}

                  {/* Symbole d'appui (triangle / rouleaux) positionné SOUS la plaque d'appui extérieure */}
                  {!isRollerY ? (
                    <g transform={`translate(${bScreen.sx}, ${bScreen.sy + 3})`}>
                      {/* Triangle d'appui */}
                      <polygon
                        points="0,0 -12,18 12,18"
                        fill="#ffffff"
                        stroke="#334155"
                        strokeWidth="1.75"
                      />
                      {node.supportType === 'roller_x' ? (
                        <g>
                          <circle cx="-6" cy="22" r="2.5" fill="#334155" />
                          <circle cx="6" cy="22" r="2.5" fill="#334155" />
                          <line x1="-16" y1="26" x2="16" y2="26" stroke="#334155" strokeWidth="2" />
                        </g>
                      ) : (
                        <line x1="-15" y1="18" x2="15" y2="18" stroke="#334155" strokeWidth="2" />
                      )}

                      {/* Réaction d'appui réelle */}
                      {nodeRes && (
                        <g transform="translate(0, 24)">
                          {/* Flèche vectorielle de réaction d'appui Ry dirigée vers le haut */}
                          <line
                            x1="0"
                            y1="28"
                            x2="0"
                            y2="4"
                            stroke="#059669"
                            strokeWidth="2.5"
                            markerEnd="url(#arrowReactionGreen)"
                          />
                          {/* Badge de valeur de réaction réelle */}
                          <g transform="translate(0, 40)">
                            <rect
                              x="-48"
                              y="-10"
                              width="96"
                              height={Math.abs(nodeRes.rx) > 0.1 ? 32 : 20}
                              rx="4"
                              fill="#ffffff"
                              stroke="#86efac"
                              strokeWidth="1.2"
                              className="shadow-sm"
                            />
                            <text
                              x="0"
                              y={Math.abs(nodeRes.rx) > 0.1 ? 2 : 4}
                              fill="#047857"
                              fontSize="10"
                              fontFamily="JetBrains Mono, monospace"
                              fontWeight="700"
                              textAnchor="middle"
                            >
                              Ry = {nodeRes.ry >= 0 ? '+' : ''}{nodeRes.ry.toFixed(1)} kN
                            </text>
                            {Math.abs(nodeRes.rx) > 0.1 && (
                              <text
                                x="0"
                                y="14"
                                fill="#047857"
                                fontSize="9"
                                fontFamily="JetBrains Mono, monospace"
                                fontWeight="600"
                                textAnchor="middle"
                              >
                                Rx = {nodeRes.rx >= 0 ? '+' : ''}{nodeRes.rx.toFixed(1)} kN
                              </text>
                            )}
                          </g>
                        </g>
                      )}
                    </g>
                  ) : (
                    /* Appui horizontal (sur bord vertical gauche) */
                    <g transform={`translate(${bScreen.sx - 3}, ${bScreen.sy})`}>
                      <polygon
                        points="0,0 -18,-12 -18,12"
                        fill="#ffffff"
                        stroke="#334155"
                        strokeWidth="1.75"
                      />
                      <line x1="-18" y1="-15" x2="-18" y2="15" stroke="#334155" strokeWidth="2" />
                      {nodeRes && (
                        <g transform="translate(-24, 0)">
                          <line
                            x1="-24"
                            y1="0"
                            x2="-4"
                            y2="0"
                            stroke="#059669"
                            strokeWidth="2.5"
                            markerEnd="url(#arrowReactionGreen)"
                          />
                          <g transform="translate(-32, 0)">
                            <rect
                              x="-56"
                              y="-10"
                              width="56"
                              height="20"
                              rx="4"
                              fill="#ffffff"
                              stroke="#86efac"
                              strokeWidth="1.2"
                              className="shadow-sm"
                            />
                            <text
                              x="-28"
                              y="4"
                              fill="#047857"
                              fontSize="9.5"
                              fontFamily="JetBrains Mono, monospace"
                              fontWeight="700"
                              textAnchor="middle"
                            >
                              Rx = {nodeRes.rx >= 0 ? '+' : ''}{nodeRes.rx.toFixed(1)} kN
                            </text>
                          </g>
                        </g>
                      )}
                    </g>
                  )}
                </g>
              );
            }

            // B. Charges appliquées sur la face extérieure supérieure
            const hasVerticalLoad = node.fy && Math.abs(node.fy) > 0.01;
            if (hasVerticalLoad && node.fy! < 0) {
              const boundaryPt = findBoundaryIntersection(concrete.points2D, node.x, node.y, 'up');
              const bScreen = boundaryPt
                ? worldToScreen(boundaryPt.x, boundaryPt.y)
                : { sx, sy: sy - 20 };

              const plateWidthPx = (node.bearingWidth || 0.20) * scale;

              return (
                <g key={`load_${node.id}`} className="pointer-events-none select-none">
                  {/* Ligne de diffusion entre face supérieure et nœud interne */}
                  <line
                    x1={sx}
                    y1={sy}
                    x2={bScreen.sx}
                    y2={bScreen.sy}
                    stroke="#dc2626"
                    strokeWidth="1.5"
                    strokeDasharray="2,2"
                  />

                  {/* Plaque de chargement sur la surface supérieure du béton */}
                  <rect
                    x={bScreen.sx - plateWidthPx / 2}
                    y={bScreen.sy - 5}
                    width={plateWidthPx}
                    height="5"
                    rx="1"
                    fill="#334155"
                    stroke="#1e293b"
                    strokeWidth="1"
                  />

                  {/* Flèche de charge descendante vers la plaque (rouge) */}
                  <line
                    x1={bScreen.sx}
                    y1={bScreen.sy - 50}
                    x2={bScreen.sx}
                    y2={bScreen.sy - 6}
                    stroke="#dc2626"
                    strokeWidth="3"
                    markerEnd="url(#arrowLoadRed)"
                  />
                  <text
                    x={bScreen.sx}
                    y={bScreen.sy - 55}
                    fill="#dc2626"
                    fontSize="11"
                    fontFamily="JetBrains Mono, monospace"
                    fontWeight="700"
                    textAnchor="middle"
                  >
                    F = {Math.abs(node.fy!).toFixed(0)} kN
                  </text>
                </g>
              );
            }

            return null;
          })}
        </g>

        {/* 6. Angles θ entre bielles et tirants */}
        {showAngles && strutTieAngles.length > 0 && (
          <g id="angles-layer" className="pointer-events-none select-none">
            {strutTieAngles.map((ang, idx) => (
              <g key={`ang-${ang.nodeId}-${idx}`}>
                {/* Arc d'angle */}
                <path
                  d={ang.arcPath}
                  fill="none"
                  stroke={ang.isWarning ? '#ea580c' : '#0284c7'}
                  strokeWidth="2"
                  strokeDasharray="2,2"
                />
                {/* Étiquette d'angle θ */}
                <g transform={`translate(${ang.labelX}, ${ang.labelY})`}>
                  <rect
                    x="-24"
                    y="-9"
                    width="48"
                    height="18"
                    rx="4"
                    fill="#ffffff"
                    stroke={ang.isWarning ? '#f97316' : '#38bdf8'}
                    strokeWidth="1.2"
                    className="shadow-sm"
                  />
                  <text
                    x="0"
                    y="3.5"
                    fill={ang.isWarning ? '#c2410c' : '#0369a1'}
                    fontSize="9.5"
                    fontFamily="JetBrains Mono, monospace"
                    fontWeight="700"
                    textAnchor="middle"
                  >
                    θ={ang.thetaDeg.toFixed(1)}°
                  </text>
                </g>
              </g>
            ))}
          </g>
        )}

        {/* 7. Nœuds STM internes */}
        <g id="nodes-layer">
          {nodes.map((node) => {
            const { sx, sy } = worldToScreen(node.x, node.y);
            const isSelected = selectedNodeId === node.id;
            const isConnecting = memberStartNodeId === node.id;
            const nodeRes = solverResult?.nodeResults.get(node.id);
            const nodeType = nodeRes?.nodeType || node.nodeType || 'CCC';

            return (
              <g
                key={node.id}
                id={`node-${node.id}`}
                className="cursor-move"
                onMouseDown={(e) => {
                  if (activeTool === 'select') {
                    e.stopPropagation();
                    setDraggingNodeId(node.id);
                    onSelectNode(node.id);
                    onSelectMember(null);
                  }
                }}
                onClick={(e) => handleNodeClick(e, node.id)}
              >
                {/* Node Target / Halo when selected */}
                {isSelected && (
                  <circle
                    cx={sx}
                    cy={sy}
                    r="14"
                    fill="none"
                    stroke="#dc2626"
                    strokeWidth="2"
                    strokeDasharray="3,3"
                  />
                )}

                {/* Node Central Point */}
                <circle
                  cx={sx}
                  cy={sy}
                  r={isSelected ? '7' : '5.5'}
                  fill={isConnecting ? '#f59e0b' : isSelected ? '#dc2626' : '#ffffff'}
                  stroke="#1e293b"
                  strokeWidth="2"
                  className="transition-transform hover:scale-125 shadow-sm"
                />

                {/* Internal Node Core Dot */}
                <circle
                  cx={sx}
                  cy={sy}
                  r="2.5"
                  fill="#dc2626"
                />

                {/* Visual marker if node is blocked near support */}
                {node.isBlockedNearSupport && (
                  <g transform={`translate(${sx - 18}, ${sy - 16})`} className="pointer-events-none">
                    <rect x="0" y="0" width="14" height="14" rx="3" fill="#0d9488" stroke="#ffffff" strokeWidth="1.5" />
                    <path
                      d="M 4 4.5 v -1 a 2 2 0 0 1 4 0 v 1 M 3 4.5 h 6 v 5 h -6 z"
                      fill="#ffffff"
                      stroke="#ffffff"
                      strokeWidth="0.5"
                    />
                  </g>
                )}

                {/* Node Label (Identifiant & Type CCC/CCT) */}
                <g transform={`translate(${sx + 9}, ${sy - 9})`}>
                  <rect
                    x="-2"
                    y="-11"
                    width="44"
                    height="15"
                    rx="3"
                    fill="#ffffff"
                    stroke="#cbd5e1"
                    strokeWidth="0.75"
                    className="shadow-sm"
                  />
                  <text
                    x="20"
                    y="0"
                    fill="#0f172a"
                    fontSize="9.5"
                    fontFamily="JetBrains Mono, monospace"
                    fontWeight="700"
                    textAnchor="middle"
                    className="select-none pointer-events-none"
                  >
                    {node.id} <tspan fill="#64748b" fontSize="8">({nodeType})</tspan>
                  </text>
                </g>

                {/* Bouton direct de suppression sur le nœud sélectionné */}
                {isSelected && (
                  <g
                    transform={`translate(${sx + 24}, ${sy - 24})`}
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDeleteNode(node.id);
                    }}
                  >
                    <title>Supprimer ce nœud (Touche Suppr)</title>
                    <circle cx="0" cy="0" r="11" fill="#ef4444" stroke="#ffffff" strokeWidth="2" className="shadow-md" />
                    <path
                      d="M -4 -4 h 8 M -3 -4 v 7 a 1 1 0 0 0 1 1 h 4 a 1 1 0 0 0 1 -1 v -7 M -1 -2 v 4 M 1 -2 v 4"
                      stroke="#ffffff"
                      strokeWidth="1.3"
                      fill="none"
                      strokeLinecap="round"
                    />
                  </g>
                )}
              </g>
            );
          })}
        </g>

        {/* 7. Construction preview when creating member */}
        {activeTool === 'add_member' && memberStartNodeId && hoverPos && (
          <g className="pointer-events-none">
            {(() => {
              const startN = nodes.find(n => n.id === memberStartNodeId);
              if (!startN) return null;
              const p1 = worldToScreen(startN.x, startN.y);
              const p2 = worldToScreen(hoverPos.x, hoverPos.y);
              return (
                <line
                  x1={p1.sx}
                  y1={p1.sy}
                  x2={p2.sx}
                  y2={p2.sy}
                  stroke="#dc2626"
                  strokeWidth="2.5"
                  strokeDasharray="4,4"
                />
              );
            })()}
          </g>
        )}
      </svg>

      {/* Floating Canvas Quick Controls (Zoom, Fit) */}
      <div className="absolute bottom-4 right-4 flex items-center gap-1.5 bg-white/95 backdrop-blur border border-slate-200 rounded-lg p-1 shadow-md text-slate-700">
        <button
          onClick={() => setScale(s => Math.min(s * 1.2, 1400))}
          className="p-1.5 hover:bg-slate-100 rounded text-slate-700 transition-colors"
          title="Zoom Avant"
        >
          <ZoomIn size={16} />
        </button>
        <button
          onClick={() => setScale(s => Math.max(s * 0.8, 40))}
          className="p-1.5 hover:bg-slate-100 rounded text-slate-700 transition-colors"
          title="Zoom Arrière"
        >
          <ZoomOut size={16} />
        </button>
        <button
          onClick={autoFitView}
          className="p-1.5 hover:bg-slate-100 rounded text-slate-700 transition-colors"
          title="Centrer la vue"
        >
          <Maximize2 size={16} />
        </button>
        <span className="text-[10px] font-mono px-1.5 text-slate-500">
          {(scale / 2.4).toFixed(0)}%
        </span>
      </div>
    </div>
  );
};
