import hotspots from './cursors/hotspots.json';
import { markerIcon } from './icons.jsx';

const images = import.meta.glob('./cursors/*.png', { eager: true, query: '?inline', import: 'default' });

export function mapCursor(name, fallback = 'default') {
  const url = images[`./cursors/${name}.png`];
  const hotspot = hotspots[name]?.hotspot;
  return url && hotspot ? `url("${url}") ${hotspot.join(' ')}, ${fallback}` : fallback;
}

export function placementCursor(row) {
  if (!row) return mapCursor('map-pointer');
  const name = `hover-${markerIcon(row.sid).split('/').at(-1)}`;
  return mapCursor(Object.hasOwn(hotspots, name) ? name : 'hover-other', 'pointer');
}
