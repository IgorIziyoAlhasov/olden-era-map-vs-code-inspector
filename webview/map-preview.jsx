import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { mapCursor, placementCursor } from './map-cursors.js';
import { rulerTicks } from './map-rulers.js';
import { Icon, iconPath, markerIcon } from './icons.jsx';

const empty = [];
const samePlacement = (a, b) => a?.groupIndex === b?.groupIndex && a?.index === b?.index;

export function MapPreview({ width, height, response, selection, checked, canMove, moves, applyMove, onSelect }) {
  const [camera, setCamera] = useState(null);
  const [moveMode, setMoveMode] = useState(false);
  const [hoverTile, setHoverTile] = useState(null);
  const drag = useRef(null);
  const svg = useRef(null);
  const view = camera ?? { x: 0, y: 0, zoom: 1 };
  const rows = response?.result ?? empty;
  const { tiles, markers } = useMemo(() => {
    const tiles = new Map();
    for (const original of rows) {
      const move = moves.get(`${original.groupIndex}:${original.index}`);
      const row = move?.node !== undefined ? { ...original, x: move.x, z: move.z } : original;
      const key = row.z * width + row.x;
      if (!tiles.has(key)) tiles.set(key, []);
      tiles.get(key).push(row);
    }
    const markers = Array.from(tiles.values(), ([row]) =>
      `M${row.x + .18} ${height - row.z - .82}h.64v.64h-.64z`).join('');
    return { tiles, markers };
  }, [rows, width, height, moves]);
  const rowsByKey = useMemo(() => new Map(rows.map(row => [`${row.groupIndex}:${row.index}`, row])), [rows]);
  const original = rows.find(row => samePlacement(row, selection));
  const appliedMove = selection && moves.get(`${selection.groupIndex}:${selection.index}`);
  const selected = original && (appliedMove?.node !== undefined ? appliedMove : original);
  const visibleGlyphs = useMemo(() => {
    if (width / view.zoom > 80 || height / view.zoom > 80) return [];
    const glyphs = [];
    for (const stack of tiles.values()) {
      const row = stack.find(item => checked.has(`${item.groupIndex}:${item.index}`)) ?? stack[0];
      const y = height - 1 - row.z;
      if (row.x + 1 < view.x || row.x > view.x + width / view.zoom ||
          y + 1 < view.y || y > view.y + height / view.zoom) continue;
      glyphs.push({ row, y, icon: markerIcon(row.sid) });
      if (glyphs.length > 350) return [];
    }
    return glyphs;
  }, [tiles, checked, width, height, view.x, view.y, view.zoom]);
  const checkedTiles = [...checked].flatMap(([key]) => {
    const move = moves.get(key);
    const row = rowsByKey.get(key);
    return row ? [move?.node !== undefined ? move : row] : [];
  });
  const zoom = useCallback((factor, anchor) => {
    setCamera(current => {
      const { x, y, zoom } = current ?? { x: 0, y: 0, zoom: 1 };
      const next = Math.max(1, Math.min(32, zoom * factor));
      const pivot = anchor ?? { x: x + width / zoom / 2, y: y + height / zoom / 2 };
      return { x: pivot.x - (pivot.x - x) * zoom / next,
        y: pivot.y - (pivot.y - y) * zoom / next, zoom: next };
    });
  }, [width, height]);
  useEffect(() => {
    const element = svg.current;
    if (!element) return;
    function wheel(event) {
      event.preventDefault();
      if (drag.current || !event.deltaY) return;
      const matrix = element.getScreenCTM()?.inverse();
      if (matrix) zoom(event.deltaY < 0 ? 1.2 : 1 / 1.2, point(event, matrix));
    }
    element.addEventListener('wheel', wheel, { passive: false });
    return () => element.removeEventListener('wheel', wheel);
  }, [zoom, response?.error]);
  function tileAt({ x, y }) {
    if (x < 0 || x >= width || y < 0 || y >= height) return null;
    const column = Math.floor(x);
    const z = height - 1 - Math.floor(y);
    return { x: column, z, node: z * width + column };
  }
  const destination = hoverTile ?? selection?.destination;
  function point(event, matrix) {
    return new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix);
  }
  function updateHoverCursor(event) {
    const element = svg.current;
    const matrix = element?.getScreenCTM()?.inverse();
    if (!matrix) return;
    const tile = tileAt(point(event, matrix));
    const stack = tile && tiles.get(tile.node);
    const row = stack && (stack.find(item => samePlacement(item, selection)) ?? stack[0]);
    element.style.cursor = row && canMove && moveMode
      ? mapCursor('move-object', 'move') : placementCursor(row);
  }
  function start(event) {
    if (event.button !== 0) return;
    const matrix = svg.current.getScreenCTM()?.inverse();
    if (!matrix) return;
    svg.current.focus();
    const origin = point(event, matrix);
    const tile = tileAt(origin);
    const stack = tile && tiles.get(tile.node);
    const object = canMove && moveMode && stack &&
      (stack.find(row => samePlacement(row, selection)) ?? stack[0]);
    drag.current = { matrix, start: origin, view, object, pointerId: event.pointerId,
      clientX: event.clientX, clientY: event.clientY, moved: false };
    svg.current.setPointerCapture(event.pointerId);
  }
  function move(event) {
    const active = drag.current;
    if (!active) {
      updateHoverCursor(event);
      return;
    }
    if (active.pointerId !== event.pointerId) return;
    active.moved ||= Math.hypot(event.clientX - active.clientX, event.clientY - active.clientY) >= 4;
    if (!active.moved) return;
    const current = point(event, active.matrix);
    if (active.object) {
      const tile = tileAt(current);
      svg.current.style.cursor = tile ? mapCursor('move-object', 'move') : mapCursor('move-blocked', 'not-allowed');
      setHoverTile(tile);
      return;
    }
    svg.current.style.cursor = mapCursor('panning', 'grabbing');
    setCamera({ ...active.view, x: active.view.x + active.start.x - current.x,
      y: active.view.y + active.start.y - current.y });
  }
  function end(event) {
    const active = drag.current;
    if (!active || active.pointerId !== event.pointerId) return;
    drag.current = null;
    updateHoverCursor(event);
    setHoverTile(null);
    const tile = tileAt(point(event, active.matrix));
    if (!tile) return;
    if (active.moved) {
      const row = active.object;
      if (row && (row.x !== tile.x || row.z !== tile.z)) {
        const origin = rows.find(candidate => samePlacement(candidate, row));
        onSelect({ ...row, originalNode: moves.get(`${row.groupIndex}:${row.index}`)?.originalNode ?? (origin.z * width + origin.x), destination: tile }, svg.current);
      }
      return;
    }
    const stack = tiles.get(tile.node);
    if (!stack) return;
    const next = stack[(stack.findIndex(row => samePlacement(row, selection)) + 1) % stack.length];
    onSelect(samePlacement(next, selection) ? selection : next, svg.current, event.ctrlKey || event.metaKey);
  }
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const hasCanvas = !response?.error && width > 0 && height > 0;
  useEffect(() => {
    const element = svg.current;
    if (!element) return;
    const observer = new ResizeObserver(([{ contentRect }]) => {
      setViewport({ width: contentRect.width, height: contentRect.height });
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasCanvas]);
  const ticks = rulerTicks({ width, height, viewport, view, selected });
  return <div className="results-pane map-preview">
    <div className="pane-heading map-heading"><h2><Icon name="controls/compass" />Map preview</h2>
      <span>{width} × {height} · Level 0</span></div>
    <div className="map-toolbar">
      <button type="button" aria-label="Zoom in" title="Zoom in" onClick={() => zoom(1.5)} disabled={!!response?.error}><Icon name="controls/zoom-in" /></button>
      <button type="button" aria-label="Zoom out" title="Zoom out" onClick={() => zoom(1 / 1.5)} disabled={!!response?.error}><Icon name="controls/zoom-out" /></button>
      <button type="button" aria-label="Fit map" title="Fit map" onClick={() => setCamera(null)}><Icon name="controls/fit-map" /></button>
      {canMove && <button type="button" aria-pressed={moveMode}
        onClick={() => setMoveMode(value => !value)}><Icon name="controls/move-objects" />Move objects</button>}
      {selection?.destination && <>
        <button type="button" onClick={() => applyMove(selection.destination)}>Apply move</button>
        <button type="button" onClick={() => onSelect({
          ...selection, destination: undefined,
        }, svg.current)}>Discard move</button>
      </>}
      {appliedMove?.node !== undefined && !selection.destination && <button type="button"
        onClick={() => applyMove(null)}>Undo move</button>}
      {selected && <span>X {selected.x}, Z {selected.z}</span>}
    </div>
    {!response && <p role="status">Loading placements…</p>}
    {response?.error && <p role="alert">{response.error}</p>}
    {response?.result && rows.length === 0 && <p role="status">No matching placements on level 0.</p>}
    {hasCanvas && <div className="map-with-rulers">
      <div className="ruler-corner" aria-hidden="true">X/Z</div>
      <div className="map-ruler ruler-x" aria-hidden="true">
        {ticks.x.map(tick => <span key={tick.value} className={tick.active ? 'ruler-active' : undefined}
          style={{ left: tick.pixel }}>{tick.value}</span>)}
      </div>
      <div className="map-ruler ruler-z" aria-hidden="true">
        {ticks.z.map(tick => <span key={tick.value} className={tick.active ? 'ruler-active' : undefined}
          style={{ top: tick.pixel }}>{tick.value}</span>)}
      </div>
      <svg className="map-canvas" ref={svg} tabIndex={0} aria-label="Surface map preview. Scroll to zoom. Drag to pan, or drag a marker when Move objects is on."
        viewBox={`${view.x} ${view.y} ${width / view.zoom} ${height / view.zoom}`}
        style={{ '--map-pointer': mapCursor('map-pointer') }}
        onPointerEnter={updateHoverCursor} onPointerDown={start} onPointerMove={move} onPointerUp={end}
        onPointerLeave={() => { if (!drag.current) svg.current.style.cursor = ''; }}
        onLostPointerCapture={() => {
          if (!drag.current) return;
          drag.current = null;
          svg.current.style.cursor = '';
          setHoverTile(null);
        }}
        onKeyDown={event => {
          const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
          const direction = Object.hasOwn(directions, event.key) && directions[event.key];
          if (!direction) return;
          event.preventDefault();
          setCamera({ ...view, x: view.x + direction[0] * width / view.zoom / 10,
            y: view.y + direction[1] * height / view.zoom / 10 });
        }}>
        <defs>
          <pattern id="map-grid" width="1" height="1" patternUnits="userSpaceOnUse">
            <path d="M 0 1 V 0 H 1" className="map-grid-line" />
          </pattern>
        </defs>
        <rect width={width} height={height} className="map-ground" />
        <rect width={width} height={height} fill="url(#map-grid)" />
        {!visibleGlyphs.length && <path className="map-markers" d={markers} />}
        {checkedTiles.length > 0 && <path className="map-checked" d={checkedTiles.map(row =>
          `M${row.x} ${height - 1 - row.z}h1v1h-1z`).join('')} />}
        {visibleGlyphs.map(({ row, y, icon }) => <path key={`${row.x}:${y}`} className="map-glyph"
          d={iconPath(icon)} transform={`translate(${row.x} ${y}) scale(.0625)`} />)}
        {selected && <rect x={selected.x} y={height - 1 - selected.z}
          width="1" height="1" className="map-selected" />}
        {destination && <rect x={destination.x} y={height - 1 - destination.z}
          width="1" height="1" className="map-destination" />}
      </svg>
    </div>}
  </div>;
}
