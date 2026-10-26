import { useEffect, useRef } from 'react';
import { createWorld, applyPreset } from '../../core/world';
import { stepWorld, tsAccelerator } from '../../core/physics';
import { UniverseRenderer, type Camera, type RenderOptions } from '../../core/simulation/renderer';

/**
 * A dedicated, self-contained procedural galaxy for the landing view.
 * It does NOT touch the shared simulation world, so a learner's universe is
 * never overwritten by visiting the home page.
 */
export function HeroCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const el: HTMLCanvasElement = canvas;
    let renderer: UniverseRenderer;
    try {
      renderer = new UniverseRenderer(el);
    } catch {
      return; // Canvas unavailable: text content remains fully usable.
    }

    const world = createWorld(20261026);
    applyPreset(world, 'spiral');
    const camera: Camera = { x: 0, y: 0, zoom: 0.78, rotation: -0.22 };
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      || document.documentElement.dataset.motion === 'reduced';

    const opts: RenderOptions = {
      grid: false, trails: false, background: '#080b10',
      selectedId: null, hoveredId: null, compare: false,
      compareFingerprint: null, reducedMotion: reduced,
    };

    function resize() {
      const r = el.getBoundingClientRect();
      const w = Math.max(1, r.width || 900);
      const h = Math.max(1, r.height || 520);
      renderer.resize(w, h, Math.min(window.devicePixelRatio || 1, 1.6), world.seed);
      renderer.render(world, camera, opts);
    }
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    ro?.observe(el);
    window.addEventListener('resize', resize);
    resize();

    let raf = 0;
    let last = 0;
    let lastRender = 0;
    let visible = true;
    let hidden = document.hidden;

    const io = typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver((entries) => { visible = entries.some((e) => e.isIntersecting); }, { threshold: 0.01 })
      : null;
    io?.observe(el);
    const onVisibility = () => { hidden = document.hidden; };
    document.addEventListener('visibilitychange', onVisibility);

    function frame(now: number) {
      raf = 0;
      if (reduced || hidden || !visible) return;
      if (now - lastRender >= 32) {
        const dt = last === 0 ? 1 / 30 : Math.min(0.05, (now - last) / 1000);
        last = now;
        lastRender = now;
        camera.rotation += dt * 0.012;
        camera.zoom = 0.78 + Math.sin(now * 0.00013) * 0.045;
        stepWorld(world, dt, tsAccelerator);
        renderer.render(world, camera, opts);
      }
      raf = requestAnimationFrame(frame);
    }
    if (!reduced) raf = requestAnimationFrame(frame);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      ro?.disconnect();
      io?.disconnect();
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
      renderer.dispose();
    };
  }, []);

  return <canvas ref={ref} className="hero__canvas" aria-hidden="true" />;
}
