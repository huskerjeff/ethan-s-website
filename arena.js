// Progressive Three.js enhancement. The static CSS/SVG-like sports stage is the default.
export function initArena({ canvas, stage, toggle, reducedMotion }) {
  if (reducedMotion) {
    toggle.textContent = '3D: OFF';
    toggle.setAttribute('aria-pressed', 'false');
    toggle.title = 'Motion is disabled in your device accessibility settings.';
    toggle.disabled = true;
    return;
  }
  let enabled = true;
  let visible = false;
  let loaded = false;
  let loading = false;
  let frame = 0;
  let last = 0;
  let renderer, scene, camera, orbit;
  let pointerX = 0;
  let pointerY = 0;
  const state = () => enabled && visible && !document.hidden;
  function stop() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    last = 0;
  }
  function render() { if (renderer && scene && camera) renderer.render(scene, camera); }
  function tick(time) {
    frame = 0;
    if (!state() || !loaded) return;
    const dt = Math.min(time - (last || time), 50);
    last = time;
    orbit.rotation.y += dt * 0.00022;
    orbit.rotation.x = Math.sin(time * .00025) * .055;
    camera.position.x += (pointerX * .3 - camera.position.x) * .04;
    camera.position.y += (pointerY * .18 - camera.position.y) * .04;
    camera.lookAt(0, 0, 0);
    render();
    frame = requestAnimationFrame(tick);
  }
  function sync() {
    toggle.textContent = '3D: ' + (enabled ? 'ON' : 'OFF');
    toggle.setAttribute('aria-pressed', String(enabled));
    stage.classList.toggle('has-webgl', enabled && loaded);
    canvas.style.display = enabled && loaded ? 'block' : 'none';
    if (state() && loaded) {
      if (!frame) frame = requestAnimationFrame(tick);
    } else stop();
  }
  function fallback() {
    stop();
    enabled = false;
    canvas.style.display = 'none';
    stage.classList.remove('has-webgl');
    toggle.style.display = 'none';
    console.info('3D enhancement unavailable; the static arena remains playable.');
  }
  function resize() {
    if (!renderer || !camera || !orbit) return;
    const bounds = stage.getBoundingClientRect();
    const width = Math.max(1, Math.round(bounds.width));
    const height = Math.max(1, Math.round(bounds.height));
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, width < 500 ? 1.4 : 1.75));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    orbit.scale.setScalar(width < 420 ? .69 : width < 600 ? .82 : 1);
    render();
  }
  async function load() {
    if (loading || loaded || !enabled) return;
    loading = true;
    try {
      // This is the verified, pinned ESM path. No nonexistent .min.js URL.
      const THREE = await import('https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js');
      if (!enabled) { loading = false; return; }
      renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
      renderer.setClearColor(0x000000, 0);
      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(43, 1, .1, 100);
      camera.position.z = 9;
      scene.add(new THREE.AmbientLight(0xb2c8ff, 2.2));
      const key = new THREE.PointLight(0xffa64b, 48);
      key.position.set(3, 4, 6);
      scene.add(key);
      const fill = new THREE.PointLight(0x5fe7ff, 23);
      fill.position.set(-4, -2, 4);
      scene.add(fill);
      orbit = new THREE.Group();
      scene.add(orbit);
      const arenaRing = new THREE.Mesh(new THREE.TorusGeometry(3.05, .014, 6, 110), new THREE.MeshBasicMaterial({ color: 0x5fe7ff, transparent: true, opacity: .55 }));
      arenaRing.rotation.x = .96;
      arenaRing.rotation.y = .25;
      orbit.add(arenaRing);

      // Original procedural football: ellipsoid, white stripes, and visible laces.
      const football = new THREE.Group();
      football.position.set(-1.9, -.35, .3);
      football.rotation.z = -.32;
      const leather = new THREE.Mesh(new THREE.SphereGeometry(.72, 28, 18), new THREE.MeshStandardMaterial({ color: 0x9a4a21, roughness: .65 }));
      leather.scale.set(1.45, .72, .72);
      football.add(leather);
      for (const x of [-.66, .66]) {
        const stripe = new THREE.Mesh(new THREE.TorusGeometry(.52, .035, 6, 48), new THREE.MeshBasicMaterial({ color: 0xf9f4df }));
        stripe.rotation.y = Math.PI / 2;
        stripe.position.x = x;
        football.add(stripe);
      }
      const laceMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const laceBase = new THREE.Mesh(new THREE.BoxGeometry(.53, .028, .025), laceMat);
      laceBase.position.y = .52;
      football.add(laceBase);
      for (const x of [-.2, -.1, 0, .1, .2]) {
        const stitch = new THREE.Mesh(new THREE.BoxGeometry(.022, .025, .16), laceMat);
        stitch.position.set(x, .53, 0);
        football.add(stitch);
      }
      orbit.add(football);

      // Original basketball with three raised black seam rings.
      const basketball = new THREE.Group();
      basketball.position.set(.05, .85, .25);
      const ball = new THREE.Mesh(new THREE.SphereGeometry(.78, 32, 24), new THREE.MeshStandardMaterial({ color: 0xf1842f, roughness: .72 }));
      basketball.add(ball);
      const seamMat = new THREE.MeshBasicMaterial({ color: 0x3b241c });
      for (const axis of ['x', 'y', 'z']) {
        const seam = new THREE.Mesh(new THREE.TorusGeometry(.787, .014, 6, 90), seamMat);
        if (axis === 'x') seam.rotation.x = Math.PI / 2;
        if (axis === 'y') seam.rotation.y = Math.PI / 2;
        basketball.add(seam);
      }
      orbit.add(basketball);

      // Hockey puck with gold rim highlights.
      const puck = new THREE.Group();
      puck.position.set(1.95, -.65, .3);
      puck.rotation.z = .28;
      const disc = new THREE.Mesh(new THREE.CylinderGeometry(.64, .64, .24, 40), new THREE.MeshStandardMaterial({ color: 0x151b26, metalness: .25, roughness: .5 }));
      puck.add(disc);
      for (const y of [-.115, .115]) {
        const rim = new THREE.Mesh(new THREE.TorusGeometry(.63, .018, 6, 60), new THREE.MeshBasicMaterial({ color: 0xd8b876 }));
        rim.rotation.x = Math.PI / 2;
        rim.position.y = y;
        puck.add(rim);
      }
      orbit.add(puck);

      const starCount = stage.clientWidth < 500 ? 55 : 115;
      const stars = [];
      for (let i = 0; i < starCount; i++) stars.push((Math.random() - .5) * 18, (Math.random() - .5) * 13, -2 - Math.random() * 7);
      const starGeo = new THREE.BufferGeometry();
      starGeo.setAttribute('position', new THREE.Float32BufferAttribute(stars, 3));
      scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xa9d6ff, size: .027 })));
      loaded = true;
      resize();
      sync();
    } catch (error) {
      fallback();
    } finally {
      loading = false;
    }
  }
  toggle.addEventListener('click', () => {
    enabled = !enabled;
    sync();
    if (enabled && visible && !loaded) load();
  });
  stage.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') return;
    const bounds = stage.getBoundingClientRect();
    pointerX = ((event.clientX - bounds.left) / bounds.width - .5) * 2;
    pointerY = -((event.clientY - bounds.top) / bounds.height - .5) * 2;
  });
  stage.addEventListener('pointerleave', () => { pointerX = 0; pointerY = 0; });
  window.addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', sync);
  canvas.addEventListener('webglcontextlost', (event) => { event.preventDefault(); fallback(); });
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      visible = entries.some((entry) => entry.isIntersecting);
      if (visible && !loaded) load();
      sync();
    }, { threshold: 0.05 });
    observer.observe(stage);
  } else {
    visible = true;
    load();
  }
  sync();
}
