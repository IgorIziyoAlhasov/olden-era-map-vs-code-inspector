import { gzip } from 'node:zlib';
import { isDeepStrictEqual, promisify } from 'node:util';
import { decodePlacementOrientation } from './placement-orientation.js';

const compress = promisify(gzip);

function prefix(length) {
  const bytes = [];
  while (length >= 128) {
    bytes.push((length % 128) + 128);
    length = Math.floor(length / 128);
  }
  bytes.push(length);
  return Buffer.from(bytes);
}

// Locate an array member without serializing adjacent values.
function transformArray(text, key, transform) {
  const keys = [...text.matchAll(new RegExp(`${JSON.stringify(key).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:\\s*\\[`, 'g'))];
  if (keys.length !== 1) throw new Error(`Cannot uniquely locate ${key}.`);
  const start = keys[0].index + keys[0][0].length;
  const tokens = /"(?:[^"\\]|\\[\s\S])*"|[\[\]{},]/g;
  tokens.lastIndex = start;
  let depth = 0;
  const members = [];
  let rowStart = start;
  for (let token; (token = tokens.exec(text));) {
    const char = token[0];
    if (depth === 0 && (char === ',' || char === ']')) {
      members.push(text.slice(rowStart, token.index));
      if (char === ']') {
        return text.slice(0, start) + transform(members).join(',') + text.slice(token.index);
      }
      rowStart = tokens.lastIndex;
    } else if (char === '[' || char === '{') depth += 1;
    else if (char === ']' || char === '}') depth -= 1;
  }
  throw new Error(`Cannot read ${key} array.`);
}

function editArrayMember(text, key, index, edit) {
  return transformArray(text, key, members => {
    if (index >= members.length) throw new Error(`Cannot locate row ${index} in ${key}.`);
    members[index] = edit(members[index]);
    return members;
  });
}

function removePlacements(map, expected, text, removals) {
  const groups = new Map();
  const ids = new Set();
  const counts = new Map();
  for (const { id } of map.objects) counts.set(id, (counts.get(id) ?? 0) + 1);
  for (const { groupIndex, index, id } of removals) {
    if (counts.get(id) !== 1) throw new Error('A matched placement has an ambiguous ID.');
    ids.add(id);
    if (!groups.has(groupIndex)) groups.set(groupIndex, new Set());
    groups.get(groupIndex).add(index);
  }
  text = transformArray(text, 'objects', members => members.flatMap((member, groupIndex) => {
    const removed = groups.get(groupIndex);
    if (!removed) return [member];
    const group = expected.objects[groupIndex];
    const length = group.ids.length;
    if (removed.size === length) return [];
    for (const [key, column] of Object.entries(group)) {
      if (!Array.isArray(column) || column.length !== length) continue;
      group[key] = column.filter((_, index) => !removed.has(index));
      member = transformArray(member, key, values => values.filter((_, index) => !removed.has(index)));
    }
    return [member];
  }));
  expected.objects = expected.objects.filter((_, index) => groups.get(index)?.size !== map.adventure.objects[index].ids.length);

  const isRemovedProperty = record => record?.type === 0 && ids.has(record.id);
  for (const [key, records] of Object.entries(expected.objectsProperties ?? {})) {
    if (!Array.isArray(records) || !records.some(isRemovedProperty)) continue;
    const removed = new Set();
    records.forEach((record, index) => { if (isRemovedProperty(record)) removed.add(index); });
    expected.objectsProperties[key] = records.filter((_, index) => !removed.has(index));
    text = transformArray(text, key, values => values.filter((_, index) => !removed.has(index)));
  }
  return text;
}

function patchPlacement(map, expected, text, { groupIndex, index, rotation, mirrored, countGrowth, node }) {
  const placement = map.objects.find(row => row.groupIndex === groupIndex && row.index === index);
  if (!placement) throw new Error('Object placement was not found.');
  if (node !== undefined) {
    const { sizeX, sizeZ } = map.stats;
    if (placement.level !== 0 || !Number.isSafeInteger(sizeX) || !Number.isSafeInteger(sizeZ) ||
        sizeX < 1 || sizeZ < 1 || !Number.isSafeInteger(sizeX * sizeZ) ||
        !Number.isSafeInteger(node) || node < 0 || node >= sizeX * sizeZ) {
      throw new Error('Choose a tile inside the surface map.');
    }
    expected.objects[groupIndex].nodes[index] = node;
    text = editArrayMember(text, 'objects', groupIndex, group =>
      editArrayMember(group, 'nodes', index, value => value.replace(/-?\d+/, String(node))));
  }
  if (rotation !== undefined || mirrored !== undefined) {
    if (!decodePlacementOrientation(placement.rotation) ||
        !Number.isInteger(rotation) || rotation < 0 || rotation > 3 || typeof mirrored !== 'boolean') {
      throw new Error('Invalid rotation or Mirror state.');
    }
    const raw = rotation + (mirrored ? 10 : 0);
    expected.objects[groupIndex].rotations[index] = raw;
    text = editArrayMember(text, 'objects', groupIndex, group =>
      editArrayMember(group, 'rotations', index, value => value.replace(/-?\d+/, String(raw))));
  }
  if (countGrowth !== undefined) {
    const table = expected.objectsProperties?.propGrowthUnits ?? [];
    const matches = table.map((record, i) => record.type === 0 && record.id === placement.id ? i : -1)
      .filter(i => i >= 0);
    if (!Number.isInteger(countGrowth) || countGrowth < 0 || countGrowth > 2147483647 ||
        matches.length !== 1 || map.objects.filter(row => row.id === placement.id).length !== 1 ||
        !Number.isInteger(table[matches[0]].countGrowth)) {
      throw new Error('Growth requires one existing, unambiguous record and a nonnegative 32-bit integer.');
    }
    const [row] = matches;
    table[row].countGrowth = countGrowth;
    text = editArrayMember(text, 'propGrowthUnits', row, record =>
      record.replace(/("countGrowth"\s*:\s*)-?\d+/, (_, key) => key + countGrowth));
  }
  return text;
}

export async function buildEditedMap(map, request, removals = []) {
  if (map.version !== '0.82.08') throw new Error('Copy editing is supported for map format 0.82.08.');
  const source = map.sections.find(section => section.name === 'adventure');
  let text = source.raw.subarray(source.dataStart - source.start).toString('utf8');
  const expected = JSON.parse(text);
  const edits = request.edits ?? [request];
  if (!Array.isArray(edits) || (!edits.length && !removals.length) || edits.length > map.objects.length) {
    throw new Error('Invalid placement edits.');
  }
  for (const edit of edits) text = patchPlacement(map, expected, text, edit);
  if (removals.length) text = removePlacements(map, expected, text, removals);
  if (!isDeepStrictEqual(JSON.parse(text), expected)) throw new Error('Edited map failed verification.');
  const data = Buffer.from(text);
  const bytes = await compress(Buffer.concat(map.sections.flatMap(section =>
    section === source ? [prefix(data.length), data] : [section.raw])));
  return bytes;
}
