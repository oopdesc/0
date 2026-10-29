import * as THREE from "three";
/** Procedural sky, viewed from inside: no images, downloads, accounts or remote services. */
export function farStars(panorama = false) {
  const count = panorama ? 6500 : 1700,
    p = new Float32Array(count * 3),
    sizes = new Float32Array(count),
    colors = new Float32Array(count * 3);
  let seed = 71293;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < count; i++) {
    const band = panorama && i > 1400,
      phi = random() * Math.PI * 2;
    const latitude = band
      ? (random() + random() + random() - 1.5) * 0.19
      : Math.asin(random() * 2 - 1);
    const r = 42 + random() * 20,
      ring = Math.cos(latitude),
      x = Math.cos(phi) * ring,
      y = Math.sin(latitude),
      z = Math.sin(phi) * ring;
    // Tilt the Milky Way across the sky, so rotation reveals its depth and dark rifts.
    const tilt = 0.55,
      yy = y * Math.cos(tilt) - z * Math.sin(tilt),
      zz = y * Math.sin(tilt) + z * Math.cos(tilt);
    p.set([x * r, yy * r, zz * r], i * 3);
    sizes[i] = 0.8 + Math.pow(random(), 7) * 2.8;
    const warm = random();
    colors.set([0.75 + warm * 0.25, 0.84 + warm * 0.1, 1 - warm * 0.28], i * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(p, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("aTint", new THREE.BufferAttribute(colors, 3));
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader:
      "attribute float aSize;attribute vec3 aTint;varying vec3 tint;void main(){tint=aTint;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=aSize;}",
    fragmentShader:
      "varying vec3 tint;void main(){vec2 p=(gl_PointCoord-.5)*2.;float r=dot(p,p);if(r>1.)discard;gl_FragColor=vec4(tint,exp(-r*3.)*.64);}",
  });
  return new THREE.Points(geometry, material);
}
