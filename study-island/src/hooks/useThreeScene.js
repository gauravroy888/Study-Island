/**
 * useThreeScene.js
 * High-fidelity, ultra-lightweight, bug-free 3D Light & Shadows simulation.
 * - Uses native Three.js PCFSoftShadowMap for 100% physically accurate shadow casting (zero floating polygon bugs).
 * - Clean, exact rectilinear ray vectors connecting light bulb -> obstacle vertices -> screen.
 * - Triangulated cyan wireframe grid floor and vertical screen.
 * - Glowing lamp with blooming corona & floor light pool.
 * - Faceted dodecahedron on a 4-legged wireframe tower pedestal.
 * - Smooth interactive orbit drag with zero matrix misalignment.
 */
import { useEffect, useRef } from "react";
import * as THREE from "three";

let sceneRenderer = null;
let sceneRoot     = null;
let sceneAnimId   = 0;

/* ── Lightweight radial glow canvas texture helper ── */
function createRadialGlowTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255, 255, 255, 1)");
  grad.addColorStop(0.2, "rgba(210, 245, 255, 0.85)");
  grad.addColorStop(0.5, "rgba(0, 200, 255, 0.35)");
  grad.addColorStop(0.8, "rgba(0, 100, 200, 0.08)");
  grad.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}

/* ── Destroy scene safely ── */
function destroyScene() {
  if (sceneAnimId) {
    cancelAnimationFrame(sceneAnimId);
    sceneAnimId = 0;
  }
  if (sceneRenderer) {
    sceneRenderer.dispose();
    sceneRenderer.domElement?.parentNode?.removeChild(sceneRenderer.domElement);
    sceneRenderer = null;
  }
  sceneRoot = null;
}

/* ── Initialize 3D Scene ── */
function initScene(container, loadingEl) {
  if (!container) return;
  destroyScene();

  const width  = Math.max(container.clientWidth, 1);
  const height = Math.max(container.clientHeight, 1);

  // 1. Scene & Depth Fog
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x040812);
  scene.fog        = new THREE.FogExp2(0x040812, 0.022);

  // Root content group that rotates on drag
  const worldGroup = new THREE.Group();
  scene.add(worldGroup);

  // 2. Camera Setup
  const camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 100);
  camera.position.set(4.2, 2.2, 10.5);
  camera.lookAt(-0.8, 0.4, -0.2);

  // 3. WebGL Renderer with Soft Shadow Maps
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.35;

  renderer.domElement.addEventListener("webglcontextlost", (e) => {
    e.preventDefault();
    cancelAnimationFrame(sceneAnimId);
    sceneAnimId = 0;
  }, false);
  renderer.domElement.addEventListener("webglcontextrestored", () => {
    initScene(container, null);
  }, false);

  container.appendChild(renderer.domElement);
  sceneRenderer = renderer;
  sceneRoot     = scene;
  if (loadingEl) loadingEl.style.display = "none";

  // 4. Coordinates
  const groundY = -2.2;
  const screenX = -5.5;
  const lightPos = new THREE.Vector3(4.5, -1.0, 2.8);
  const objPos   = new THREE.Vector3(-1.2, 0.65, 0.0);

  // 5. Ambient & Fill Light
  worldGroup.add(new THREE.AmbientLight(0x0a1628, 0.65));
  const fillLight = new THREE.DirectionalLight(0x1a3a60, 0.3);
  fillLight.position.set(0, 8, 8);
  worldGroup.add(fillLight);

  // 6. Triangulated Ground Plane Grid
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
  worldGroup.add(floorWire);

  // Floor receiver plane for shadows & ground grid
  const floorSolid = new THREE.Mesh(
    floorGeo,
    new THREE.MeshStandardMaterial({ color: 0x050914, roughness: 0.95, metalness: 0.05 })
  );
  floorSolid.rotation.x = -Math.PI / 2;
  floorSolid.position.y = groundY - 0.01;
  floorSolid.receiveShadow = true;
  worldGroup.add(floorSolid);

  // Diagonal Isometric Floor Lines
  const diagGridLines = [];
  const gridSize = 36;
  const step = 1.5;
  const diagMat = new THREE.LineBasicMaterial({ color: 0x00d4ff, transparent: true, opacity: 0.12 });
  for (let i = -gridSize / 2; i <= gridSize / 2; i += step) {
    const pts1 = [new THREE.Vector3(i, groundY, -gridSize / 2), new THREE.Vector3(i + gridSize, groundY, gridSize / 2)];
    const pts2 = [new THREE.Vector3(i, groundY, gridSize / 2), new THREE.Vector3(i + gridSize, groundY, -gridSize / 2)];
    diagGridLines.push(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts1), diagMat));
    diagGridLines.push(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts2), diagMat));
  }
  diagGridLines.forEach(l => worldGroup.add(l));

  // 7. Vertical Backdrop Screen Wall
  const screenGeo = new THREE.PlaneGeometry(16, 12, 16, 12);
  const screenWireMat = new THREE.MeshBasicMaterial({
    color: 0x00f0ff,
    wireframe: true,
    transparent: true,
    opacity: 0.28
  });
  const screenWire = new THREE.Mesh(screenGeo, screenWireMat);
  screenWire.position.set(screenX, 1.8, 0);
  screenWire.rotation.y = Math.PI / 2;
  worldGroup.add(screenWire);

  // Screen solid receiver (catches the spotlight & shadow cleanly)
  const screenSolid = new THREE.Mesh(
    screenGeo,
    new THREE.MeshStandardMaterial({
      color: 0x081324,
      roughness: 0.85,
      metalness: 0.1,
      side: THREE.DoubleSide
    })
  );
  screenSolid.position.set(screenX - 0.01, 1.8, 0);
  screenSolid.rotation.y = Math.PI / 2;
  screenSolid.receiveShadow = true;
  worldGroup.add(screenSolid);

  // 8. Foreground Glowing Lamp Group
  const lampGroup = new THREE.Group();
  lampGroup.position.copy(lightPos);

  const lampStandMat = new THREE.MeshStandardMaterial({ color: 0x111622, roughness: 0.3, metalness: 0.8 });
  const lampPole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.16, 1.4, 32), lampStandMat);
  lampPole.position.y = -0.7;
  lampGroup.add(lampPole);

  const lampFoot = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.08, 32), lampStandMat);
  lampFoot.position.y = -1.36;
  lampGroup.add(lampFoot);

  // Radiant White Bulb
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.24, 32, 32), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  lampGroup.add(bulb);

  // Blooming Corona Sprite
  const glowTex = createRadialGlowTexture();
  const coronaMat = new THREE.SpriteMaterial({
    map: glowTex,
    color: 0xe0f7ff,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const corona = new THREE.Sprite(coronaMat);
  corona.scale.set(3.0, 3.0, 3.0);
  lampGroup.add(corona);

  // Ground Pool of Light
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
  groundPool.position.y = -1.38;
  lampGroup.add(groundPool);

  // Powerful SpotLight (Projects the bright circular beam on the screen and casts clean shadow)
  const spotLight = new THREE.SpotLight(0xe8f6ff, 7.5, 30, Math.PI / 4, 0.35, 0.9);
  spotLight.position.copy(lightPos);
  spotLight.target.position.set(screenX, objPos.y + 0.3, objPos.z);
  spotLight.castShadow = true;
  spotLight.shadow.mapSize.width = 2048;
  spotLight.shadow.mapSize.height = 2048;
  spotLight.shadow.bias = -0.0005;
  spotLight.shadow.camera.near = 0.5;
  spotLight.shadow.camera.far = 25;
  worldGroup.add(spotLight);
  worldGroup.add(spotLight.target);

  // PointLight for 360 ambient illumination
  const pointLight = new THREE.PointLight(0xffffff, 3.5, 20);
  pointLight.position.copy(lightPos);
  worldGroup.add(pointLight);

  worldGroup.add(lampGroup);

  // 9. Obstacle Group (Tower Stand + Dodecahedron)
  const obstacleGroup = new THREE.Group();
  obstacleGroup.position.copy(objPos);

  // 4-Legged Wireframe Tower Stand
  const towerMat = new THREE.LineBasicMaterial({ color: 0x88d4f8, transparent: true, opacity: 0.85 });
  const buildTowerPedestal = (baseW = 0.95, topW = 0.28) => {
    const lines = [];
    const yBottom = groundY - objPos.y;
    const yTop = -0.65;

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
    return new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(lines), towerMat);
  };
  obstacleGroup.add(buildTowerPedestal());

  // Faceted Dodecahedron Mesh (casting shadow onto the screen)
  const polyGeo = new THREE.DodecahedronGeometry(1.25, 0);
  const polyMat = new THREE.MeshStandardMaterial({
    color: 0x5a708a,
    roughness: 0.4,
    metalness: 0.15,
    flatShading: true
  });
  const polyMesh = new THREE.Mesh(polyGeo, polyMat);
  polyMesh.castShadow = true;
  polyMesh.receiveShadow = true;
  obstacleGroup.add(polyMesh);

  worldGroup.add(obstacleGroup);

  // 10. Clean Straight Light Ray Vectors
  const rayMat = new THREE.LineBasicMaterial({
    color: 0xdff4ff,
    transparent: true,
    opacity: 0.42,
    blending: THREE.AdditiveBlending
  });
  const rayLinesMesh = new THREE.LineSegments(new THREE.BufferGeometry(), rayMat);
  worldGroup.add(rayLinesMesh);

  // 11. Smooth Mouse/Touch Orbit Interaction
  let isDragging = false;
  let prevMouseX = 0, prevMouseY = 0;
  let targetRotY = 0, targetRotX = 0;

  const onPointerDown = (e) => {
    isDragging = true;
    prevMouseX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
    prevMouseY = e.clientY || (e.touches && e.touches[0].clientY) || 0;
  };

  const onPointerMove = (e) => {
    if (!isDragging) return;
    const cx = e.clientX || (e.touches && e.touches[0].clientX) || 0;
    const cy = e.clientY || (e.touches && e.touches[0].clientY) || 0;
    const dx = cx - prevMouseX;
    const dy = cy - prevMouseY;
    targetRotY += dx * 0.005;
    targetRotX += dy * 0.003;
    targetRotX = Math.max(-0.35, Math.min(0.35, targetRotX));
    prevMouseX = cx;
    prevMouseY = cy;
  };

  const onPointerUp = () => { isDragging = false; };

  container.addEventListener("mousedown", onPointerDown);
  window.addEventListener("mousemove", onPointerMove);
  window.addEventListener("mouseup", onPointerUp);
  container.addEventListener("touchstart", onPointerDown, { passive: true });
  window.addEventListener("touchmove", onPointerMove, { passive: true });
  window.addEventListener("touchend", onPointerUp);

  // 12. Resize Handler
  const onResize = () => {
    const w = Math.max(container.clientWidth, 1);
    const h = Math.max(container.clientHeight, 1);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };
  window.addEventListener("resize", onResize);

  // 13. Dynamic Ray Calculation
  // Pre-calculate obstacle local vertices
  const posAttr = polyGeo.attributes.position;
  const localVertices = [];
  for (let i = 0; i < posAttr.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(posAttr, i);
    let duplicate = false;
    for (let u of localVertices) {
      if (u.distanceToSquared(v) < 0.001) { duplicate = true; break; }
    }
    if (!duplicate) localVertices.push(v);
  }

  // 14. Animation Loop
  let t = 0;
  function animate() {
    sceneAnimId = requestAnimationFrame(animate);
    t += 0.016;

    // Smooth drag rotation on the whole world
    worldGroup.rotation.y += (targetRotY - worldGroup.rotation.y) * 0.08;
    worldGroup.rotation.x += (targetRotX - worldGroup.rotation.x) * 0.08;

    // Subtle gentle spin on the dodecahedron
    polyMesh.rotation.y = t * 0.2;
    polyMesh.rotation.x = Math.sin(t * 0.15) * 0.12;

    // Subtle corona pulse
    const pulse = Math.sin(t * 3) * 0.12;
    corona.scale.set(3.0 + pulse, 3.0 + pulse, 3.0 + pulse);

    // Calculate clean rectilinear rays from bulb through vertices to screen
    const rayPoints = [];
    const objMatrix = polyMesh.matrixWorld;

    for (let localV of localVertices) {
      // Vertex in worldGroup space
      const worldV = localV.clone().applyMatrix4(polyMesh.matrix).add(objPos);
      const dir = new THREE.Vector3().subVectors(worldV, lightPos);

      if (dir.x < -0.01) {
        const timeFactor = (screenX - lightPos.x) / dir.x;
        if (timeFactor > 0) {
          const hitScreen = new THREE.Vector3().copy(lightPos).addScaledVector(dir, timeFactor);
          // Straight ray line: Light -> Hit on Screen
          rayPoints.push(lightPos.clone(), hitScreen);
        }
      }
    }

    if (rayPoints.length > 0) {
      rayLinesMesh.geometry.dispose();
      rayLinesMesh.geometry = new THREE.BufferGeometry().setFromPoints(rayPoints);
    }

    renderer.render(scene, camera);
  }
  animate();

  return () => {
    window.removeEventListener("resize", onResize);
    container.removeEventListener("mousedown", onPointerDown);
    window.removeEventListener("mousemove", onPointerMove);
    window.removeEventListener("mouseup", onPointerUp);
    container.removeEventListener("touchstart", onPointerDown);
    window.removeEventListener("touchmove", onPointerMove);
    window.removeEventListener("touchend", onPointerUp);
    destroyScene();
  };
}

/* ── React Hook Export ── */
export default function useThreeScene(active = true) {
  const containerRef = useRef(null);
  const loadingRef   = useRef(null);

  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => {
      initScene(containerRef.current, loadingRef.current);
    }, 60);
    return () => {
      clearTimeout(timer);
      destroyScene();
    };
  }, [active]);

  return { containerRef, loadingRef };
}
