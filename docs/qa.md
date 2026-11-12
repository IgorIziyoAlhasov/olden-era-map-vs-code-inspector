# Phase 0 QA · Hybrid QA Reporting Protocol v1.0

Environment was Linux with Node.js 24.22.1. Run the tests with
OLDEN_ERA_FIXTURES pointing to the two attached maps. Stable test IDs appear
in the test names.

| ID | Status | Evidence |
|---|---|---|
| P0-01 | PASS | Invalid gzip, truncated gzip and truncated framed payload rejected |
| P0-02 | PASS | UTF-8 byte lengths, empty versus absent fields, and opaque bytes verified |
| P0-03 | PASS | Synthetic alternate version warns and mismatched object columns reject |
| P0-04 | PASS | Compressed and decompressed caps enforced |
| P0-05 | PASS | Both fixture counts, all 60 conversions, exact offsets and input SHA-256 verified |
| P0-06 | BLOCKED | Needs a real alternate-version fixture |
| P0-07 | BLOCKED | Needs a rectangular map with editor-verified placements |
| MAP-001 / MAP-007 | NOT RUN | VS Code open, webview lifecycle, Windows and UI search await extension implementation |

Regression evidence is reproducible from tests/parser.test.js and the fixture
hashes stored there.

## Phase 1

| ID | Status | Evidence |
|---|---|---|
| P0-01 to P0-05 | PASS | Original parser regressions with both exact Phase 0 fixtures |
| P1-01 | PASS | Synthetic 05 00 header and unknown-header diagnostic |
| P1-02 | PASS | Worker returns a readable file error |
| P1-03 | PASS | Worker returns the expected summary for a real map |
| P1-04 | PASS | VSIX build and archive verification |
| P1-05 | NOT RUN | Windows VS Code installation, Explorer and Command Palette opening, reopen and disposal |

For P1-05, install the VSIX and open both fixtures. Expect 42,424 placements
on each, 60 prisons in Dia.Rush and 4,407 Random Squads in Dia.Rush.RS.
Close and reopen a map, then open a plain-text file named invalid.map and
check that the editor shows the gzip diagnostic.

## Phase 2

| ID | Status | Evidence |
|---|---|---|
| P2-01 | PASS | Real-fixture worker query, category filter, ID and node lookup, paging, sort and Random Squad details |
| P2-02 | NOT RUN | Windows VS Code UI smoke test |

For P2-02, install the new VSIX and open the exact modified Phase 0 fixture.
Click the Random Squads count, search for ID 2688 and open its details.
Expect node 16603 and requestedValue 90000. Clear the search and test Next
and Previous. Open Scenario and expand Player spawns and faction settings.
