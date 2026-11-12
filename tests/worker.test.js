import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { Worker } from 'node:worker_threads';
import { test } from 'vitest';

async function readMap(path, inspect) {
  const worker = new Worker(new URL('../src/map-worker.js', import.meta.url), { workerData: path });
  try {
    const snapshot = await new Promise((resolveResult, reject) => {
      worker.once('message', resolveResult);
      worker.once('error', reject);
      worker.once('exit', code => reject(new Error(`Worker exited with code ${code}`)));
    });
    if (inspect) {
      await inspect(async (type, payload) => {
        const response = new Promise((resolveResult, reject) => {
          worker.once('message', resolveResult);
          worker.once('error', reject);
        });
        worker.postMessage({ requestId: 1, type, ...payload });
        return (await response).result;
      });
    }
    return snapshot;
  } finally {
    await worker.terminate();
  }
}

test('P1-02 sends a readable error when the map cannot be opened', async () => {
  assert.match((await readMap('missing-test-map.map')).error, /ENOENT/);
});

test('P1-03 loads a compact summary from a real fixture', {
  skip: !process.env.OLDEN_ERA_FIXTURES,
}, async () => {
  const result = await readMap(resolve(process.env.OLDEN_ERA_FIXTURES, 'Dia.Rush.RS.map'));
  assert.equal(result.summary.version, '0.82.08');
  assert.equal(result.summary.stats.total, 42424);
  assert.equal(result.summary.stats.randomSquads, 4407);
  assert.equal(result.summary.sections.at(-1).end, 4038881);
});

test('P2-01 filters, pages and inspects real Random Squad placements', {
  skip: !process.env.OLDEN_ERA_FIXTURES,
}, async () => {
  await readMap(resolve(process.env.OLDEN_ERA_FIXTURES, 'Dia.Rush.RS.map'), async request => {
    const page = await request('query', { sid: 'random-squad', sort: 'id', page: 1 });
    assert.equal(page.total, 4407);
    assert.equal(page.page, 1);
    assert.equal(page.rows.length, 50);
    assert.ok(page.rows.every((row, index) => !index || row.id >= page.rows[index - 1].id));
    const exact = await request('query', { sid: 'random-squad', field: 'id', search: '2688' });
    assert.equal(exact.total, 1);
    const [{ groupIndex, index, node }] = exact.rows;
    assert.equal(node, 16603);
    const detail = await request('detail', { groupIndex, index });
    assert.equal(detail.properties[0].requestedValue, 90000);
    assert.equal(detail.fields.sid, 'random-squad');
    const byNode = await request('query', { field: 'node', search: '16603' });
    assert.ok(byNode.rows.some(row => row.id === 2688));
    const empty = await request('query', { sid: 'prison' });
    assert.equal(empty.total, 0);
  });
});

test.skipIf(!process.env.OLDEN_ERA_FIXTURES)('compares and stages only checked placements across pages', async () => {
  await readMap(resolve(process.env.OLDEN_ERA_FIXTURES, 'Dia.Rush.map'), async request => {
    const first = await request('query', { sid: 'prison', page: 0 });
    const second = await request('query', { sid: 'prison', page: 1 });
    const placements = [first.rows[0], second.rows[0]];
    const compared = await request('compare', { placements });
    assert.deepEqual(compared.map(row => row.fields.ids), placements.map(row => row.id));
    const selected = placements.map(row => `${row.groupIndex}:${row.index}`);
    const removed = await request('removeMatches', { selected, count: 2 });
    assert.deepEqual(removed.map(row => row.key).sort(), [...selected].sort());
    assert.equal((await request('query', { sid: 'prison', removed: selected })).total, 58);
    assert.equal((await request('query', { sid: 'prison' })).total, 60);
    const { parseMap } = await import('../src/parser.js');
    const copy = await parseMap(await request('saveCopy', { removed: selected, edits: [] }));
    assert.equal(copy.stats.prisons, 58);
    assert.ok(placements.every(row => !copy.objects.some(object => object.id === row.id)));
  });
});
