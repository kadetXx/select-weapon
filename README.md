# Select Weapon

A 3D FPS weapon select HUD for the web. Browse weapon categories and inspect 3D models in real time, styled after a console shooter's loadout screen.

## Tech

- **Three.js**: 3D browser rendering (glTF/GLB, WebP-compressed textures, Meshopt-compressed geometry)
- **Vanilla JS**: UI state and interactions
- **HTML/CSS**: layout and styling
- **Vite**: dev server and production build
- **Meshy**: 3D weapon models

## Getting started

```bash
npm install
npm run dev
```

Other scripts:

```bash
npm run build     # production build to dist/
npm run preview   # serve the production build locally
```

## Deployment

Pushes to `main` build and deploy automatically to GitHub Pages via the workflow in `.github/workflows/deploy.yml`.
