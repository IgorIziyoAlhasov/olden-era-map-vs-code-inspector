# Olden Era map format research

The two supplied samples are gzip streams. All offsets below refer to
decompressed bytes and use half-open ranges. The 32-byte identifier is shared
between the samples and its meaning is unresolved. The version is 0.82.08.

| Section | Dia.Rush.map range | Dia.Rush.RS.map range | Encoding |
|---|---|---|---|
| Identifier | [0, 33) | [0, 33) | Length-prefixed UTF-8 |
| Version | [33, 41) | [33, 41) | Length-prefixed UTF-8 |
| Opaque header | [41, 43) | [41, 43) | Bytes 0d 00 |
| Scenario | [43, 3966) | [43, 3966) | Length-prefixed JSON |
| Adventure | [3966, 4016918) | [3966, 4038758) | Length-prefixed JSON |
| Dialog and quest data | [4016918, 4016966) | [4038758, 4038806) | Length-prefixed JSON |
| Comment and AI data | [4016966, 4017041) | [4038806, 4038881) | Length-prefixed JSON |

Each observed length is an unsigned base-128 integer with seven low bits per
byte and the high bit signaling continuation. The scenario prefix d1 1e encodes
3,921 bytes. The original adventure prefix 94 f7 f4 01 encodes 4,012,948 bytes.
The last two sections have 47 and 74 JSON bytes respectively. Both samples
end immediately after the fourth JSON object. The parser preserves the framing
and opaque bytes as Buffer views. An unrecognized tail is retained as one
range when its internal boundaries cannot be established. The fixed header
pattern and section order are based on this fixture pair.

## Scenario and adventure

Both maps report 256 × 256 and eight players via scenario.spawns.playersCount.
The scenario includes spawn slots, faction SIDs, hero information,
restrictions, mode and game settings. The adventure data carries fileMapName,
mapName, mapDesc, terrain arrays, settings and object property tables.
The observed mapName and mapDesc are empty strings. fileMapName is Dia.Rush
in both files. Access the original fields to preserve absent versus empty data.

## Objects

adventure.objects groups placements by sid. The ids, nodes, rotations and
levels arrays align by index. The separate adventure.squads collection is
outside the placement count. Unknown group fields and property tables remain
accessible through adventure and the raw section bytes.

| Metric | Original | Modified |
|---|---:|---:|
| Object groups | 477 | 476 |
| Object placements | 42,424 | 42,424 |
| prison | 60 | 0 |
| random-squad | 4,347 | 4,407 |
| city-spawner | 8 | 8 |
| random-city | 16 | 16 |
| propRandomSquads rows | 4,371 | 4,431 |

All 60 prison IDs occur as random-squad IDs in the modified map with identical
node, rotation and level. Their new objectsProperties.propRandomSquads rows
join by id and contain requestedValue 90000, fraction "", tier 0, and additional
fields retained by the parser. ID 2688 has node 16603, rotation 0 and level 0.
Each map has 24 property rows outside the random-squad join. In the original,
these IDs resolve to eight city-spawner and sixteen random-city placements.
The prototype retains these rows in the raw property table.
The city SIDs are observable categories. A general town classifier remains open.

## Coordinate verification

Nodes are stable placement indices in the fixture comparison. For a 256-wide
row-major grid, 16603 would decompose into remainder 219 and quotient 64.
The samples are square, so they cannot identify the stride axis. Neither axis
order, origin, layer encoding nor the terrain mapping has been confirmed.
The parser exposes node and level directly. Use an asymmetric rectangular
fixture with editor-recorded corner, off-axis and alternate-level placements
to establish stride, origin and layer mapping before emitting X/Z.

## Related implementations

The public Map Editor JSON Tool documents a separate scenario-script JSON
sidecar and a publish workflow. Its documentation does not establish the
binary map layout. The public Olden Era RMG Editor targets generator-template
JSON, while OldenEraExplorer inspects game assets and entity metadata. These
are potential sources of terminology and type metadata. The parser's format
claims come from the supplied bytes.

- [Map Editor JSON Tool](https://github.com/mimiasei/map-editor-json-tool)
- [Olden Era RMG Editor](https://github.com/GendizerGaming/olden-era-rmg-editor)
- [OldenEraExplorer](https://github.com/laszlo-gilanyi/OldenEraExplorer)

The STDU fork at commit d9572058d5e0caad06c88c25cc9a72b2f17211d8 also
reads length-prefixed chunks after the two header bytes. It documents 05 00
for three-chunk maps and 0d 00 when the fourth script chunk is present.
The parser accepts both header variants. Add a real
05 00 fixture to verify compatibility beyond the synthetic regression. STDU's grid code uses
X = node % sizeX and Z = floor(node / sizeX), which is independent source
evidence for the candidate mapping above. A rectangular in-game reference
is still needed to verify the displayed coordinates and layers.
STDU also documents propRandomSquads usage for some city or portal
garrisons, and uses a (type, id) key. The prototype's join is limited to
the fixture-backed random-squad placement category.

- [STDU map container and property handling](https://github.com/IgorIziyoAlhasov/map-editor-json-tool-stdu/blob/d9572058d5e0caad06c88c25cc9a72b2f17211d8/src/lib/map-write.ts)
- [STDU grid indexing](https://github.com/IgorIziyoAlhasov/map-editor-json-tool-stdu/blob/d9572058d5e0caad06c88c25cc9a72b2f17211d8/src/lib/rmg/generate-random-map.ts)
