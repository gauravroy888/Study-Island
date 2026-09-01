(function () {
  'use strict';

  var THEME_STORAGE_KEY = 'edtech-island-theme';
  var R2_PUBLIC_CDN_URL = 'https://pub-670b98370fe642a2be08ee37cbfd385f.r2.dev';
  var DEFAULT_CHAPTER_ID = 'light-shadows';
  var DETAIL_CHAPTER_ORDER = ['light-shadows', 'space-solar'];

  function resolveR2Url(url) {
    if (!url) return '';
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    return R2_PUBLIC_CDN_URL + '/' + url.replace(/^\//, '');
  }

  var AVAILABLE_APPS = {
    'Chapter_experience_L_S.html': true,
    'Shadow_Lab.html': true,
    'quiz.html': true
  };
  var CHAPTERS = {
    'light-shadows': {
      id: 'light-shadows',
      title: 'LIGHT AND SHADOWS',
      description: 'The light and shadow simulation model provides interactive exploration of fundamental optical principles. Visualize the formation of complex shadow patterns, examine umbra and penumbra regions, and observe how light propagates to form shadows based on object shape and distance.',
      iconClass: 'ph ph-lightbulb',
      sceneKey: 'lightShadows',
      experienceUrl: 'Chapter_experience_L_S.html',
      quizReady: true,
      contentReady: true
    },
    'space-solar': {
      id: 'space-solar',
      title: 'SPACE AND SOLAR SYSTEM',
      description: 'The solar system model provides an interactive journey through our cosmic neighbourhood. Explore planetary orbits, understand gravitational forces, and discover the unique characteristics of each planet from the scorching Mercury to the icy realms of Neptune.',
      iconClass: 'ph ph-planet',
      sceneKey: 'solarSystem',
      experienceUrl: '',
      quizReady: false,
      contentReady: false
    }
  };

  var currentScreenId = 'screen-home';
  var currentChapterId = DEFAULT_CHAPTER_ID;
  var overlayResetTimer = 0;
  var toastHideTimer = 0;
  var FULLSCREEN_OVERLAY_BODY_CLASS = 'fullscreen-overlay-open';
  var sceneAnimationId = 0;
  var sceneRenderer = null;
  var sceneCleanup = null;
  var sceneRoot = null;
  var sceneBootTimer = 0;

  function byId(id) {
    return document.getElementById(id);
  }

  function getChapter(chapterId) {
    return CHAPTERS[chapterId] || CHAPTERS[DEFAULT_CHAPTER_ID];
  }

  function getCurrentChapter() {
    return getChapter(currentChapterId);
  }

  function setThemeButtonLabel() {
    var themeButton = byId('theme-toggle');
    if (!themeButton) {
      return;
    }

    var isPortal = document.body.classList.contains('light-theme');
    themeButton.textContent = isPortal ? 'Theme: Portal UI' : 'Theme: Deep Space';
    themeButton.setAttribute('aria-label', isPortal ? 'Switch to Deep Space theme' : 'Switch to Portal UI theme');
  }

  function saveThemePreference(value) {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, value);
    } catch (error) {
      // Ignore storage failures in restricted browser contexts.
    }
  }

  function applySavedTheme() {
    var storedTheme = '';

    try {
      storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY) || '';
    } catch (error) {
      storedTheme = '';
    }

    document.body.classList.toggle('light-theme', storedTheme === 'light');
    setThemeButtonLabel();
  }

  function syncFullscreenButton() {
    var fullscreenButton = byId('fullscreen-toggle');
    if (!fullscreenButton) {
      return;
    }

    var inFullscreen = !!document.fullscreenElement;
    var label = inFullscreen ? 'Exit Fullscreen' : 'Fullscreen';
    var iconSpan = fullscreenButton.querySelector('.fullscreen-icon');

    // Update only the text node — preserve the icon <span> inside the button
    if (iconSpan) {
      // Remove existing text nodes, keep the span
      Array.prototype.forEach.call(fullscreenButton.childNodes, function (node) {
        if (node.nodeType === 3) { fullscreenButton.removeChild(node); }
      });
      fullscreenButton.appendChild(document.createTextNode(' ' + label));
    } else {
      fullscreenButton.textContent = label;
    }
    fullscreenButton.setAttribute('aria-label', inFullscreen ? 'Exit fullscreen' : 'Enter fullscreen');
  }

  function ensureToast() {
    var toast = byId('app-toast');

    if (toast) {
      return toast;
    }

    toast = document.createElement('div');
    toast.id = 'app-toast';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.style.position = 'fixed';
    toast.style.left = '50%';
    toast.style.bottom = '96px';
    toast.style.transform = 'translateX(-50%) translateY(12px)';
    toast.style.padding = '12px 18px';
    toast.style.borderRadius = '999px';
    toast.style.border = '1px solid rgba(255, 255, 255, 0.18)';
    toast.style.background = 'rgba(8, 15, 28, 0.92)';
    toast.style.backdropFilter = 'blur(14px)';
    toast.style.webkitBackdropFilter = 'blur(14px)';
    toast.style.color = '#f8fafc';
    toast.style.fontSize = '0.95rem';
    toast.style.fontWeight = '600';
    toast.style.letterSpacing = '0.02em';
    toast.style.boxShadow = '0 20px 60px rgba(0, 0, 0, 0.35)';
    toast.style.opacity = '0';
    toast.style.pointerEvents = 'none';
    toast.style.transition = 'opacity 180ms ease, transform 180ms ease';
    toast.style.zIndex = '1200';
    document.body.appendChild(toast);

    return toast;
  }

  function showToast(message) {
    var toast = ensureToast();

    toast.textContent = message;
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(-50%) translateY(0)';

    window.clearTimeout(toastHideTimer);
    toastHideTimer = window.setTimeout(function () {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(12px)';
    }, 2600);
  }

  function updateBottomNav(screenId) {
    var activeLabel = 'HOME';
    if (screenId === 'screen-subjects' || screenId === 'screen-chapters' || screenId === 'screen-chapter-detail') {
      activeLabel = 'STUDIES';
    } else if (screenId === 'screen-profile') {
      activeLabel = 'PROFILE';
    }

    Array.prototype.forEach.call(document.querySelectorAll('.nav-btn'), function (button) {
      var label = button.querySelector('.nav-label');
      var isActive = !!label && label.textContent.trim() === activeLabel;
      button.classList.toggle('active', isActive);
    });
  }

  function activateTab(tabName) {
    Array.prototype.forEach.call(document.querySelectorAll('.sol-tab'), function (button) {
      var isActive = button.getAttribute('data-tab') === tabName;
      button.classList.toggle('active-tab', isActive);
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    Array.prototype.forEach.call(document.querySelectorAll('.sol-tab-panel'), function (panel) {
      panel.classList.toggle('active', panel.id === 'tabpanel-' + tabName);
    });

    if (tabName === 'experience') {
      window.setTimeout(function () {
        window.dispatchEvent(new Event('resize'));
        if (currentScreenId === 'screen-chapter-detail') {
          scheduleChapterSceneBoot();
        }
      }, 10);
    }
  }

  function disposeSceneGraph(root) {
    if (!root) {
      return;
    }

    if (typeof window.disposeThreeObject === 'function') {
      window.disposeThreeObject(root);
      return;
    }

    if (!root.traverse) {
      return;
    }

    root.traverse(function (object) {
      var materials;

      if (object.geometry && typeof object.geometry.dispose === 'function') {
        object.geometry.dispose();
      }

      if (!object.material) {
        return;
      }

      materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(function (material) {
        Object.keys(material).forEach(function (key) {
          if (material[key] && typeof material[key].dispose === 'function') {
            material[key].dispose();
          }
        });

        if (typeof material.dispose === 'function') {
          material.dispose();
        }
      });
    });
  }

  function destroyChapterScene() {
    var canvasContainer = byId('canvas-container');

    if (sceneAnimationId) {
      window.cancelAnimationFrame(sceneAnimationId);
      sceneAnimationId = 0;
    }

    if (sceneCleanup) {
      sceneCleanup();
      sceneCleanup = null;
    }

    disposeSceneGraph(sceneRoot);
    sceneRoot = null;

    if (sceneRenderer) {
      sceneRenderer.dispose();
      if (typeof sceneRenderer.forceContextLoss === 'function') {
        sceneRenderer.forceContextLoss();
      }
      sceneRenderer = null;
    }

    if (canvasContainer) {
      canvasContainer.innerHTML = '';
    }
  }

  function makeGlowTexture(innerColor, outerColor) {
    var canvas = document.createElement('canvas');
    var context;
    var gradient;

    canvas.width = 128;
    canvas.height = 128;
    context = canvas.getContext('2d');
    gradient = context.createRadialGradient(64, 64, 0, 64, 64, 64);
    gradient.addColorStop(0, innerColor || 'rgba(255,255,255,1)');
    gradient.addColorStop(0.25, 'rgba(210,240,255,0.85)');
    gradient.addColorStop(0.55, 'rgba(140,200,255,0.35)');
    gradient.addColorStop(1, outerColor || 'rgba(100,200,255,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, 128, 128);

    return new THREE.CanvasTexture(canvas);
  }

  function addDragRotate(container, target, sensitivityX, sensitivityY) {
    var drag = false;
    var last = { x: 0, y: 0 };
    var sx = sensitivityX || 0.006;
    var sy = sensitivityY || 0.003;

    function start(event) {
      var point = event.touches ? event.touches[0] : event;
      drag = true;
      last = { x: point.clientX, y: point.clientY };
    }

    function end() {
      drag = false;
    }

    function move(event) {
      var point;

      if (!drag) {
        return;
      }

      point = event.touches ? event.touches[0] : event;
      target.rotation.y += (point.clientX - last.x) * sx;
      target.rotation.x = Math.max(-Math.PI / 5, Math.min(Math.PI / 5, target.rotation.x + (point.clientY - last.y) * sy));
      last = { x: point.clientX, y: point.clientY };
    }

    container.addEventListener('mousedown', start);
    container.addEventListener('mouseup', end);
    container.addEventListener('mouseleave', end);
    container.addEventListener('mousemove', move);
    container.addEventListener('touchstart', start, { passive: true });
    container.addEventListener('touchend', end);
    container.addEventListener('touchmove', move, { passive: true });

    return function removeDragRotate() {
      container.removeEventListener('mousedown', start);
      container.removeEventListener('mouseup', end);
      container.removeEventListener('mouseleave', end);
      container.removeEventListener('mousemove', move);
      container.removeEventListener('touchstart', start);
      container.removeEventListener('touchend', end);
      container.removeEventListener('touchmove', move);
    };
  }

  function initLightAndShadows3D() {
    var container = byId('canvas-container');
    var loadingEl = byId('canvas-loading');

    if (typeof THREE === 'undefined' || !container) {
      showToast('The 3D engine is not available right now.');
      return;
    }

    destroyChapterScene();

    var width = Math.max(container.clientWidth, 1);
    var height = Math.max(container.clientHeight, 1);

    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0x040812);
    scene.fog = new THREE.FogExp2(0x040812, 0.022);

    var worldGroup = new THREE.Group();
    scene.add(worldGroup);

    var camera = new THREE.PerspectiveCamera(46, width / height, 0.1, 100);
    camera.position.set(4.2, 2.2, 10.5);
    camera.lookAt(-0.8, 0.4, -0.2);

    var renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(window.IFP_PIXEL_RATIO || Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    container.appendChild(renderer.domElement);
    sceneRenderer = renderer;
    sceneRoot = scene;

    if (loadingEl) {
      loadingEl.style.display = 'none';
    }

    var groundY = -2.2;
    var screenX = -5.5;
    var lightPos = new THREE.Vector3(4.5, -1.0, 2.8);
    var objPos = new THREE.Vector3(-1.2, 0.65, 0.0);

    worldGroup.add(new THREE.AmbientLight(0x0a1628, 0.65));
    var fillLight = new THREE.DirectionalLight(0x1a3a60, 0.3);
    fillLight.position.set(0, 8, 8);
    worldGroup.add(fillLight);

    // Floor wireframe & solid receiver
    var floorGeo = new THREE.PlaneGeometry(36, 36, 24, 24);
    var floorWireMat = new THREE.MeshBasicMaterial({ color: 0x0088aa, wireframe: true, transparent: true, opacity: 0.18 });
    var floorWire = new THREE.Mesh(floorGeo, floorWireMat);
    floorWire.rotation.x = -Math.PI / 2;
    floorWire.position.y = groundY;
    worldGroup.add(floorWire);

    var floorSolid = new THREE.Mesh(
      floorGeo,
      new THREE.MeshStandardMaterial({ color: 0x050914, roughness: 0.95, metalness: 0.05 })
    );
    floorSolid.rotation.x = -Math.PI / 2;
    floorSolid.position.y = groundY - 0.01;
    floorSolid.receiveShadow = true;
    worldGroup.add(floorSolid);

    var gridSize = 36;
    var step = 1.5;
    var diagMat = new THREE.LineBasicMaterial({ color: 0x00d4ff, transparent: true, opacity: 0.12 });
    for (var i = -gridSize / 2; i <= gridSize / 2; i += step) {
      var pts1 = [new THREE.Vector3(i, groundY, -gridSize / 2), new THREE.Vector3(i + gridSize, groundY, gridSize / 2)];
      var pts2 = [new THREE.Vector3(i, groundY, gridSize / 2), new THREE.Vector3(i + gridSize, groundY, -gridSize / 2)];
      worldGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts1), diagMat));
      worldGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts2), diagMat));
    }

    // Vertical screen wall
    var screenGeo = new THREE.PlaneGeometry(16, 12, 16, 12);
    var screenWireMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, wireframe: true, transparent: true, opacity: 0.28 });
    var screenWire = new THREE.Mesh(screenGeo, screenWireMat);
    screenWire.position.set(screenX, 1.8, 0);
    screenWire.rotation.y = Math.PI / 2;
    worldGroup.add(screenWire);

    var screenSolid = new THREE.Mesh(
      screenGeo,
      new THREE.MeshStandardMaterial({ color: 0x081324, roughness: 0.85, metalness: 0.1, side: THREE.DoubleSide })
    );
    screenSolid.position.set(screenX - 0.01, 1.8, 0);
    screenSolid.rotation.y = Math.PI / 2;
    screenSolid.receiveShadow = true;
    worldGroup.add(screenSolid);

    // Lamp group
    var lampGroup = new THREE.Group();
    lampGroup.position.copy(lightPos);

    var lampStandMat = new THREE.MeshStandardMaterial({ color: 0x111622, roughness: 0.3, metalness: 0.8 });
    var lampPole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.16, 1.4, 32), lampStandMat);
    lampPole.position.y = -0.7;
    lampGroup.add(lampPole);

    var lampFoot = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 0.08, 32), lampStandMat);
    lampFoot.position.y = -1.36;
    lampGroup.add(lampFoot);

    var bulb = new THREE.Mesh(new THREE.SphereGeometry(0.24, 32, 32), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    lampGroup.add(bulb);

    var glowTex = makeGlowTexture('rgba(255,255,255,1)', 'rgba(0,100,200,0)');
    var corona = new THREE.Sprite(new THREE.SpriteMaterial({
      map: glowTex,
      color: 0xe0f7ff,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    }));
    corona.scale.set(3.0, 3.0, 3.0);
    lampGroup.add(corona);

    var groundPool = new THREE.Mesh(new THREE.PlaneGeometry(4.5, 4.5), new THREE.MeshBasicMaterial({
      map: glowTex,
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.45,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    }));
    groundPool.rotation.x = -Math.PI / 2;
    groundPool.position.y = -1.38;
    lampGroup.add(groundPool);

    var spotLight = new THREE.SpotLight(0xe8f6ff, 7.5, 30, Math.PI / 4, 0.35, 0.9);
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

    var pointLight = new THREE.PointLight(0xffffff, 3.5, 20);
    pointLight.position.copy(lightPos);
    worldGroup.add(pointLight);
    worldGroup.add(lampGroup);

    // Obstacle & Pedestal
    var obstacleGroup = new THREE.Group();
    obstacleGroup.position.copy(objPos);

    var towerMat = new THREE.LineBasicMaterial({ color: 0x88d4f8, transparent: true, opacity: 0.85 });
    var baseW = 0.95;
    var topW = 0.28;
    var yBottom = groundY - objPos.y;
    var yTop = -0.65;
    var towerLines = [];

    var b0 = new THREE.Vector3(-baseW / 2, yBottom, -baseW / 2);
    var b1 = new THREE.Vector3(baseW / 2, yBottom, -baseW / 2);
    var b2 = new THREE.Vector3(baseW / 2, yBottom, baseW / 2);
    var b3 = new THREE.Vector3(-baseW / 2, yBottom, baseW / 2);
    var t0 = new THREE.Vector3(-topW / 2, yTop, -topW / 2);
    var t1 = new THREE.Vector3(topW / 2, yTop, -topW / 2);
    var t2 = new THREE.Vector3(topW / 2, yTop, topW / 2);
    var t3 = new THREE.Vector3(-topW / 2, yTop, topW / 2);

    towerLines.push(b0, t0, b1, t1, b2, t2, b3, t3);
    towerLines.push(b0, b1, b1, b2, b2, b3, b3, b0);
    towerLines.push(t0, t1, t1, t2, t2, t3, t3, t0);
    towerLines.push(b0, b2, b1, b3);

    for (var tier = 1; tier < 3; tier++) {
      var f = tier / 3;
      var yMid = yBottom + (yTop - yBottom) * f;
      var wMid = baseW + (topW - baseW) * f;
      var m0 = new THREE.Vector3(-wMid / 2, yMid, -wMid / 2);
      var m1 = new THREE.Vector3(wMid / 2, yMid, -wMid / 2);
      var m2 = new THREE.Vector3(wMid / 2, yMid, wMid / 2);
      var m3 = new THREE.Vector3(-wMid / 2, yMid, wMid / 2);
      towerLines.push(m0, m1, m1, m2, m2, m3, m3, m0);

      var prevF = (tier - 1) / 3;
      var prevY = yBottom + (yTop - yBottom) * prevF;
      var prevW = baseW + (topW - baseW) * prevF;
      var p0 = new THREE.Vector3(-prevW / 2, prevY, -prevW / 2);
      var p1 = new THREE.Vector3(prevW / 2, prevY, -prevW / 2);
      var p2 = new THREE.Vector3(prevW / 2, prevY, prevW / 2);
      var p3 = new THREE.Vector3(-prevW / 2, prevY, prevW / 2);
      towerLines.push(p0, m1, p1, m0, p1, m2, p2, m1, p2, m3, p3, m2, p3, m0, p0, m3);
    }
    obstacleGroup.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(towerLines), towerMat));

    var polyGeo = new THREE.DodecahedronGeometry(1.25, 0);
    var polyMesh = new THREE.Mesh(polyGeo, new THREE.MeshStandardMaterial({
      color: 0x5a708a,
      roughness: 0.4,
      metalness: 0.15,
      flatShading: true
    }));
    polyMesh.castShadow = true;
    polyMesh.receiveShadow = true;
    obstacleGroup.add(polyMesh);
    worldGroup.add(obstacleGroup);

    // Clean straight rays
    var rayMat = new THREE.LineBasicMaterial({ color: 0xdff4ff, transparent: true, opacity: 0.42, blending: THREE.AdditiveBlending });
    var rayLinesMesh = new THREE.LineSegments(new THREE.BufferGeometry(), rayMat);
    worldGroup.add(rayLinesMesh);

    var removeDragRotate = addDragRotate(container, worldGroup, 0.005, 0.003);

    var posAttr = polyGeo.attributes.position;
    var localVertices = [];
    for (var k = 0; k < posAttr.count; k++) {
      var v = new THREE.Vector3().fromBufferAttribute(posAttr, k);
      var duplicate = false;
      for (var u = 0; u < localVertices.length; u++) {
        if (localVertices[u].distanceToSquared(v) < 0.001) { duplicate = true; break; }
      }
      if (!duplicate) localVertices.push(v);
    }

    var onResize = function () {
      if (!container || !sceneRenderer) return;
      camera.aspect = Math.max(container.clientWidth, 1) / Math.max(container.clientHeight, 1);
      camera.updateProjectionMatrix();
      sceneRenderer.setSize(Math.max(container.clientWidth, 1), Math.max(container.clientHeight, 1));
    };
    window.addEventListener('resize', onResize);

    sceneCleanup = function () {
      window.removeEventListener('resize', onResize);
      removeDragRotate();
    };

    var time = 0;
    function animate() {
      sceneAnimationId = window.requestAnimationFrame(animate);
      if (window.IFP_VISIBLE === false || currentScreenId !== 'screen-chapter-detail') return;

      time += 0.016;
      polyMesh.rotation.y = time * 0.2;
      polyMesh.rotation.x = Math.sin(time * 0.15) * 0.12;

      var pulse = Math.sin(time * 3) * 0.12;
      corona.scale.set(3.0 + pulse, 3.0 + pulse, 3.0 + pulse);

      var rayPoints = [];
      for (var idx = 0; idx < localVertices.length; idx++) {
        var worldV = localVertices[idx].clone().applyMatrix4(polyMesh.matrix).add(objPos);
        var dir = new THREE.Vector3().subVectors(worldV, lightPos);
        if (dir.x < -0.01) {
          var timeFactor = (screenX - lightPos.x) / dir.x;
          if (timeFactor > 0) {
            var hitScreen = new THREE.Vector3().copy(lightPos).addScaledVector(dir, timeFactor);
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
  }

  function init3DSolarSystem() {
    var container = byId('canvas-container');
    var loadingEl = byId('canvas-loading');
    var scene;
    var camera;
    var renderer;
    var starField;
    var sun;
    var planets = [];
    var onResize;
    var removeDragRotate;

    if (typeof THREE === 'undefined' || !container) {
      showToast('The 3D engine is not available right now.');
      return;
    }

    destroyChapterScene();

    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(
      45,
      Math.max(container.clientWidth, 1) / Math.max(container.clientHeight, 1),
      0.1,
      1000
    );
    camera.position.set(0, 30, 45);
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(Math.max(container.clientWidth, 1), Math.max(container.clientHeight, 1));
    renderer.setPixelRatio(window.IFP_PIXEL_RATIO || Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x050814);
    container.appendChild(renderer.domElement);
    sceneRenderer = renderer;
    sceneRoot = scene;

    if (loadingEl) {
      loadingEl.style.display = 'none';
    }

    scene.add(new THREE.AmbientLight(0xffffff, 0.22));
    scene.add(new THREE.PointLight(0xffdcb4, 2.5, 160));

    (function addStarField() {
      var starsGeometry = new THREE.BufferGeometry();
      var starPositions = new Float32Array(1200 * 3);

      for (var i = 0; i < starPositions.length; i += 1) {
        starPositions[i] = (Math.random() - 0.5) * 220;
      }

      starsGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
      starField = new THREE.Points(
        starsGeometry,
        new THREE.PointsMaterial({
          size: 0.12,
          color: 0x88ccff,
          transparent: true,
          opacity: 0.8
        })
      );
      scene.add(starField);
    })();

    sun = new THREE.Mesh(
      new THREE.SphereGeometry(3, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0xffaa00 })
    );
    scene.add(sun);
    scene.add(new THREE.Mesh(
      new THREE.SphereGeometry(3.6, 32, 32),
      new THREE.MeshBasicMaterial({
        color: 0xff6600,
        transparent: true,
        opacity: 0.18,
        side: THREE.BackSide
      })
    ));

    [
      { radius: 0.30, distance: 6, speed: 0.020, color: 0x888888 },
      { radius: 0.60, distance: 9, speed: 0.015, color: 0xe3bb76 },
      { radius: 0.65, distance: 13, speed: 0.010, color: 0x3366ff },
      { radius: 0.40, distance: 17, speed: 0.008, color: 0xff3300 },
      { radius: 1.80, distance: 23, speed: 0.004, color: 0xd99b58 },
      { radius: 1.40, distance: 30, speed: 0.003, color: 0xc5ab6e, hasRing: true },
      { radius: 0.90, distance: 36, speed: 0.002, color: 0x66ccff }
    ].forEach(function (planetData) {
      var orbitPoints = [];
      var group = new THREE.Group();
      var mesh = new THREE.Mesh(
        new THREE.SphereGeometry(planetData.radius, 28, 28),
        new THREE.MeshStandardMaterial({ color: planetData.color, roughness: 0.7, metalness: 0.1 })
      );

      for (var i = 0; i <= 64; i += 1) {
        var theta = (i / 64) * Math.PI * 2;
        orbitPoints.push(new THREE.Vector3(
          Math.cos(theta) * planetData.distance,
          0,
          Math.sin(theta) * planetData.distance
        ));
      }

      scene.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(orbitPoints),
        new THREE.LineBasicMaterial({ color: 0x40e0d0, transparent: true, opacity: 0.2 })
      ));

      mesh.position.x = planetData.distance;
      group.add(mesh);
      scene.add(group);

      if (planetData.hasRing) {
        var ring = new THREE.Mesh(
          new THREE.RingGeometry(planetData.radius * 1.4, planetData.radius * 2.2, 32),
          new THREE.MeshStandardMaterial({
            color: 0xaaaaaa,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.7
          })
        );
        ring.rotation.x = Math.PI / 2 + 0.3;
        mesh.add(ring);
      }

      planets.push({
        group: group,
        mesh: mesh,
        speed: planetData.speed,
        angle: Math.random() * Math.PI * 2
      });
    });

    removeDragRotate = addDragRotate(container, scene);

    onResize = function () {
      if (!container || !sceneRenderer) {
        return;
      }
      camera.aspect = Math.max(container.clientWidth, 1) / Math.max(container.clientHeight, 1);
      camera.updateProjectionMatrix();
      sceneRenderer.setSize(Math.max(container.clientWidth, 1), Math.max(container.clientHeight, 1));
    };

    window.addEventListener('resize', onResize);
    sceneCleanup = function () {
      window.removeEventListener('resize', onResize);
      removeDragRotate();
    };

    function animate() {
      sceneAnimationId = window.requestAnimationFrame(animate);

      if (window.IFP_VISIBLE === false || currentScreenId !== 'screen-chapter-detail') {
        return;
      }

      starField.rotation.y += 0.0002;
      sun.rotation.y += 0.005;
      planets.forEach(function (planet) {
        planet.angle += planet.speed;
        planet.group.rotation.y = planet.angle;
        planet.mesh.rotation.y += 0.018;
      });
      renderer.render(scene, camera);
    }

    animate();
  }

  function bootChapterScene() {
    var chapter = getCurrentChapter();

    if (!chapter || !chapter.sceneKey || currentScreenId !== 'screen-chapter-detail') {
      return;
    }

    if (chapter.sceneKey === 'lightShadows') {
      initLightAndShadows3D();
      return;
    }

    if (chapter.sceneKey === 'solarSystem') {
      init3DSolarSystem();
    }
  }

  function scheduleChapterSceneBoot() {
    var loadingEl = byId('canvas-loading');

    if (currentScreenId !== 'screen-chapter-detail') {
      return;
    }

    if (loadingEl) {
      loadingEl.style.display = 'flex';
    }

    window.clearTimeout(sceneBootTimer);
    sceneBootTimer = window.setTimeout(function () {
      bootChapterScene();
    }, 90);
  }

  function updateChapterDetail(chapterId) {
    var chapter = getChapter(chapterId);
    var detailTitle = byId('detail-title');
    var detailDescription = byId('detail-description');
    var detailIcon = byId('detail-tab-phosphor-icon');
    var chapterScreen = byId('screen-chapter-detail');
    var startButton = byId('btn-start-journey');
    var nextButton = byId('btn-next-chapter');
    var quizTitle = document.querySelector('#tabpanel-quiz .sol-unlocked-title');
    var quizDescription = document.querySelector('#tabpanel-quiz .sol-unlocked-desc');
    var quizButton = document.querySelector('#tabpanel-quiz .sol-start-btn');
    var canvasLoading = byId('canvas-loading');

    currentChapterId = chapter.id;

    if (detailTitle) {
      detailTitle.textContent = chapter.title;
    }

    if (detailDescription) {
      detailDescription.textContent = chapter.description;
    }

    if (detailIcon) {
      detailIcon.className = chapter.iconClass + ' sol-tab-solo-icon';
    }

    if (chapterScreen) {
      chapterScreen.style.backgroundImage = chapter.id === 'space-solar'
        ? "url('assets/Future verion lowres.jpg')"
        : "url('assets/chapter background lowres.jpg')";
    }

    if (startButton) {
      startButton.textContent = chapter.experienceUrl ? 'Start Journey' : 'Journey Coming Soon';
    }

    if (nextButton) {
      nextButton.textContent = chapter.id === 'space-solar' ? 'Back to Chapter 1' : 'Next Chapter';
    }

    if (quizTitle) {
      quizTitle.textContent = chapter.quizReady ? 'Interactive Quiz' : 'Quiz Coming Soon';
    }

    if (quizDescription) {
      quizDescription.textContent = chapter.quizReady
        ? 'Test your mastery on ' + chapter.title + '.'
        : 'Quiz content for ' + chapter.title + ' is still being prepared.';
    }

    if (quizButton) {
      quizButton.textContent = chapter.quizReady ? 'Start Quiz' : 'Quiz Coming Soon';
    }

    if (canvasLoading) {
      canvasLoading.style.display = 'flex';
    }

    destroyChapterScene();
    activateTab('experience');
  }

  function navigateTo(screenId, options) {
    var targetScreen = byId(screenId);
    var isDetailScreenChange = screenId === 'screen-chapter-detail' && currentScreenId === 'screen-chapter-detail' && options && options.chapterId && options.chapterId !== currentChapterId;
    var currentActiveScreen = byId(currentScreenId);

    if (!targetScreen) {
      showToast('That screen is not available yet.');
      return;
    }

    if (currentScreenId === 'screen-chapter-detail' || screenId === 'screen-chapter-detail') {
      destroyChapterScene();
    }

    if (isDetailScreenChange) {
      updateChapterDetail(options.chapterId);
      updateBottomNav(screenId);
      scheduleChapterSceneBoot();
      return;
    }

    if (screenId === currentScreenId) {
      return;
    }

    if (options && options.chapterId) {
      updateChapterDetail(options.chapterId);
    } else if (screenId === 'screen-chapter-detail') {
      updateChapterDetail(currentChapterId);
    }

    Array.prototype.forEach.call(document.querySelectorAll('.screen'), function (screen) {
      if (screen.id === screenId) {
        screen.classList.remove('exit-left');
        screen.classList.add('active');
      } else if (screen.classList.contains('active') || screen === currentActiveScreen) {
        screen.classList.remove('active');
        screen.classList.add('exit-left');
        window.setTimeout(function () {
          screen.classList.remove('exit-left');
        }, 280);
      } else {
        screen.classList.remove('exit-left');
        screen.classList.remove('active');
      }
    });

    currentScreenId = screenId;
    updateBottomNav(screenId);

    // Hide the global nav whenever we're inside a chapter — show it on all
    // main menu screens (home, subjects, chapters list, world, profile, exit).
    document.body.classList.toggle('chapter-detail-open', screenId === 'screen-chapter-detail');

    if (screenId === 'screen-chapter-detail') {
      scheduleChapterSceneBoot();
    }
  }

  function setOverlayLayout(kind) {
    var overlay = byId('app-overlay');
    var shell = byId('app-overlay-shell');
    var frame = byId('app-overlay-frame');

    if (!overlay || !shell || !frame) {
      return;
    }

    overlay.classList.remove('app-overlay--story', 'app-overlay--fullscreen');
    overlay.style.pointerEvents = 'auto';

    if (kind === 'story') {
      overlay.classList.add('app-overlay--story');
      document.body.classList.remove(FULLSCREEN_OVERLAY_BODY_CLASS);
      overlay.style.background = '';
      overlay.style.backdropFilter = '';
      overlay.style.webkitBackdropFilter = '';
      shell.style.width = '';
      shell.style.height = '';
      frame.style.borderRadius = '';
      return;
    }

    overlay.classList.add('app-overlay--fullscreen');
    document.body.classList.add(FULLSCREEN_OVERLAY_BODY_CLASS);
    overlay.style.background = '';
    overlay.style.backdropFilter = '';
    overlay.style.webkitBackdropFilter = '';
    shell.style.width = '';
    shell.style.height = '';
    frame.style.borderRadius = '';
  }

  function openOverlay(source, kind, options) {
    var overlay = byId('app-overlay');
    var iframe = byId('app-iframe');
    var loader = byId('iframe-loading-dots');
    var finalSource = source;

    if (!overlay || !iframe) {
      return;
    }

    if (options && options.cacheBust) {
      finalSource += (source.indexOf('?') === -1 ? '?' : '&') + 'cb=' + Date.now();
    }

    window.clearTimeout(overlayResetTimer);
    setOverlayLayout(kind);
    iframe.setAttribute('allow', 'autoplay; fullscreen');
    
    if (loader) {
      loader.classList.remove('hidden');
    }
    
    iframe.onload = function() {
      if (loader) {
        loader.classList.add('hidden');
      }
    };

    iframe.src = finalSource;
    overlay.classList.remove('hidden');
  }

  function closeOverlay() {
    var overlay = byId('app-overlay');
    var iframe = byId('app-iframe');

    if (!overlay || !iframe) {
      return;
    }

    document.body.classList.remove(FULLSCREEN_OVERLAY_BODY_CLASS);
    overlay.classList.add('hidden');
    window.clearTimeout(overlayResetTimer);
    overlayResetTimer = window.setTimeout(function () {
      iframe.removeAttribute('src');
    }, 160);
  }

  function openExperiment(path) {
    var chapter = getCurrentChapter();

    if (!chapter.contentReady) {
      showToast(chapter.title + ' interactive content is coming soon.');
      return;
    }

    if (!AVAILABLE_APPS[path]) {
      showToast('This activity is not connected yet.');
      return;
    }

    openOverlay(encodeURI(path), 'fullscreen', { cacheBust: true });
  }

  function openStoryVideo(url) {
    openOverlay(url, 'story');
  }

  function startChapterJourney() {
    var chapter = getCurrentChapter();

    if (!chapter.contentReady || !chapter.experienceUrl) {
      showToast(chapter.title + ' journey is coming soon.');
      return;
    }

    openExperiment(chapter.experienceUrl);
  }

  function goToNextChapter() {
    var currentIndex = DETAIL_CHAPTER_ORDER.indexOf(currentChapterId);
    var nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % DETAIL_CHAPTER_ORDER.length;
    var nextChapterId = DETAIL_CHAPTER_ORDER[nextIndex];

    navigateTo('screen-chapter-detail', { chapterId: nextChapterId });

    if (!getChapter(nextChapterId).contentReady) {
      showToast(getChapter(nextChapterId).title + ' is ready for preview. Full activities are still coming online.');
    }
  }

  function scrollCarousel(direction) {
    var carousel = byId('experiments-carousel');

    if (!carousel) {
      return;
    }

    carousel.scrollBy({
      left: direction * 320,
      behavior: 'smooth'
    });
  }

  function toggleTheme() {
    var useLightTheme = !document.body.classList.contains('light-theme');

    document.body.classList.toggle('light-theme', useLightTheme);
    saveThemePreference(useLightTheme ? 'light' : 'dark');
    setThemeButtonLabel();
  }

  function toggleAppFullscreen() {
    if (!document.fullscreenElement) {
      if (!document.documentElement.requestFullscreen) {
        showToast('Fullscreen is not available in this browser.');
        return;
      }

      document.documentElement.requestFullscreen().catch(function () {
        showToast('Fullscreen could not be started.');
      });
      return;
    }

    document.exitFullscreen().catch(function () {
      showToast('Fullscreen could not be closed.');
    });
  }

  function addClickListener(selector, handler) {
    Array.prototype.forEach.call(document.querySelectorAll(selector), function (element) {
      element.addEventListener('click', handler);
    });
  }

  function bindTabs() {
    Array.prototype.forEach.call(document.querySelectorAll('.sol-tab'), function (button) {
      button.addEventListener('click', function () {
        activateTab(button.getAttribute('data-tab'));
      });
    });
  }

  function bindPlaceholderButtons() {
    [
      ['#subj-history', 'History content is coming soon.'],
      ['#subj-geography', 'Geography content is coming soon.'],
      ['#subj-pe', 'Physical Education content is coming soon.'],
      ['#subj-arts', 'Arts content is coming soon.'],
      ['#subj-english', 'English content is coming soon.'],
      ['#subj-math', 'Mathematics content is coming soon.'],
      ['#subj-music', 'Music content is coming soon.'],
      ['#ch-skeletal', 'Skeletal System is queued for the next release.'],
      ['#ch-food-health', 'Food and Health is queued for the next release.'],
      ['#ch-pollination', 'Pollination is queued for the next release.'],
      ['#ch-fertilization', 'Fertilization is queued for the next release.'],
      ['#ch-solids', 'Solids, Liquids, and Gases is queued for the next release.'],
      ['#ch-interdependence', 'Interdependence is queued for the next release.']
    ].forEach(function (entry) {
      var element = document.querySelector(entry[0]);

      if (!element) {
        return;
      }

      element.addEventListener('click', function () {
        showToast(entry[1]);
      });
    });

    addClickListener('.nav-btn[aria-label="World"]:not([onclick])', function () {
      showToast('World view is coming soon.');
    });

    addClickListener('.nav-btn[aria-label="Profile"]:not([onclick])', function () {
      showToast('Profile view is coming soon.');
    });

    addClickListener('.nav-btn[aria-label="Exit"]:not([onclick])', function () {
      navigateTo('screen-home');
    });
  }

  function bindOverlayEvents() {
    var overlay = byId('app-overlay');
    var closeButton = byId('close-app-btn');

    if (closeButton) {
      closeButton.addEventListener('click', closeOverlay);
    }

    if (overlay) {
      overlay.addEventListener('click', function (event) {
        if (event.target === overlay) {
          closeOverlay();
        }
      });
    }

    window.addEventListener('message', function (event) {
      if (event.data === 'closeOverlay') {
        closeOverlay();
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        if (!byId('app-overlay').classList.contains('hidden')) {
          closeOverlay();
          return;
        }

        if (document.fullscreenElement) {
          document.exitFullscreen().catch(function () {
            showToast('Fullscreen could not be closed.');
          });
        }
      }
    });
  }

  function bindPrimaryButtons() {
    var startJourneyButton = byId('btn-start-journey');
    var nextChapterButton = byId('btn-next-chapter');

    if (startJourneyButton) {
      startJourneyButton.addEventListener('click', startChapterJourney);
    }

    if (nextChapterButton) {
      nextChapterButton.addEventListener('click', goToNextChapter);
    }
  }

  function initSpringSlider() {
    var knob = document.getElementById('spring-slider-knob');
    var track = document.getElementById('spring-slider-track');
    if (!knob || !track) return;

    var isDragging = false;
    var startY = 0;
    var currentOffset = 0;
    var maxOffset = 0;

    function onStart(e) {
      isDragging = true;
      // Calculate maxOffset dynamically because the parent tab might be hidden on load
      maxOffset = (track.clientHeight / 2) - (knob.clientHeight / 2);
      
      var clientY = e.touches ? e.touches[0].clientY : e.clientY;
      startY = clientY - currentOffset;
      knob.style.transition = 'none';
      knob.classList.add('dragging');
    }

    function onMove(e) {
      if (!isDragging) return;
      var clientY = e.touches ? e.touches[0].clientY : e.clientY;
      currentOffset = clientY - startY;

      if (currentOffset > maxOffset) currentOffset = maxOffset;
      if (currentOffset < -maxOffset) currentOffset = -maxOffset;

      knob.style.transform = 'translate(-50%, calc(-50% + ' + currentOffset + 'px))';
    }

    function onEnd(e) {
      if (!isDragging) return;
      isDragging = false;
      knob.classList.remove('dragging');
      
      // Snap back to center
      currentOffset = 0;
      knob.style.transition = 'transform 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)';
      knob.style.transform = 'translate(-50%, -50%)';
    }

    knob.addEventListener('mousedown', onStart);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onEnd);
    
    knob.addEventListener('touchstart', onStart, {passive: true});
    window.addEventListener('touchmove', onMove, {passive: false});
    window.addEventListener('touchend', onEnd);
  }

  // ─── SUPABASE REALTIME PROFILE & COURSE SYNC ───
  var SUPABASE_URL = 'https://qmyrxvtbzlbnvzxypnus.supabase.co';
  var SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFteXJ4dnRiemxibnZ6eHlwbnVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MjA4OTcsImV4cCI6MjA5NTM5Njg5N30.ABvW_oBzXC2Ffxm5ToLh6t4WmdKPdtg9SyfeAE76iJo';
  var supabaseClient = null;

  function initSupabaseSync() {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }
    syncStudentProfile();
  }

  function syncStudentProfile() {
    var urlParams = new URLSearchParams(window.location.search);
    var studentEmail = urlParams.get('email') || '';
    var studentId = urlParams.get('student_id') || urlParams.get('id') || '';
    
    var storedName = localStorage.getItem('student_portal_name') || 'Alex K.';
    var storedAvatar = localStorage.getItem('student_portal_avatar') || 'assets/avatar.png';
    var storedClass = localStorage.getItem('student_portal_designation') || 'Class 6th Science & Physics';
    
    var nameEl = byId('profile-student-name');
    var avatarEl = byId('profile-avatar-img');
    var classEl = byId('profile-student-class');
    var idEl = byId('profile-student-id');

    if (nameEl) nameEl.textContent = storedName;
    if (avatarEl && storedAvatar) avatarEl.src = storedAvatar;
    if (classEl) classEl.textContent = storedClass;
    if (idEl) idEl.textContent = 'ID: ' + (studentId || 'STU-64029');

    var officialClass6thSubjects = [
      {
        id: 'c6-sci',
        title: 'Class 6th Science',
        class_name: 'Class 6th',
        subject: 'Science',
        chapters_count: 2,
        icon: '💡',
        access: 'Full Access'
      },
      {
        id: 'c6-hist',
        title: 'Class 6th Ancient & World History',
        class_name: 'Class 6th',
        subject: 'History',
        chapters_count: 1,
        icon: '🏛️',
        access: 'Full Access'
      },
      {
        id: 'c6-geo',
        title: 'Class 6th World Geography & Continents',
        class_name: 'Class 6th',
        subject: 'Geography',
        chapters_count: 1,
        icon: '🌍',
        access: 'Full Access'
      },
      {
        id: 'c6-math',
        title: 'Class 6th Mathematics & Geometry',
        class_name: 'Class 6th',
        subject: 'Mathematics',
        chapters_count: 1,
        icon: '📐',
        access: 'Full Access'
      },
      {
        id: 'c6-eng',
        title: 'Class 6th English Literature & Grammar',
        class_name: 'Class 6th',
        subject: 'English',
        chapters_count: 1,
        icon: '📝',
        access: 'Full Access'
      },
      {
        id: 'c6-art',
        title: 'Class 6th Visual Arts & 3D Design',
        class_name: 'Class 6th',
        subject: 'Arts',
        chapters_count: 1,
        icon: '🎨',
        access: 'Full Access'
      },
      {
        id: 'c6-music',
        title: 'Class 6th Music Theory & Acoustics',
        class_name: 'Class 6th',
        subject: 'Music',
        chapters_count: 1,
        icon: '🎵',
        access: 'Full Access'
      },
      {
        id: 'c6-pe',
        title: 'Class 6th Physical Education & Sports Science',
        class_name: 'Class 6th',
        subject: 'Physical Education',
        chapters_count: 1,
        icon: '🏃',
        access: 'Full Access'
      }
    ];

    function renderCourses(coursesToDisplay) {
      var listEl = byId('profile-courses-list');
      if (!listEl) return;
      listEl.innerHTML = '';

      var subjectIcons = {
        'Science': '💡',
        'History': '🏛️',
        'Geography': '🌍',
        'Mathematics': '📐',
        'English': '📝',
        'Arts': '🎨',
        'Music': '🎵',
        'Physical Education': '🏃'
      };

      coursesToDisplay.forEach(function (course) {
        var card = document.createElement('div');
        card.className = 'glass-mini';
        card.style.cssText = 'padding: 16px 22px; border-radius: 16px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.15); display: flex; align-items: center; justify-content: space-between; gap: 18px; transition: all 0.25s ease; box-shadow: 0 4px 20px rgba(0,0,0,0.25);';
        
        var chapterCount = course.chapters_count || (course.course_chapters ? course.course_chapters.length : 1);
        var icon = course.icon || subjectIcons[course.subject] || '📖';

        card.innerHTML = '\
          <div style="display: flex; align-items: center; gap: 16px; flex: 1; min-width: 0;">\
            <div style="width: 48px; height: 48px; border-radius: 14px; background: rgba(0,240,255,0.12); border: 1px solid rgba(0,240,255,0.3); display: flex; align-items: center; justify-content: center; font-size: 1.6rem; flex-shrink: 0;">\
              ' + icon + '\
            </div>\
            <div style="flex: 1; min-width: 0;">\
              <h4 style="font-size: 1.15rem; font-weight: 800; color: white; margin: 0 0 6px 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="' + (course.title || 'Subject') + '">' + (course.title || 'Subject') + '</h4>\
              <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">\
                <span style="font-size: 0.78rem; padding: 3px 10px; border-radius: 8px; background: rgba(16,185,129,0.18); border: 1px solid rgba(16,185,129,0.35); color: #10B981; font-weight: 800; white-space: nowrap; flex-shrink: 0;">🟢 Full Access</span>\
                <span style="color: #cbd5e1; font-size: 0.88rem; font-weight: 500; white-space: nowrap;">' + (course.class_name || 'Class 6th') + ' • ' + (course.subject || 'Core Subject') + '</span>\
              </div>\
            </div>\
          </div>\
          <button onclick="navigateTo(\'screen-chapters\')" style="padding: 12px 22px; border-radius: 14px; background: linear-gradient(135deg, #00F0FF, #3B82F6); color: #000; font-weight: 800; border: none; cursor: pointer; font-size: 0.92rem; white-space: nowrap; flex-shrink: 0; box-shadow: 0 0 20px rgba(0,240,255,0.4);">\
            🚀 Launch 3D Lab\
          </button>\
        ';
        listEl.appendChild(card);
      });
    }

    if (supabaseClient) {
      supabaseClient
        .from('courses')
        .select('*, course_chapters(*)')
        .eq('class_name', 'Class 6th')
        .then(function (res) {
          var dbCourses = res.data || [];
          if (dbCourses.length > 0) {
            renderCourses(dbCourses);
          } else {
            renderCourses(officialClass6thSubjects);
          }
        }).catch(function () {
          renderCourses(officialClass6thSubjects);
        });

      supabaseClient
        .channel('public:courses_profile_sync')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'courses' }, function () {
          syncStudentProfile();
        })
        .subscribe();
    } else {
      renderCourses(officialClass6thSubjects);
    }
  }

  function init() {
    applySavedTheme();
    syncFullscreenButton();
    updateBottomNav(currentScreenId);
    updateChapterDetail(DEFAULT_CHAPTER_ID);
    bindTabs();
    bindPrimaryButtons();
    bindPlaceholderButtons();
    bindOverlayEvents();
    initSpringSlider();
    initSupabaseSync();

    document.addEventListener('fullscreenchange', syncFullscreenButton);
    window.addEventListener('beforeunload', destroyChapterScene);
  }

  function showExitModal() {
    var modal = byId('exit-modal');
    if (modal) {
      modal.style.display = 'flex';
      modal.classList.remove('hidden');
    }
  }

  function closeExitModal() {
    var modal = byId('exit-modal');
    if (modal) {
      modal.style.display = 'none';
      modal.classList.add('hidden');
    }
  }

  function confirmExitSession() {
    closeExitModal();
    // 1. Attempt window.close() to close current browser tab
    window.close();

    // 2. Fallback if browser blocks window.close() (when tab wasn't opened via JS)
    setTimeout(function () {
      if (!window.closed) {
        window.location.href = 'http://localhost:3000/dashboard';
      }
    }, 300);
  }

  window.navigateTo = navigateTo;
  window.activateTab = activateTab;
  window.scrollCarousel = scrollCarousel;
  window.openExperiment = openExperiment;
  window.openStoryVideo = openStoryVideo;
  window.toggleTheme = toggleTheme;
  window.toggleAppFullscreen = toggleAppFullscreen;
  window.closeOverlay = closeOverlay;
  window.showExitModal = showExitModal;
  window.closeExitModal = closeExitModal;
  window.confirmExitSession = confirmExitSession;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
