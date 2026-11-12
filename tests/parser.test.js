import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { test } from 'vitest';
import { gzipSync, gunzipSync } from 'node:zlib';
import { parseMap, parseMapFile } from '../src/parser.js';

function frame(text) {
  const data = Buffer.from(text);
  let size = data.length;
  const prefix = [];
  while (size >= 128) {
    prefix.push((size % 128) + 128);
    size = Math.floor(size / 128);
  }
  return Buffer.concat([Buffer.from([...prefix, size]), data]);
}

function fixture({ version = '0.82.08', scenario = {}, adventure = { objects: [] },
  tail = Buffer.alloc(0) } = {}) {
  return gzipSync(Buffer.concat([
    frame('a'.repeat(32)), frame(version), Buffer.from([13, 0]),
    frame(JSON.stringify(scenario)), frame(JSON.stringify(adventure)),
    frame('{}'), frame('{}'), tail,
  ]));
}

test('P0-01 rejects invalid gzip and truncation at both layers', async () => {
  await assert.rejects(parseMap(Buffer.from('plain text')), /Expected.*gzip/);
  await assert.rejects(parseMap(fixture().subarray(0, 20)), /Invalid.*gzip/);
  const raw = gunzipSync(fixture());
  await assert.rejects(parseMap(gzipSync(raw.subarray(0, 46))), /Cannot decode adventure/);
});

test('P0-02 preserves UTF-8 byte boundaries, absent fields and opaque bytes', async () => {
  const tail = Buffer.from([255, 254, 0]);
  const compressed = fixture({ scenario: { title: 'מפה', desc: '' }, tail });
  const map = await parseMap(compressed);
  assert.equal(map.scenario.title, 'מפה');
  assert.equal(map.scenario.desc, '');
  assert.equal(Object.hasOwn(map.scenario, 'spawns'), false);
  assert.deepEqual(map.sections.at(-1).raw, tail);
  assert.deepEqual(Buffer.concat(map.sections.map(section => section.raw)), gunzipSync(compressed));
});

test('P0-03 warns about unverified versions and rejects misaligned columns', async () => {
  assert.match((await parseMap(fixture({ version: '0.83.00' }))).warnings[0], /Unverified/);
  const adventure = { objects: [{ sid: 'prison', ids: [1], nodes: [], rotations: [], levels: [] }] };
  await assert.rejects(parseMap(fixture({ adventure })), /Invalid object columns/);
});

test('P0-04 enforces compressed and decompressed size limits', async () => {
  await assert.rejects(parseMap(Buffer.alloc(32 * 1024 * 1024 + 1)), /exceeds/);
  await assert.rejects(parseMap(gzipSync(Buffer.alloc(64 * 1024 * 1024 + 1))), /oversized gzip/);
});

test('P0-05 compares both maps and verifies byte-for-byte integrity', {
  skip: !process.env.OLDEN_ERA_FIXTURES,
}, async () => {
  const paths = ['Dia.Rush.map', 'Dia.Rush.RS.map'].map(name => resolve(process.env.OLDEN_ERA_FIXTURES, name));
  const hashes = [
    '8fbc33d2282cb29e7f0362adc329646da91ff9dcf93d927d2e1918ef7680e373',
    'f3cefa6922706cc6a343546a0289d8ba4f73a8ec9c059676a10de03a0769eb6e',
  ];
  async function verifyHashes() {
    for (const [index, path] of paths.entries()) {
      assert.equal(createHash('sha256').update(await readFile(path)).digest('hex'), hashes[index]);
    }
  }
  await verifyHashes();
  const [original, modified] = await Promise.all(paths.map(parseMapFile));
  await verifyHashes();
  for (const map of [original, modified]) {
    assert.equal(map.version, '0.82.08');
    assert.equal(map.stats.total, 42424);
    assert.deepEqual([map.stats.sizeX, map.stats.sizeZ, map.stats.players], [256, 256, 8]);
    assert.equal(map.sections.find(section => section.name === 'adventure').dataStart, 3970);
  }
  assert.deepEqual(original.sections.map(section => section.end), [33, 41, 43, 3966, 4016918, 4016966, 4017041]);
  assert.deepEqual(modified.sections.map(section => section.end), [33, 41, 43, 3966, 4038758, 4038806, 4038881]);
  assert.deepEqual([original.stats.prisons, original.stats.randomSquads], [60, 4347]);
  assert.deepEqual([modified.stats.prisons, modified.stats.randomSquads], [0, 4407]);
  const replacementById = new Map(modified.objects.map(object => [object.id, object]));
  for (const object of original.objects.filter(object => object.sid === 'prison')) {
    const replacement = replacementById.get(object.id);
    assert.equal(replacement.sid, 'random-squad');
    for (const key of ['node', 'rotation', 'level']) assert.equal(replacement[key], object[key]);
    assert.equal(replacement.properties.length, 1);
    assert.equal(replacement.properties[0].requestedValue, 90000);
    assert.equal(replacement.properties[0].fraction, '');
  }
});

test('P1-01 opens the three-section header variant', async () => {
  const bytes = gunzipSync(fixture());
  bytes[41] = 0x05;
  const map = await parseMap(gzipSync(bytes.subarray(0, -3)));
  assert.equal(map.sections.at(-1).name, 'dialogQuestData');
  assert.deepEqual(map.warnings, []);
  bytes[41] = 0x06;
  await assert.rejects(parseMap(gzipSync(bytes)), /header layout: 0600/);
});
