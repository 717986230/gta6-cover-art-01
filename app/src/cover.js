// Neon Coast cover renderer: turns photos + a caption into multi-panel,
// comic-guttered cover art with a sunset / neon colour grade, drawn on canvas.
// All geometry is normalised (0..1) so one layout renders at any export size.
// The lettering font is "CoverDisplay", a heavy condensed face shipped under
// app/fonts (Noto Sans Condensed Black, SIL Open Font License). Nothing here
// copies Rockstar art, logos or fonts: every shape and gradient is original.

export const SIZES = [
  { id: 'square', w: 1080, h: 1080, label: 'Square 1080 × 1080' },
  { id: 'portrait', w: 1080, h: 1350, label: 'Portrait 1080 × 1350' },
  { id: 'wide', w: 1920, h: 1080, label: 'Wide 1920 × 1080' },
];

export const GRADES = {
  sunset: {
    label: 'Sunset',
    filter: 'saturate(1.35) contrast(1.08) sepia(0.22) brightness(1.02)',
    overlay: ['overlay', 0.34, ['rgba(255, 140, 60, 0)', 'rgba(255, 60, 140, 1)']],
  },
  neon: {
    label: 'Neon',
    filter: 'saturate(1.7) contrast(1.18) hue-rotate(-18deg)',
    overlay: ['overlay', 0.3, ['rgba(0, 255, 255, 1)', 'rgba(255, 0, 180, 1)']],
  },
  noir: {
    label: 'Noir',
    filter: 'grayscale(1) contrast(1.3) brightness(1.08)',
    overlay: null,
  },
  palm: {
    label: 'Palm',
    filter: 'saturate(1.25) contrast(1.05) hue-rotate(14deg)',
    overlay: ['soft-light', 0.5, ['rgba(0, 180, 160, 1)', 'rgba(190, 255, 120, 1)']],
  },
  original: { label: 'Original', filter: 'none', overlay: null },
};

export const TITLE_COLORS = {
  white: { label: 'White', fill: ['#ffffff', '#ffe9c9'] },
  sunset: { label: 'Sunset', fill: ['#ffd166', '#ff5e78'] },
  neon: { label: 'Neon', fill: ['#7df9ff', '#ff5ce1'] },
  gold: { label: 'Gold', fill: ['#fff3b0', '#f5a623'] },
};

// Panel polygons, clockwise from the top-left corner, in normalised units.
// Shared edges use the same coordinates so the gutters line up.
export const LAYOUTS = {
  'cover-story': {
    label: 'Cover Story',
    hint: 'Hero panel, two side panels, one wide strip',
    panels: [
      [[0, 0], [0.64, 0], [0.58, 0.62], [0, 0.66]],
      [[0.64, 0], [1, 0], [1, 0.3], [0.611, 0.3]],
      [[0.611, 0.3], [1, 0.3], [1, 0.66], [0.58, 0.62]],
      [[0, 0.66], [0.58, 0.62], [1, 0.66], [1, 1], [0, 1]],
    ],
  },
  'six-panel': {
    label: 'Six Panel',
    hint: 'Three across, two rows, slanted gutters',
    panels: [
      [[0, 0], [0.36, 0], [0.33, 0.5], [0, 0.52]],
      [[0.36, 0], [0.68, 0], [0.65, 0.5], [0.33, 0.5]],
      [[0.68, 0], [1, 0], [1, 0.5], [0.65, 0.5]],
      [[0, 0.52], [0.33, 0.5], [0.3, 1], [0, 1]],
      [[0.33, 0.5], [0.65, 0.5], [0.62, 1], [0.3, 1]],
      [[0.65, 0.5], [1, 0.5], [1, 1], [0.62, 1]],
    ],
  },
  duo: {
    label: 'Duo',
    hint: 'Two panels split on a diagonal',
    panels: [
      [[0, 0], [0.58, 0], [0.42, 1], [0, 1]],
      [[0.58, 0], [1, 0], [1, 1], [0.42, 1]],
    ],
  },
  hero: {
    label: 'Hero',
    hint: 'One full-bleed photo',
    panels: [[[0, 0], [1, 0], [1, 1], [0, 1]]],
  },
};

export function defaultPanels(layoutId) {
  return LAYOUTS[layoutId].panels.map(() => ({
    photo: null,
    zoom: 1,
    dx: 0,
    dy: 0,
    grade: 'sunset',
    flip: false,
  }));
}

export function defaultState() {
  return {
    layout: 'cover-story',
    size: SIZES[0],
    title: 'Sunset Heist',
    subtitle: 'NEON COAST',
    titleColor: 'white',
    panels: defaultPanels('cover-story'),
  };
}

/** Ray-casting hit test: which panel (index) holds normalised point (nx, ny)? */
export function panelAt(layoutId, nx, ny) {
  const panels = LAYOUTS[layoutId].panels;
  for (let i = panels.length - 1; i >= 0; i--) {
    const poly = panels[i];
    let inside = false;
    for (let a = 0, b = poly.length - 1; a < poly.length; b = a++) {
      const [ax, ay] = poly[a];
      const [bx, by] = poly[b];
      if (ay > ny !== by > ny && nx < ((bx - ax) * (ny - ay)) / (by - ay) + ax) inside = !inside;
    }
    if (inside) return i;
  }
  return -1;
}

function polyPath(ctx, poly, w, h) {
  ctx.beginPath();
  ctx.moveTo(poly[0][0] * w, poly[0][1] * h);
  for (let i = 1; i < poly.length; i++) ctx.lineTo(poly[i][0] * w, poly[i][1] * h);
  ctx.closePath();
}

function drawSunsetBackdrop(ctx, w, h) {
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#1b1035');
  sky.addColorStop(0.42, '#7b2d8b');
  sky.addColorStop(0.72, '#ff7e5f');
  sky.addColorStop(1, '#feb47b');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);
  // Low sun glowing through the gutters.
  const sun = ctx.createRadialGradient(w * 0.74, h * 0.16, 0, w * 0.74, h * 0.16, w * 0.26);
  sun.addColorStop(0, 'rgba(255, 222, 150, 0.95)');
  sun.addColorStop(0.45, 'rgba(255, 140, 90, 0.55)');
  sun.addColorStop(1, 'rgba(255, 140, 90, 0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, w, h);
  // Faint horizon haze.
  const haze = ctx.createLinearGradient(0, h * 0.55, 0, h * 0.8);
  haze.addColorStop(0, 'rgba(255, 190, 120, 0)');
  haze.addColorStop(1, 'rgba(255, 190, 120, 0.18)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, w, h);
}

function drawPhotoPanel(ctx, img, poly, panel, w, h) {
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  const bx = Math.min(...xs) * w;
  const by = Math.min(...ys) * h;
  const bw = (Math.max(...xs) - Math.min(...xs)) * w;
  const bh = (Math.max(...ys) - Math.min(...ys)) * h;
  const grade = GRADES[panel.grade] ?? GRADES.sunset;
  const cx = bx + bw / 2 + panel.dx * bw;
  const cy = by + bh / 2 + panel.dy * bh;
  const base = Math.max(bw / img.naturalWidth, bh / img.naturalHeight) * panel.zoom;
  const dw = img.naturalWidth * base;
  const dh = img.naturalHeight * base;

  ctx.save();
  polyPath(ctx, poly, w, h);
  ctx.clip();
  if (panel.flip) {
    ctx.translate(cx, cy);
    ctx.scale(-1, 1);
    ctx.translate(-cx, -cy);
  }
  ctx.filter = grade.filter;
  ctx.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
  ctx.filter = 'none';
  if (grade.overlay) {
    const [mode, alpha, stops] = grade.overlay;
    const g = ctx.createLinearGradient(bx, by, bx + bw * 0.25, by + bh);
    g.addColorStop(0, stops[0]);
    g.addColorStop(1, stops[1]);
    ctx.globalCompositeOperation = mode;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = g;
    ctx.fillRect(bx, by, bw, bh);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  // Gentle vignette for comic depth.
  const v = ctx.createRadialGradient(cx, cy, Math.min(bw, bh) * 0.35, cx, cy, Math.max(bw, bh) * 0.75);
  v.addColorStop(0, 'rgba(0, 0, 0, 0)');
  v.addColorStop(1, 'rgba(0, 0, 0, 0.26)');
  ctx.fillStyle = v;
  ctx.fillRect(bx, by, bw, bh);
  ctx.restore();
}

function drawEmptyPanel(ctx, poly, w, h) {
  ctx.save();
  polyPath(ctx, poly, w, h);
  ctx.clip();
  const g = ctx.createLinearGradient(0, 0, w * 0.2, h);
  g.addColorStop(0, 'rgba(255, 255, 255, 0.10)');
  g.addColorStop(1, 'rgba(255, 255, 255, 0.02)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function drawPanelBorders(ctx, layoutId, w, h, selected) {
  const panels = LAYOUTS[layoutId].panels;
  panels.forEach((poly, i) => {
    // Soft drop shadow under the panel.
    ctx.save();
    ctx.translate(w * 0.008, h * 0.008);
    polyPath(ctx, poly, w, h);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.30)';
    ctx.fill();
    ctx.restore();
    // Black outer line, then the white comic gutter.
    polyPath(ctx, poly, w, h);
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#14081f';
    ctx.lineWidth = Math.max(4, w * 0.011);
    ctx.stroke();
    polyPath(ctx, poly, w, h);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = Math.max(2, w * 0.005);
    ctx.stroke();
    if (i === selected) {
      polyPath(ctx, poly, w, h);
      ctx.strokeStyle = '#ffd166';
      ctx.lineWidth = Math.max(3, w * 0.004);
      ctx.setLineDash([w * 0.02, w * 0.012]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  });
}

/** Fit the title to at most two lines inside maxWidth, shrinking as needed. */
function fitTitleLines(ctx, text, maxWidth, startSize) {
  let size = startSize;
  while (size > 24) {
    ctx.font = `900 ${size}px "CoverDisplay", "Arial Black", sans-serif`;
    try { ctx.letterSpacing = `${Math.round(size * 0.02)}px`; } catch { /* older canvas */ }
    const words = text.split(/\s+/).filter(Boolean);
    const lines = [];
    let line = '';
    for (const word of words) {
      const trial = line ? `${line} ${word}` : word;
      if (ctx.measureText(trial).width <= maxWidth || !line) line = trial;
      else { lines.push(line); line = word; }
    }
    if (line) lines.push(line);
    if (lines.length <= 2 && lines.every((l) => ctx.measureText(l).width <= maxWidth)) {
      return { lines, size };
    }
    size -= 4;
  }
  ctx.font = `900 ${size}px "CoverDisplay", "Arial Black", sans-serif`;
  return { lines: [text], size };
}

function drawCaption(ctx, state, w, h) {
  const title = (state.title ?? '').trim().toUpperCase();
  const subtitle = (state.subtitle ?? '').trim().toUpperCase();
  if (!title && !subtitle) return;
  const colors = TITLE_COLORS[state.titleColor] ?? TITLE_COLORS.white;

  // Dark scrim so the lettering reads over any photo.
  const scrim = ctx.createLinearGradient(0, h * 0.62, 0, h);
  scrim.addColorStop(0, 'rgba(10, 5, 20, 0)');
  scrim.addColorStop(0.45, 'rgba(10, 5, 20, 0.55)');
  scrim.addColorStop(1, 'rgba(10, 5, 20, 0.78)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, h * 0.62, w, h * 0.38);

  ctx.save();
  ctx.translate(w / 2, h * 0.965);
  ctx.rotate(-0.026); // a slight tilt, like a poster logo
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // Lay the block out bottom-up with explicit gaps, so the gradient bar can
  // never touch the tagline or the title: title top -> gap -> bar -> gap ->
  // tagline. All positions are negative offsets from the title's last baseline.
  let titleTop = 0;
  let titleSize = 0;
  let titleLines = [];
  if (title) {
    const fit = fitTitleLines(ctx, title, w * 0.92, Math.round(h * 0.115));
    titleLines = fit.lines;
    titleSize = fit.size;
    const lineHeight = titleSize * 1.02;
    const colors = TITLE_COLORS[state.titleColor] ?? TITLE_COLORS.white;
    const fill = ctx.createLinearGradient(0, -titleSize * titleLines.length, 0, 0);
    fill.addColorStop(0, colors.fill[0]);
    fill.addColorStop(1, colors.fill[1]);
    ctx.font = `900 ${titleSize}px "CoverDisplay", "Arial Black", sans-serif`;
    try { ctx.letterSpacing = `${Math.round(titleSize * 0.02)}px`; } catch { /* older canvas */ }
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#14081f';
    ctx.lineWidth = titleSize * 0.15;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
    ctx.shadowBlur = titleSize * 0.1;
    ctx.shadowOffsetY = titleSize * 0.03;
    titleLines.forEach((line, i) => {
      const y = -(titleLines.length - 1 - i) * lineHeight;
      ctx.strokeText(line, 0, y);
      ctx.fillStyle = fill;
      ctx.fillText(line, 0, y);
    });
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    titleTop = -((titleLines.length - 1) * lineHeight + titleSize * 0.75);
  }
  if (title && subtitle) {
    // Gradient accent bar between the title and the tagline.
    const barH = Math.max(4, titleSize * 0.055);
    const barCenter = titleTop - titleSize * 0.3;
    const barW = Math.min(w * 0.5, ctx.measureText(titleLines[0]).width * 0.55);
    const bar = ctx.createLinearGradient(-barW / 2, 0, barW / 2, 0);
    bar.addColorStop(0, '#ff7e5f');
    bar.addColorStop(0.5, '#ffd166');
    bar.addColorStop(1, '#ff5ce1');
    ctx.fillStyle = bar;
    ctx.beginPath();
    ctx.roundRect(-barW / 2, barCenter - barH / 2, barW, barH, barH / 2);
    ctx.fill();
    const subSize = Math.max(18, Math.round(h * 0.026));
    const subBaseline = barCenter - barH / 2 - subSize * 0.9 - subSize * 0.15;
    ctx.font = `900 ${subSize}px "CoverDisplay", "Arial Black", sans-serif`;
    try { ctx.letterSpacing = `${Math.round(subSize * 0.22)}px`; } catch { /* older canvas */ }
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#14081f';
    ctx.lineWidth = Math.max(2, subSize * 0.16);
    ctx.strokeText(subtitle, 0, subBaseline);
    ctx.fillStyle = '#ffd166';
    ctx.fillText(subtitle, 0, subBaseline);
  } else if (subtitle) {
    const subSize = Math.max(18, Math.round(h * 0.026));
    ctx.font = `900 ${subSize}px "CoverDisplay", "Arial Black", sans-serif`;
    try { ctx.letterSpacing = `${Math.round(subSize * 0.22)}px`; } catch { /* older canvas */ }
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#14081f';
    ctx.lineWidth = Math.max(2, subSize * 0.16);
    ctx.strokeText(subtitle, 0, -subSize * 0.2);
    ctx.fillStyle = '#ffd166';
    ctx.fillText(subtitle, 0, -subSize * 0.2);
  }
  ctx.restore();
  try { ctx.letterSpacing = '0px'; } catch { /* older canvas */ }
}

/** Draws the cover described by `state` onto `canvas` (sized to state.size). */
export function drawCover(canvas, state, photos, selected = -1) {
  const ctx = canvas.getContext('2d');
  const { w, h } = state.size;
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  drawSunsetBackdrop(ctx, w, h);
  const panels = LAYOUTS[state.layout].panels;
  panels.forEach((poly, i) => {
    const panel = state.panels[i];
    // A photo entry is { img, url, name }; a bare image is accepted too.
    const entry = panel && panel.photo != null ? photos[panel.photo] : null;
    const img = entry ? entry.img ?? entry : null;
    if (img) drawPhotoPanel(ctx, img, poly, panel, w, h);
    else drawEmptyPanel(ctx, poly, w, h);
  });
  drawPanelBorders(ctx, state.layout, w, h, selected);
  drawCaption(ctx, state, w, h);
}

/** Renders the cover at an arbitrary size into a fresh canvas. */
export function renderCover(state, photos, w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  drawCover(canvas, { ...state, size: { w, h } }, photos, -1);
  return canvas;
}

/** Renders the cover at `w` x `h` and resolves with a PNG blob. */
export function exportCoverPNG(state, photos, w, h) {
  return new Promise((resolve, reject) => {
    renderCover(state, photos, w, h).toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('PNG export failed'));
    }, 'image/png');
  });
}
