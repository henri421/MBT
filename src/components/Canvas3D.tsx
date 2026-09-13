import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { STMNode, STMMember, ConcreteOutline, SolverResult } from '../types/stm';
import { RotateCw, Eye, Maximize2, ZoomIn, ZoomOut } from 'lucide-react';

interface Canvas3DProps {
  nodes: STMNode[];
  members: STMMember[];
  concrete: ConcreteOutline;
  solverResult: SolverResult | null;
  selectedNodeId: string | null;
  selectedMemberId: string | null;
  onSelectNode: (id: string | null) => void;
  onSelectMember: (id: string | null) => void;
}

export const Canvas3D: React.FC<Canvas3DProps> = ({
  nodes,
  members,
  concrete,
  solverResult,
  selectedNodeId,
  selectedMemberId,
  onSelectNode,
  onSelectMember
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const gridHelperRef = useRef<THREE.GridHelper | null>(null);
  const animFrameIdRef = useRef<number | null>(null);

  const [showConcreteVolume, setShowConcreteVolume] = useState(true);
  const [isRotatingAuto, setIsRotatingAuto] = useState(false);

  // Orbit state
  const isDraggingRef = useRef(false);
  const dragModeRef = useRef<'rotate' | 'pan'>('rotate');
  const prevMouseRef = useRef({ x: 0, y: 0 });
  const cameraSphericalRef = useRef({ radius: 4.5, theta: Math.PI / 4, phi: Math.PI / 3.2 });
  const cameraTargetRef = useRef(new THREE.Vector3(1.2, 0.6, 0.6));
  const autoFitDoneRef = useRef(false);

  // Click raycasting
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseClickPosRef = useRef({ x: 0, y: 0 });
  const clickableObjectsRef = useRef<Array<{ mesh: THREE.Object3D; type: 'node' | 'member'; id: string }>>([]);

  const updateCameraPosition = useCallback(() => {
    if (!cameraRef.current) return;
    const { radius, theta, phi } = cameraSphericalRef.current;
    const target = cameraTargetRef.current;

    cameraRef.current.position.x = target.x + radius * Math.sin(phi) * Math.sin(theta);
    cameraRef.current.position.y = target.y + radius * Math.cos(phi);
    cameraRef.current.position.z = target.z + radius * Math.sin(phi) * Math.cos(theta);
    cameraRef.current.lookAt(target);
  }, []);

  // Frame and center the camera on the structural model
  const fitCameraToModel = useCallback((force = false) => {
    if (!cameraRef.current || (!force && autoFitDoneRef.current)) return;

    // Determine model bounds
    const is3DModel = nodes.some(n => n.z !== undefined && Math.abs(n.z) > 0.001) || !!concrete.bounds3D;
    const min = new THREE.Vector3(Infinity, Infinity, Infinity);
    const max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);

    nodes.forEach(n => {
      const px = n.x;
      const py = is3DModel ? (n.z || 0) : n.y;
      const pz = is3DModel ? n.y : 0;
      min.min(new THREE.Vector3(px, py, pz));
      max.max(new THREE.Vector3(px, py, pz));
    });

    if (concrete.bounds3D) {
      const b = concrete.bounds3D;
      min.min(new THREE.Vector3(b.minX, b.minZ, b.minY));
      max.max(new THREE.Vector3(b.maxX, b.maxZ, b.maxY));
    } else if (concrete.points2D && concrete.points2D.length > 0) {
      concrete.points2D.forEach(pt => {
        min.min(new THREE.Vector3(pt[0], pt[1], -concrete.thickness / 2));
        max.max(new THREE.Vector3(pt[0], pt[1], concrete.thickness / 2));
      });
    }

    if (!isFinite(min.x) || !isFinite(max.x)) {
      min.set(0, 0, 0);
      max.set(2, 1, 1);
    }

    const center = new THREE.Vector3().addVectors(min, max).multiplyScalar(0.5);
    const size = new THREE.Vector3().subVectors(max, min);
    const maxDim = Math.max(size.x, size.y, size.z, 0.8);

    cameraTargetRef.current.copy(center);
    cameraSphericalRef.current.radius = Math.max(maxDim * 2.2, 2.0);
    cameraSphericalRef.current.theta = Math.PI / 4.2;
    cameraSphericalRef.current.phi = Math.PI / 3.4;
    updateCameraPosition();

    // Adjust ground grid
    if (gridHelperRef.current) {
      gridHelperRef.current.position.set(center.x, 0, center.z);
    }

    autoFitDoneRef.current = true;
  }, [nodes, concrete, updateCameraPosition]);

  // Initial WebGL Scene Setup
  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    // Scene with elegant crisp light background
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8fafc);
    sceneRef.current = scene;

    // Perspective Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.05, 500);
    cameraRef.current = camera;

    // WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Lighting setup for engineering model clarity
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const hemisphereLight = new THREE.HemisphereLight(0xffffff, 0xe2e8f0, 0.65);
    scene.add(hemisphereLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.85);
    dirLight1.position.set(10, 15, 10);
    dirLight1.castShadow = true;
    dirLight1.shadow.mapSize.width = 1024;
    dirLight1.shadow.mapSize.height = 1024;
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xffffff, 0.45);
    dirLight2.position.set(-10, 8, -8);
    scene.add(dirLight2);

    const dirLight3 = new THREE.DirectionalLight(0xffffff, 0.35);
    dirLight3.position.set(0, -10, 0);
    scene.add(dirLight3);

    // Ground Grid Helper
    const grid = new THREE.GridHelper(8, 16, 0x94a3b8, 0xe2e8f0);
    grid.position.set(1.5, 0, 1.0);
    scene.add(grid);
    gridHelperRef.current = grid;

    updateCameraPosition();
    fitCameraToModel(true);

    // Animation Loop
    const animate = () => {
      if (isRotatingAuto) {
        cameraSphericalRef.current.theta += 0.006;
        updateCameraPosition();
      }
      renderer.render(scene, camera);
      animFrameIdRef.current = requestAnimationFrame(animate);
    };
    animate();

    // Robust ResizeObserver on container
    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        if (w > 0 && h > 0 && cameraRef.current && rendererRef.current) {
          cameraRef.current.aspect = w / h;
          cameraRef.current.updateProjectionMatrix();
          rendererRef.current.setSize(w, h);
        }
      }
    });
    resizeObserver.observe(container);

    return () => {
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      resizeObserver.disconnect();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [isRotatingAuto, updateCameraPosition, fitCameraToModel]);

  // Re-build 3D Meshes when geometry or calculation changes
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Remove previous dynamic elements
    const toRemove: THREE.Object3D[] = [];
    scene.children.forEach(child => {
      if (child.name === 'dynamic_stm') toRemove.push(child);
    });
    toRemove.forEach(obj => scene.remove(obj));

    const stmGroup = new THREE.Group();
    stmGroup.name = 'dynamic_stm';
    clickableObjectsRef.current = [];

    // Check if genuinely 3D (nodes have non-zero z or 3D bounds specified)
    const is3DModel = nodes.some(n => n.z !== undefined && Math.abs(n.z) > 0.001) || !!concrete.bounds3D;

    // Coordinate mapping helper:
    // In 3D models: Civil X = Three X, Civil Z (height) = Three Y, Civil Y (depth) = Three Z
    // In 2D models: Civil X = Three X, Civil Y (height) = Three Y, Civil Z (thickness) = Three Z
    const mapPoint = (x: number, y: number, z?: number): THREE.Vector3 => {
      if (is3DModel) {
        return new THREE.Vector3(x, z || 0, y);
      }
      return new THREE.Vector3(x, y, 0);
    };

    // 1. Concrete Outline 3D Geometry
    if (showConcreteVolume) {
      if (concrete.bounds3D) {
        // 3D Foundation block (semelle 3 ou 4 pieux)
        const b = concrete.bounds3D;
        const sizeX = b.maxX - b.minX;
        const sizeY = b.maxZ - b.minZ; // Height
        const sizeZ = b.maxY - b.minY; // Depth

        const geom = new THREE.BoxGeometry(sizeX, sizeY, sizeZ);
        const mat = new THREE.MeshStandardMaterial({
          color: 0x94a3b8,
          transparent: true,
          opacity: 0.22,
          roughness: 0.8,
          metalness: 0.1
        });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.set(
          (b.minX + b.maxX) / 2,
          (b.minZ + b.maxZ) / 2,
          (b.minY + b.maxY) / 2
        );
        stmGroup.add(mesh);

        const edges = new THREE.EdgesGeometry(geom);
        const edgeLine = new THREE.LineSegments(
          edges,
          new THREE.LineBasicMaterial({ color: 0x475569, linewidth: 2 })
        );
        edgeLine.position.copy(mesh.position);
        stmGroup.add(edgeLine);
      } else if (concrete.points2D && concrete.points2D.length >= 3) {
        try {
          // 2D Shape extruded upright in (X, Y) plane with depth along Z
          const shape = new THREE.Shape();
          concrete.points2D.forEach((p, idx) => {
            if (idx === 0) shape.moveTo(p[0], p[1]);
            else shape.lineTo(p[0], p[1]);
          });
          shape.closePath();

          const thick = concrete.thickness || 0.30;
          const extrudeGeom = new THREE.ExtrudeGeometry(shape, {
            depth: thick,
            bevelEnabled: false
          });

          const mat = new THREE.MeshStandardMaterial({
            color: 0x94a3b8,
            transparent: true,
            opacity: 0.22,
            roughness: 0.75,
            metalness: 0.05
          });
          const mesh = new THREE.Mesh(extrudeGeom, mat);
          // Center the extrusion around Z = 0
          mesh.position.set(0, 0, -thick / 2);
          stmGroup.add(mesh);

          const edges = new THREE.EdgesGeometry(extrudeGeom);
          const edgeLine = new THREE.LineSegments(
            edges,
            new THREE.LineBasicMaterial({ color: 0x475569, linewidth: 2 })
          );
          edgeLine.position.set(0, 0, -thick / 2);
          stmGroup.add(edgeLine);
        } catch (err) {
          console.warn('3D ExtrudeGeometry fallback:', err);
        }
      }
    }

    // 2. Members (Struts in Blue, Ties in Red)
    members.forEach(m => {
      const n1 = nodes.find(n => n.id === m.fromNodeId);
      const n2 = nodes.find(n => n.id === m.toNodeId);
      if (!n1 || !n2) return;

      const p1 = mapPoint(n1.x, n1.y, n1.z);
      const p2 = mapPoint(n2.x, n2.y, n2.z);
      const dir = new THREE.Vector3().subVectors(p2, p1);
      const len = dir.length();
      if (len < 1e-4) return;

      const res = solverResult?.memberResults.get(m.id);
      const force = res?.force ?? 0;
      const isCompression = force < -0.01 || (res === undefined && m.type === 'strut');
      const isTension = force > 0.01 || (res === undefined && m.type === 'tie');

      // Radius scaled proportional to load
      let radius = isCompression ? 0.045 : 0.030;
      if (res?.effectiveWidthRequired) {
        radius = Math.min(Math.max(res.effectiveWidthRequired / 2000, 0.025), 0.12);
      }

      const geom = new THREE.CylinderGeometry(radius, radius, len, 24);
      const isSelected = selectedMemberId === m.id;

      // Color coding: Blue for Struts (compression), Red for Ties (tension)
      const color = isCompression ? 0x2563eb : 0xdc2626;

      const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.35,
        metalness: isTension ? 0.65 : 0.2,
        emissive: isSelected ? (isCompression ? 0x60a5fa : 0xf87171) : 0x000000,
        emissiveIntensity: isSelected ? 0.5 : 0.0
      });

      const cylinder = new THREE.Mesh(geom, mat);
      const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);
      cylinder.position.copy(mid);

      const up = new THREE.Vector3(0, 1, 0);
      const normDir = dir.clone().normalize();
      const quat = new THREE.Quaternion().setFromUnitVectors(up, normDir);
      cylinder.quaternion.copy(quat);

      stmGroup.add(cylinder);
      clickableObjectsRef.current.push({ mesh: cylinder, type: 'member', id: m.id });

      // Steel rebar rings along tension ties
      if (isTension) {
        const ringGeom = new THREE.TorusGeometry(radius * 1.35, 0.007, 8, 20);
        const ringMat = new THREE.MeshStandardMaterial({ color: 0xfdba74, metalness: 0.8, roughness: 0.2 });
        for (let t = 0.2; t <= 0.8; t += 0.2) {
          const ring = new THREE.Mesh(ringGeom, ringMat);
          ring.position.copy(p1).lerp(p2, t);
          ring.quaternion.copy(quat);
          ring.rotateX(Math.PI / 2);
          stmGroup.add(ring);
        }
      }
    });

    // 3. Nodes (Spheres + Plates + Load Arrows)
    nodes.forEach(n => {
      const pos = mapPoint(n.x, n.y, n.z);
      const isSelected = selectedNodeId === n.id;
      const nodeRes = solverResult?.nodeResults.get(n.id);
      const nodeType = nodeRes?.nodeType || n.nodeType || 'CCC';

      let nodeColor = 0x0284c7; // CCC
      if (nodeType === 'CCT') nodeColor = 0xd97706; // CCT
      if (nodeType === 'CTT') nodeColor = 0xdc2626; // CTT

      const radius = isSelected ? 0.065 : 0.048;
      const sphereGeom = new THREE.SphereGeometry(radius, 24, 24);
      const sphereMat = new THREE.MeshStandardMaterial({
        color: nodeColor,
        roughness: 0.3,
        metalness: 0.2,
        emissive: isSelected ? 0xffffff : 0x000000,
        emissiveIntensity: isSelected ? 0.4 : 0.0
      });
      const sphere = new THREE.Mesh(sphereGeom, sphereMat);
      sphere.position.copy(pos);
      stmGroup.add(sphere);
      clickableObjectsRef.current.push({ mesh: sphere, type: 'node', id: n.id });

      // Support steel bearing plate
      if (n.isSupport) {
        const plateW = n.bearingWidth || 0.30;
        const plateGeom = new THREE.BoxGeometry(plateW, 0.04, is3DModel ? plateW : (concrete.thickness || 0.30));
        const plateMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.6, roughness: 0.4 });
        const plate = new THREE.Mesh(plateGeom, plateMat);
        plate.position.set(pos.x, pos.y - 0.035, pos.z);
        stmGroup.add(plate);
      }

      // External load 3D vector arrow
      const fVert = is3DModel ? (n.fz || n.fy || 0) : (n.fy || 0);
      const fHoriz = n.fx || 0;

      if (Math.abs(fVert) > 1 || Math.abs(fHoriz) > 1) {
        const dir3D = new THREE.Vector3(
          fHoriz !== 0 ? (fHoriz > 0 ? 1 : -1) : 0,
          fVert !== 0 ? (fVert > 0 ? 1 : -1) : 0,
          0
        ).normalize();

        const arrowOrigin = new THREE.Vector3(
          pos.x - dir3D.x * 0.45,
          pos.y - dir3D.y * 0.45,
          pos.z
        );
        const arrow = new THREE.ArrowHelper(dir3D, arrowOrigin, 0.45, 0xdc2626, 0.12, 0.08);
        stmGroup.add(arrow);
      }
    });

    scene.add(stmGroup);

    // Auto-fit camera whenever model or mesh updates
    fitCameraToModel(true);
  }, [nodes, members, concrete, solverResult, showConcreteVolume, selectedNodeId, selectedMemberId, fitCameraToModel]);

  // Mouse Drag Handlers for Smooth Orbit & Pan
  const handleMouseDown = (e: React.MouseEvent) => {
    isDraggingRef.current = true;
    dragModeRef.current = e.button === 2 || e.shiftKey ? 'pan' : 'rotate';
    prevMouseRef.current = { x: e.clientX, y: e.clientY };
    mouseClickPosRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - prevMouseRef.current.x;
    const dy = e.clientY - prevMouseRef.current.y;
    prevMouseRef.current = { x: e.clientX, y: e.clientY };

    if (dragModeRef.current === 'rotate') {
      cameraSphericalRef.current.theta -= dx * 0.007;
      cameraSphericalRef.current.phi = Math.max(
        0.05,
        Math.min(Math.PI - 0.05, cameraSphericalRef.current.phi - dy * 0.007)
      );
      updateCameraPosition();
    } else {
      // Pan camera target
      const factor = cameraSphericalRef.current.radius * 0.0015;
      const right = new THREE.Vector3();
      const up = new THREE.Vector3(0, 1, 0);
      if (cameraRef.current) {
        right.crossVectors(cameraRef.current.getWorldDirection(new THREE.Vector3()), up).normalize();
      }
      cameraTargetRef.current.addScaledVector(right, -dx * factor);
      cameraTargetRef.current.y += dy * factor;
      updateCameraPosition();
    }
  };

  const handleMouseUp = (e: React.MouseEvent) => {
    isDraggingRef.current = false;

    // Check if it was a stationary click (selection)
    const distSq =
      Math.pow(e.clientX - mouseClickPosRef.current.x, 2) +
      Math.pow(e.clientY - mouseClickPosRef.current.y, 2);

    if (distSq < 16 && containerRef.current && cameraRef.current && sceneRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycasterRef.current.setFromCamera(new THREE.Vector2(mouseX, mouseY), cameraRef.current);
      const meshes = clickableObjectsRef.current.map(o => o.mesh);
      const intersects = raycasterRef.current.intersectObjects(meshes, false);

      if (intersects.length > 0) {
        const hit = clickableObjectsRef.current.find(o => o.mesh === intersects[0].object);
        if (hit) {
          if (hit.type === 'node') {
            onSelectNode(hit.id);
            onSelectMember(null);
          } else {
            onSelectMember(hit.id);
            onSelectNode(null);
          }
          return;
        }
      }

      // Clicked background: unselect
      onSelectNode(null);
      onSelectMember(null);
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 1.08 : 0.92;
    cameraSphericalRef.current.radius = Math.max(
      0.8,
      Math.min(30.0, cameraSphericalRef.current.radius * zoomFactor)
    );
    updateCameraPosition();
  };

  const handleZoom = (delta: number) => {
    cameraSphericalRef.current.radius = Math.max(
      0.8,
      Math.min(30.0, cameraSphericalRef.current.radius * delta)
    );
    updateCameraPosition();
  };

  const resetView = () => {
    autoFitDoneRef.current = false;
    fitCameraToModel(true);
  };

  return (
    <div
      ref={containerRef}
      id="canvas3d-viewport"
      className="relative w-full h-full bg-slate-100 select-none overflow-hidden cursor-grab active:cursor-grabbing"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onWheel={handleWheel}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Dedicated Three.js canvas mount container */}
      <div ref={mountRef} className="absolute inset-0 w-full h-full pointer-events-none" />

      {/* Viewport Control Bar Overlay */}
      <div className="absolute top-4 right-4 flex items-center gap-1.5 bg-white/90 backdrop-blur border border-slate-200 shadow-md rounded-lg p-1 text-slate-700 z-10">
        <button
          id="btn-3d-toggle-concrete"
          onClick={() => setShowConcreteVolume(!showConcreteVolume)}
          className={`px-2.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors ${
            showConcreteVolume
              ? 'bg-slate-900 text-white shadow-sm'
              : 'hover:bg-slate-100 text-slate-600'
          }`}
          title="Afficher/Masquer le volume de béton"
        >
          <Eye size={13} />
          <span>Volume Béton</span>
        </button>

        <div className="h-4 w-px bg-slate-200"></div>

        <button
          id="btn-3d-zoom-in"
          onClick={() => handleZoom(0.85)}
          className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 transition-colors"
          title="Zoomer (+)"
        >
          <ZoomIn size={14} />
        </button>

        <button
          id="btn-3d-zoom-out"
          onClick={() => handleZoom(1.15)}
          className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 transition-colors"
          title="Dézoomer (-)"
        >
          <ZoomOut size={14} />
        </button>

        <button
          id="btn-3d-autorotate"
          onClick={() => setIsRotatingAuto(!isRotatingAuto)}
          className={`p-1.5 rounded-md transition-colors ${
            isRotatingAuto
              ? 'bg-red-50 text-red-600 font-bold border border-red-200'
              : 'hover:bg-slate-100 text-slate-600'
          }`}
          title="Rotation automatique à 360°"
        >
          <RotateCw size={14} className={isRotatingAuto ? 'animate-spin' : ''} />
        </button>

        <button
          id="btn-3d-reset-view"
          onClick={resetView}
          className="p-1.5 rounded-md hover:bg-slate-100 text-slate-600 transition-colors"
          title="Recadrer la vue sur l'élément"
        >
          <Maximize2 size={14} />
        </button>
      </div>

      {/* 3D Legend and Instructions */}
      <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur border border-slate-200 rounded-lg p-3 text-xs text-slate-700 space-y-2 pointer-events-none shadow-md max-w-xs">
        <div className="font-bold text-slate-900 border-b border-slate-200 pb-1 flex items-center justify-between">
          <span>Visualisation 3D Interactive</span>
          <span className="text-[10px] font-mono text-slate-500 font-normal">Three.js GL</span>
        </div>
        <div className="space-y-1 text-[11px]">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-600 shadow-sm flex-shrink-0"></div>
            <span>Bielles comprimées (Béton armé)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-600 shadow-sm flex-shrink-0"></div>
            <span>Tirants tendus (Aciers / Barres)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-sm bg-slate-700 shadow-sm flex-shrink-0"></div>
            <span>Plaques d'appui / Pieux de fondation</span>
          </div>
        </div>
        <div className="pt-1 border-t border-slate-100 text-[10px] text-slate-400 font-mono">
          Clic gauche : Orbite • Clic droit / Shift : Pan • Molette : Zoom
        </div>
      </div>
    </div>
  );
};
