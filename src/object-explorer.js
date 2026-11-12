import { objectCategory } from './object-categories.js';

const pageSize = 50;

export function createObjectExplorer(objects, stats = {}) {
  const types = new Map();
  for (const object of objects) {
    const group = types.get(object.sid) ?? [];
    group.push(object);
    types.set(object.sid, group);
  }
  function find({ sid, search, field, category, removed = [], edits = [] }) {
    const term = typeof search === 'string' ? search.trim().slice(0, 128).toLowerCase() : '';
    const candidates = typeof sid === 'string' && sid ? types.get(sid) ?? [] : objects;
    const excluded = new Set(removed);
    const nodes = new Map(edits.filter(edit => edit.node !== undefined)
      .map(edit => [`${edit.groupIndex}:${edit.index}`, edit.node]));
    return candidates.flatMap(row => {
      const key = `${row.groupIndex}:${row.index}`;
      if (excluded.has(key) || (category && objectCategory(row.sid) !== category)) return [];
      return [nodes.has(key) ? { ...row, node: nodes.get(key) } : row];
    }).filter(row => !term ||
      (field !== 'id' && field !== 'node' && row.sid.toLowerCase().includes(term)) ||
      (field !== 'type' && field !== 'node' && String(row.id) === term) ||
      (field !== 'type' && field !== 'id' && String(row.node) === term));
  }
  return {
    find,
    types: [...types].map(([sid, rows]) => ({ sid, count: rows.length }))
      .sort((a, b) => b.count - a.count || a.sid.localeCompare(b.sid)),
    preview(filters) {
      const { sizeX, sizeZ } = stats;
      if (!Number.isSafeInteger(sizeX) || !Number.isSafeInteger(sizeZ) ||
          sizeX < 1 || sizeZ < 1 || !Number.isSafeInteger(sizeX * sizeZ)) {
        throw new Error('Map dimensions are unavailable or invalid.');
      }
      const rows = [];
      for (const row of find(filters)) {
        if (row.level !== 0 || !Number.isSafeInteger(row.node) ||
            row.node < 0 || row.node >= sizeX * sizeZ) continue;
        rows.push({
          x: row.node % sizeX,
          z: Math.floor(row.node / sizeX),
          id: row.id, sid: row.sid, groupIndex: row.groupIndex, index: row.index,
        });
      }
      return rows;
    },
    query({ page, sort, ...filters }) {
      const matches = find(filters);
      if (sort === 'id') matches.sort((a, b) => a.id - b.id);
      if (sort === 'node') matches.sort((a, b) => a.node - b.node);
      if (sort === 'type') matches.sort((a, b) => a.sid.localeCompare(b.sid));
      const pages = Math.max(1, Math.ceil(matches.length / pageSize));
      const index = Number.isSafeInteger(page) ? Math.max(0, Math.min(pages - 1, page)) : 0;
      const rows = matches.slice(index * pageSize, (index + 1) * pageSize)
        .map(({ properties, ...row }) => row);
      return { rows, total: matches.length, page: index, pages };
    },
  };
}
