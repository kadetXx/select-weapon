// stats are 0-10, model paths point at /public/models. these are runtime
// strings, not static imports, so Vite's own base-path rewriting (see
// vite.config.js) never touches them -- BASE_URL has to be prepended by hand
// or these 404 once deployed under a subpath (e.g. GitHub Pages)
const MODEL_BASE = import.meta.env.BASE_URL + "models/";
const SMG_MODEL = MODEL_BASE + "smg.glb";
const LMG_MODEL = MODEL_BASE + "lmg.glb";
const SHOTGUN_MODEL = MODEL_BASE + "shotgun.glb";
const LAUNCHER_MODEL = MODEL_BASE + "launcher.glb";
const SLOT_COUNT = 4;

function repeatAcrossSlots(weapon, count = SLOT_COUNT) {
  return Array.from({ length: count }, (_, i) => ({
    ...weapon,
    slotId: `${weapon.id}-slot-${i}`,
  }));
}

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
    defaultSlotIndex: 1,
    weapons: repeatAcrossSlots(
      {
        id: "cordite",
        name: "Cordite",
        description: "Full-auto submachine gun. Well rounded with a large ammo pool.",
        stats: { damage: 4, range: 3, fireRate: 8, accuracy: 5 },
        mags: 3,
        roundsPerMag: 60,
        operatorMod: "Belt Feed",
        model: SMG_MODEL,
      },
      4
    ),
  },
  {
    id: "light-machine",
    label: "Light Machine",
    enabled: true,
    defaultSlotIndex: 0,
    weapons: repeatAcrossSlots(
      {
        id: "titan",
        name: "Titan",
        description: "Full-auto light machine gun. Reliable firepower with the largest ammo pool.",
        stats: { damage: 6, range: 6, fireRate: 7, accuracy: 5 },
        mags: 3,
        roundsPerMag: 75,
        operatorMod: "Oppressor",
        model: LMG_MODEL,
      },
      3
    ),
  },
  {
    id: "launchers",
    label: "Launchers",
    enabled: true,
    weapons: repeatAcrossSlots(
      {
        id: "hellion-salvo",
        name: "Hellion Salvo",
        description: "Lock-on or free fire rocket launcher. Reliable anti-vehicle weapon with anti-personnel capabilities.",
        stats: { damage: 10, range: 7, fireRate: 1, accuracy: 7 },
        mags: 3,
        roundsPerMag: 1,
        operatorMod: "None",
        model: LAUNCHER_MODEL,
      },
      1
    ),
  },
  {
    id: "shotguns",
    label: "Shotguns",
    enabled: true,
    weapons: repeatAcrossSlots(
      {
        id: "mog12",
        name: "MOG 12",
        description: "Pump-action shotgun. Reliable 2-shot kill with a short 1-hit-kill range.",
        stats: { damage: 9, range: 2, fireRate: 2, accuracy: 3 },
        mags: 4,
        roundsPerMag: 4,
        operatorMod: "Dragon Breath",
        model: SHOTGUN_MODEL,
      },
      2
    ),
  },
  {
    id: "tactical-rifles",
    label: "Tactical Rifles",
    enabled: false,
    weapons: [],
  },
];

export const defaultSelection = { categoryId: "submachine-guns", slotIndex: 1 };
