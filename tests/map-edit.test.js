import { join } from 'node:path';
import { expect, test } from 'vitest';
import { buildEditedMap } from '../src/map-edit.js';
import { parseMap, parseMapFile } from '../src/parser.js';

const fixtures = process.env.OLDEN_ERA_EDIT_FIXTURES;
test.skipIf(!fixtures)('saves two moves together while preserving linked guard records', async () => {
  const original = await parseMapFile(join(fixtures, 'empty.96x64.with-guards(2).map'));
  const edits = [[0, 5762], [3, 5765]].map(([id, node]) => {
    const { groupIndex, index } = original.objects.find(row => row.id === id);
    return { groupIndex, index, node };
  });
  const copy = await parseMap(await buildEditedMap(original, { edits }));
  expect(copy.objects.map(row => row.node)).toEqual([5762, 5765, 5293, 4901]);
  expect(original.objects.map(row => row.node)).toEqual([5858, 5861, 5293, 4901]);
  expect(copy.adventure.objectsProperties).toEqual(original.adventure.objectsProperties);
  const untouched = map => map.sections.filter(section => section.name !== 'adventure').map(section => section.raw);
  expect(untouched(copy)).toEqual(untouched(original));
});

test.skipIf(!process.env.OLDEN_ERA_FIXTURES)('removes all prisons across pages and cleans linked properties for a partial group', async () => {
  const { createObjectExplorer } = await import('../src/object-explorer.js');
  const original = await parseMapFile(join(process.env.OLDEN_ERA_FIXTURES, 'Dia.Rush.map'));
  const explorer = createObjectExplorer(original.objects);
  const prisons = explorer.find({ sid: 'prison' });
  expect(prisons).toHaveLength(60);
  const copy = await parseMap(await buildEditedMap(original, { edits: [] }, prisons));
  expect(copy.stats.prisons).toBe(0);
  expect(copy.stats.total).toBe(original.stats.total - 60);
  expect(copy.objects.map(({ id }) => id)).toEqual(original.objects.filter(row => row.sid !== 'prison').map(row => row.id));

  const hire = explorer.find({ field: 'id', search: '1476' });
  expect(hire[0].sid).toBe('random-hire');
  const partial = await parseMap(await buildEditedMap(original, { edits: [] }, hire));
  expect(partial.objects.some(row => row.id === 1476)).toBe(false);
  expect(partial.adventure.objectsProperties.propRandomHires).toEqual(
    original.adventure.objectsProperties.propRandomHires.filter(row => row.id !== 1476),
  );
});

test('working search excludes removed placements and matches staged destinations', async () => {
  const { createObjectExplorer } = await import('../src/object-explorer.js');
  const explorer = createObjectExplorer([
    { id: 1, sid: 'prison', node: 5, groupIndex: 0, index: 0 },
    { id: 2, sid: 'prison', node: 5, groupIndex: 0, index: 1 },
  ]);
  const working = { removed: ['0:0'], edits: [{ groupIndex: 0, index: 1, node: 9 }] };
  expect(explorer.query({ sid: 'prison', ...working }).total).toBe(1);
  expect(explorer.find({ field: 'node', search: '5', ...working })).toEqual([]);
  expect(explorer.find({ field: 'node', search: '9', ...working }).map(row => row.id)).toEqual([2]);
});

test('uses the same category filter for the list and the surface preview', async () => {
  const { createObjectExplorer } = await import('../src/object-explorer.js');
  const explorer = createObjectExplorer([
    { id: 1, sid: 'barracks_human_7', node: 5, groupIndex: 0, index: 0, level: 0 },
    { id: 2, sid: 'mine_gold', node: 6, groupIndex: 1, index: 0, level: 0 },
    { id: 3, sid: 'unrecognized', node: 7, groupIndex: 2, index: 0, level: 0 },
  ], { sizeX: 8, sizeZ: 8 });
  expect(explorer.query({ category: 'dwellings' }).rows.map(row => row.id)).toEqual([1]);
  expect(explorer.preview({ category: 'dwellings' }).map(row => row.id)).toEqual([1]);
  expect(explorer.find({ category: 'other' }).map(row => row.id)).toEqual([3]);
});
