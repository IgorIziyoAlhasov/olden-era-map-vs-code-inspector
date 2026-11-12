// Fixture-backed property records use type 0 for adventure placements.
export function indexPlacementProperties(objects, tables) {
  const placementIds = new Set();
  const ambiguousIds = new Set();
  for (const { id } of objects) {
    if (placementIds.has(id)) ambiguousIds.add(id);
    placementIds.add(id);
  }

  const byId = new Map();
  for (const [table, records] of Object.entries(tables ?? {})) {
    if (!Array.isArray(records)) continue;
    for (const record of records) {
      if (record?.type !== 0 || !placementIds.has(record.id) || ambiguousIds.has(record.id)) continue;
      if (!byId.has(record.id)) byId.set(record.id, Object.create(null));
      const groups = byId.get(record.id);
      (groups[table] ??= []).push(record);
    }
  }
  return byId;
}
