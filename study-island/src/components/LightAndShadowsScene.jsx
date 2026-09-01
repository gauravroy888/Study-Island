import React, { useState, useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

// --- Audio Feedback Helper ---
const playClickSound = (freq = 800) => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.5, ctx.currentTime + 0.04);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.04);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.05);
  } catch (e) {}
};

// --- Texture Generator Helpers ---
function makeRadialGlowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  grad.addColorStop(0.2, 'rgba(220, 245, 255, 0.85)');
  grad.addColorStop(0.5, 'rgba(0, 200, 255, 0.35)');
  grad.addColorStop(0.8, 'rgba(0, 100, 200, 0.08)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

function makeSpotlightTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(256, 256, 40, 256, 256, 256);
  grad.addColorStop(0, 'rgba(230, 248, 255, 0.85)');
  grad.addColorStop(0.35, 'rgba(120, 220, 255, 0.6)');
  grad.addColorStop(0.7, 'rgba(0, 150, 220, 0.25)');
  grad.addColorStop(0.95, 'rgba(0, 70, 140, 0.05)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 512);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

export default function LightAndShadowsScene() {
  const containerRef = useRef(null);
  const sceneRef = useRef(null);

  // --- Interactive State ---
  const [lightDistance, setLightDistance] = useState(5.8);
  const [lightHeight, setLightHeight] = useState(-0.8);
  const [objectDistance, setObjectDistance] = useState(-1.5);
  const [objectHeight, setObjectHeight] = useState(0.8);
  const [objectShape, setObjectShape] = useState('dodecahedron');
  const [autoRotate, setAutoRotate] = useState(true);
  const [rotationSpeed, setRotationSpeed] = useState(0.6);
  const [showRays, setShowRays] = useState(true);
  const [showSpotlight, setShowSpotlight] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [showPedestal, setShowPedestal] = useState(true);
  const [activeCameraView, setActiveCameraView] = useState('reference');
  const [isMuted, setIsMuted] = useState(false);
  const [isHUDVisible, setIsHUDVisible] = useState(true);
  const [activeTab, setActiveTab] = useState('controls');

  // Optics Calculations
  const d1 = useMemo(() => Math.abs(lightDistance - objectDistance), [lightDistance, objectDistance]);
  const screenX = -6.5;
  const d2 = useMemo(() => Math.abs(objectDistance - screenX), [objectDistance]);
  const magnification = useMemo(() => (d1 > 0 ? ((d1 + d2) / d1).toFixed(2) : '1.00'), [d1, d2]);

  // --- Three.js Scene Setup & Loop ---
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 1. Scene & Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x040812);
    scene.fog = new THREE.FogExp2(0x040812, 0.022);

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 100);
    camera.position.set(4.5, 3.2, 10.5);
    camera.lookAt(-1.2, 0.4, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    container.appendChild(renderer.domElement);

    // OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.maxPolarAngle = Math.PI / 2 + 0.05;
    controls.minDistance = 2;
    controls.maxDistance = 25;
    controls.target.set(-1.2, 0.4, 0);

    // 2. Ambient & Scene Lights
    const ambientLight = new THREE.AmbientLight(0x0e1b33, 0.6);
    scene.add(ambientLight);

    const fillLight = new THREE.DirectionalLight(0x1a3a60, 0.4);
    fillLight.position.set(0, 8, 8);
    scene.add(fillLight);

    // 3. Ground Plane with Triangulated Wireframe
    const groundY = -2.2;
    const gridGroup = new THREE.Group();

    const floorGeo = new THREE.PlaneGeometry(36, 36, 24, 24);
    const floorWireMat = new THREE.MeshBasicMaterial({
      color: 0x0088aa,
      wireframe: true,
      transparent: true,
      opacity: 0.18
    });
    const floorWire = new THREE.Mesh(floorGeo, floorWireMat);
    floorWire.rotation.x = -Math.PI / 2;
    floorWire.position.y = groundY;
    gridGroup.add(floorWire);

    const diagGridLines = [];
    const gridSize = 36;
    const step = 1.5;
    const diagMat = new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.12 });
    for (let i = -gridSize / 2; i <= gridSize / 2; i += step) {
      const pts1 = [new THREE.Vector3(i, groundY, -gridSize / 2), new THREE.Vector3(i + gridSize, groundY, gridSize / 2)];
      const pts2 = [new THREE.Vector3(i, groundY, gridSize / 2), new THREE.Vector3(i + gridSize, groundY, -gridSize / 2)];
      diagGridLines.push(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts1), diagMat));
      diagGridLines.push(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts2), diagMat));
    }
    diagGridLines.forEach(l => gridGroup.add(l));
    scene.add(gridGroup);

    // 4. Vertical Screen Wall with Cyan Wireframe
    const screenGroup = new THREE.Group();
    screenGroup.position.set(screenX, 1.8, 0);

    const screenGeo = new THREE.PlaneGeometry(16, 12, 16, 12);
    const screenWireMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      wireframe: true,
      transparent: true,
      opacity: 0.28
    });
    const screenWire = new THREE.Mesh(screenGeo, screenWireMat);
    screenWire.rotation.y = Math.PI / 2;
    screenGroup.add(screenWire);

    const screenSolidMat = new THREE.MeshStandardMaterial({
      color: 0x071120,
      roughness: 0.9,
      metalness: 0.1,
      side: THREE.DoubleSide
    });
    const screenSolid = new THREE.Mesh(screenGeo, screenSolidMat);
    screenSolid.rotation.y = Math.PI / 2;
    screenSolid.position.x = -0.02;
    screenSolid.receiveShadow = true;
    screenGroup.add(screenSolid);

    // Spotlight projection disc on screen
    const spotlightTex = makeSpotlightTexture();
    const spotlightMat = new THREE.MeshBasicMaterial({
      map: spotlightTex,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    const spotlightMesh = new THREE.Mesh(new THREE.PlaneGeometry(9, 9), spotlightMat);
    spotlightMesh.rotation.y = Math.PI / 2;
    spotlightMesh.position.set(0.01, 0, 0);
    screenGroup.add(spotlightMesh);

    // Dynamic 2D Shadow Polygon Mesh on screen
    const shadowPolyGeo = new THREE.BufferGeometry();
    const shadowPolyMat = new THREE.MeshBasicMaterial({
      color: 0x03060d,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const shadowPolyMesh = new THREE.Mesh(shadowPolyGeo, shadowPolyMat);
    shadowPolyMesh.rotation.y = Math.PI / 2;
    shadowPolyMesh.position.set(0.03, 0, 0);
    screenGroup.add(shadowPolyMesh);

    const shadowOutlineMat = new THREE.LineBasicMaterial({ color: 0x001a33, linewidth: 2 });
    const shadowOutlineMesh = new THREE.LineLoop(new THREE.BufferGeometry(), shadowOutlineMat);
    shadowOutlineMesh.rotation.y = Math.PI / 2;
    shadowOutlineMesh.position.set(0.04, 0, 0);
    screenGroup.add(shadowOutlineMesh);

    scene.add(screenGroup);

    // 5. Foreground Glowing Lamp Group
    const lampGroup = new THREE.Group();

    const lampStandMat = new THREE.MeshStandardMaterial({
      color: 0x111622,
      roughness: 0.3,
      metalness: 0.8
    });
    const lampPole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.16, 1.4, 32), lampStandMat);
    lampPole.position.y = -0.7;
    lampGroup.add(lampPole);

    const lampFoot = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.08, 32), lampStandMat);
    lampFoot.position.y = -1.36;
    lampGroup.add(lampFoot);

    const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.24, 32, 32), bulbMat);
    bulb.position.set(0, 0, 0);
    lampGroup.add(bulb);

    const glowTex = makeRadialGlowTexture();
    const coronaMat = new THREE.SpriteMaterial({
      map: glowTex,
      color: 0xe0f7ff,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const corona = new THREE.Sprite(coronaMat);
    corona.scale.set(3.2, 3.2, 3.2);
    lampGroup.add(corona);

    const groundPoolMat = new THREE.MeshBasicMaterial({
      map: glowTex,
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const groundPool = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 4.5), groundPoolMat);
    groundPool.rotation.x = -Math.PI / 2;
    groundPool.position.y = -1.39;
    lampGroup.add(groundPool);

    const pointLight = new THREE.PointLight(0xffffff, 4.5, 30);
    pointLight.position.set(0, 0, 0);
    pointLight.castShadow = true;
    pointLight.shadow.mapSize.width = 2048;
    pointLight.shadow.mapSize.height = 2048;
    pointLight.shadow.bias = -0.001;
    lampGroup.add(pointLight);

    scene.add(lampGroup);

    // 6. Obstacle Group
    const obstacleGroup = new THREE.Group();
    const pedestalGroup = new THREE.Group();
    const towerMat = new THREE.LineBasicMaterial({
      color: 0x88d4f8,
      transparent: true,
      opacity: 0.85
    });

    const buildTowerPedestal = (h = 2.4, baseW = 1.0, topW = 0.28) => {
      const lines = [];
      const yBottom = groundY;
      const yTop = 0;

      const b0 = new THREE.Vector3(-baseW / 2, yBottom, -baseW / 2);
      const b1 = new THREE.Vector3(baseW / 2, yBottom, -baseW / 2);
      const b2 = new THREE.Vector3(baseW / 2, yBottom, baseW / 2);
      const b3 = new THREE.Vector3(-baseW / 2, yBottom, baseW / 2);

      const t0 = new THREE.Vector3(-topW / 2, yTop, -topW / 2);
      const t1 = new THREE.Vector3(topW / 2, yTop, -topW / 2);
      const t2 = new THREE.Vector3(topW / 2, yTop, topW / 2);
      const t3 = new THREE.Vector3(-topW / 2, yTop, topW / 2);

      lines.push(b0, t0, b1, t1, b2, t2, b3, t3);
      lines.push(b0, b1, b1, b2, b2, b3, b3, b0);
      lines.push(t0, t1, t1, t2, t2, t3, t3, t0);
      lines.push(b0, b2, b1, b3);

      const tiers = 3;
      for (let i = 1; i < tiers; i++) {
        const f = i / tiers;
        const yMid = yBottom + (yTop - yBottom) * f;
        const wMid = baseW + (topW - baseW) * f;
        const m0 = new THREE.Vector3(-wMid / 2, yMid, -wMid / 2);
        const m1 = new THREE.Vector3(wMid / 2, yMid, -wMid / 2);
        const m2 = new THREE.Vector3(wMid / 2, yMid, wMid / 2);
        const m3 = new THREE.Vector3(-wMid / 2, yMid, wMid / 2);
        lines.push(m0, m1, m1, m2, m2, m3, m3, m0);

        const prevF = (i - 1) / tiers;
        const prevY = yBottom + (yTop - yBottom) * prevF;
        const prevW = baseW + (topW - baseW) * prevF;
        const p0 = new THREE.Vector3(-prevW / 2, prevY, -prevW / 2);
        const p1 = new THREE.Vector3(prevW / 2, prevY, -prevW / 2);
        const p2 = new THREE.Vector3(prevW / 2, prevY, prevW / 2);
        const p3 = new THREE.Vector3(-prevW / 2, prevY, prevW / 2);
        lines.push(p0, m1, p1, m0, p1, m2, p2, m1, p2, m3, p3, m2, p3, m0, p0, m3);
      }

      const geo = new THREE.BufferGeometry().setFromPoints(lines);
      return new THREE.LineSegments(geo, towerMat);
    };

    pedestalGroup.add(buildTowerPedestal());
    obstacleGroup.add(pedestalGroup);

    const shapeGeometries = {
      dodecahedron: new THREE.DodecahedronGeometry(1.2, 0),
      cube: new THREE.BoxGeometry(1.6, 1.6, 1.6),
      sphere: new THREE.SphereGeometry(1.1, 32, 32),
      cylinder: new THREE.CylinderGeometry(0.85, 0.85, 1.7, 32),
      pyramid: new THREE.ConeGeometry(1.15, 1.8, 4)
    };

    const polyMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.45,
      metalness: 0.15,
      flatShading: true
    });

    let currentObjMesh = new THREE.Mesh(shapeGeometries.dodecahedron, polyMat);
    currentObjMesh.castShadow = true;
    currentObjMesh.receiveShadow = true;
    currentObjMesh.position.y = 0.8;
    obstacleGroup.add(currentObjMesh);

    scene.add(obstacleGroup);

    // 7. Ray Vectors
    const rayMat = new THREE.LineBasicMaterial({
      color: 0xe0f2fe,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending
    });
    const rayConeMat = new THREE.LineBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.22,
      blending: THREE.AdditiveBlending
    });

    const rayLinesMesh = new THREE.LineSegments(new THREE.BufferGeometry(), rayMat);
    const rayConeMesh = new THREE.LineSegments(new THREE.BufferGeometry(), rayConeMat);
    scene.add(rayLinesMesh);
    scene.add(rayConeMesh);

    sceneRef.current = {
      scene,
      camera,
      renderer,
      controls,
      lampGroup,
      corona,
      pointLight,
      obstacleGroup,
      currentObjMesh,
      shapeGeometries,
      pedestalGroup,
      gridGroup,
      screenGroup,
      spotlightMesh,
      shadowPolyMesh,
      shadowOutlineMesh,
      rayLinesMesh,
      rayConeMesh
    };

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // 8. Animation Loop
    let animId;
    let time = 0;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      time += 0.016;

      if (corona) {
        const pulse = Math.sin(time * 3) * 0.15;
        corona.scale.set(3.2 + pulse, 3.2 + pulse, 3.2 + pulse);
        corona.material.opacity = 0.8 + Math.sin(time * 4) * 0.1;
      }

      if (autoRotate && currentObjMesh) {
        currentObjMesh.rotation.y += 0.012 * rotationSpeed;
        currentObjMesh.rotation.x = Math.sin(time * 0.8 * rotationSpeed) * 0.18;
      }

      const lightWorldPos = new THREE.Vector3();
      bulb.getWorldPosition(lightWorldPos);

      const targetScreenX = screenX;
      const rayPoints = [];
      const projectedShadowVertices = [];

      if (currentObjMesh && currentObjMesh.geometry) {
        const geom = currentObjMesh.geometry;
        const posAttr = geom.attributes.position;
        const matrixWorld = currentObjMesh.matrixWorld;

        const worldVertices = [];
        const tempVec = new THREE.Vector3();

        for (let i = 0; i < posAttr.count; i++) {
          tempVec.fromBufferAttribute(posAttr, i);
          tempVec.applyMatrix4(matrixWorld);

          let exists = false;
          for (let v of worldVertices) {
            if (v.distanceToSquared(tempVec) < 0.001) {
              exists = true;
              break;
            }
          }
          if (!exists) worldVertices.push(tempVec.clone());
        }

        for (let v of worldVertices) {
          const dir = new THREE.Vector3().subVectors(v, lightWorldPos);
          if (Math.abs(dir.x) > 0.001) {
            const t = (targetScreenX - lightWorldPos.x) / dir.x;
            if (t > 0) {
              const screenHit = new THREE.Vector3().copy(lightWorldPos).addScaledVector(dir, t);
              rayPoints.push(lightWorldPos.clone(), screenHit);

              const localScreenY = screenHit.y - screenGroup.position.y;
              const localScreenZ = screenHit.z - screenGroup.position.z;
              projectedShadowVertices.push({ y: localScreenY, z: localScreenZ, point: screenHit });
            }
          }
        }

        if (showRays && rayPoints.length > 0) {
          rayLinesMesh.visible = true;
          rayLinesMesh.geometry.dispose();
          rayLinesMesh.geometry = new THREE.BufferGeometry().setFromPoints(rayPoints);
        } else {
          rayLinesMesh.visible = false;
        }

        if (projectedShadowVertices.length >= 3) {
          let cY = 0, cZ = 0;
          for (let p of projectedShadowVertices) {
            cY += p.y;
            cZ += p.z;
          }
          cY /= projectedShadowVertices.length;
          cZ /= projectedShadowVertices.length;

          projectedShadowVertices.sort((a, b) => {
            const angleA = Math.atan2(a.y - cY, a.z - cZ);
            const angleB = Math.atan2(b.y - cY, b.z - cZ);
            return angleA - angleB;
          });

          const shadowTriangles = [];
          const outlinePts = [];
          const originY = projectedShadowVertices[0].y;
          const originZ = projectedShadowVertices[0].z;

          for (let i = 1; i < projectedShadowVertices.length - 1; i++) {
            shadowTriangles.push(-originZ, originY, 0);
            shadowTriangles.push(-projectedShadowVertices[i].z, projectedShadowVertices[i].y, 0);
            shadowTriangles.push(-projectedShadowVertices[i + 1].z, projectedShadowVertices[i + 1].y, 0);
          }

          for (let p of projectedShadowVertices) {
            outlinePts.push(new THREE.Vector3(-p.z, p.y, 0));
          }

          shadowPolyMesh.geometry.dispose();
          const polyGeo = new THREE.BufferGeometry();
          polyGeo.setAttribute('position', new THREE.Float32BufferAttribute(shadowTriangles, 3));
          polyGeo.computeVertexNormals();
          shadowPolyMesh.geometry = polyGeo;

          shadowOutlineMesh.geometry.dispose();
          shadowOutlineMesh.geometry = new THREE.BufferGeometry().setFromPoints(outlinePts);
        }

        const lightRayToScreen = new THREE.Vector3().subVectors(obstacleGroup.position, lightWorldPos);
        const tCenter = (targetScreenX - lightWorldPos.x) / lightRayToScreen.x;
        const spotCenter = new THREE.Vector3().copy(lightWorldPos).addScaledVector(lightRayToScreen, tCenter);

        spotlightMesh.position.y = spotCenter.y - screenGroup.position.y;
        spotlightMesh.position.z = spotCenter.z - screenGroup.position.z;
        spotlightMesh.visible = showSpotlight;

        if (showRays && showSpotlight) {
          rayConeMesh.visible = true;
          const conePts = [];
          const spotRadius = 4.0;
          const segs = 12;
          for (let i = 0; i < segs; i++) {
            const th = (i / segs) * Math.PI * 2;
            const edgePt = new THREE.Vector3(targetScreenX, spotCenter.y + Math.sin(th) * spotRadius, spotCenter.z + Math.cos(th) * spotRadius);
            conePts.push(lightWorldPos.clone(), edgePt);
          }
          rayConeMesh.geometry.dispose();
          rayConeMesh.geometry = new THREE.BufferGeometry().setFromPoints(conePts);
        } else {
          rayConeMesh.visible = false;
        }
      }

      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Sync React State
  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    s.lampGroup.position.set(lightDistance, lightHeight, 2.8);
    s.obstacleGroup.position.set(objectDistance, objectHeight, 0);
    if (s.gridGroup) s.gridGroup.visible = showGrid;
    if (s.pedestalGroup) s.pedestalGroup.visible = showPedestal;
    if (s.spotlightMesh) s.spotlightMesh.visible = showSpotlight;
  }, [lightDistance, lightHeight, objectDistance, objectHeight, showGrid, showPedestal, showSpotlight]);

  useEffect(() => {
    const s = sceneRef.current;
    if (!s || !s.currentObjMesh || !s.shapeGeometries) return;
    s.currentObjMesh.geometry = s.shapeGeometries[objectShape] || s.shapeGeometries.dodecahedron;
  }, [objectShape]);

  const setCameraPreset = (preset) => {
    const s = sceneRef.current;
    if (!s || !s.camera || !s.controls) return;
    setActiveCameraView(preset);
    if (!isMuted) playClickSound(1000);

    if (preset === 'reference') {
      s.camera.position.set(4.5, 3.2, 10.5);
      s.controls.target.set(-1.2, 0.4, 0);
    } else if (preset === 'side') {
      s.camera.position.set(0, 1.2, 14);
      s.controls.target.set(-1.0, 0.5, 0);
    } else if (preset === 'top') {
      s.camera.position.set(-0.5, 14, 1.0);
      s.controls.target.set(-0.5, 0, 0);
    } else if (preset === 'screen') {
      s.camera.position.set(-1.5, 1.5, 0);
      s.controls.target.set(-6.5, 1.5, 0);
    }
    s.controls.update();
  };

  return (
    <div className="relative w-full h-full select-none bg-[#040812] overflow-hidden">
      <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top Header */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-center pointer-events-none z-20">
        <div className="flex items-center gap-3 pointer-events-auto bg-[#0a1426]/80 backdrop-blur-md border border-cyan-500/30 rounded-2xl px-4 py-2.5 shadow-xl">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 font-bold">
            💡
          </div>
          <div>
            <h2 className="text-sm font-extrabold text-white tracking-wider">LIGHT &amp; SHADOWS</h2>
            <p className="text-[11px] text-slate-400 font-mono">3D Optical Ray-Tracing Simulation</p>
          </div>
        </div>

        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="hidden sm:flex items-center bg-[#0a1426]/80 backdrop-blur-md border border-white/10 rounded-xl p-1 gap-1">
            {['reference', 'side', 'top', 'screen'].map((p) => (
              <button
                key={p}
                onClick={() => setCameraPreset(p)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold capitalize transition-all ${
                  activeCameraView === p ? 'bg-cyan-500 text-slate-950 font-bold' : 'text-slate-300 hover:text-white'
                }`}
              >
                {p}
              </button>
            ))}
          </div>

          <button
            onClick={() => setIsHUDVisible(!isHUDVisible)}
            className="px-3 py-1.5 rounded-xl bg-[#0a1426]/80 backdrop-blur-md border border-cyan-400/30 text-xs font-bold text-cyan-300"
          >
            {isHUDVisible ? 'Hide Controls' : 'Controls ⚙️'}
          </button>
        </div>
      </div>

      {/* Controls Deck */}
      {isHUDVisible && (
        <div className="absolute top-20 bottom-4 right-4 w-80 bg-[#0a1426]/85 backdrop-blur-xl border border-cyan-500/30 rounded-2xl p-4 flex flex-col justify-between z-20 shadow-2xl overflow-y-auto text-xs">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="font-bold text-cyan-300">LAB CONTROLS</span>
              <span className="font-mono text-[10px] text-slate-400">M = {magnification}×</span>
            </div>

            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Light Distance</span>
                <span className="font-mono text-cyan-300">{lightDistance.toFixed(1)}m</span>
              </div>
              <input
                type="range"
                min="2.0"
                max="8.0"
                step="0.1"
                value={lightDistance}
                onChange={(e) => setLightDistance(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-300 mb-1">
                <span>Object Position</span>
                <span className="font-mono text-cyan-300">{objectDistance.toFixed(1)}m</span>
              </div>
              <input
                type="range"
                min="-4.5"
                max="1.5"
                step="0.1"
                value={objectDistance}
                onChange={(e) => setObjectDistance(parseFloat(e.target.value))}
                className="w-full"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                onClick={() => setShowRays(!showRays)}
                className={`py-1.5 px-2 rounded-lg border text-xs font-semibold ${
                  showRays ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300' : 'border-white/10 text-slate-400'
                }`}
              >
                Rays: {showRays ? 'ON' : 'OFF'}
              </button>
              <button
                onClick={() => setAutoRotate(!autoRotate)}
                className={`py-1.5 px-2 rounded-lg border text-xs font-semibold ${
                  autoRotate ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300' : 'border-white/10 text-slate-400'
                }`}
              >
                Spin: {autoRotate ? 'ON' : 'OFF'}
              </button>
            </div>

            <div className="space-y-1 pt-2 border-t border-white/10">
              <span className="text-[11px] text-slate-400 font-bold uppercase">Object Shape</span>
              <div className="grid grid-cols-3 gap-1.5 pt-1">
                {['dodecahedron', 'cube', 'sphere', 'pyramid', 'cylinder'].map((s) => (
                  <button
                    key={s}
                    onClick={() => setObjectShape(s)}
                    className={`py-1 px-1.5 rounded-lg border text-[11px] font-medium capitalize truncate ${
                      objectShape === s ? 'bg-cyan-500 text-slate-950 font-bold border-cyan-400' : 'border-white/10 text-slate-300'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-white/10 flex justify-between text-[11px] text-slate-400">
            <span>🖱️ Drag to Orbit</span>
            <button
              onClick={() => {
                setLightDistance(5.8);
                setLightHeight(-0.8);
                setObjectDistance(-1.5);
                setObjectHeight(0.8);
                setObjectShape('dodecahedron');
                setCameraPreset('reference');
              }}
              className="text-cyan-300 hover:underline"
            >
              Reset
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
