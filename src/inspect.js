import { parseMapFile } from './parser.js';

const [path, id] = process.argv.slice(2);
try {
  if (!path || (id !== undefined && !/^\d+$/.test(id))) {
    throw new Error('Usage: node src/inspect.js <map-path> [object-id]');
  }
  const { headerId, version, sections, scenario, adventure, stats, warnings, objects } =
    await parseMapFile(path);
  console.log(JSON.stringify({
    headerId, version, sections: sections.map(({ name, start, dataStart, end }) => ({
      name, start, dataStart, end,
    })),
    scenario, mapName: adventure.mapName, fileMapName: adventure.fileMapName,
    mapDescription: adventure.mapDesc, stats, warnings,
    matches: id === undefined ? undefined : objects.filter(object => object.id === Number(id))
      ,
  }, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
