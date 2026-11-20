// Fixed scenes for screenshots: ?shot=editor shows the editor with a sample
// photo loaded; ?shot=cover shows the finished cover alone. `photo` picks the
// sample (samples/<photo>.jpg), `caption` the title, `layout` the panel layout,
// `size` the export size (e.g. 1080x1350), `grades` a comma list of colour
// grades, one per panel. window.__shotReady is set once painted.
import { SIZES } from './cover.js';

const CROPS = [
  { zoom: 1.15, dx: 0, dy: -0.04 },
  { zoom: 1.9, dx: 0.18, dy: 0.08 },
  { zoom: 1.7, dx: -0.22, dy: -0.1 },
  { zoom: 1.35, dx: 0, dy: 0.12 },
  { zoom: 2.1, dx: -0.08, dy: 0.16 },
  { zoom: 1.5, dx: 0.12, dy: -0.14 },
];

export async function runShot(shot, query, api) {
  const { addSamplePhoto, applyLayout, state, photos, captionInput, subtitleInput, redraw, setStatus } = api;
  const photo = query.get('photo') ?? 'pier';
  const caption = query.get('caption') ?? 'Sunset Heist';
  const subtitle = query.get('subtitle') ?? 'NEON COAST';
  const layout = query.get('layout') ?? 'cover-story';
  const grades = (query.get('grades') ?? 'sunset,neon,noir,palm').split(',').map((g) => g.trim());
  const [w, h] = (query.get('size') ?? '1080x1080').split('x').map(Number);
  const size = SIZES.find((s) => s.w === w && s.h === h) ?? SIZES[0];
  state.size = size;
  document.querySelectorAll('#sizes button').forEach((b) => {
    b.classList.toggle('active', b.dataset.size === size.id);
  });

  applyLayout(layout);
  const index = await addSamplePhoto(photo);
  state.panels.forEach((panel, i) => {
    panel.photo = index;
    panel.grade = grades[i % grades.length];
    const crop = CROPS[i % CROPS.length];
    panel.zoom = crop.zoom;
    panel.dx = crop.dx;
    panel.dy = crop.dy;
  });
  state.title = caption;
  captionInput.value = caption;
  state.subtitle = subtitle;
  subtitleInput.value = subtitle;
  if (shot === 'cover') document.body.classList.add('shot-cover');
  redraw();
  if (api.refreshPanelControls) api.refreshPanelControls();
  setStatus(`Screenshot scene: ${layout}, ${size.w} × ${size.h}, “${caption}”.`);
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  window.__shotReady = true;
}
