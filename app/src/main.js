// Neon Coast editor: wires the controls to the cover renderer. Photos are read
// on the person's own machine and never uploaded anywhere; the app works fully
// offline. A `?shot=` query sets up a fixed scene for a screenshot instead
// (see ./shots.js). Exposes window.__coverStudio so the cover can be driven
// and exported from a test harness.
import { GRADES, LAYOUTS, SIZES, TITLE_COLORS, defaultPanels, defaultState, drawCover, exportCoverPNG, panelAt, renderCover } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const captionInput = document.getElementById('caption');
const subtitleInput = document.getElementById('subtitle');
const statusEl = document.getElementById('status');
const photoInput = document.getElementById('photo');
const thumbStrip = document.getElementById('thumbs');
const panelLabel = document.getElementById('panel-label');
const zoomInput = document.getElementById('zoom');
const panXInput = document.getElementById('panx');
const panYInput = document.getElementById('pany');
const gradeRow = document.getElementById('grades');
const flipButton = document.getElementById('flip');
const clearButton = document.getElementById('clear-panel');
const fillAllButton = document.getElementById('fill-all');

const state = defaultState();
const photos = [];
let selected = 0;
let fontsReady = false;

function setStatus(text) {
  statusEl.textContent = text;
}

function redraw() {
  drawCover(canvas, state, photos, selected);
}

function refreshPanelControls() {
  const panel = state.panels[selected];
  const count = state.panels.length;
  panelLabel.textContent = `Panel ${selected + 1} of ${count} — ${panel.photo == null ? 'empty' : photos[panel.photo]?.name ?? 'photo'}`;
  zoomInput.value = String(panel.zoom);
  panXInput.value = String(panel.dx);
  panYInput.value = String(panel.dy);
  gradeRow.querySelectorAll('button').forEach((b) => {
    b.classList.toggle('active', b.dataset.grade === panel.grade);
  });
  flipButton.classList.toggle('active', panel.flip);
}

function refreshThumbs() {
  thumbStrip.innerHTML = '';
  photos.forEach((photo, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'thumb';
    button.title = `${photo.name} — click to put it in the selected panel`;
    const img = document.createElement('img');
    img.src = photo.url;
    img.alt = photo.name;
    button.appendChild(img);
    button.addEventListener('click', () => {
      state.panels[selected].photo = i;
      setStatus(`${photo.name} is in panel ${selected + 1}.`);
      refreshPanelControls();
      redraw();
    });
    thumbStrip.appendChild(button);
  });
  if (photos.length === 0) {
    const hint = document.createElement('span');
    hint.className = 'thumb-hint';
    hint.textContent = 'No photos yet — add your own or try a sample below.';
    thumbStrip.appendChild(hint);
  }
}

function selectPanel(i) {
  if (i < 0 || i >= state.panels.length) return;
  selected = i;
  refreshPanelControls();
  redraw();
}

function applyLayout(layoutId) {
  const oldPanels = state.panels;
  state.layout = layoutId;
  state.panels = defaultPanels(layoutId);
  // Keep each photo where it was: panel i keeps panel i's photo.
  state.panels.forEach((panel, i) => {
    if (oldPanels[i]) {
      panel.photo = oldPanels[i].photo;
      panel.grade = oldPanels[i].grade;
    }
  });
  selected = 0;
  document.querySelectorAll('#layouts button').forEach((b) => {
    b.classList.toggle('active', b.dataset.layout === layoutId);
  });
  refreshPanelControls();
  redraw();
}

function applySize(sizeId) {
  state.size = SIZES.find((s) => s.id === sizeId) ?? SIZES[0];
  document.querySelectorAll('#sizes button').forEach((b) => {
    b.classList.toggle('active', b.dataset.size === sizeId);
  });
  redraw();
}

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${url}`));
    img.src = url;
  });
}

async function addPhotoFile(file) {
  const url = URL.createObjectURL(file);
  const img = await loadImage(url);
  const index = photos.length;
  photos.push({ img, url, name: file.name });
  // Fill the first empty panel, or the selected one if it is empty.
  const target = state.panels.findIndex((p) => p.photo == null);
  state.panels[target === -1 ? selected : target].photo = index;
  refreshThumbs();
  refreshPanelControls();
  redraw();
  return index;
}

async function addSamplePhoto(sample, caption) {
  const img = await loadImage(`samples/${sample}.jpg`);
  const index = photos.length;
  photos.push({ img, url: `samples/${sample}.jpg`, name: `${sample}.jpg` });
  refreshThumbs();
  return index;
}

function downloadBlob(blob, filename) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 60_000);
}

async function exportOne(size) {
  setStatus(`Exporting ${size.w} × ${size.h}…`);
  const blob = await exportCoverPNG(state, photos, size.w, size.h);
  downloadBlob(blob, `neon-coast-cover-${size.w}x${size.h}.png`);
  setStatus(`Saved neon-coast-cover-${size.w}x${size.h}.png (${Math.round(blob.size / 1024)} KiB).`);
}

async function exportAllSizes() {
  for (const size of SIZES) {
    await exportOne(size);
  }
  setStatus('Saved all three sizes: 1080×1080, 1080×1350, 1920×1080.');
}

// ---- controls ----
photoInput.addEventListener('change', async (e) => {
  const files = [...(e.target.files ?? [])].filter((f) => f.type.startsWith('image/'));
  if (!files.length) return;
  try {
    for (const file of files) await addPhotoFile(file);
    setStatus(`${files.length} photo${files.length > 1 ? 's' : ''} added. Click a thumbnail to place it, or drag on a panel to move it.`);
  } catch (err) {
    setStatus(`Could not read that photo: ${err.message}`);
  }
  photoInput.value = '';
});

document.querySelectorAll('#samples button').forEach((button) => {
  button.addEventListener('click', async () => {
    const sample = button.dataset.sample;
    const index = await addSamplePhoto(sample);
    const empty = state.panels.findIndex((p) => p.photo == null);
    state.panels[empty === -1 ? selected : empty].photo = index;
    setStatus(`Sample photo ${sample}.jpg is in. Try a layout, a grade, or your own photo.`);
    refreshPanelControls();
    redraw();
  });
});

document.querySelectorAll('#layouts button').forEach((button) => {
  button.addEventListener('click', () => applyLayout(button.dataset.layout));
});

document.querySelectorAll('#sizes button').forEach((button) => {
  button.addEventListener('click', () => applySize(button.dataset.size));
});

captionInput.addEventListener('input', () => {
  state.title = captionInput.value;
  redraw();
});
subtitleInput.addEventListener('input', () => {
  state.subtitle = subtitleInput.value;
  redraw();
});

document.querySelectorAll('#title-colors button').forEach((button) => {
  button.addEventListener('click', () => {
    state.titleColor = button.dataset.color;
    document.querySelectorAll('#title-colors button').forEach((b) => {
      b.classList.toggle('active', b === button);
    });
    redraw();
  });
});

zoomInput.addEventListener('input', () => {
  state.panels[selected].zoom = Number(zoomInput.value);
  redraw();
});
panXInput.addEventListener('input', () => {
  state.panels[selected].dx = Number(panXInput.value);
  redraw();
});
panYInput.addEventListener('input', () => {
  state.panels[selected].dy = Number(panYInput.value);
  redraw();
});

Object.keys(GRADES).forEach((grade) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.grade = grade;
  button.textContent = GRADES[grade].label;
  button.addEventListener('click', () => {
    state.panels[selected].grade = grade;
    refreshPanelControls();
    redraw();
  });
  gradeRow.appendChild(button);
});

flipButton.addEventListener('click', () => {
  state.panels[selected].flip = !state.panels[selected].flip;
  refreshPanelControls();
  redraw();
});

clearButton.addEventListener('click', () => {
  state.panels[selected].photo = null;
  refreshPanelControls();
  redraw();
});

fillAllButton.addEventListener('click', () => {
  const source = state.panels[selected].photo ?? photos.findIndex(() => true);
  if (source == null || source < 0) {
    setStatus('Add a photo first — then Fill all panels will spread it across the cover.');
    return;
  }
  state.panels.forEach((panel) => { panel.photo = source; });
  setStatus('One photo across every panel — drag each panel to frame a different crop.');
  refreshPanelControls();
  redraw();
});

document.getElementById('export').addEventListener('click', () => exportOne(state.size));
document.getElementById('export-all').addEventListener('click', exportAllSizes);

// ---- canvas interaction: click to select a panel, drag to pan, wheel to zoom ----
let drag = null;

function canvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY,
    nx: ((e.clientX - rect.left) / rect.width),
    ny: ((e.clientY - rect.top) / rect.height),
  };
}

canvas.addEventListener('pointerdown', (e) => {
  const { nx, ny } = canvasPoint(e);
  const hit = panelAt(state.layout, nx, ny);
  if (hit === -1) return;
  selectPanel(hit);
  const panel = state.panels[hit];
  if (panel.photo == null) return;
  canvas.setPointerCapture(e.pointerId);
  drag = { startX: e.clientX, startY: e.clientY, dx: panel.dx, dy: panel.dy };
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const rect = canvas.getBoundingClientRect();
  const panel = state.panels[selected];
  panel.dx = drag.dx + (e.clientX - drag.startX) / rect.width;
  panel.dy = drag.dy + (e.clientY - drag.startY) / rect.height;
  panel.dx = Math.max(-0.6, Math.min(0.6, panel.dx));
  panel.dy = Math.max(-0.6, Math.min(0.6, panel.dy));
  panXInput.value = String(panel.dx);
  panYInput.value = String(panel.dy);
  redraw();
});
canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const { nx, ny } = canvasPoint(e);
  const hit = panelAt(state.layout, nx, ny);
  if (hit === -1) return;
  selectPanel(hit);
  const panel = state.panels[hit];
  panel.zoom = Math.max(0.8, Math.min(3, panel.zoom * (e.deltaY < 0 ? 1.08 : 0.93)));
  zoomInput.value = String(panel.zoom);
  redraw();
}, { passive: false });

// ---- boot ----
window.__coverStudio = {
  state,
  photos,
  exportCoverPNG,
  renderCover,
  addSamplePhoto,
  applyLayout,
  applySize,
  selectPanel,
  redraw,
};

async function boot() {
  try {
    await document.fonts.load('900 100px "CoverDisplay"');
    await document.fonts.ready;
    fontsReady = true;
  } catch {
    fontsReady = false; // the canvas falls back to Arial Black
  }
  const shot = new URLSearchParams(location.search).get('shot');
  if (shot) {
    await runShot(shot, new URLSearchParams(location.search), {
      addSamplePhoto,
      applyLayout,
      applySize,
      redraw,
      refreshPanelControls,
      state,
      photos,
      captionInput,
      subtitleInput,
      setStatus,
    });
  } else {
    refreshThumbs();
    refreshPanelControls();
    redraw();
    setStatus('Add a photo to begin — or try a sample below.');
  }
}

boot();
