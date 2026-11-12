import { parentPort, workerData } from 'node:worker_threads';
import { buildEditedMap } from './map-edit.js';
import { parseMapFile } from './parser.js';
import { indexPlacementProperties } from './object-properties.js';
import { createObjectExplorer } from './object-explorer.js';

try {
  const map = await parseMapFile(workerData);
  const { version, sections, scenario, adventure, stats, warnings, objects } = map;
  const propertiesById = indexPlacementProperties(objects, adventure.objectsProperties);
  const explorer = createObjectExplorer(objects, stats);
  parentPort.postMessage({
    summary: {
      version, fileMapName: adventure.fileMapName, name: adventure.mapName,
      description: adventure.mapDesc, mode: scenario.gameMode,
      stats: {
        players: stats.players, sizeX: stats.sizeX, sizeZ: stats.sizeZ,
        total: stats.total, prisons: stats.prisons, randomSquads: stats.randomSquads,
      },
      sections: sections.map(({ name, start, end }) => ({ name, start, end })),
      warnings, types: explorer.types,
      scenario: {
        spawns: scenario.spawns,
        restrictions: scenario.banInfoData,
        heroSettings: scenario.heroesInfos,
        startSettings: scenario.startSettings,
        mapSettings: adventure.settings,
      },
    },
  });
  function detail({ groupIndex, index }) {
    const group = adventure.objects[groupIndex];
    if (!Number.isSafeInteger(groupIndex) || !Number.isSafeInteger(index) ||
        index < 0 || !group || index >= group.ids.length) {
      throw new Error('Object placement was not found.');
    }
    const propertyGroups = propertiesById.get(group.ids[index]) ?? {};
    const properties = group.sid === 'random-squad' ? propertyGroups.propRandomSquads ?? [] : [];
    const fields = Object.fromEntries(Object.entries(group).map(([key, value]) => [
      key, Array.isArray(value) && value.length === group.ids.length ? value[index] : value,
    ]));
    return { fields, properties, propertyGroups };
  }
  parentPort.on('message', async ({ requestId, type, ...request }) => {
    try {
      if (type === 'query') {
        parentPort.postMessage({ requestId, result: explorer.query(request) });
      } else if (type === 'preview') {
        parentPort.postMessage({ requestId, result: explorer.preview(request) });
      } else if (type === 'saveCopy') {
        const removed = new Set(request.removed ?? []);
        const matches = objects.filter(row => removed.has(`${row.groupIndex}:${row.index}`));
        if (matches.length !== removed.size) throw new Error('A removed placement could not be found.');
        parentPort.postMessage({ requestId, result: await buildEditedMap(map, request, matches) });
      } else if (type === 'removeMatches') {
        const { sid, search, category, count } = request;
        const selected = Array.isArray(request.selected) ? new Set(request.selected) : null;
        if (!selected && !sid && !category && !search?.trim()) throw new Error('Set a search or object type first.');
        const matches = selected
          ? explorer.find({ removed: request.removed }).filter(row => selected.has(`${row.groupIndex}:${row.index}`))
          : explorer.find(request);
        if (!matches.length || matches.length !== count) throw new Error('The match count changed. Run the search again.');
        parentPort.postMessage({ requestId, result: matches.map(row => ({
          key: `${row.groupIndex}:${row.index}`, sid: row.sid,
        })) });
      } else if (type === 'detail') {
        parentPort.postMessage({ requestId, result: detail(request) });
      } else if (type === 'compare') {
        const { placements } = request;
        if (!Array.isArray(placements) || placements.length < 2 || placements.length > 4) {
          throw new Error('Select two to four objects.');
        }
        const results = placements.map(detail);
        if (results.some(row => row.fields.sid !== results[0].fields.sid)) {
          throw new Error('Select objects with the same type.');
        }
        parentPort.postMessage({ requestId, result: results });
      }
    } catch (error) {
      parentPort.postMessage({ requestId, error: error.message });
    }
  });
} catch (error) {
  parentPort.postMessage({ error: error.message });
}
