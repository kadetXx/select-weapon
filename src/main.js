import { categories, defaultSelection } from "./data/weapons.js";
import { createViewer, createRenderLoop } from "./three/viewer.js";
import { playHover, playSelect, playDenied, setSoundEnabled } from "./audio.js";

// the Google Fonts link is preloaded (not render-blocking) in the HTML head --
// promote it to an active stylesheet once the module script runs
const fontsLink = document.getElementById("fontsStylesheet");
if (fontsLink) fontsLink.rel = "stylesheet";

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

function setActive(button, isActive) {
  button.classList.toggle("active", isActive);
  if (isActive) button.setAttribute("aria-current", "true");
  else button.removeAttribute("aria-current");
}

const STAT_SEGMENTS = 10;
const SLIDE_SETTLE_TIMEOUT = 750;
const FADE_SCALE_SETTLE_TIMEOUT = 400;
const MAIN_DISTANCE_SCALE = 1.8;
const MOBILE_MAIN_DISTANCE_SCALE = 1.2; // portrait has the vertical room to let it read bigger
const CAROUSEL_DISTANCE_SCALE = 1.9;

const portraitQuery = window.matchMedia("(orientation: portrait)");

function currentMainDistanceScale() {
  return portraitQuery.matches ? MOBILE_MAIN_DISTANCE_SCALE : MAIN_DISTANCE_SCALE;
}

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

// per-category starting slot when a category is switched into; falls back
// to the first tile if the category doesn't specify one
function initialSlotIndex(category) {
  return category.defaultSlotIndex ?? 0;
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
mainCanvas.setAttribute("aria-hidden", "true"); // the weapon name/description right below it are the real accessible content
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
  distanceScale: scaledDistance(currentMainDistanceScale(), initialMainWeapon),
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

  mainViewer.setModel(weapon.model, scaledDistance(currentMainDistanceScale(), weapon));

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
  state.slotIndex = initialSlotIndex(category);

  renderTabs();
  renderCarousel();
  transitionToSlot(direction);
}

function stepCategory(direction) {
  const list = enabledCategories();
  const currentIndex = list.findIndex((c) => c.id === state.categoryId);
  const nextIndex = (currentIndex + direction + list.length) % list.length;
  selectCategory(list[nextIndex].id, direction);
  playSelect();
}

// LB/RB step through weapon slots in the current category rather than
// switching category -- on portrait/mobile the carousel tiles are hidden
// (see the portrait media query in style.css), so this is the only way to
// browse a category's weapons there
function stepSlot(direction) {
  const category = getCategory(state.categoryId);
  const count = category.weapons.length;
  if (count === 0) return;
  // nothing to switch to (e.g. Launchers' single weapon) -- same "can't do
  // that" buzz as the decorative X/B prompts, so it reads as denied rather
  // than silently doing nothing
  if (count === 1) {
    playDenied();
    return;
  }
  const nextIndex = (state.slotIndex + direction + count) % count;
  selectSlot(state.categoryId, nextIndex);
  playSelect();
}

function buildTabButton(category) {
  const button = document.createElement("button");
  button.className = "tab";
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
  return button;
}

// tab-track state is kept separate from `state` (the app's weapon/category
// selection) and named distinctly from the weapon carousel (renderCarousel,
// state.carouselViewers) -- "carousel" already means something else here
const tabTrackState = {
  mode: null, // "flat" (desktop/landscape) | "carousel" (portrait)
  track: null,
  entries: [], // { categoryIndex, button }, two laps of the enabled list back to back
  activeIndex: 0,
};

function buildFlatTabs() {
  el.categoryTabs.innerHTML = "";
  categories.forEach((category) => el.categoryTabs.appendChild(buildTabButton(category)));
}

// mobile tabs never scroll -- clicking any tab to the right slides the whole
// row so it becomes the new left-aligned one. Going "back" just means
// looping all the way forward, which is why the row is built two laps deep:
// enough runway to reach any tab from any position in one slide, then a
// transitionend snap back into lap one (invisible, since both laps are
// identical) keeps a third lap from ever being necessary. Disabled
// categories are left out entirely -- they're dead weight here, and with
// two of them at opposite ends of the full list, wrapping could otherwise
// land two in a row and push every real tab off-screen with nothing to tap.
function buildTabTrack() {
  el.categoryTabs.innerHTML = "";
  tabTrackState.track = document.createElement("div");
  tabTrackState.track.className = "category-tabs-track";
  el.categoryTabs.appendChild(tabTrackState.track);

  const list = enabledCategories();
  tabTrackState.entries = [];
  for (let lap = 0; lap < 2; lap++) {
    list.forEach((category, categoryIndex) => {
      const button = buildTabButton(category);
      tabTrackState.track.appendChild(button);
      tabTrackState.entries.push({ categoryIndex, button });
    });
  }

  tabTrackState.activeIndex = list.findIndex((c) => c.id === state.categoryId);
  syncTabTrackPosition({ animate: false });
}

function markActiveTabEntry(index) {
  tabTrackState.entries.forEach((entry, i) => setActive(entry.button, i === index));
}

function syncTabTrackPosition({ animate }) {
  const { track, entries } = tabTrackState;
  const list = enabledCategories();
  const n = list.length;
  const targetCategoryIndex = list.findIndex((c) => c.id === state.categoryId);
  tabTrackState.activeIndex += (targetCategoryIndex - (tabTrackState.activeIndex % n) + n) % n;
  const { activeIndex } = tabTrackState;

  markActiveTabEntry(activeIndex);
  if (!animate) track.style.transition = "none";
  track.style.transform = `translateX(${-entries[activeIndex].button.offsetLeft}px)`;

  if (!animate) {
    void track.offsetWidth; // force reflow before re-enabling the transition
    track.style.transition = "";
  } else if (activeIndex >= n) {
    const resetIndex = activeIndex - n;
    track.addEventListener(
      "transitionend",
      () => {
        track.style.transition = "none";
        tabTrackState.activeIndex = resetIndex;
        markActiveTabEntry(resetIndex);
        track.style.transform = `translateX(${-entries[resetIndex].button.offsetLeft}px)`;
        void track.offsetWidth;
        track.style.transition = "";
      },
      { once: true }
    );
  }
}

function renderTabs() {
  const mode = portraitQuery.matches ? "carousel" : "flat";
  const justSwitchedMode = tabTrackState.mode !== mode;
  if (justSwitchedMode) {
    tabTrackState.mode = mode;
    if (mode === "carousel") buildTabTrack(); // syncs its own active state + position
    else buildFlatTabs();
  }
  if (mode === "flat") {
    [...el.categoryTabs.children].forEach((button, i) => setActive(button, categories[i].id === state.categoryId));
  } else if (!justSwitchedMode) {
    syncTabTrackPosition({ animate: true });
  }
}

portraitQuery.addEventListener("change", () => {
  renderTabs();
  const weapon = getSlot(state.categoryId, state.slotIndex);
  mainViewer.setModel(weapon.model, scaledDistance(currentMainDistanceScale(), weapon));
});

function renderCarousel() {
  const category = getCategory(state.categoryId);

  if (state.carouselCategoryId !== state.categoryId) {
    for (const viewer of state.carouselViewers) renderLoop.remove(viewer);
    state.carouselViewers = [];
    el.carousel.innerHTML = "";

    category.weapons.forEach((weapon) => {
      const card = document.createElement("button");
      card.className = "weapon-card is-loading";
      card.setAttribute("aria-label", weapon.name);

      const canvas = document.createElement("canvas");
      canvas.setAttribute("aria-hidden", "true");
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
    setActive(card, index === state.slotIndex);
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

const categoryControls = [
  { button: el.prevCategory, direction: -1 },
  { button: el.nextCategory, direction: 1 },
];
for (const { button, direction } of categoryControls) {
  button.addEventListener("pointerenter", playHover);
  button.addEventListener("click", () => stepCategory(direction));
}

const slotControls = [
  { button: el.lbButton, direction: -1 },
  { button: el.rbButton, direction: 1 },
];
for (const { button, direction } of slotControls) {
  button.addEventListener("pointerenter", playHover);
  button.addEventListener("click", () => stepSlot(direction));
}

window.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") stepCategory(-1);
  if (event.key === "ArrowRight") stepCategory(1);
});

// X/B are decorative prompts -- this UI has no actual select/back flow,
// so clicking them plays a "can't do that" buzz instead of a real action
for (const prompt of document.querySelectorAll(".prompt")) {
  prompt.addEventListener("pointerenter", playHover);
  prompt.addEventListener("click", playDenied);
}

// intro overlay: its Enter click is the guaranteed user gesture that
// unlocks the AudioContext (hover doesn't reliably count, especially on
// Safari), and it buys the 3D assets a head start loading behind it
const introOverlay = document.getElementById("introOverlay");
const soundOff = document.getElementById("soundOff");
const soundOn = document.getElementById("soundOn");

function enterWithSound(enabled) {
  setSoundEnabled(enabled);
  if (enabled) playSelect();
  introOverlay.classList.add("dismissed");
  setTimeout(() => introOverlay.remove(), 450);
}

soundOff.addEventListener("click", () => enterWithSound(false));
soundOn.addEventListener("click", () => enterWithSound(true));

renderTabs();
renderCarousel();
{
  const initialWeapon = getSlot(state.categoryId, state.slotIndex);
  fadeScaleReplace(weaponCopySlider, (pane) => buildWeaponCopyPane(pane, initialWeapon));
  updateStatsPanel(initialWeapon);
}
