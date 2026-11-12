import { expect, test } from 'vitest';
import { decodePlacementOrientation } from '../src/placement-orientation.js';

test.each([[0, 0, false], [10, 0, true], [2, 2, false], [12, 2, true]])(
  'decodes fixture rotation %i', (raw, rotation, mirrored) => {
    expect(decodePlacementOrientation(raw)).toEqual({ rotation, mirrored });
  },
);

test('leaves unfamiliar encodings undecoded', () => {
  for (const raw of [undefined, -1, 4, 9, 14, '12']) {
    expect(decodePlacementOrientation(raw)).toBeNull();
  }
});
