export function rulerTicks({ width, height, viewport, view, selected }) {
  const viewWidth = width / view.zoom;
  const viewHeight = height / view.zoom;
  const scale = Math.min(viewport.width / viewWidth, viewport.height / viewHeight);
  if (!Number.isFinite(scale) || scale <= 0) return { x: [], z: [] };

  function axis(length, pixels, span, origin, reversed, active) {
    const inset = (pixels - span * scale) / 2;
    const step = 2 ** Math.max(0, Math.ceil(Math.log2(38 / scale)));
    // SVG centers the viewBox, but content can still paint in its side margins.
    const start = origin - inset / scale;
    const end = start + pixels / scale;
    const low = reversed ? length - end : start;
    const high = reversed ? length - start : end;
    const marks = [];
    const first = Math.max(0, Math.ceil((low - .5) / step) * step);
    const last = Math.min(length - 1, Math.floor(high - .5));
    for (let value = first; value <= last; value += step) marks.push(value);
    if (Number.isInteger(active) && active >= low - .5 && active <= last && active >= 0) {
      const position = marks.indexOf(active);
      if (position < 0) marks.push(active);
    }
    return marks.map(value => ({
      value, active: value === active,
      pixel: inset + ((reversed ? length - value - .5 : value + .5) - origin) * scale,
    })).filter(mark => mark.pixel >= 0 && mark.pixel <= pixels);
  }

  return {
    x: axis(width, viewport.width, viewWidth, view.x, false, selected?.x),
    z: axis(height, viewport.height, viewHeight, view.y, true, selected?.z),
  };
}
