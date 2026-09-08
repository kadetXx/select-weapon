import { categories, defaultSelection } from "./data/weapons.js";
import { createViewer, createRenderLoop } from "./three/viewer.js";
import { playHover, playSelect, playDenied, setSoundEnabled } from "./audio.js";

const renderLoop = createRenderLoop();

const el = {
  prevCategory: document.getElementById("prevCategory"),
  nextCategory: document.getElementById("nextCategory"),
  lbButton: document.getElementById("lbButton"),
  rbButton: document.getElementById("rbButton"),
  mainViewport: document.getElementById("mainViewport"),
  infoRow: document.getElementById("infoRow"),
  categoryTabs: document.getElementById("categoryTabs"),
  carousel: document.getElementById("carousel"),
};

function pulse(target) {
  target.classList.remove("pulse-feedback");
  void target.offsetWidth; // restart the animation even if it's mid-run
  target.classList.add("pulse-feedback");
}

const STAT_SEGMENTS = 10;
const SLIDE_SETTLE_TIMEOUT = 750;
const FADE_SCALE_SETTLE_TIMEOUT = 400;
const MAIN_DISTANCE_SCALE = 1.8;
const CAROUSEL_DISTANCE_SCALE = 1.9;

function scaledDistance(base, weapon) {
  return base * (weapon.zoomAdjust ?? 1);
}

const state = {
  categoryId: defaultSelection.categoryId,
  slotIndex: defaultSelection.slotIndex,
  carouselCategoryId: null,
  carouselViewers: [],
};

function getCategory(categoryId) {
  return categories.find((c) => c.id === categoryId);
}

function getSlot(categoryId, slotIndex) {
  return getCategory(categoryId)?.weapons[slotIndex];
}

function enabledCategories() {
  return categories.filter((c) => c.enabled && c.weapons.length > 0);
}

function slideOut(pane, direction, onSettled) {
  let settled = false;
  const settle = () => {
    if (settled) return;
    settled = true;
    pane.remove();
    onSettled?.();
  };
  pane.addEventListener("transitionend", settle, { once: true });
  setTimeout(settle, SLIDE_SETTLE_TIMEOUT);
  pane.style.transform = `translateX(${-direction * 100}%)`;
}

function slideIn(pane, direction) {
  pane.style.transition = "none";
  pane.style.transform = `translateX(${direction * 100}%)`;
  void pane.getBoundingClientRect(); // forces reflow
  pane.style.transition = "";
  pane.style.transform = "translateX(0%)";
}

function fadeScaleReplace(container, build) {
  const outgoing = container.currentPane;
  const incoming = document.createElement("div");
  incoming.className = "fade-scale-pane";
  build(incoming);
  container.appendChild(incoming);
  container.currentPane = incoming;

  if (!outgoing) return;

  incoming.style.transition = "none";
  incoming.style.opacity = "0";
  incoming.style.transform = "scale(0.95)";
  void incoming.getBoundingClientRect(); // forces reflow
  incoming.style.transition = "";
  incoming.style.opacity = "1";
  incoming.style.transform = "scale(1)";

  let settled = false;
  const settle = () => {
    if (settled) return;
    settled = true;
    outgoing.remove();
  };
  outgoing.addEventListener("transitionend", settle, { once: true });
  setTimeout(settle, FADE_SCALE_SETTLE_TIMEOUT);
  outgoing.style.opacity = "0";
  outgoing.style.transform = "scale(0.95)";
}

function buildStatBar(container, value) {
  for (let i = 0; i < STAT_SEGMENTS; i++) {
    const segment = document.createElement("span");
    if (i < value) segment.classList.add("filled");
    container.appendChild(segment);
  }
}

function buildWeaponCopyPane(pane, weapon) {
  const copy = document.createElement("div");
  copy.className = "weapon-copy";
  copy.innerHTML = `
    <div class="weapon-name-block">
      <h2 class="weapon-name"></h2>
      <div class="divider"></div>
    </div>
    <p class="weapon-description"></p>
  `;
  copy.querySelector(".weapon-name").textContent = weapon.name;
  copy.querySelector(".weapon-description").textContent = weapon.description;
  pane.appendChild(copy);
}

const statsPanel = document.createElement("div");
statsPanel.className = "stats-panel";
statsPanel.innerHTML = `
  <div class="stat-row"><span class="stat-label">Damage</span><div class="stat-bar" data-stat="damage"></div></div>
  <div class="stat-row"><span class="stat-label">Range</span><div class="stat-bar" data-stat="range"></div></div>
  <div class="stat-row"><span class="stat-label">Fire Rate</span><div class="stat-bar" data-stat="fireRate"></div></div>
  <div class="stat-row"><span class="stat-label">Accuracy</span><div class="stat-bar" data-stat="accuracy"></div></div>
  <div class="divider"></div>
  <div class="ammo-row">
    <span class="stat-label">Mags</span>
    <span class="stat-value" data-field="mags"></span>
    <span class="stat-label secondary-label">Rounds / Mag</span>
    <span class="stat-value" data-field="rounds"></span>
  </div>
  <div class="ammo-row">
    <span class="stat-label">Operator Mod</span>
    <span class="stat-value" data-field="operatorMod"></span>
  </div>
`;
statsPanel.querySelectorAll(".stat-bar").forEach((bar) => buildStatBar(bar, 0));

const STAT_SEGMENT_STAGGER_MS = 35;

function updateStatsPanel(weapon) {
  for (const [stat, value] of Object.entries(weapon.stats)) {
    const segments = [...statsPanel.querySelectorAll(`.stat-bar[data-stat="${stat}"] span`)];
    const oldValue = segments.filter((s) => s.classList.contains("filled")).length;
    const newValue = value;

    // delay by position within the changing group, not absolute index
    if (newValue > oldValue) {
      for (let i = oldValue; i < newValue; i++) {
        segments[i].style.transitionDelay = `${(i - oldValue) * STAT_SEGMENT_STAGGER_MS}ms`;
      }
    } else if (newValue < oldValue) {
      for (let i = newValue; i < oldValue; i++) {
        segments[i].style.transitionDelay = `${(oldValue - 1 - i) * STAT_SEGMENT_STAGGER_MS}ms`;
      }
    }

    segments.forEach((segment, i) => segment.classList.toggle("filled", i < newValue));
  }
  statsPanel.querySelector('[data-field="mags"]').textContent = weapon.mags;
  statsPanel.querySelector('[data-field="rounds"]').textContent = weapon.roundsPerMag;
  statsPanel.querySelector('[data-field="operatorMod"]').textContent = weapon.operatorMod;
}

// one persistent WebGL context, reused for every weapon: a new renderer
// per switch stalls the page
const mainLiveLayer = document.createElement("div");
mainLiveLayer.className = "slide-pane";
const mainCanvas = document.createElement("canvas");
mainCanvas.className = "viewport-media";
mainLiveLayer.appendChild(mainCanvas);
el.mainViewport.appendChild(mainLiveLayer);

const mainSpinner = document.createElement("div");
mainSpinner.className = "loading-spinner";
el.mainViewport.appendChild(mainSpinner);
el.mainViewport.classList.add("is-loading");

const weaponCopySlider = document.createElement("div");
weaponCopySlider.className = "weapon-copy-slider";
el.infoRow.appendChild(weaponCopySlider);
el.infoRow.appendChild(statsPanel);

const initialMainWeapon = getSlot(state.categoryId, state.slotIndex);
const mainViewer = createViewer(mainCanvas, {
  modelUrl: initialMainWeapon.model,
  distanceScale: scaledDistance(MAIN_DISTANCE_SCALE, initialMainWeapon),
  spinSpeed: 0.25,
  interactive: true,
  preserveDrawingBuffer: true, // needed for the toDataURL() snapshot below
  onReady: () => el.mainViewport.classList.remove("is-loading"),
});
renderLoop.add(mainViewer);

function slideMainViewport(direction, weapon) {
  const ghostPane = document.createElement("div");
  ghostPane.className = "slide-pane";
  const ghostImg = document.createElement("img");
  ghostImg.className = "viewport-media";
  ghostImg.src = mainCanvas.toDataURL("image/webp", 0.92);
  ghostPane.appendChild(ghostImg);
  el.mainViewport.appendChild(ghostPane);
  void ghostPane.getBoundingClientRect(); // forces reflow

  mainViewer.setModel(weapon.model, scaledDistance(MAIN_DISTANCE_SCALE, weapon));

  slideIn(mainLiveLayer, direction);
  slideOut(ghostPane, direction);
}

function transitionToSlot(direction) {
  const weapon = getSlot(state.categoryId, state.slotIndex);
  if (!weapon) return;
  slideMainViewport(direction, weapon);
  fadeScaleReplace(weaponCopySlider, (pane) => buildWeaponCopyPane(pane, weapon));
  updateStatsPanel(weapon);
}

function selectSlot(categoryId, slotIndex) {
  if (categoryId === state.categoryId && slotIndex === state.slotIndex) return;
  const direction = categoryId === state.categoryId ? Math.sign(slotIndex - state.slotIndex) || 1 : 1;

  state.categoryId = categoryId;
  state.slotIndex = slotIndex;

  renderTabs();
  renderCarousel();
  transitionToSlot(direction);
}

function selectCategory(categoryId, explicitDirection) {
  const category = getCategory(categoryId);
  if (!category || !category.enabled || category.weapons.length === 0) return;
  if (categoryId === state.categoryId) return;

  const direction =
    explicitDirection ||
    Math.sign(categories.findIndex((c) => c.id === categoryId) - categories.findIndex((c) => c.id === state.categoryId)) ||
    1;

  state.categoryId = categoryId;
  state.slotIndex = defaultSelection.slotIndex;

  renderTabs();
  renderCarousel();
  transitionToSlot(direction);
}

function stepCategory(direction, source) {
  const list = enabledCategories();
  const currentIndex = list.findIndex((c) => c.id === state.categoryId);
  const nextIndex = (currentIndex + direction + list.length) % list.length;
  selectCategory(list[nextIndex].id, direction);

  // LB/RB and the on-screen arrows are the same action -- clicking either
  // (or pressing the arrow keys) pulses whichever one wasn't the direct
  // source, so it always reads as "the LB/RB pair just fired"
  playSelect();
  const arrowBtn = direction === -1 ? el.prevCategory : el.nextCategory;
  const badgeBtn = direction === -1 ? el.lbButton : el.rbButton;
  if (source !== "arrow") pulse(arrowBtn);
  if (source !== "badge") pulse(badgeBtn);
}

function renderTabs() {
  el.categoryTabs.innerHTML = "";
  for (const category of categories) {
    const button = document.createElement("button");
    button.className = "tab" + (category.id === state.categoryId ? " active" : "");
    button.disabled = !category.enabled || category.weapons.length === 0;

    const label = document.createElement("span");
    label.className = "tab-label";
    label.textContent = category.label;
    button.appendChild(label);

    if (!button.disabled) {
      button.addEventListener("pointerenter", playHover);
      button.addEventListener("click", () => {
        playSelect();
        selectCategory(category.id);
      });
    }
    el.categoryTabs.appendChild(button);
  }
}

function renderCarousel() {
  const category = getCategory(state.categoryId);

  if (state.carouselCategoryId !== state.categoryId) {
    for (const viewer of state.carouselViewers) renderLoop.remove(viewer);
    state.carouselViewers = [];
    el.carousel.innerHTML = "";

    category.weapons.forEach((weapon) => {
      const card = document.createElement("button");
      card.className = "weapon-card is-loading";

      const canvas = document.createElement("canvas");
      card.appendChild(canvas);

      const spinner = document.createElement("div");
      spinner.className = "loading-spinner small";
      card.appendChild(spinner);

      const chip = document.createElement("span");
      chip.className = "name-chip";
      chip.textContent = weapon.name;
      card.appendChild(chip);

      card.addEventListener("pointerenter", playHover);
      el.carousel.appendChild(card);

      const viewer = createViewer(canvas, {
        modelUrl: weapon.model,
        distanceScale: scaledDistance(CAROUSEL_DISTANCE_SCALE, weapon),
        spinSpeed: 0.15,
        onReady: () => card.classList.remove("is-loading"),
      });
      renderLoop.add(viewer);
      state.carouselViewers.push(viewer);
    });

    state.carouselCategoryId = state.categoryId;
  }

  [...el.carousel.children].forEach((card, index) => {
    card.classList.toggle("active", index === state.slotIndex);
    card.onclick = () => {
      playSelect();
      selectSlot(state.categoryId, index);
    };

    card.querySelectorAll(".bracket").forEach((b) => b.remove());
    if (index === state.slotIndex) {
      for (const corner of ["tl", "tr", "bl", "br"]) {
        const bracket = document.createElement("span");
        bracket.className = `bracket ${corner}`;
        card.appendChild(bracket);
      }
    }
  });
}

el.prevCategory.addEventListener("pointerenter", playHover);
el.nextCategory.addEventListener("pointerenter", playHover);
el.lbButton.addEventListener("pointerenter", playHover);
el.rbButton.addEventListener("pointerenter", playHover);

el.prevCategory.addEventListener("click", () => stepCategory(-1, "arrow"));
el.nextCategory.addEventListener("click", () => stepCategory(1, "arrow"));
el.lbButton.addEventListener("click", () => stepCategory(-1, "badge"));
el.rbButton.addEventListener("click", () => stepCategory(1, "badge"));

window.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") stepCategory(-1, "keyboard");
  if (event.key === "ArrowRight") stepCategory(1, "keyboard");
});

// X/B are decorative prompts -- this UI has no actual select/back flow,
// so clicking them plays a "can't do that" buzz instead of a real action
for (const promptIcon of document.querySelectorAll(".prompt-icon")) {
  promptIcon.addEventListener("pointerenter", playHover);
  promptIcon.addEventListener("click", playDenied);
}

// intro overlay: its Enter click is the guaranteed user gesture that
// unlocks the AudioContext (hover doesn't reliably count, especially on
// Safari), and it buys the 3D assets a head start loading behind it
const introOverlay = document.getElementById("introOverlay");
const soundToggle = document.getElementById("soundToggle");
const introEnter = document.getElementById("introEnter");

soundToggle.addEventListener("click", () => {
  const nowEnabled = soundToggle.getAttribute("aria-pressed") !== "true";
  soundToggle.setAttribute("aria-pressed", String(nowEnabled));
  setSoundEnabled(nowEnabled);
  if (nowEnabled) playSelect();
});

introEnter.addEventListener("click", () => {
  playSelect();
  introOverlay.classList.add("dismissed");
  setTimeout(() => introOverlay.remove(), 450);
});

renderTabs();
renderCarousel();
{
  const initialWeapon = getSlot(state.categoryId, state.slotIndex);
  fadeScaleReplace(weaponCopySlider, (pane) => buildWeaponCopyPane(pane, initialWeapon));
  updateStatsPanel(initialWeapon);
}

// portrait phones render the layout rotated 90deg (see .screen in
// style.css) at a fixed 1440x900 reference size, scaled to fit whatever
// the actual screen is. driven off matchMedia/innerWidth/innerHeight only,
// never user-agent or touch detection, so it matches devtools emulation.
const CANVAS_WIDTH = 1440;
const CANVAS_HEIGHT = 900;
const mobilePortrait = window.matchMedia("(max-width: 768px) and (orientation: portrait)");

function updateMobileScale() {
  if (!mobilePortrait.matches) return;
  const scale = Math.min(window.innerHeight / CANVAS_WIDTH, window.innerWidth / CANVAS_HEIGHT);
  document.documentElement.style.setProperty("--mobile-scale", scale);
}

mobilePortrait.addEventListener("change", updateMobileScale);
window.addEventListener("resize", updateMobileScale);
updateMobileScale();
