import { open } from 'node:fs/promises';
import { promisify, TextDecoder } from 'node:util';
import { gunzip } from 'node:zlib';

const decompress = promisify(gunzip);
const utf8 = new TextDecoder('utf-8', { fatal: true });
const inputLimit = 32 * 1024 * 1024;
const outputLimit = 64 * 1024 * 1024;
const objectLimit = 250_000;

export async function parseMapFile(path) {
  const file = await open(path, 'r');
  try {
    const { size, isRegularFile } = await file.stat().then(stat => ({
      size: stat.size, isRegularFile: stat.isFile(),
    }));
    if (!isRegularFile || size > inputLimit) throw new Error('Expected a regular map file up to 32 MiB.');
    const bytes = Buffer.alloc(size + 1);
    let offset = 0;
    while (offset < bytes.length) {
      const { bytesRead } = await file.read(bytes, offset, bytes.length - offset, offset);
      if (!bytesRead) break;
      offset += bytesRead;
    }
    if (offset !== size) throw new Error('Map size changed while reading.');
    return await parseMap(bytes.subarray(0, size));
  } finally {
    await file.close();
  }
}

export async function parseMap(compressed) {
  if (compressed.length > inputLimit) throw new Error('Compressed map exceeds 32 MiB.');
  if (compressed[0] !== 0x1f || compressed[1] !== 0x8b) throw new Error('Expected an Olden Era gzip map.');
  let bytes;
  try {
    bytes = await decompress(compressed, { maxOutputLength: outputLimit });
  } catch (error) {
    throw new Error('Invalid, truncated, or oversized gzip map.', { cause: error });
  }

  let cursor = 0;
  const sections = [];
  const warnings = [];
  function take(length) {
    const start = cursor;
    cursor += length;
    if (cursor > bytes.length) throw new Error(`Truncated payload at byte ${start}.`);
    return bytes.subarray(start, cursor);
  }
  function lengthPrefix() {
    let length = 0;
    for (let shift = 0; shift <= 28; shift += 7) {
      const byte = take(1)[0];
      length += (byte & 127) * 2 ** shift;
      if (length > outputLimit) throw new Error('Section length exceeds limit.');
      if (byte < 128) return length;
    }
    throw new Error('Invalid section length prefix.');
  }
  function record(name, start, dataStart) {
    sections.push({ name, start, dataStart, end: cursor, raw: bytes.subarray(start, cursor) });
  }
  function readString(name) {
    const start = cursor;
    const length = lengthPrefix();
    const dataStart = cursor;
    const value = utf8.decode(take(length));
    record(name, start, dataStart);
    return value;
  }
  function readObject(name) {
    let value;
    try {
      value = JSON.parse(readString(name));
    } catch (error) {
      throw new Error(`Cannot decode ${name}: ${error.message}`, { cause: error });
    }
    if (!value || Array.isArray(value) || typeof value !== 'object') {
      throw new Error(`Expected a JSON object in ${name}.`);
    }
    return value;
  }
  const headerId = readString('headerId');
  const version = readString('version');
  if (!/^[a-f0-9]{32}$/i.test(headerId) || !/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error('Unrecognized Olden Era header.');
  }
  if (version !== '0.82.08') warnings.push(`Unverified game version ${version}.`);
  const flagStart = cursor;
  const headerBytes = take(2);
  record('opaqueHeader', flagStart, flagStart);
  if (![0x05, 0x0d].includes(headerBytes[0]) || headerBytes[1] !== 0) {
    throw new Error(`Unsupported Olden Era header layout: ${headerBytes.toString('hex')}.`);
  }
  const scenario = readObject('scenario');
  const adventure = readObject('adventure');
  const trailing = [];
  const trailingNames = headerBytes[0] === 0x0d
    ? ['dialogQuestData', 'commentAiData']
    : ['dialogQuestData'];
  for (const name of trailingNames) {
    if (cursor === bytes.length) {
      warnings.push(`Missing observed section ${name}.`);
      break;
    }
    const start = cursor;
    const sectionCount = sections.length;
    try {
      trailing.push(readObject(name));
    } catch {
      cursor = start;
      sections.length = sectionCount;
      warnings.push(`Unrecognized trailing data at byte ${start}.`);
      break;
    }
  }
  if (cursor < bytes.length) {
    const start = cursor;
    take(bytes.length - cursor);
    record('opaqueTail', start, start);
    warnings.push('Preserved opaque trailing bytes.');
  }
  if (!Array.isArray(adventure.objects)) throw new Error('Unsupported adventure object layout.');

  const squadsById = new Map();
  const squadProperties = adventure.objectsProperties?.propRandomSquads;
  if (squadProperties !== undefined && !Array.isArray(squadProperties)) {
    throw new Error('Unsupported Random Squad property layout.');
  }
  for (const property of squadProperties ?? []) {
    if (!Number.isSafeInteger(property?.id)) throw new Error('Invalid Random Squad property ID.');
    const matches = squadsById.get(property.id) ?? [];
    matches.push(property);
    squadsById.set(property.id, matches);
  }
  const counts = Object.create(null);
  const objects = [];
  const seenIds = new Set();
  const placementTypes = new Map();
  const matchedSquadIds = new Set();
  let duplicateIds = 0;
  for (const [groupIndex, group] of adventure.objects.entries()) {
    const { sid, ids, nodes, rotations, levels } = group ?? {};
    if (typeof sid !== 'string' || !Array.isArray(ids) ||
        ![nodes, rotations, levels].every(column => Array.isArray(column) && column.length === ids.length)) {
      throw new Error(`Invalid object columns at group ${groupIndex}.`);
    }
    if (objects.length + ids.length > objectLimit) throw new Error('Object count exceeds 250,000.');
    counts[sid] = (counts[sid] ?? 0) + ids.length;
    for (let index = 0; index < ids.length; index += 1) {
      const id = ids[index];
      const node = nodes[index];
      const rotation = rotations[index];
      const level = levels[index];
      if (![id, node, rotation, level].every(Number.isSafeInteger)) {
        throw new Error(`Invalid object column value at group ${groupIndex}, row ${index}.`);
      }
      if (seenIds.has(id)) duplicateIds += 1;
      placementTypes.set(id, seenIds.has(id) ? null : sid);
      seenIds.add(id);
      const properties = sid === 'random-squad' ? squadsById.get(id) ?? [] : [];
      if (properties.length) matchedSquadIds.add(id);
      objects.push({ sid, id, node, rotation, level, groupIndex, index, properties });
    }
  }
  if (duplicateIds) warnings.push(`${duplicateIds} repeated object ID occurrences.`);
  const unmatched = (squadProperties?.length ?? 0) -
    [...matchedSquadIds].reduce((total, id) => total + squadsById.get(id).length, 0);
  if (unmatched) {
    const categories = new Map();
    for (const property of squadProperties) {
      if (matchedSquadIds.has(property.id)) continue;
      const category = placementTypes.get(property.id) ?? 'unresolved or ambiguous ID';
      categories.set(category, (categories.get(category) ?? 0) + 1);
    }
    const breakdown = [...categories].map(([category, count]) => `${category} (${count})`).join(', ');
    warnings.push(`${unmatched} propRandomSquads rows outside random-squad placements resolve by ID as follows: ${breakdown}.`);
  }

  return {
    headerId, version, sections, scenario, adventure, trailing, warnings, objects,
    stats: {
      total: objects.length, counts, prisons: counts.prison ?? 0,
      randomSquads: counts['random-squad'] ?? 0,
      players: scenario.spawns?.playersCount,
      sizeX: scenario.sizeX, sizeZ: scenario.sizeZ,
    },
  };
}
