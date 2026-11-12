import { join } from 'node:path';
import { expect, test } from 'vitest';
import { indexPlacementProperties } from '../src/object-properties.js';
import { parseMapFile } from '../src/parser.js';

test('links type 0 records to unique placements only and preserves all rows', () => {
  const records = [{ type: 0, id: 1, value: 0 }, { type: 0, id: 1, value: false }];
  const index = indexPlacementProperties([{ id: 1 }, { id: 2 }, { id: 2 }], {
    propExample: [...records, { type: 1, id: 1 }, { type: 0, id: 2 }, { type: 0, id: 3 }],
  });
  expect([...index.keys()]).toEqual([1]);
  expect(index.get(1).propExample).toEqual(records);
});

const fixtures = process.env.OLDEN_ERA_FIXTURES;
test.skipIf(!fixtures)('links several property tables in Dia.Rush.RS', async () => {
  const { objects, adventure } = await parseMapFile(join(fixtures, 'Dia.Rush.RS.map'));
  const index = indexPlacementProperties(objects, adventure.objectsProperties);
  expect(index.get(1476).propRandomHires[0]).toMatchObject({ tier: 3, fraction: 0 });
  expect(index.get(2688).propRandomSquads[0].requestedValue).toBe(90000);
  const city = index.get(objects.find(object => object.sid === 'city-spawner').id);
  expect(Object.keys(city)).toEqual(expect.arrayContaining(['propSpawns', 'propCities', 'propHeroes']));
});
