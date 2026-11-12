import { expect, test } from 'vitest';
import { rulerTicks } from '../webview/map-rulers.js';

test('aligns fixed rulers to a letterboxed grid with Z increasing upward', () => {
  const ticks = rulerTicks({
    width: 10, height: 5, viewport: { width: 200, height: 200 },
    view: { x: 0, y: 0, zoom: 1 }, selected: { x: 3, z: 3 },
  });
  expect(ticks.x.find(tick => tick.active).pixel).toBe(70);
  expect(ticks.z.find(tick => tick.active).pixel).toBe(80);
  expect(ticks.z.find(tick => tick.value === 0).pixel).toBe(140);
});

test('tracks the camera and omits offscreen coordinates', () => {
  const ticks = rulerTicks({
    width: 100, height: 50, viewport: { width: 400, height: 200 },
    view: { x: 20, y: 10, zoom: 2 }, selected: { x: 10, z: 25 },
  });
  expect(ticks.x.every(tick => tick.value >= 20 && tick.value < 70)).toBe(true);
  expect(ticks.x.some(tick => tick.active)).toBe(false);
  expect(ticks.z.find(tick => tick.active).pixel).toBe(116);
});

test.each([-70, 70])('keeps X ticks aligned while panning into side margins (%i)', x => {
  const ticks = rulerTicks({
    width: 96, height: 64, viewport: { width: 1280, height: 320 },
    view: { x, y: 0, zoom: 1 }, selected: { x: 48, z: 25 },
  });
  expect(ticks.x.map(tick => tick.value)).toEqual([0, 8, 16, 24, 32, 40, 48, 56, 64, 72, 80, 88]);
  expect(ticks.x.find(tick => tick.active)?.pixel).toBe(400 + (48.5 - x) * 5);
});
