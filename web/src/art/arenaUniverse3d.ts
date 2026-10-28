import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export type UniverseOptions = {
  mode: number;
  seed: number;
  brightness: number;
  paused: boolean;
  autoCamera: boolean;
  quality: "standard" | "high";
  speed: number;
};
export type View3D = {
  x: number;
  y: number;
  z: number;
  azimuth: number;
  elevation: number;
  distance: number;
};
export type UniverseHandle = {
  update(options: UniverseOptions): void;
  view(view: { x: number; y: number; z: number }): void;
  readView(): View3D;
  image(): string;
  dispose(): void;
};

function seeded(seed:number){let x=seed>>>0||1;return ()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return (x>>>0)/4294967296;};}

// ── 共有マテリアル・シェーダー ──────────────────────────────────────────────

const starSpriteTexture = (() => {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.2, "rgba(255,255,255,0.8)");
  g.addColorStop(0.5, "rgba(255,255,255,0.2)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
})();

// ── 星の色（温度に基づく） ──────────────────────────────────────────────────

function starColor(temp: number): THREE.Color {
  // temp: 0 (赤) → 1 (青白)
  const c = new THREE.Color();
  if (temp < 0.3) {
    c.setRGB(1.0, 0.4 + temp * 1.5, 0.2);
  } else if (temp < 0.6) {
    c.setRGB(1.0, 0.8 + (temp - 0.3) * 0.67, 0.5 + (temp - 0.3) * 1.0);
  } else {
    c.setRGB(0.7 + (temp - 0.6) * 0.5, 0.9, 1.0);
  }
  return c;
}

// ── 展示1: 太陽系 ───────────────────────────────────────────────────────────

interface PlanetData {
  name: string;
  radius: number;
  distance: number;
  orbitSpeed: number;
  rotationSpeed: number;
  color: THREE.Color;
  hasRing?: boolean;
  ringInner?: number;
  ringOuter?: number;
  ringColor?: THREE.Color;
}

const PLANETS: PlanetData[] = [
  { name: "水星", radius: 0.38, distance: 8, orbitSpeed: 4.15, rotationSpeed: 0.004, color: new THREE.Color(0.65, 0.65, 0.65) },
  { name: "金星", radius: 0.95, distance: 11, orbitSpeed: 1.62, rotationSpeed: 0.002, color: new THREE.Color(0.9, 0.8, 0.55) },
  { name: "地球", radius: 1.0, distance: 15, orbitSpeed: 1.0, rotationSpeed: 1.0, color: new THREE.Color(0.2, 0.4, 0.9) },
  { name: "火星", radius: 0.53, distance: 19, orbitSpeed: 0.53, rotationSpeed: 0.97, color: new THREE.Color(0.8, 0.3, 0.2) },
  { name: "木星", radius: 3.0, distance: 26, orbitSpeed: 0.084, rotationSpeed: 2.4, color: new THREE.Color(0.85, 0.7, 0.5) },
  { name: "土星", radius: 2.5, distance: 35, orbitSpeed: 0.034, rotationSpeed: 2.2, color: new THREE.Color(0.9, 0.85, 0.7), hasRing: true, ringInner: 3.5, ringOuter: 6.0, ringColor: new THREE.Color(0.7, 0.65, 0.55) },
  { name: "天王星", radius: 1.8, distance: 44, orbitSpeed: 0.012, rotationSpeed: 1.4, color: new THREE.Color(0.5, 0.7, 0.8) },
  { name: "海王星", radius: 1.7, distance: 52, orbitSpeed: 0.006, rotationSpeed: 1.5, color: new THREE.Color(0.3, 0.3, 0.7) },
];

function createSolarSystem(_scene: THREE.Scene, seed: number, brightness: number): THREE.Group {
  const group = new THREE.Group();
  const random = seeded(seed);

  // 太陽
  const sunGeo = new THREE.SphereGeometry(4, 64, 64);
  const sunMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.9, 0.4) });
  const sun = new THREE.Mesh(sunGeo, sunMat);
  group.add(sun);

  // 太陽の光
  const sunLight = new THREE.PointLight(0xffffee, 2, 200);
  sunLight.position.set(0, 0, 0);
  group.add(sunLight);

  // 環境光（微弱）
  const ambient = new THREE.AmbientLight(0x222233, 0.3);
  group.add(ambient);

  // 惑星
  const planetMeshes: { mesh: THREE.Mesh; data: PlanetData; orbitGroup: THREE.Group; ring?: THREE.Mesh }[] = [];

  for (const p of PLANETS) {
    const orbitGroup = new THREE.Group();
    group.add(orbitGroup);

    const geo = new THREE.SphereGeometry(p.radius, 32, 32);
    const mat = new THREE.MeshStandardMaterial({
      color: p.color,
      roughness: 0.7,
      metalness: 0.1,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.x = p.distance;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    orbitGroup.add(mesh);

    // 環
    let ring: THREE.Mesh | undefined;
    if (p.hasRing && p.ringInner && p.ringOuter && p.ringColor) {
      const ringGeo = new THREE.RingGeometry(p.ringInner, p.ringOuter, 64);
      const ringMat = new THREE.MeshBasicMaterial({
        color: p.ringColor,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.6,
      });
      ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2.5;
      mesh.add(ring);
    }

    // 軌道線
    const orbitGeo = new THREE.RingGeometry(p.distance - 0.05, p.distance + 0.05, 128);
    const orbitMat = new THREE.MeshBasicMaterial({ color: 0x334455, side: THREE.DoubleSide, transparent: true, opacity: 0.15 });
    const orbitLine = new THREE.Mesh(orbitGeo, orbitMat);
    orbitLine.rotation.x = Math.PI / 2;
    group.add(orbitLine);

    planetMeshes.push({ mesh, data: p, orbitGroup, ring });
  }

  // 星の背景
  const starCount = 2000;
  const starGeo = new THREE.BufferGeometry();
  const starPos = new Float32Array(starCount * 3);
  const starCol = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const r = 150 + random() * 100;
    const theta = random() * Math.PI * 2;
    const phi = Math.acos(2 * random() - 1);
    starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    starPos[i * 3 + 2] = r * Math.cos(phi);
    const temp = random();
    const c = starColor(temp);
    starCol[i * 3] = c.r;
    starCol[i * 3 + 1] = c.g;
    starCol[i * 3 + 2] = c.b;
  }
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute("color", new THREE.BufferAttribute(starCol, 3));
  const starMat = new THREE.PointsMaterial({
    size: 0.8,
    vertexColors: true,
    map: starSpriteTexture,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
  });
  const stars = new THREE.Points(starGeo, starMat);
  group.add(stars);

  group.userData = { planetMeshes, sun, brightness };
  return group;
}

// ── 展示2: 銀河とブラックホール ────────────────────────────────────────────

function createGalaxy(_scene: THREE.Scene, seed: number, brightness: number, withBlackHole: boolean): THREE.Group {
  const group = new THREE.Group();
  const random = seeded(seed);
  const count = 15000;

  // 星の配置（渦巻き）
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);

  const arms = 4;
  const radius = 50;
  const spin = 0.12;
  const randomness = 0.3;

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const r = random() * radius;
    const branchAngle = ((i % arms) / arms) * Math.PI * 2;
    const spinAngle = r * spin;

    // 中心からの距離に応じて、円盤の厚みを変化
    const diskThickness = 0.5 + Math.exp(-r * 0.03) * 3;

    const randomX = (random() - 0.5) * randomness * r * 0.3;
    const randomY = (random() - 0.5) * diskThickness;
    const randomZ = (random() - 0.5) * randomness * r * 0.3;

    const angle = branchAngle + spinAngle;
    positions[i3] = Math.cos(angle) * r + randomX;
    positions[i3 + 1] = randomY;
    positions[i3 + 2] = Math.sin(angle) * r + randomZ;

    // 色：中心は黄色く、外側は青白く
    const distRatio = r / radius;
    const c = new THREE.Color();
    if (distRatio < 0.3) {
      c.setRGB(1.0, 0.85, 0.5); // 中心：黄色
    } else if (distRatio < 0.6) {
      c.setRGB(0.8, 0.7, 1.0); // 中間：白
    } else {
      c.setRGB(0.4, 0.5, 1.0); // 外側：青
    }
    colors[i3] = c.r;
    colors[i3 + 1] = c.g;
    colors[i3 + 2] = c.b;

    sizes[i] = random() * 0.5 + 0.2;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

  const mat = new THREE.PointsMaterial({
    size: 0.6,
    vertexColors: true,
    map: starSpriteTexture,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geo, mat);
  group.add(points);

  // 降着円盤（ブラックホール付きの場合）
  if (withBlackHole) {
    // ブラックホール（暗い中心）
    const bhGeo = new THREE.SphereGeometry(1.5, 32, 32);
    const bhMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const bh = new THREE.Mesh(bhGeo, bhMat);
    group.add(bh);

    // 降着円盤
    const diskCount = 5000;
    const diskPos = new Float32Array(diskCount * 3);
    const diskCol = new Float32Array(diskCount * 3);

    for (let i = 0; i < diskCount; i++) {
      const i3 = i * 3;
      const r = 2 + random() * 15;
      const angle = random() * Math.PI * 2;
      const y = (random() - 0.5) * 0.3 * (1 + r * 0.05);
      diskPos[i3] = Math.cos(angle) * r;
      diskPos[i3 + 1] = y;
      diskPos[i3 + 2] = Math.sin(angle) * r;

      // 温度に応じた色
      const temp = 1 - r / 17;
      diskCol[i3] = 1.0;
      diskCol[i3 + 1] = 0.3 + temp * 0.5;
      diskCol[i3 + 2] = temp * 0.3;
    }

    const diskGeo = new THREE.BufferGeometry();
    diskGeo.setAttribute("position", new THREE.BufferAttribute(diskPos, 3));
    diskGeo.setAttribute("color", new THREE.BufferAttribute(diskCol, 3));
    const diskMat = new THREE.PointsMaterial({
      size: 0.3,
      vertexColors: true,
      map: starSpriteTexture,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const disk = new THREE.Points(diskGeo, diskMat);
    disk.rotation.x = 0;
    group.add(disk);

    // 光のリング（重力レンズの近似）
    const ringGeo = new THREE.RingGeometry(1.6, 1.8, 64);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffaa33,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.4,
      blending: THREE.AdditiveBlending,
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    group.add(ring);

    group.userData = { bh, disk, ring };
  }

  group.userData = { ...group.userData, brightness };
  return group;
}

// ── 展示3: 星団と軌道 ─────────────────────────────────────────────────────

function createOrbit(_scene: THREE.Scene, seed: number, brightness: number): THREE.Group {
  const group = new THREE.Group();
  const random = seeded(seed);

  // 星団（球状星団）
  const clusterCount = 5000;
  const positions = new Float32Array(clusterCount * 3);
  const colors = new Float32Array(clusterCount * 3);

  for (let i = 0; i < clusterCount; i++) {
    const i3 = i * 3;
    const r = Math.pow(random(), 0.5) * 15;
    const theta = random() * Math.PI * 2;
    const phi = Math.acos(2 * random() - 1);
    positions[i3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i3 + 2] = r * Math.cos(phi);

    const c = new THREE.Color();
    c.setHSL(0.1 + random() * 0.1, 0.3, 0.6 + random() * 0.3);
    colors[i3] = c.r;
    colors[i3 + 1] = c.g;
    colors[i3 + 2] = c.b;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.3,
    vertexColors: true,
    map: starSpriteTexture,
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
  });
  const cluster = new THREE.Points(geo, mat);
  group.add(cluster);

  // 連星（2つの星が互いに回る）
  const binaryGroup = new THREE.Group();
  const star1Geo = new THREE.SphereGeometry(1.5, 32, 32);
  const star1Mat = new THREE.MeshStandardMaterial({ color: 0xffaa33, emissive: 0x442200 });
  const star1 = new THREE.Mesh(star1Geo, star1Mat);
  const star2Geo = new THREE.SphereGeometry(1.0, 32, 32);
  const star2Mat = new THREE.MeshStandardMaterial({ color: 0x6688ff, emissive: 0x001133 });
  const star2 = new THREE.Mesh(star2Geo, star2Mat);

  star1.position.x = -5;
  star2.position.x = 5;
  binaryGroup.add(star1);
  binaryGroup.add(star2);

  const binaryLight = new THREE.PointLight(0xffffff, 0.5, 50);
  binaryGroup.add(binaryLight);

  group.add(binaryGroup);

  // 軌道線
  const orbitGeo = new THREE.RingGeometry(4.9, 5.1, 64);
  const orbitMat = new THREE.MeshBasicMaterial({ color: 0x334466, side: THREE.DoubleSide, transparent: true, opacity: 0.2 });
  const orbitLine = new THREE.Mesh(orbitGeo, orbitMat);
  orbitLine.rotation.x = Math.PI / 2;
  binaryGroup.add(orbitLine);

  // 星の背景
  const bgCount = 3000;
  const bgPos = new Float32Array(bgCount * 3);
  for (let i = 0; i < bgCount; i++) {
    const r = 100 + random() * 100;
    const theta = random() * Math.PI * 2;
    const phi = Math.acos(2 * random() - 1);
    bgPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    bgPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    bgPos[i * 3 + 2] = r * Math.cos(phi);
  }
  const bgGeo = new THREE.BufferGeometry();
  bgGeo.setAttribute("position", new THREE.BufferAttribute(bgPos, 3));
  const bgMat = new THREE.PointsMaterial({ size: 0.5, color: 0x888899, map: starSpriteTexture, transparent: true, opacity: 0.5, depthWrite: false });
  const bgStars = new THREE.Points(bgGeo, bgMat);
  group.add(bgStars);

  group.userData = { cluster, binaryGroup, star1, star2, brightness };
  return group;
}

// ── 展示4: 星雲 ───────────────────────────────────────────────────────────

function createNebula(_scene: THREE.Scene, seed: number, brightness: number): THREE.Group {
  const group = new THREE.Group();
  const random = seeded(seed);

  // 星雲の層（複数の透明な平面）
  const layers = 8;
  for (let l = 0; l < layers; l++) {
    const count = 3000;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const sizes = new Float32Array(count);

    const layerRadius = 30 + l * 5;
    const hue = 0.65 + l * 0.02;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const r = random() * layerRadius;
      const angle = random() * Math.PI * 2;
      const y = (random() - 0.5) * 8 * Math.exp(-r * 0.05);
      positions[i3] = Math.cos(angle) * r;
      positions[i3 + 1] = y;
      positions[i3 + 2] = Math.sin(angle) * r;

      const c = new THREE.Color();
      c.setHSL(hue + random() * 0.05, 0.5, 0.4 + random() * 0.2);
      colors[i3] = c.r;
      colors[i3 + 1] = c.g;
      colors[i3 + 2] = c.b;

      sizes[i] = random() * 2 + 0.5;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    geo.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

    const mat = new THREE.PointsMaterial({
      size: 1.0,
      vertexColors: true,
      map: starSpriteTexture,
      transparent: true,
      opacity: 0.15,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geo, mat);
    points.position.z = -l * 3;
    group.add(points);
  }

  // 内側の星
  const innerCount = 2000;
  const innerPos = new Float32Array(innerCount * 3);
  const innerCol = new Float32Array(innerCount * 3);
  for (let i = 0; i < innerCount; i++) {
    const i3 = i * 3;
    const r = random() * 25;
    const angle = random() * Math.PI * 2;
    innerPos[i3] = Math.cos(angle) * r;
    innerPos[i3 + 1] = (random() - 0.5) * 3;
    innerPos[i3 + 2] = Math.sin(angle) * r;

    const temp = random();
    const c = starColor(temp);
    innerCol[i3] = c.r;
    innerCol[i3 + 1] = c.g;
    innerCol[i3 + 2] = c.b;
  }
  const innerGeo = new THREE.BufferGeometry();
  innerGeo.setAttribute("position", new THREE.BufferAttribute(innerPos, 3));
  innerGeo.setAttribute("color", new THREE.BufferAttribute(innerCol, 3));
  const innerMat = new THREE.PointsMaterial({
    size: 0.4,
    vertexColors: true,
    map: starSpriteTexture,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
  });
  const innerStars = new THREE.Points(innerGeo, innerMat);
  group.add(innerStars);

  // 背景の星
  const bgCount = 5000;
  const bgPos = new Float32Array(bgCount * 3);
  for (let i = 0; i < bgCount; i++) {
    const r = 120 + random() * 100;
    const theta = random() * Math.PI * 2;
    const phi = Math.acos(2 * random() - 1);
    bgPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    bgPos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    bgPos[i * 3 + 2] = r * Math.cos(phi);
  }
  const bgGeo = new THREE.BufferGeometry();
  bgGeo.setAttribute("position", new THREE.BufferAttribute(bgPos, 3));
  const bgMat = new THREE.PointsMaterial({ size: 0.4, color: 0x666677, map: starSpriteTexture, transparent: true, opacity: 0.4, depthWrite: false });
  const bgStars = new THREE.Points(bgGeo, bgMat);
  group.add(bgStars);

  group.userData = { brightness };
  return group;
}

// ── 展示5: 星の流れ・星塵 ─────────────────────────────────────────────────

function createParticles(_scene: THREE.Scene, seed: number, brightness: number): THREE.Group {
  const group = new THREE.Group();
  const random = seeded(seed);

  const count = 10000;
  const positions = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const phases = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    const r = 5 + random() * 40;
    const angle = random() * Math.PI * 2;
    const y = (random() - 0.5) * 10;

    positions[i3] = Math.cos(angle) * r;
    positions[i3 + 1] = y;
    positions[i3 + 2] = Math.sin(angle) * r;

    // 速度：中心方向 + 回転
    const tangential = 0.02 / Math.max(r * 0.1, 0.5);
    velocities[i3] = -Math.sin(angle) * tangential;
    velocities[i3 + 1] = (random() - 0.5) * 0.01;
    velocities[i3 + 2] = Math.cos(angle) * tangential;

    const temp = random();
    const c = starColor(temp);
    colors[i3] = c.r;
    colors[i3 + 1] = c.g;
    colors[i3 + 2] = c.b;

    sizes[i] = random() * 0.8 + 0.2;
    phases[i] = random() * Math.PI * 2;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geo.setAttribute("size", new THREE.BufferAttribute(sizes, 1));

  const mat = new THREE.PointsMaterial({
    size: 0.4,
    vertexColors: true,
    map: starSpriteTexture,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geo, mat);
  group.add(points);

  // 中心の重力源（暗い星）
  const centerGeo = new THREE.SphereGeometry(1.0, 32, 32);
  const centerMat = new THREE.MeshBasicMaterial({ color: 0x111122 });
  const center = new THREE.Mesh(centerGeo, centerMat);
  group.add(center);

  // 中心の光
  const centerLight = new THREE.PointLight(0x4466aa, 0.3, 50);
  group.add(centerLight);

  group.userData = { points, velocities, positions, phases, center, brightness };
  return group;
}

// ── メインエンジン ─────────────────────────────────────────────────────────


/** Arena 05 geometry with corrected mode changes, deterministic seeds and bounded rendering. */
export function createUniverse(canvas:HTMLCanvasElement,initial:UniverseOptions,onReady:()=>void,onError:(message:string)=>void):UniverseHandle {
 let options={...initial},disposed=false,frame=0,last=0,time=0,dirty=true;
 let group:THREE.Group|null=null;
 const scene=new THREE.Scene();scene.background=new THREE.Color(0x03050e);
 const camera=new THREE.PerspectiveCamera(55,1,.1,1000);
 let renderer:THREE.WebGLRenderer;
 try{renderer=new THREE.WebGLRenderer({canvas,antialias:false,preserveDrawingBuffer:true});}
 catch{onError('この端末では三次元表示を開始できません。ほかの宇宙の模型をお試しください。');return {update(){},view(){},readView(){return{x:0,y:0,z:0,azimuth:0,elevation:0,distance:0};},image(){return '';},dispose(){}};}
 const controls=new OrbitControls(camera,canvas);controls.enableDamping=false;controls.minDistance=12;controls.maxDistance=190;
 function disposeGroup(){group?.traverse(obj=>{const mesh=obj as THREE.Mesh;mesh.geometry?.dispose();if(mesh.material){for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])material.dispose();}});if(group)scene.remove(group);}
 function rebuild(){
  disposeGroup();time=0;
  switch(options.mode){
   case 0:group=createSolarSystem(scene,options.seed,options.brightness);camera.position.set(0,35,85);break;
   case 1:group=createGalaxy(scene,options.seed,options.brightness,true);camera.position.set(0,48,75);break;
   case 2:group=createOrbit(scene,options.seed,options.brightness);camera.position.set(0,24,65);break;
   case 3:group=createNebula(scene,options.seed,options.brightness);camera.position.set(0,28,105);break;
   default:group=createParticles(scene,options.seed,options.brightness);camera.position.set(0,18,65);
  }
  scene.add(group);controls.target.set(0,0,0);camera.lookAt(0,0,0);controls.update();dirty=true;
 }
 function resize(){const w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight);renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5,Math.sqrt(1500000/(w*h))));renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();dirty=true;}
 const ro=new ResizeObserver(resize);ro.observe(canvas);
 const change=()=>{dirty=true;};controls.addEventListener('change',change);
 function animate(now:number){
  if(disposed)return;frame=requestAnimationFrame(animate);
  if(document.hidden||now-last<1000/24)return;
  const dt=Math.min((now-last)/1000,.08);last=now;
  if(!options.paused){time+=dt*Math.max(0,Math.min(options.speed,2));if(group){group.rotation.y=time*(options.mode===1?.025:.04);const disk=group.userData.disk as THREE.Object3D|undefined;if(disk)disk.rotation.y=time*.3;}dirty=true;}
  if(dirty){renderer.render(scene,camera);dirty=false;}
 }
 function readView():View3D{return {x:camera.position.x,y:camera.position.y,z:camera.position.z,azimuth:controls.getAzimuthalAngle(),elevation:controls.getPolarAngle(),distance:camera.position.length()};}
 rebuild();resize();frame=requestAnimationFrame(animate);onReady();
 return {update(next){const rebuildNeeded=next.mode!==options.mode||next.seed!==options.seed;options={...next};if(rebuildNeeded)rebuild();dirty=true;},view(v){camera.position.set(v.x,v.y,v.z);camera.lookAt(0,0,0);controls.update();dirty=true;},readView,image(){renderer.render(scene,camera);return canvas.toDataURL('image/png');},dispose(){disposed=true;cancelAnimationFrame(frame);ro.disconnect();controls.removeEventListener('change',change);controls.dispose();disposeGroup();renderer.dispose();renderer.forceContextLoss();}};
}
