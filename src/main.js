import { categories, defaultSelection } from "./data/weapons.js";
import { createViewer, createRenderLoop } from "./three/viewer.js";

const renderLoop = createRenderLoop();

const el = {
  prevCategory: document.getElementById("prevCategory"),
  nextCategory: document.getElementById("nextCategory"),
  mainCanvas: document.getElementById("mainCanvas"),
  weaponName: document.getElementById("weaponName"),
  weaponDescription: document.getElementById("weaponDescription"),
  categoryTabs: document.getElementById("categoryTabs"),
  carousel: document.getElementById("carousel"),
  statMags: document.getElementById("statMags"),
  statRounds: document.getElementById("statRounds"),
  statOperatorMod: document.getElementById("statOperatorMod"),
};

const STAT_SEGMENTS = 10;

const state = {
  categoryId: defaultSelection.categoryId,
  weaponId: defaultSelection.weaponId,
  mainViewer: null,
  carouselViewers: [],
};

function getCategory(categoryId) {
  return categories.find((c) => c.id === categoryId);
}

function getWeapon(categoryId, weaponId) {
  return getCategory(categoryId)?.weapons.find((w) => w.id === weaponId);
}

function enabledCategories() {
  return categories.filter((c) => c.enabled && c.weapons.length > 0);
}

function selectWeapon(categoryId, weaponId) {
  state.categoryId = categoryId;
  state.weaponId = weaponId;
  renderTabs();
  renderCarousel();
  renderInfo();
  updateMainViewer();
}

function selectCategory(categoryId) {
  const category = getCategory(categoryId);
  if (!category || !category.enabled || category.weapons.length === 0) return;
  selectWeapon(categoryId, category.weapons[0].id);
}

function stepCategory(direction) {
  const list = enabledCategories();
  const currentIndex = list.findIndex((c) => c.id === state.categoryId);
  const nextIndex = (currentIndex + direction + list.length) % list.length;
  selectCategory(list[nextIndex].id);
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

function buildStatBar(container, value) {
  container.innerHTML = "";
  for (let i = 0; i < STAT_SEGMENTS; i++) {
    const segment = document.createElement("span");
    if (i < value) segment.classList.add("filled");
    container.appendChild(segment);
  }
}

function renderInfo() {
  const weapon = getWeapon(state.categoryId, state.weaponId);
  if (!weapon) return;

  el.weaponName.textContent = weapon.name;
  el.weaponDescription.textContent = weapon.description;
  el.statMags.textContent = weapon.mags;
  el.statRounds.textContent = weapon.roundsPerMag;
  el.statOperatorMod.textContent = weapon.operatorMod;

  buildStatBar(document.getElementById("bar-damage"), weapon.stats.damage);
  buildStatBar(document.getElementById("bar-range"), weapon.stats.range);
  buildStatBar(document.getElementById("bar-fireRate"), weapon.stats.fireRate);
  buildStatBar(document.getElementById("bar-accuracy"), weapon.stats.accuracy);
}

function renderCarousel() {
  for (const viewer of state.carouselViewers) renderLoop.remove(viewer);
  state.carouselViewers = [];
  el.carousel.innerHTML = "";

  const category = getCategory(state.categoryId);
  for (const weapon of category.weapons) {
    const card = document.createElement("button");
    card.className = "weapon-card" + (weapon.id === state.weaponId ? " active" : "");
    card.addEventListener("click", () => selectWeapon(state.categoryId, weapon.id));

    const canvas = document.createElement("canvas");
    card.appendChild(canvas);

    const chip = document.createElement("span");
    chip.className = "name-chip";
    chip.textContent = weapon.name;
    card.appendChild(chip);

    if (weapon.id === state.weaponId) {
      for (const corner of ["tl", "tr", "bl", "br"]) {
        const bracket = document.createElement("span");
        bracket.className = `bracket ${corner}`;
        card.appendChild(bracket);
      }
    }

    el.carousel.appendChild(card);

    const viewer = createViewer(canvas, {
      modelUrl: weapon.model,
      distanceScale: 1.9,
      spinSpeed: 0.15,
    });
    renderLoop.add(viewer);
    state.carouselViewers.push(viewer);
  }
}

function updateMainViewer() {
  const weapon = getWeapon(state.categoryId, state.weaponId);
  if (!weapon) return;

  if (state.mainViewer) renderLoop.remove(state.mainViewer);
  state.mainViewer = createViewer(el.mainCanvas, {
    modelUrl: weapon.model,
    distanceScale: 1.6,
    spinSpeed: 0.25,
    interactive: true,
  });
  renderLoop.add(state.mainViewer);
}

el.prevCategory.addEventListener("click", () => stepCategory(-1));
el.nextCategory.addEventListener("click", () => stepCategory(1));

window.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") stepCategory(-1);
  if (event.key === "ArrowRight") stepCategory(1);
});

selectWeapon(state.categoryId, state.weaponId);
