import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import wasmMeta from "../wasm-manifest.json";

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
type Core = {
  memory: WebAssembly.Memory;
  cosmic_generate(mode: number, count: number, seed: number): number;
  galaxy_ptr(): number;
  galaxy_len(): number;
};
let corePromise: Promise<Core> | undefined;
async function core() {
  corePromise ??= fetch(wasmMeta.url)
    .then(async (r) => {
      if (!r.ok) throw Error("星の計算を読み込めませんでした。");
      return (await WebAssembly.instantiate(await r.arrayBuffer(), {})).instance
        .exports as unknown as Core;
    })
    .catch((e) => {
      corePromise = undefined;
      throw e;
    });
  return corePromise;
}
const starVertex = `
attribute float luminosity;
uniform float time;uniform float mode;uniform float pixelRatio;
varying vec3 tint;varying float intensity;
void main(){
 vec3 p=position;float r=length(p.xy);
 float spin=mode==3.0?0.0:time*(mode==1.0?.055:.006)/(r+.23);
 float c=cos(spin),s=sin(spin);p.xy=mat2(c,s,-s,c)*p.xy;
 vec4 v=modelViewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*v;
 float bright=pow(luminosity,6.0);
 gl_PointSize=clamp((.65+bright*2.8)*pixelRatio*3.7/max(.6,-v.z),.65,5.5*pixelRatio);
 float random=fract(sin(dot(position.xy,vec2(12.9898,78.233)))*43758.5453);
 vec3 warm=vec3(1.0,.58,.23),cool=vec3(.22,.47,1.0);
 tint=mix(warm,cool,smoothstep(.12,.55,r)*.87);
 if(mode==1.0)tint=mix(vec3(1.0,.27,.06),vec3(1.0,.86,.58),smoothstep(.24,.65,r));
 if(mode==3.0)tint=mix(vec3(.68,.78,1.),vec3(1.,.85,.68),random);
 if(mode==0.0&&r>.27&&random>.96)tint=vec3(1.0,.46,.56);
 intensity=(.07+luminosity*.5)*(mode==3.0?.75:mode==1.0?.13:mix(.09,.8,smoothstep(.01,.28,r)));
}`;
const starFragment = `
uniform float brightness;varying vec3 tint;varying float intensity;
void main(){float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;
 float glow=exp(-d*d*5.8);gl_FragColor=vec4(tint*intensity*brightness,glow);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
const planeVertex = `varying vec2 point;void main(){point=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const noise = `
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=noise(p)*a;p=mat2(.8,.6,-.6,.8)*p*2.08+17.3;a*=.5;}return v;}`;
const diskFragment = `
varying vec2 point;uniform float time;uniform float seed;uniform float mode;uniform float brightness;uniform float layer;
${noise}
void main(){vec2 p=point;float r=length(p);if(r>1.22)discard;float a=atan(p.y,p.x);
 float n=fbm(p*16.+seed*.03);float fine=fbm(p*57.+seed*.07);
 vec3 col;float density;
 if(mode==1.){float orbit=a-time*.05/(r+.2);float lanes=.55+.45*sin(r*120.+orbit*13.+n*8.);
 density=smoothstep(.23,.28,r)*(1.-smoothstep(.8,1.1,r))*exp(-r*1.2)*(.25+n*.8)*lanes;
 col=mix(vec3(1.,.18,.025),vec3(1.,.85,.55),pow(1.-r,1.4));
 }else{float spiral=a*2.-r*11.4-time*.012/(r+.3);float arm=pow(.5+.5*cos(spiral+n*2.2),2.);
 float dust=smoothstep(.42,.63,fbm(p*27.+2.))*(.4+.6*arm);
 float cloud=fbm(p*35.+vec2(seed*.02,seed*.04));
 density=exp(-r*2.8)*(.32+arm*1.8)*(.2+cloud*1.8)*(1.-dust*.78);
 density+=exp(-r*r*68.)*.55;density*=1.-smoothstep(.87,1.21,r);
 col=mix(vec3(1.,.53,.21),vec3(.10,.29,.72),smoothstep(.08,.39,r));
 col=mix(col,vec3(.9,.24,.42),arm*pow(fine,4.)*.65);
 }
 gl_FragColor=vec4(col*brightness,density*layer*(mode==1.?2.5:1.));
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}`;
const glowFragment = `varying vec2 point;uniform float brightness;uniform float mode;
void main(){float r=length(point);float alpha;vec3 c;
if(mode==1.){alpha=exp(-pow((r-.226)*75.,2.))*.8+exp(-pow((r-.235)*22.,2.))*.14;c=vec3(1.,.64,.28);}
else{alpha=exp(-r*r*38.)*.24;c=vec3(1.,.78,.5);}
gl_FragColor=vec4(c*brightness,alpha);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`;

/** カメラと描画の境界。毎フレームの座標生成を避け、最大24fps・画素数上限を守る。 */
export function createUniverse(
  canvas: HTMLCanvasElement,
  initial: UniverseOptions,
  onReady: () => void,
  onError: (message: string) => void,
  interactive = true,
  onViewChange?: (view: View3D) => void,
): UniverseHandle {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: false,
    antialias: false,
    powerPreference: "low-power",
    preserveDrawingBuffer: true,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.setClearColor(0x02040a, 1);
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(42, 1, 0.05, 40);
  camera.up.set(0, 0, 1);
  camera.position.set(1.1, -2.8, 2.6);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = false;
  controls.enabled = interactive;
  controls.enablePan = false;
  controls.minDistance = 1.6;
  controls.maxDistance = 8;
  controls.maxTargetRadius = 0.45;
  controls.autoRotateSpeed = 0.22;
  controls.minPolarAngle = 0.04;
  controls.maxPolarAngle = Math.PI - 0.04;
  controls.zoomSpeed = 0.65;
  const system = new THREE.Group();
  scene.add(system);
  let options = { ...initial },
    time = 0,
    raf = 0,
    last = 0,
    visible = true,
    disposed = false,
    contextLost = false,
    dirty = true,
    generation = 0,
    pixelRatio = 1;
  let field: THREE.Points | undefined;
  // 低GPU向けの適応劣化: 描画間隔が遅い状態が続いたら粒子数を一度だけ落とす。
  let degraded = false,
    slowFrames = 0;
  const animatedMaterials: THREE.ShaderMaterial[] = [];
  const glow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 1.5),
    new THREE.ShaderMaterial({
      vertexShader: planeVertex,
      fragmentShader: glowFragment,
      uniforms: {
        brightness: { value: initial.brightness },
        mode: { value: initial.mode },
      },
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    }),
  );
  glow.renderOrder = 8;
  scene.add(glow);
  const reduced = matchMedia("(prefers-reduced-motion: reduce)");
  function release(object: THREE.Object3D) {
    object.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      if (m.material) {
        for (const material of Array.isArray(m.material)
          ? m.material
          : [m.material])
          material.dispose();
      }
    });
  }
  function points(data: Float32Array, mode: number) {
    const geometry = new THREE.BufferGeometry(),
      positions = new Float32Array((data.length / 4) * 3),
      light = new Float32Array(data.length / 4);
    for (let i = 0; i < light.length; i++) {
      positions.set(data.subarray(i * 4, i * 4 + 3), i * 3);
      light[i] = data[i * 4 + 3];
    }
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("luminosity", new THREE.BufferAttribute(light, 1));
    const material = new THREE.ShaderMaterial({
      vertexShader: starVertex,
      fragmentShader: starFragment,
      uniforms: {
        time: { value: 0 },
        mode: { value: mode },
        pixelRatio: { value: pixelRatio },
        brightness: { value: options.brightness },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    animatedMaterials.push(material);
    return new THREE.Points(geometry, material);
  }
  async function rebuild() {
    const token = ++generation;
    try {
      const wasm = await core();
      if (disposed || token !== generation) return;
      const baseCount = !interactive
        ? 12000
        : options.quality === "high"
          ? 32000
          : 22000;
      wasm.cosmic_generate(
        options.mode,
        degraded ? Math.round(baseCount * 0.45) : baseCount,
        options.seed,
      );
      if (degraded) canvas.dataset.degraded = "true";
      else delete canvas.dataset.degraded;
      const data = new Float32Array(
        wasm.memory.buffer,
        wasm.galaxy_ptr(),
        wasm.galaxy_len(),
      ).slice();
      release(system);
      system.clear();
      animatedMaterials.length = 0;
      system.add(points(data, options.mode));
      if (field) {
        scene.remove(field);
        release(field);
      }
      wasm.cosmic_generate(3, interactive ? 2200 : 1200, 191);
      field = points(
        new Float32Array(
          wasm.memory.buffer,
          wasm.galaxy_ptr(),
          wasm.galaxy_len(),
        ).slice(),
        3,
      );
      scene.add(field);
      for (let i = 0; i < 3; i++) {
        const material = new THREE.ShaderMaterial({
          vertexShader: planeVertex,
          fragmentShader: diskFragment,
          uniforms: {
            time: { value: time },
            seed: { value: options.seed + i * 3 },
            mode: { value: options.mode },
            brightness: { value: options.brightness },
            layer: { value: options.mode === 1 ? 0.23 : 0.75 },
          },
          transparent: true,
          depthWrite: false,
          blending: THREE.NormalBlending,
          side: THREE.DoubleSide,
        });
        animatedMaterials.push(material);
        const disk = new THREE.Mesh(
          new THREE.PlaneGeometry(2.5, 2.5),
          material,
        );
        disk.position.z = (i - 1) * 0.025;
        system.add(disk);
      }
      if (options.mode === 1) {
        const hole = new THREE.Mesh(
          new THREE.SphereGeometry(0.22, 40, 28),
          new THREE.MeshBasicMaterial({ color: 0x000000 }),
        );
        system.add(hole);
      }
      (glow.material as THREE.ShaderMaterial).uniforms.mode.value =
        options.mode;
      draw();
      onReady();
      invalidate();
    } catch {
      if (!disposed)
        onError(
          "三次元の星を読み込めませんでした。観測資料の表示は利用できます。",
        );
    }
  }
  function moving() {
    return !options.paused && !reduced.matches;
  }
  function draw() {
    controls.autoRotate = options.autoCamera && moving();
    controls.update(1 / 24);
    controls.target.clampLength(0, 0.45);
    for (const m of animatedMaterials) {
      m.uniforms.time.value = time;
      m.uniforms.brightness.value = options.brightness;
      m.uniforms.pixelRatio && (m.uniforms.pixelRatio.value = pixelRatio);
    }
    (glow.material as THREE.ShaderMaterial).uniforms.brightness.value =
      options.brightness;
    glow.quaternion.copy(camera.quaternion);
    renderer.render(scene, camera);
  }
  function tick(now: number) {
    raf = 0;
    if (disposed || contextLost || !visible || document.hidden) return;
    if (now - last >= 1000 / 24) {
      const dt = now - last;
      if (moving()) time += Math.min(dt / 1000, 0.1) * options.speed;
      last = now;
      dirty = false;
      draw();
      // 実フレーム間隔が約58ms超で続く環境では、星の数を落として滑らかさを守る。
      if (interactive && moving()) {
        slowFrames = dt > 58 ? slowFrames + 1 : Math.max(0, slowFrames - 2);
        if (!degraded && slowFrames >= 100) {
          degraded = true;
          slowFrames = 0;
          void rebuild();
        }
      }
    }
    if ((moving() || dirty) && !raf) raf = requestAnimationFrame(tick);
  }
  function invalidate() {
    if (disposed || contextLost) return;
    dirty = true;
    if (!raf && visible && !document.hidden) raf = requestAnimationFrame(tick);
  }
  function resize() {
    const b = canvas.getBoundingClientRect();
    const cap = !interactive
      ? 800000
      : options.quality === "high"
        ? 1800000
        : 1200000;
    pixelRatio = Math.min(
      devicePixelRatio || 1,
      1.6,
      Math.sqrt(cap / Math.max(1, b.width * b.height)),
    );
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(Math.max(1, b.width), Math.max(1, b.height), false);
    camera.aspect = b.width / Math.max(1, b.height);
    camera.updateProjectionMatrix();
    if (field) draw();
    invalidate();
  }
  function visibility() {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else invalidate();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  const io = new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    if (visible) invalidate();
    else {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  });
  io.observe(canvas);
  const readView = () => {
    const offset = camera.position.clone().sub(controls.target),
      distance = offset.length();
    return {
      x: offset.x,
      y: offset.y,
      z: offset.z,
      distance,
      azimuth: (Math.atan2(offset.y, offset.x) * 180) / Math.PI,
      elevation: (Math.asin(offset.z / distance) * 180) / Math.PI,
    };
  };
  const inputEnd = () => onViewChange?.(readView());
  controls.addEventListener("end", inputEnd);
  controls.addEventListener("change", invalidate);
  document.addEventListener("visibilitychange", visibility);
  reduced.addEventListener("change", invalidate);
  const lost = (event: Event) => {
    event.preventDefault();
    contextLost = true;
    cancelAnimationFrame(raf);
    raf = 0;
    onError("描画が一時停止しました。ページを再読み込みしてください。");
  };
  canvas.addEventListener("webglcontextlost", lost);
  resize();
  void rebuild();
  return {
    update(next) {
      const changed =
        next.mode !== options.mode ||
        next.seed !== options.seed ||
        next.quality !== options.quality;
      const sizeChanged = next.quality !== options.quality;
      if (sizeChanged) {
        // 画質設定が変わったら適応劣化を解除して再評価する。
        degraded = false;
        slowFrames = 0;
      }
      options = { ...next };
      if (changed) void rebuild();
      if (sizeChanged) resize();
      invalidate();
    },
    view(v) {
      camera.position.set(v.x, v.y, v.z);
      controls.target.set(0, 0, 0);
      controls.update();
      invalidate();
    },
    readView() {
      const offset = camera.position.clone().sub(controls.target),
        distance = offset.length();
      return {
        x: offset.x,
        y: offset.y,
        z: offset.z,
        distance,
        azimuth: (Math.atan2(offset.y, offset.x) * 180) / Math.PI,
        elevation: (Math.asin(offset.z / distance) * 180) / Math.PI,
      };
    },
    image() {
      draw();
      return canvas.toDataURL("image/png");
    },
    dispose() {
      disposed = true;
      generation++;
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      controls.removeEventListener("change", invalidate);
      controls.removeEventListener("end", inputEnd);
      controls.dispose();
      document.removeEventListener("visibilitychange", visibility);
      reduced.removeEventListener("change", invalidate);
      canvas.removeEventListener("webglcontextlost", lost);
      release(scene);
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
