// Stat values are 0–10, rendered as segmented bars in the UI.
// `model` points at a .glb in /public/models — every entry uses the same
// placeholder mesh for now. Swap individual entries once per-weapon Meshy
// exports are ready; nothing else in the app needs to change.
const PLACEHOLDER_MODEL = "/models/weapon-placeholder.glb";

export const categories = [
  {
    id: "assault-rifles",
    label: "Assault Rifles",
    enabled: false,
    weapons: [],
  },
  {
    id: "submachine-guns",
    label: "Submachine Guns",
    enabled: true,
    weapons: [
      {
        id: "mx9",
        name: "MX·9",
        description: "Full-auto submachine gun. High mobility with fast handling.",
        stats: { damage: 3, range: 3, fireRate: 7, accuracy: 5 },
        mags: 4,
        roundsPerMag: 30,
        operatorMod: "Fast Mag",
        model: PLACEHOLDER_MODEL,
      },
      {
        id: "spitfire",
        name: "Spitfire",
        description: "Full-auto submachine gun. High rate of fire with manageable recoil.",
        stats: { damage: 4, range: 4, fireRate: 8, accuracy: 6 },
        mags: 3,
        roundsPerMag: 45,
        operatorMod: "Extended Mag",
        model: PLACEHOLDER_MODEL,
      },
      {
        id: "cordite",
        name: "Cordite",
        description: "Full-auto submachine gun. Well rounded with a large ammo pool.",
        stats: { damage: 4, range: 3, fireRate: 8, accuracy: 5 },
        mags: 3,
        roundsPerMag: 60,
        operatorMod: "Belt Feed",
        model: PLACEHOLDER_MODEL,
      },
      {
        id: "gks",
        name: "GKS",
        description: "Full-auto submachine gun. Balanced handling with moderate range.",
        stats: { damage: 4, range: 5, fireRate: 6, accuracy: 6 },
        mags: 3,
        roundsPerMag: 40,
        operatorMod: "Quickdraw",
        model: PLACEHOLDER_MODEL,
      },
    ],
  },
  {
    id: "tactical-rifles",
    label: "Tactical Rifles",
    enabled: false,
    weapons: [],
  },
  {
    id: "light-machine",
    label: "Light Machine",
    enabled: true,
    weapons: [
      {
        id: "hades",
        name: "Hades",
        description: "Full-auto light machine gun. Slow handling with devastating close-range power.",
        stats: { damage: 7, range: 5, fireRate: 5, accuracy: 4 },
        mags: 2,
        roundsPerMag: 100,
        operatorMod: "Suppressed",
        model: PLACEHOLDER_MODEL,
      },
      {
        id: "titan",
        name: "Titan",
        description: "Full-auto light machine gun. Reliable firepower with the largest ammo pool.",
        stats: { damage: 6, range: 6, fireRate: 7, accuracy: 5 },
        mags: 3,
        roundsPerMag: 75,
        operatorMod: "Oppressor",
        model: PLACEHOLDER_MODEL,
      },
      {
        id: "vkm750",
        name: "VKM 750",
        description: "Full-auto light machine gun. High accuracy with controlled recoil.",
        stats: { damage: 5, range: 7, fireRate: 5, accuracy: 7 },
        mags: 3,
        roundsPerMag: 100,
        operatorMod: "Recoil Springs",
        model: PLACEHOLDER_MODEL,
      },
    ],
  },
  {
    id: "sniper-rifles",
    label: "Sniper Rifles",
    enabled: false,
    weapons: [],
  },
];

export const defaultSelection = { categoryId: "submachine-guns", weaponId: "cordite" };
