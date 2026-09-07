// Stat values are 0–10, rendered as segmented bars in the UI.
// `model` points at a .glb in /public/models — each enabled category has
// its own dedicated asset today, repeated across all four carousel slots
// until distinct per-slot models exist.
const SMG_MODEL = "/models/smg.glb";
const LMG_MODEL = "/models/lmg.glb";
const SHOTGUN_MODEL = "/models/shotgun.glb";
const LAUNCHER_MODEL = "/models/launcher.glb";
const SLOT_COUNT = 4;

// Each enabled category has exactly one real weapon today. It's repeated
// across all four carousel slots as placeholder inventory until distinct
// assets exist per slot — `slotId` gives each repeat a unique DOM identity
// while every other field (name, stats, model) stays identical.
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
    weapons: repeatAcrossSlots({
      id: "cordite",
      name: "Cordite",
      description: "Full-auto submachine gun. Well rounded with a large ammo pool.",
      stats: { damage: 4, range: 3, fireRate: 8, accuracy: 5 },
      mags: 3,
      roundsPerMag: 60,
      operatorMod: "Belt Feed",
      model: SMG_MODEL,
    }),
  },
  {
    id: "light-machine",
    label: "Light Machine",
    enabled: true,
    weapons: repeatAcrossSlots({
      id: "titan",
      name: "Titan",
      description: "Full-auto light machine gun. Reliable firepower with the largest ammo pool.",
      stats: { damage: 6, range: 6, fireRate: 7, accuracy: 5 },
      mags: 3,
      roundsPerMag: 75,
      operatorMod: "Oppressor",
      model: LMG_MODEL,
      // This model's bounding box fits a bit looser than the others (longer
      // stock/bipod silhouette), so the standard camera distance leaves it
      // looking smaller in frame — pull the camera in slightly to match.
      zoomAdjust: 0.85,
    }),
  },
  {
    id: "launchers",
    label: "Launchers",
    enabled: true,
    weapons: repeatAcrossSlots({
      id: "hellion-salvo",
      name: "Hellion Salvo",
      description: "Lock-on or free fire rocket launcher. Reliable anti-vehicle weapon with anti-personnel capabilities.",
      stats: { damage: 10, range: 7, fireRate: 1, accuracy: 7 },
      mags: 3,
      roundsPerMag: 1,
      operatorMod: "None",
      model: LAUNCHER_MODEL,
    }),
  },
  {
    id: "shotguns",
    label: "Shotguns",
    enabled: true,
    weapons: repeatAcrossSlots({
      id: "mog12",
      name: "MOG 12",
      description: "Pump-action shotgun. Reliable 2-shot kill with a short 1-hit-kill range.",
      stats: { damage: 9, range: 2, fireRate: 2, accuracy: 3 },
      mags: 4,
      roundsPerMag: 4,
      operatorMod: "Dragon Breath",
      model: SHOTGUN_MODEL,
    }),
  },
  {
    id: "tactical-rifles",
    label: "Tactical Rifles",
    enabled: false,
    weapons: [],
  },
];

export const defaultSelection = { categoryId: "submachine-guns", slotIndex: 0 };
