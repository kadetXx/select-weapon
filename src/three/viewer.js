import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

const loader = new GLTFLoader();
loader.setMeshoptDecoder(MeshoptDecoder);

const modelCache = new Map();

function loadModel(url) {
  if (!modelCache.has(url)) {
    modelCache.set(
      url,
      loader.loadAsync(url).then((gltf) => gltf.scene)
    );
  }
  return modelCache.get(url);
}

function frameObject(object, camera, distanceScale) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  object.position.sub(center);

  // Fit both the vertical and horizontal extent of the object into the
  // camera's frustum — on a wide canvas, fitting height alone leaves a
  // horizontally-large object looking tiny in all the unused side space.
  const verticalFov = (camera.fov * Math.PI) / 180;
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * camera.aspect);

  const distanceForHeight = size.y / 2 / Math.tan(verticalFov / 2);
  const distanceForWidth = size.x / 2 / Math.tan(horizontalFov / 2);
  const fitDistance = Math.max(distanceForHeight, distanceForWidth, size.z) || 1;

  camera.position.set(0, 0, fitDistance * distanceScale);
  camera.near = fitDistance / 100;
  camera.far = fitDistance * 100;
  camera.updateProjectionMatrix();
}

/**
 * Mounts a self-contained rotating viewer into `canvas`.
 * Multiple viewers can point at the same model URL cheaply — the geometry
 * and textures are loaded once and shared via Object3D.clone().
 */
export function createViewer(canvas, { modelUrl, distanceScale = 1.6, spinSpeed = 0.25, interactive = false, preserveDrawingBuffer = false }) {
  // preserveDrawingBuffer is only needed by viewers that get snapshotted via
  // canvas.toDataURL() outside the render loop's own frame (e.g. for a
  // slide-transition ghost image) — off by default since it costs memory
  // bandwidth on every frame.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);

  scene.add(new THREE.AmbientLight(0xffffff, 1.1));
  const key = new THREE.DirectionalLight(0xfff2d9, 2.4);
  key.position.set(3, 4, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffa93e, 1.1);
  rim.position.set(-4, -2, -3);
  scene.add(rim);

  const rig = new THREE.Group();
  scene.add(rig);

  let disposed = false;
  let currentModel = null;

  function setModel(url, modelDistanceScale = distanceScale) {
    if (currentModel) {
      rig.remove(currentModel);
      currentModel = null;
    }
    return loadModel(url).then((source) => {
      if (disposed) return;
      const model = source.clone(true);
      currentModel = model;
      rig.add(model);
      resize();
      frameObject(model, camera, modelDistanceScale);
    });
  }

  let autoRotatePaused = false;
  let resumeTimer = null;
  let dragCleanup = null;

  if (interactive) {
    const ROTATE_SPEED = 0.008;
    const PITCH_LIMIT = 1.1;
    const RESUME_DELAY = 1500;
    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    const onPointerDown = (event) => {
      dragging = true;
      autoRotatePaused = true;
      clearTimeout(resumeTimer);
      lastX = event.clientX;
      lastY = event.clientY;
      canvas.style.cursor = "grabbing";
      canvas.setPointerCapture(event.pointerId);
    };
    const onPointerMove = (event) => {
      if (!dragging) return;
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
      rig.rotation.y += dx * ROTATE_SPEED;
      rig.rotation.x = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, rig.rotation.x + dy * ROTATE_SPEED));
    };
    const onPointerUp = (event) => {
      if (!dragging) return;
      dragging = false;
      canvas.style.cursor = "grab";
      if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      resumeTimer = setTimeout(() => {
        autoRotatePaused = false;
      }, RESUME_DELAY);
    };

    canvas.style.cursor = "grab";
    canvas.style.touchAction = "none";
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);

    dragCleanup = () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
    };
  }

  function resize() {
    const { clientWidth, clientHeight } = canvas;
    if (!clientWidth || !clientHeight) return;
    renderer.setSize(clientWidth, clientHeight, false);
    camera.aspect = clientWidth / clientHeight;
    camera.updateProjectionMatrix();
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);

  setModel(modelUrl);

  function tick(deltaSeconds) {
    if (disposed) return;
    if (!autoRotatePaused) rig.rotation.y += deltaSeconds * spinSpeed;
    renderer.render(scene, camera);
  }

  function dispose() {
    disposed = true;
    clearTimeout(resumeTimer);
    dragCleanup?.();
    resizeObserver.disconnect();
    renderer.dispose();
    // renderer.dispose() alone frees the renderer's internal GPU resources
    // but doesn't hand the WebGL context itself back to the browser — that
    // happens whenever the browser's GC gets around to it. Since the
    // carousel repeatedly creates and tears down contexts, waiting on GC
    // eventually exhausts the browser's context limit (Chrome allows ~16),
    // after which new contexts silently fail and render blank/white.
    // forceContextLoss() releases it immediately and deterministically.
    renderer.forceContextLoss();
  }

  resize();

  return { tick, dispose, setModel, canvas };
}

/** Drives every registered viewer off a single requestAnimationFrame loop. */
export function createRenderLoop() {
  const viewers = new Set();
  const clock = new THREE.Clock();
  let running = false;

  function frame() {
    if (!running) return;
    const delta = clock.getDelta();
    for (const viewer of viewers) viewer.tick(delta);
    requestAnimationFrame(frame);
  }

  return {
    add(viewer) {
      viewers.add(viewer);
      if (!running) {
        running = true;
        clock.start();
        requestAnimationFrame(frame);
      }
    },
    remove(viewer) {
      viewers.delete(viewer);
      viewer.dispose();
    },
  };
}
