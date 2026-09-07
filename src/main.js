import { categories, defaultSelection } from "./data/weapons.js";
import { createViewer, createRenderLoop } from "./three/viewer.js";

const renderLoop = createRenderLoop();

const el = {
  prevCategory: document.getElementById("prevCategory"),
  nextCategory: document.getElementById("nextCategory"),
  mainViewport: document.getElementById("mainViewport"),
  infoRow: document.getElementById("infoRow"),
  categoryTabs: document.getElementById("categoryTabs"),
  carousel: document.getElementById("carousel"),
};

const STAT_SEGMENTS = 10;
const SLIDE_SETTLE_TIMEOUT = 750; // safety net in case transitionend is ever missed (above the 600ms slide duration)
const FADE_SCALE_SETTLE_TIMEOUT = 400; // safety net above the fade-scale pane's transition duration

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

/**
 * Animates `pane` (already in its resting position) out to `-direction*100%`
 * while `enteringFrom(pane)` sets up whatever replaces it. `pane` is removed
 * once its exit transition ends (or after a timeout safety net).
 */
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

/** Slides a brand-new pane in from `direction` to resting position (0%). */
function slideIn(pane, direction) {
  pane.style.transition = "none";
  pane.style.transform = `translateX(${direction * 100}%)`;
  void pane.getBoundingClientRect(); // force layout flush before enabling the transition
  pane.style.transition = "";
  pane.style.transform = "translateX(0%)";
}

/**
 * Scale+fade container swap (used for the weapon name/description — a
 * slide there just duplicated the 3D viewport's motion). The new pane pops
 * in from 95% scale while fading in; the old one shrinks slightly while
 * fading out. `build(paneEl)` fills the new pane.
 */
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
  void incoming.getBoundingClientRect(); // force layout flush before enabling the transition
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

// --- Stats panel: persistent, never slides. Built once; weapon switches
// just toggle each meter segment's .filled class and update the text
// fields in place, so the CSS transition on .stat-bar span animates the
// meter bars growing/shrinking to the new values instead of the whole
// panel sliding off with the rest of the info row.
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

const STAT_SEGMENT_STAGGER_MS = 35; // per-segment delay so a bar lights up (or drains) one box at a time

function updateStatsPanel(weapon) {
  for (const [stat, value] of Object.entries(weapon.stats)) {
    const segments = [...statsPanel.querySelectorAll(`.stat-bar[data-stat="${stat}"] span`)];
    const oldValue = segments.filter((s) => s.classList.contains("filled")).length;
    const newValue = value;

    // Delay is based on each segment's position within the *changing* group,
    // not its absolute index — otherwise a bar whose only change is at a
    // high index would sit waiting before it even starts, while a bar
    // changing at low indices finishes first, making them look out of sync.
    if (newValue > oldValue) {
      // Filling: sweep left-to-right through the newly-added segments.
      for (let i = oldValue; i < newValue; i++) {
        segments[i].style.transitionDelay = `${(i - oldValue) * STAT_SEGMENT_STAGGER_MS}ms`;
      }
    } else if (newValue < oldValue) {
      // Draining: sweep from the tip (highest index) inward.
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

// --- Main viewport: one persistent WebGL context, reused for every weapon.
// Spinning up a new WebGLRenderer per transition is expensive enough to
// stall the whole page for a moment, so the "slide" here works by sliding
// a still-image snapshot of the outgoing frame away while the live canvas
// (already updated to the new model) slides in — no second GL context.
const mainLiveLayer = document.createElement("div");
mainLiveLayer.className = "slide-pane";
const mainCanvas = document.createElement("canvas");
mainCanvas.className = "viewport-media";
mainLiveLayer.appendChild(mainCanvas);
el.mainViewport.appendChild(mainLiveLayer);

const weaponCopySlider = document.createElement("div");
weaponCopySlider.className = "weapon-copy-slider";
el.infoRow.appendChild(weaponCopySlider);
el.infoRow.appendChild(statsPanel);

const mainViewer = createViewer(mainCanvas, {
  modelUrl: getSlot(state.categoryId, state.slotIndex).model,
  distanceScale: 1.6,
  spinSpeed: 0.25,
  interactive: true,
  preserveDrawingBuffer: true, // needed for the toDataURL() slide-transition snapshot
});
renderLoop.add(mainViewer);

function slideMainViewport(direction, weapon) {
  // Mirrors mainLiveLayer's structure exactly: a .slide-pane wrapper (which
  // JS slides horizontally) containing a .viewport-media element (which CSS
  // keeps vertically centered at 165% height) — keeping these as separate
  // elements means the slide's inline transform never clobbers the media's
  // own translateY centering.
  const ghostPane = document.createElement("div");
  ghostPane.className = "slide-pane";
  const ghostImg = document.createElement("img");
  ghostImg.className = "viewport-media";
  ghostImg.src = mainCanvas.toDataURL("image/webp", 0.92);
  ghostPane.appendChild(ghostImg);
  el.mainViewport.appendChild(ghostPane);
  void ghostPane.getBoundingClientRect(); // commit the ghost's resting position first

  mainViewer.setModel(weapon.model);

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
  state.slotIndex = 0;

  renderTabs();
  renderCarousel();
  transitionToSlot(direction);
}

function stepCategory(direction) {
  const list = enabledCategories();
  const currentIndex = list.findIndex((c) => c.id === state.categoryId);
  const nextIndex = (currentIndex + direction + list.length) % list.length;
  selectCategory(list[nextIndex].id, direction);
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
      button.addEventListener("click", () => selectCategory(category.id));
    }
    el.categoryTabs.appendChild(button);
  }
}

// Carousel canvases are only rebuilt when the category's weapon list
// actually changes. Re-selecting a different slot inside the same
// category just moves the active highlight — the models are already
// live and rendering, no need to tear anything down.
function renderCarousel() {
  const category = getCategory(state.categoryId);

  if (state.carouselCategoryId !== state.categoryId) {
    for (const viewer of state.carouselViewers) renderLoop.remove(viewer);
    state.carouselViewers = [];
    el.carousel.innerHTML = "";

    category.weapons.forEach((weapon) => {
      const card = document.createElement("button");
      card.className = "weapon-card";

      const canvas = document.createElement("canvas");
      card.appendChild(canvas);

      const chip = document.createElement("span");
      chip.className = "name-chip";
      chip.textContent = weapon.name;
      card.appendChild(chip);

      el.carousel.appendChild(card);

      const viewer = createViewer(canvas, {
        modelUrl: weapon.model,
        distanceScale: 1.9,
        spinSpeed: 0.15,
      });
      renderLoop.add(viewer);
      state.carouselViewers.push(viewer);
    });

    state.carouselCategoryId = state.categoryId;
  }

  [...el.carousel.children].forEach((card, index) => {
    card.classList.toggle("active", index === state.slotIndex);
    card.onclick = () => selectSlot(state.categoryId, index);

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

el.prevCategory.addEventListener("click", () => stepCategory(-1));
el.nextCategory.addEventListener("click", () => stepCategory(1));

window.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") stepCategory(-1);
  if (event.key === "ArrowRight") stepCategory(1);
});

renderTabs();
renderCarousel();
{
  const initialWeapon = getSlot(state.categoryId, state.slotIndex);
  fadeScaleReplace(weaponCopySlider, (pane) => buildWeaponCopyPane(pane, initialWeapon));
  updateStatsPanel(initialWeapon);
}
