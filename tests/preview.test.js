import { join } from 'node:path';
import { expect, test } from 'vitest';
import { createObjectExplorer } from '../src/object-explorer.js';
import { parseMapFile } from '../src/parser.js';

test('P3-01 filters surface placements and rejects nodes outside a rectangular map', () => {
  const placement = { sid: 'barracks', id: 1, groupIndex: 0, index: 0, level: 0, node: 5858 };
  const explorer = createObjectExplorer([
    placement,
    { ...placement, level: 1 },
    { ...placement, node: 6144 },
    { ...placement, node: -1 },
    { ...placement, id: 2, sid: 'mine', node: 6143 },
  ], { sizeX: 96, sizeZ: 64 });
  expect(explorer.preview({}).map(({ x, z }) => [x, z])).toEqual([[2, 61], [95, 63]]);
  expect(explorer.preview({ sid: 'mine', search: '2', field: 'id' })).toHaveLength(1);
  expect(explorer.preview({ sid: 'mine', search: '1', field: 'id' })).toEqual([]);
});

const fixtures = process.env.OLDEN_ERA_PREVIEW_FIXTURES;
test.skipIf(!fixtures)('P3-02 matches all three editor-reported tiles', async () => {
  const { objects, stats } = await parseMapFile(join(fixtures, 'empty.96x64(1).map'));
  expect([stats.sizeX, stats.sizeZ]).toEqual([96, 64]);
  expect(createObjectExplorer(objects, stats).preview({}).map(({ sid, x, z }) => [sid, x, z]))
    .toEqual([
      ['barracks_human_7', 2, 61],
      ['barracks_neutral_11', 13, 55],
      ['barracks_dungeon_7', 5, 51],
    ]);
});
