import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Lesson, ModelReport, QualityPreset, SimulationParams } from '../core/types';

export interface UniverseHandle {
  zoomIn(): void;
  zoomOut(): void;
  rotateLeft(): void;
  rotateRight(): void;
  resetView(): void;
  focusBody(id?: string): void;
}

interface UniverseCanvasProps {
  lesson: Pick<Lesson, 'id' | 'scene' | 'title'>;
  params: SimulationParams;
  report: ModelReport | null;
  paused: boolean;
  timeScale: number;
  quality: QualityPreset;
  reduceMotion: boolean;
}

interface SceneRuntime {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  galaxy: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  galaxyMaterial: THREE.ShaderMaterial;
  orbitGroup: THREE.Group;
  ownershipGroup: THREE.Group;
  catalogGroup: THREE.Group;
  trajectory: THREE.Line<THREE.BufferGeometry, THREE.LineDashedMaterial>;
  planetMeshes: Map<string, THREE.Mesh>;
  catalogMeshes: Map<string, THREE.Mesh>;
  orbitLines: THREE.LineLoop[];
  quality: 'high' | 'balanced' | 'battery';
}

const vertexShader = `
  attribute float aSize;
  attribute float aPhase;
  uniform float uTime;
  uniform float uSpin;
  uniform float uPixelRatio;
  uniform float uFade;
  varying vec3 vColor;
  varying float vFade;
  void main() {
    float radius = length(position.xz);
    float turn = uTime * uSpin * (0.12 + 0.34 / (0.7 + radius)) + aPhase;
    float c = cos(turn);
    float s = sin(turn);
    vec2 xz = vec2(position.x * c - position.z * s, position.x * s + position.z * c);
    vec3 p = vec3(xz.x, position.y, xz.y);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp(aSize * uPixelRatio * (250.0 / max(2.0, -mv.z)), 1.0, 8.5);
    vColor = color;
    vFade = uFade;
  }
`;

const fragmentShader = `
  varying vec3 vColor;
  varying float vFade;
  void main() {
    vec2 p = gl_PointCoord - vec2(0.5);
    float d = length(p);
    float halo = smoothstep(0.50, 0.02, d);
    float core = exp(-d * d * 44.0);
    float alpha = halo * vFade * (0.34 + core * 0.72);
    gl_FragColor = vec4(vColor * (0.72 + core * 0.75), alpha);
  }
`;

function randomGenerator(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function createGalaxy(count: number): THREE.BufferGeometry {
  const random = randomGenerator(41821);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);
  const inner = new THREE.Color('#ffd4a0');
  const mid = new THREE.Color('#b4d8bf');
  const outer = new THREE.Color('#84a9a1');

  for (let index = 0; index < count; index++) {
    const radius = 0.35 + Math.sqrt(random()) * 9.1;
    const arm = index % 5;
    const twist = radius * 0.47;
    const jitter = (random() + random() + random() - 1.5) * (0.12 + radius * 0.035);
    const angle = (arm / 5) * Math.PI * 2 + twist + jitter;
    const depth = (random() - 0.5) * (0.14 + (10 - radius) * 0.08);
    const offset = index * 3;
    positions[offset] = Math.cos(angle) * radius;
    positions[offset + 1] = depth;
    positions[offset + 2] = Math.sin(angle) * radius * 0.72;

    const t = Math.min(1, radius / 9.5);
    const color = t < 0.53
      ? inner.clone().lerp(mid, t / 0.53)
      : mid.clone().lerp(outer, (t - 0.53) / 0.47);
    colors[offset] = color.r;
    colors[offset + 1] = color.g;
    colors[offset + 2] = color.b;
    sizes[index] = 0.45 + Math.pow(random(), 4) * 2.2;
    phases[index] = (random() - 0.5) * 0.14;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  return geometry;
}

function createBackground(count: number): THREE.Points<THREE.BufferGeometry, THREE.PointsMaterial> {
  const random = randomGenerator(9301);
  const positions = new Float32Array(count * 3);
  for (let index = 0; index < count; index++) {
    const radius = 18 + random() * 28;
    const theta = random() * Math.PI * 2;
    const y = (random() - 0.5) * 32;
    const offset = index * 3;
    positions[offset] = Math.cos(theta) * radius;
    positions[offset + 1] = y;
    positions[offset + 2] = Math.sin(theta) * radius;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    color: '#ccd8cb',
    size: 0.06,
    transparent: true,
    opacity: 0.52,
    sizeAttenuation: true,
    depthWrite: false,
  });
  return new THREE.Points(geometry, material);
}

function makeOrbitLine(radius: number, eccentricity: number, color: string): THREE.LineLoop {
  const points: THREE.Vector3[] = [];
  const e = Math.min(0.72, Math.max(0.005, eccentricity));
  const semiMinor = radius * Math.sqrt(1 - e * e);
  for (let step = 0; step < 128; step++) {
    const angle = (step / 128) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * semiMinor));
  }
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.32 });
  return new THREE.LineLoop(geometry, material);
}

function disposeObject(root: THREE.Object3D) {
  root.traverse((object) => {
    const mesh = object as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    const material = mesh.material;
    if (Array.isArray(material)) material.forEach((item) => item.dispose());
    else material?.dispose();
  });
}

function resolveQuality(quality: QualityPreset): 'high' | 'balanced' | 'battery' {
  if (quality !== 'auto') return quality;
  const smallViewport = typeof window !== 'undefined' && window.matchMedia('(max-width: 700px)').matches;
  const lowMemory = typeof navigator !== 'undefined' && (navigator as Navigator & { deviceMemory?: number }).deviceMemory !== undefined
    && (navigator as Navigator & { deviceMemory?: number }).deviceMemory! <= 4;
  return smallViewport || lowMemory ? 'battery' : 'balanced';
}

export const UniverseCanvas = forwardRef<UniverseHandle, UniverseCanvasProps>(function UniverseCanvas(
  { lesson, params, report, paused, timeScale, quality, reduceMotion },
  forwardedRef,
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runtimeRef = useRef<SceneRuntime | null>(null);
  const propsRef = useRef({ lesson, params, report, paused, timeScale, reduceMotion });
  const frameRef = useRef<number | null>(null);
  const drawRef = useRef<(() => void) | null>(null);
  const loopRef = useRef<(() => void) | null>(null);
  const [fallback, setFallback] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const contextLostRef = useRef(false);

  propsRef.current = { lesson, params, report, paused, timeScale, reduceMotion };

  useImperativeHandle(forwardedRef, () => ({
    zoomIn() {
      const runtime = runtimeRef.current;
      if (!runtime) return;
      const offset = runtime.camera.position.clone().sub(runtime.controls.target).multiplyScalar(0.82);
      runtime.camera.position.copy(runtime.controls.target).add(offset);
      runtime.controls.update();
      drawRef.current?.();
    },
    zoomOut() {
      const runtime = runtimeRef.current;
      if (!runtime) return;
      const offset = runtime.camera.position.clone().sub(runtime.controls.target).multiplyScalar(1.22);
      runtime.camera.position.copy(runtime.controls.target).add(offset);
      runtime.controls.update();
      drawRef.current?.();
    },
    rotateLeft() {
      const runtime = runtimeRef.current;
      if (!runtime) return;
      const offset = runtime.camera.position.clone().sub(runtime.controls.target);
      const spherical = new THREE.Spherical().setFromVector3(offset);
      spherical.theta += 0.18;
      runtime.camera.position.copy(runtime.controls.target).add(new THREE.Vector3().setFromSpherical(spherical));
      runtime.controls.update();
      drawRef.current?.();
    },
    rotateRight() {
      const runtime = runtimeRef.current;
      if (!runtime) return;
      const offset = runtime.camera.position.clone().sub(runtime.controls.target);
      const spherical = new THREE.Spherical().setFromVector3(offset);
      spherical.theta -= 0.18;
      runtime.camera.position.copy(runtime.controls.target).add(new THREE.Vector3().setFromSpherical(spherical));
      runtime.controls.update();
      drawRef.current?.();
    },
    resetView() {
      const runtime = runtimeRef.current;
      if (!runtime) return;
      runtime.controls.target.set(0, 0, 0);
      runtime.camera.position.set(0, 8, 17);
      runtime.camera.lookAt(0, 0, 0);
      runtime.controls.update();
      drawRef.current?.();
    },
    focusBody(id = 'sun') {
      const runtime = runtimeRef.current;
      if (!runtime) return;
      const target = id === 'sun' || id === 'earth' || id === 'mars' || id === 'neptune' || id === 'mercury'
        ? runtime.planetMeshes.get(id)?.position
        : undefined;
      if (target) runtime.controls.target.copy(target);
      else runtime.controls.target.set(0, 0, 0);
      runtime.controls.update();
      drawRef.current?.();
    },
  }), []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    let runtime: SceneRuntime;
    let visible = true;
    let elapsed = 0;
    let previousTime = 0;
    let disposed = false;
    let resizeObserver: ResizeObserver | null = null;
    let intersectionObserver: IntersectionObserver | null = null;

    try {
      const selectedQuality = resolveQuality(quality);
      const scene = new THREE.Scene();
      scene.background = new THREE.Color('#070d0d');
      const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 120);
      camera.position.set(0, 8, 17);
      const renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: false,
        antialias: false,
        powerPreference: selectedQuality === 'high' ? 'high-performance' : 'low-power',
        preserveDrawingBuffer: false,
      });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.setClearColor('#070d0d', 1);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, selectedQuality === 'high' ? 1.6 : selectedQuality === 'balanced' ? 1.25 : 1));

      const controls = new OrbitControls(camera, canvas);
      controls.enableDamping = false;
      controls.enablePan = false;
      controls.listenToKeyEvents(canvas);
      controls.minDistance = 7;
      controls.maxDistance = 34;
      controls.rotateSpeed = 0.52;
      controls.zoomSpeed = 0.72;
      controls.target.set(0, 0, 0);
      controls.update();

      const particleLimit = selectedQuality === 'high' ? 28000 : selectedQuality === 'balanced' ? 16000 : 7000;
      const galaxyMaterial = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        uniforms: {
          uTime: { value: 0 },
          uSpin: { value: 0.14 },
          uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 1.6) },
          uFade: { value: 1 },
        },
      });
      const galaxy = new THREE.Points(createGalaxy(particleLimit), galaxyMaterial);
      scene.add(galaxy);
      scene.add(createBackground(selectedQuality === 'high' ? 900 : 520));

      const core = new THREE.Mesh(
        new THREE.SphereGeometry(0.34, 24, 16),
        new THREE.MeshBasicMaterial({ color: '#050707' }),
      );
      core.position.y = 0.06;
      scene.add(core);
      const innerDisk = new THREE.Mesh(
        new THREE.TorusGeometry(0.55, 0.045, 8, 80),
        new THREE.MeshBasicMaterial({ color: '#f0b76e', transparent: true, opacity: 0.86 }),
      );
      innerDisk.rotation.x = Math.PI / 2;
      innerDisk.rotation.z = -0.16;
      scene.add(innerDisk);
      const outerDisk = new THREE.Mesh(
        new THREE.TorusGeometry(0.79, 0.012, 6, 96),
        new THREE.MeshBasicMaterial({ color: '#afd4bd', transparent: true, opacity: 0.4 }),
      );
      outerDisk.rotation.x = Math.PI / 2;
      outerDisk.rotation.z = -0.16;
      scene.add(outerDisk);

      const orbitGroup = new THREE.Group();
      scene.add(orbitGroup);
      const planetMeshes = new Map<string, THREE.Mesh>();
      const orbitLines = [
        makeOrbitLine(2.5, 0.08, '#d4b38b'),
        makeOrbitLine(3.8, 0.017, '#8dc9bb'),
        makeOrbitLine(5.0, 0.093, '#e58e6c'),
        makeOrbitLine(6.5, 0.009, '#9bbdd2'),
      ];
      orbitLines.forEach((line) => orbitGroup.add(line));
      const sun = new THREE.Mesh(
        new THREE.SphereGeometry(0.43, 24, 16),
        new THREE.MeshBasicMaterial({ color: '#f0bf78' }),
      );
      sun.position.set(0, 0.08, 0);
      orbitGroup.add(sun);
      planetMeshes.set('sun', sun);
      const bodySpecs = [
        { id: 'mercury', radius: 0.11, color: '#c5ae8e', orbit: 2.5, phase: 0.1 },
        { id: 'earth', radius: 0.18, color: '#89c9bd', orbit: 3.8, phase: 1.8 },
        { id: 'mars', radius: 0.15, color: '#e58e6c', orbit: 5.0, phase: 3.1 },
        { id: 'neptune', radius: 0.22, color: '#97b9d0', orbit: 6.5, phase: 4.5 },
      ];
      bodySpecs.forEach((spec) => {
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(spec.radius, 16, 12),
          new THREE.MeshBasicMaterial({ color: spec.color }),
        );
        mesh.userData = { ...spec };
        orbitGroup.add(mesh);
        planetMeshes.set(spec.id, mesh);
      });

      const catalogGroup = new THREE.Group();
      const catalogMeshes = new Map<string, THREE.Mesh>();
      const catalogSpecs = [
        { id: 'sirius', x: -5.4, z: 1.0, color: '#eac99c' },
        { id: 'vega', x: 3.3, z: -4.2, color: '#bdd4d1' },
        { id: 'polaris', x: 0.4, z: 6.2, color: '#d8c8a7' },
        { id: 'altair', x: -1.4, z: -6.4, color: '#b9ceba' },
        { id: 'rigel', x: 6.7, z: 2.7, color: '#c7d7db' },
      ];
      catalogSpecs.forEach((spec) => {
        const marker = new THREE.Mesh(
          new THREE.SphereGeometry(0.075, 10, 8),
          new THREE.MeshBasicMaterial({ color: spec.color }),
        );
        marker.position.set(spec.x, 0.13, spec.z);
        marker.userData = { ...spec };
        catalogGroup.add(marker);
        catalogMeshes.set(spec.id, marker);
      });
      scene.add(catalogGroup);

      const ownershipGroup = new THREE.Group();
      const box = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(3.6, 1.8, 1.1)),
        new THREE.LineBasicMaterial({ color: '#84bea4', transparent: true, opacity: 0.8 }),
      );
      ownershipGroup.add(box);
      for (let index = 0; index < 8; index++) {
        const sphere = new THREE.Mesh(
          new THREE.SphereGeometry(0.075, 8, 6),
          new THREE.MeshBasicMaterial({ color: index % 3 === 0 ? '#f1bf7a' : '#a9d6bb' }),
        );
        sphere.position.set(-1.25 + (index % 4) * 0.83, Math.floor(index / 4) * 0.43 - 0.2, 0.12);
        ownershipGroup.add(sphere);
      }
      ownershipGroup.position.set(0, 0.05, 0);
      scene.add(ownershipGroup);

      const trajectoryGeometry = new THREE.BufferGeometry();
      const trajectoryPoints: THREE.Vector3[] = [];
      for (let index = 0; index <= 128; index++) {
        const angle = (index / 128) * Math.PI * 2;
        trajectoryPoints.push(new THREE.Vector3(Math.cos(angle) * 4.2, 0.04, Math.sin(angle) * 2.9));
      }
      trajectoryGeometry.setFromPoints(trajectoryPoints);
      const trajectoryMaterial = new THREE.LineDashedMaterial({ color: '#e58e6c', dashSize: 0.16, gapSize: 0.11, transparent: true, opacity: 0.88 });
      const trajectory = new THREE.Line(trajectoryGeometry, trajectoryMaterial);
      trajectory.computeLineDistances();
      scene.add(trajectory);

      runtime = {
        scene,
        camera,
        renderer,
        controls,
        galaxy,
        galaxyMaterial,
        orbitGroup,
        ownershipGroup,
        catalogGroup,
        trajectory,
        planetMeshes,
        catalogMeshes,
        orbitLines,
        quality: selectedQuality,
      };
      runtimeRef.current = runtime;

      const resize = () => {
        const width = Math.max(1, canvas.clientWidth);
        const height = Math.max(1, canvas.clientHeight);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
        galaxyMaterial.uniforms['uPixelRatio']!.value = renderer.getPixelRatio();
        drawRef.current?.();
      };

      let lastOrbitE = Number.NaN;
      const applyProps = () => {
        const current = propsRef.current;
        const density = Math.max(400, Math.min(particleLimit, Math.round(current.params.particleCount)));
        galaxy.geometry.setDrawRange(0, density);
        galaxyMaterial.uniforms['uFade']!.value = current.lesson.scene === 'galaxy' ? 1 : 0.42;
        galaxyMaterial.uniforms['uSpin']!.value = current.lesson.scene === 'ownership' ? 0.045 : 0.14;
        orbitGroup.visible = current.lesson.scene === 'orbit' || current.lesson.scene === 'trajectory';
        ownershipGroup.visible = current.lesson.scene === 'ownership';
        trajectory.visible = current.lesson.scene === 'trajectory';

        const e = Math.min(0.72, Math.max(0.005, current.params.eccentricity));
        if (Math.abs(lastOrbitE - e) > 0.0001) {
          const next = makeOrbitLine(5.0, e, '#e58e6c');
          orbitLines[2]!.geometry.dispose();
          (next.material as THREE.Material).dispose();
          orbitLines[2]!.geometry = next.geometry;
          lastOrbitE = e;
        }
        catalogGroup.visible = current.lesson.scene === 'galaxy';
        const highlighted = new Set(current.report?.highlightedIds ?? []);
        catalogMeshes.forEach((mesh, id) => {
          const selected = highlighted.has(id);
          const baseColor = mesh.userData.color as string;
          (mesh.material as THREE.MeshBasicMaterial).color.set(selected ? '#f0c47e' : baseColor);
          mesh.scale.setScalar(selected ? 1.7 : 1);
        });

        const invalid = current.report?.status === 'error';
        const trajectoryMaterial = trajectory.material;
        trajectoryMaterial.color.set(invalid ? '#eb826f' : '#d7c08d');
        trajectoryMaterial.opacity = invalid ? 0.95 : 0.5;
        const bodyMeshes = ['mercury', 'earth', 'mars', 'neptune'];
        bodyMeshes.forEach((id) => {
          const mesh = planetMeshes.get(id);
          if (!mesh) return;
          const selected = highlighted.has(id);
          const base = mesh.userData.color as string;
          (mesh.material as THREE.MeshBasicMaterial).color.set(selected ? '#f1d29a' : base);
          const baseScale = (mesh.userData.radius as number) / 0.15;
          mesh.scale.setScalar(selected ? baseScale * 1.28 : baseScale);
        });
        const sunMesh = planetMeshes.get('sun');
        if (sunMesh) {
          const isStar = current.params.selectedBody === 'star' && current.lesson.id === 'java-polymorphism';
          const selected = highlighted.has('sun') || isStar;
          (sunMesh.material as THREE.MeshBasicMaterial).color.set(isStar ? '#fff0bf' : selected ? '#ffe0a6' : '#f0bf78');
          sunMesh.scale.setScalar(selected ? 1.18 : 1);
        }
        const ownershipMaterial = (ownershipGroup.children[0] as THREE.LineSegments).material as THREE.LineBasicMaterial;
        const isMoveLesson = current.lesson.id === 'rust-ownership';
        const moved = isMoveLesson ? current.params.handoff : false;
        ownershipMaterial.color.set(moved ? '#dcae75' : '#84bea4');
        ownershipGroup.position.x = moved ? 1.45 : -1.45;
      };

      const renderOnce = () => {
        if (disposed || contextLostRef.current) return;
        applyProps();
        const current = propsRef.current;
        galaxyMaterial.uniforms['uTime']!.value = elapsed;
        const speeds: Record<string, number> = { mercury: 0.56, earth: 0.31, mars: 0.22, neptune: 0.12 };
        ['mercury', 'earth', 'mars', 'neptune'].forEach((id) => {
          const mesh = planetMeshes.get(id);
          if (!mesh) return;
          const data = mesh.userData as { orbit: number; phase: number; id: string };
          const angle = data.phase + elapsed * (speeds[id] ?? 0.2);
          const orbit = data.orbit;
          const eccentricity = id === 'earth' ? Math.min(0.35, current.params.eccentricity) : 0.04;
          const semiMinor = orbit * Math.sqrt(Math.max(0.4, 1 - eccentricity * eccentricity));
          mesh.position.set(Math.cos(angle) * orbit, 0.08, Math.sin(angle) * semiMinor);
        });
        renderer.render(scene, camera);
      };

      const animate = (time: number) => {
        if (disposed || !visible || document.hidden) return;
        const current = propsRef.current;
        const fps = runtime.quality === 'high' ? 30 : runtime.quality === 'balanced' ? 24 : 15;
        const interval = 1000 / fps;
        if (time - previousTime >= interval) {
          const delta = previousTime === 0 ? interval / 1000 : Math.min(0.08, (time - previousTime) / 1000);
          previousTime = time;
          if (!current.paused && !current.reduceMotion) elapsed += delta * current.timeScale;
          renderOnce();
        }
        frameRef.current = requestAnimationFrame(animate);
      };

      const stopLoop = () => {
        if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
        previousTime = 0;
      };
      const startLoop = () => {
        stopLoop();
        const current = propsRef.current;
        if (!disposed && visible && !document.hidden && !current.paused && !current.reduceMotion) {
          frameRef.current = requestAnimationFrame(animate);
        } else {
          renderOnce();
        }
      };
      drawRef.current = renderOnce;
      loopRef.current = startLoop;

      const onVisibility = () => startLoop();
      const onContextLost = (event: Event) => {
        event.preventDefault();
        contextLostRef.current = true;
        setContextLost(true);
        stopLoop();
      };
      const onContextRestored = () => {
        contextLostRef.current = false;
        setContextLost(false);
        resize();
        startLoop();
      };
      const onControlChange = () => renderOnce();
      canvas.addEventListener('webglcontextlost', onContextLost, false);
      canvas.addEventListener('webglcontextrestored', onContextRestored, false);
      controls.addEventListener('change', onControlChange);
      document.addEventListener('visibilitychange', onVisibility);
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(canvas);
      intersectionObserver = new IntersectionObserver((entries) => {
        visible = entries[0]?.isIntersecting ?? true;
        startLoop();
      }, { threshold: 0.02 });
      intersectionObserver.observe(canvas);
      resize();
      startLoop();

      return () => {
        disposed = true;
        if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
        document.removeEventListener('visibilitychange', onVisibility);
        canvas.removeEventListener('webglcontextlost', onContextLost);
        canvas.removeEventListener('webglcontextrestored', onContextRestored);
        controls.removeEventListener('change', onControlChange);
        controls.dispose();
        resizeObserver?.disconnect();
        intersectionObserver?.disconnect();
        disposeObject(scene);
        renderer.dispose();
        runtimeRef.current = null;
        drawRef.current = null;
        loopRef.current = null;
      };
    } catch {
      setFallback(true);
      return undefined;
    }
  // A quality change rebuilds a bounded scene; model parameters update in the separate effect.
  }, [quality]);

  useEffect(() => {
    drawRef.current?.();
    loopRef.current?.();
  }, [lesson.id, lesson.scene, params.stabilityLimit, params.radiusFloor, params.eccentricity, params.particleCount, params.brightnessFloor, params.selectedBody, params.handoff, params.orbitRadius, report?.status, paused, timeScale, reduceMotion]);

  return (
    <div className="universe-renderer" aria-label="操作可能な手続き生成の宇宙モデル">
      <canvas ref={canvasRef} className="universe-canvas" tabIndex={0} role="img" aria-label={`${lesson.title}に連動する教育用宇宙モデル。ドラッグで回転、ピンチまたはスクロールで拡大縮小できます。`} />
      <div className="universe-a11y-summary" aria-live="polite">
        {report?.headline ?? '手続き生成された銀河。表示中のモデルは観測データではありません。'}
      </div>
      {fallback && <div className="canvas-fallback"><span className="fallback-mark">◌</span><strong>3D描画を利用できません</strong><p>WebGLを利用できない環境です。教材、コード、数値の状態は下のテキスト表示から引き続き利用できます。</p></div>}
      {contextLost && <div className="canvas-fallback context-recovery"><span className="fallback-mark">↻</span><strong>描画コンテキストが一時停止しました</strong><p>ブラウザが復元を試みています。復元しない場合も、ページを再読み込みすれば再開できます。</p></div>}
    </div>
  );
});
