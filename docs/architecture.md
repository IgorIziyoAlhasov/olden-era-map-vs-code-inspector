# VS Code extension architecture

## Phase 0 milestones

| Milestone | Exit criterion |
|---|---|
| Frame and compare the supplied maps | All section offsets reproduced and complete byte coverage checked |
| Decode placement columns and priority properties | Counts verified independently and all 60 conversions matched by ID and position fields |
| Establish parser regression checks | Malformed inputs, size limits, byte preservation and fixture integrity pass |
| Extend compatibility evidence | Test Octo and Diamonds variants plus a real map from another game build |
| Verify coordinate semantics | Rectangular fixture reproduces known editor coordinates and layers |

The first three milestones are implemented. Compatibility and coordinate
verification need additional fixtures. Phase 1 can display serialized node
indices while the coordinate work proceeds. Visual rendering depends on the
coordinate milestone.

## Phase 1 extension foundation

Contribute a custom editor for *.map with priority option to coexist with
other map formats. Expose an Explorer context action and an Open Olden Era Map
command that uses a file picker and vscode.openWith. Implement a
CustomReadonlyEditorProvider with one CustomDocument per URI. Keep parsing in
a Node worker so JSON decoding and normalization leave the extension host
responsive. Use an ESM source tree, bundle the extension activation entry
for the selected VS Code host, and build the React webview separately with Vite.
Scope the initial extension to a desktop or remote Node extension host.

Own the worker and parsed data at document scope. Cancel pending work when the
document closes. The panel subscribes before its ready handshake and
re-requests a snapshot after reload. Attach disposal handlers to each panel and
ignore obsolete request IDs. Restrict local resource roots to compiled webview
assets, use a nonce-based content security policy, and render map strings as text.
Map sources use read access. For the first release, local Node-host paths use
the bounded file reader. Surface a clear diagnostic for unsupported URI schemes.

[VS Code Custom Editor API](https://code.visualstudio.com/api/extension-guides/custom-editors)

## Phase 2 inspection

Keep full maps and binary views in the worker. Send a summary, diagnostics,
paged object rows and selected-object details using a versioned message
contract with request IDs. Build the query index once, debounce text input,
page or virtualize results, and use group/row as the selection key so repeated
serialized IDs remain visible. Support SID/name, ID and verified coordinates
as available. Treat absent fields distinctly from empty strings, false and zero.
Display proven categories and surface unknown SIDs verbatim. Preserve full raw
properties and bound their presentation using pagination or limited previews.

Extend Vitest parser coverage as formats are verified, Playwright tests for the
Vite webview harness, and VS Code Extension Test Runner checks for open-with,
palette, reload, disposal, Windows paths and unchanged input hashes. Add ESLint
with the extension foundation. Package a VSIX after those acceptance tests.
