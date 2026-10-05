// Sparkplug 3D viewer. Nothing heavy loads until someone presses
// "Turn it around in 3D", so the page stays light on slow connections.
// Three.js comes from the jsDelivr CDN; no install or build step needed.

const THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.min.js";
const ADDONS = "https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/";
const MODEL_URL = "models/sparkplug-assembly.stl";

const button = document.getElementById("model-load");
const stage = document.getElementById("model-stage");

if (button && stage) {
  const still = stage.querySelector(".model__still");
  const canvas = stage.querySelector(".model__canvas");
  const status = stage.querySelector(".model__status");

  button.addEventListener("click", async () => {
    button.disabled = true;
    status.textContent = "Loading the 3D viewer…";
    try {
      // The add-ons import "three" by name; the import map in sparkplug.html points it at THREE_URL
      const THREE = await import(THREE_URL);
      const { STLLoader } = await import(ADDONS + "loaders/STLLoader.js");
      const { OrbitControls } = await import(ADDONS + "controls/OrbitControls.js");
      const geometry = await new STLLoader().loadAsync(MODEL_URL);
      start(THREE, OrbitControls, geometry);

      still.hidden = true;
      canvas.hidden = false;
      canvas.tabIndex = 0;
      status.textContent = "Drag to turn it. Scroll or pinch to zoom.";
      button.hidden = true;
      document.getElementById("model-hint").hidden = true;
    } catch (error) {
      status.textContent = "The 3D viewer couldn't load. The picture above shows the same model.";
      button.disabled = false;
    }
  });

  function start(THREE, OrbitControls, geometry) {
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const scene = new THREE.Scene();
    // Blender is Z-up, three.js is Y-up
    geometry.rotateX(-Math.PI / 2);
    geometry.center();
    geometry.computeVertexNormals();

    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({ color: 0xff8500, roughness: 0.55, metalness: 0.05 })
    );
    scene.add(mesh);

    scene.add(new THREE.HemisphereLight(0xfff8ef, 0x0077b6, 1.6));
    const sun = new THREE.DirectionalLight(0xffffff, 1.8);
    sun.position.set(150, 300, 200);
    scene.add(sun);

    const camera = new THREE.PerspectiveCamera(35, 1, 1, 5000);
    camera.position.set(150, 180, 260);

    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = true;
    controls.minDistance = 150;
    controls.maxDistance = 900;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    controls.autoRotate = !reduceMotion;
    controls.autoRotateSpeed = 1.2;
    canvas.addEventListener("pointerdown", () => (controls.autoRotate = false), { once: true });

    function resize() {
      const { clientWidth: w, clientHeight: h } = canvas;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
    new ResizeObserver(resize).observe(canvas);
    resize();

    renderer.setAnimationLoop(() => {
      controls.update();
      renderer.render(scene, camera);
    });
  }
}
