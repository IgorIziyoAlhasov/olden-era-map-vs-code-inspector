import React, { useEffect, useRef, useState } from 'react';
import { decodePlacementOrientation } from '../src/placement-orientation.js';
import { categories, objectCategory } from '../src/object-categories.js';
import { Icon, markerIcon } from './icons.jsx';
import { MapPreview } from './map-preview.jsx';

let nextToken = 0;
function useRequest(vscode, type, payload, delay = 0) {
  const [response, setResponse] = useState(null);
  const [request, setRequest] = useState(null);
  const serialized = JSON.stringify(payload);
  useEffect(() => {
    if (serialized === 'null') return;
    const current = ++nextToken;
    setRequest({ token: current, serialized });
    function receive({ data }) {
      if (data?.type === type && data.token === current) setResponse(data);
    }
    window.addEventListener('message', receive);
    const timer = setTimeout(() => vscode.postMessage({
      ...JSON.parse(serialized), type, token: current,
    }), delay);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('message', receive);
    };
  }, [vscode, type, serialized, delay]);
  return payload && request?.serialized === serialized && response?.token === request.token ? response : null;
}

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [query]);
  return matches;
}

function EditPlacement({ orientation, growth, save }) {
  const [rotation, setRotation] = useState(orientation?.rotation);
  const [mirrored, setMirrored] = useState(orientation?.mirrored);
  const [count, setCount] = useState(growth ?? '');
  const orientationChanged = orientation && (rotation !== orientation.rotation || mirrored !== orientation.mirrored);
  const growthChanged = growth !== undefined && count !== growth;
  if (!orientation && growth === undefined) return null;
  return <form className="filters" onSubmit={event => {
    event.preventDefault();
    save({
      ...(orientationChanged ? { rotation, mirrored } : {}),
      ...(growthChanged ? { countGrowth: count } : {}),
    });
  }}>
    {orientation && <>
      <label>Rotation index<select value={rotation} onChange={event => setRotation(Number(event.target.value))}>
        {[0, 1, 2, 3].map(value => <option key={value}>{value}</option>)}
      </select></label>
      <label>Mirror<input type="checkbox" checked={mirrored} onChange={event => setMirrored(event.target.checked)} /></label>
    </>}
    {growth !== undefined && <label>Growth count<input type="number" min="0" max="2147483647" step="1"
      required value={count} onChange={event => setCount(event.target.value === '' ? '' : event.target.valueAsNumber)} /></label>}
    <button type="submit" disabled={!orientationChanged && !growthChanged}>Apply property changes</button>
  </form>;
}

function Comparison({ response, placements, moves, width, height, close }) {
  const dialog = useRef(null);
  useEffect(() => {
    dialog.current.showModal();
  }, []);
  const columns = response?.result?.map(({ fields, propertyGroups }, index) => {
    const placement = placements[index];
    const edit = moves.get(`${placement.groupIndex}:${placement.index}`);
    const node = edit?.node ?? fields.nodes;
    const orientation = decodePlacementOrientation(fields.rotations);
    const values = new Map(Object.entries(fields));
    values.set('nodes', node);
    if (fields.levels === 0 && width > 0 && height > 0 && node >= 0 && node < width * height) {
      values.set('Coordinates', `X ${node % width}, Z ${Math.floor(node / width)}`);
    }
    values.set('Rotation index', edit?.rotation ?? orientation?.rotation);
    values.set('Mirror', edit?.mirrored ?? orientation?.mirrored);
    if (edit?.rotation !== undefined) values.set('rotations', edit.rotation + (edit.mirrored ? 10 : 0));
    for (const [table, records] of Object.entries(propertyGroups)) {
      records.forEach((record, row) => {
        for (const [field, value] of Object.entries(record)) {
          if (field === 'id' || field === 'type') continue;
          values.set(`${table} [${row + 1}].${field}`,
            table === 'propGrowthUnits' && field === 'countGrowth' ? edit?.countGrowth ?? value : value);
        }
      });
    }
    return values;
  });
  const rows = new Set(columns?.flatMap(column => [...column.keys()]));
  return <dialog ref={dialog} className="comparison" aria-labelledby="comparison-title" onClose={close}>
    <div className="pane-heading"><h2 id="comparison-title">Compare {placements[0].sid}</h2>
      <button type="button" onClick={() => dialog.current.close()}>Close</button></div>
    {!response && <p role="status">Loading comparison…</p>}
    {response?.error && <p role="alert">{response.error}</p>}
    {columns && <table>
      <thead><tr><th scope="col">Field</th>{placements.map(row =>
        <th scope="col" key={`${row.groupIndex}:${row.index}`}>ID {row.id}</th>)}</tr></thead>
      <tbody>{[...rows].map(field => <tr key={field}><th scope="row">{field}{columns.some(column =>
        JSON.stringify(column.get(field)) !== JSON.stringify(columns[0].get(field))) &&
        <small className="difference-label">Differs</small>}</th>
        {columns.map((column, index) => <td key={index} className={columns.some(other => JSON.stringify(other.get(field)) !== JSON.stringify(column.get(field))) ? 'comparison-difference' : undefined}><pre>{JSON.stringify(column.get(field), null, 2) ?? '—'}</pre></td>)}
      </tr>)}</tbody>
    </table>}
  </dialog>;
}

export function ObjectExplorer({ vscode, types, stats, initialType, layoutName, canEdit, moves, setMoves, removed, removing, removeMatches }) {
  const [filters, setFilters] = useState({
    sid: initialType, category: '', search: '', field: '', sort: '', page: 0,
  });
  const [checked, setChecked] = useState(() => new Map());
  const [comparison, setComparison] = useState(null);
  const selectedRows = [...checked].filter(([key]) => !removed.has(key)).map(([, row]) => row);
  const sameType = selectedRows.every(row => row.sid === selectedRows[0]?.sid);
  const canCompare = sameType && selectedRows.length >= 2 && selectedRows.length <= 4;
  const compared = useRequest(vscode, 'compare', comparison && { placements: comparison });
  const [showMap, setShowMap] = useState(false);
  const [listExpanded, setListExpanded] = useState(false);
  const [showCategories, setShowCategories] = useState(true);
  const [selection, setSelection] = useState(null);
  const [detailsShare, setDetailsShare] = useState(42);
  const layout = useRef(null);
  const drag = useRef(null);
  const selectedButton = useRef(null);
  const narrow = useMediaQuery('(width < 760px)');
  const wide = useMediaQuery('(width >= 980px)');
  const listBelow = wide && (layoutName === 'wayfarer' || (layoutName === 'cartographer' && listExpanded));
  const detailsBelow = Boolean(selection) && (narrow || (wide && ['arcane', 'ledger'].includes(layoutName)));
  const splitTarget = listBelow ? 'map-object-list' : 'object-details';
  function resize(share) {
    setDetailsShare(Math.min(70, Math.max(25, share)));
  }
  function closeDetails() {
    selectedButton.current?.focus({ preventScroll: true });
    setSelection(null);
  }
  const working = { removed: [...removed.keys()], edits: [...moves.values()].filter(edit => edit.node !== undefined) };
  const page = useRequest(vscode, 'query', { ...filters, ...working }, 150);
  const { sid, search, field, category } = filters;
  const preview = useRequest(vscode, 'preview', { sid, search, field, category, ...working }, 150);
  const detail = useRequest(vscode, 'detail', selection && {
    groupIndex: selection.groupIndex, index: selection.index,
  });
  const fields = detail?.result?.fields;
  const { sizeX, sizeZ } = stats;
  const selectionKey = selection && `${selection.groupIndex}:${selection.index}`;
  const appliedMove = moves.get(selectionKey);
  const node = appliedMove?.node ?? fields?.nodes;
  function applyMove(destination) {
    setMoves(previous => {
      const next = new Map(previous);
      const edit = { groupIndex: selection.groupIndex, index: selection.index, ...next.get(selectionKey) };
      if (!destination || destination.node === selection.originalNode) {
        delete edit.node;
        delete edit.x;
        delete edit.z;
      } else Object.assign(edit, destination, { originalNode: selection.originalNode });
      if (edit.node === undefined && edit.rotation === undefined && edit.countGrowth === undefined) next.delete(selectionKey);
      else next.set(selectionKey, edit);
      return next;
    });
    setSelection(current => ({ ...current, destination: undefined }));
  }
  const coordinates = fields?.levels === 0 && Number.isSafeInteger(sizeX) && sizeX > 0 &&
    Number.isSafeInteger(sizeZ) && sizeZ > 0 && Number.isSafeInteger(node) &&
    node >= 0 && node < sizeX * sizeZ
    ? { x: node % sizeX, z: Math.floor(node / sizeX) } : null;
  const result = page?.result;
  const orientation = appliedMove?.rotation === undefined
    ? decodePlacementOrientation(fields?.rotations)
    : { rotation: appliedMove.rotation, mirrored: appliedMove.mirrored };
  const growthRows = detail?.result?.propertyGroups.propGrowthUnits;
  const growth = growthRows?.length === 1 && Number.isInteger(growthRows[0].countGrowth)
    ? appliedMove?.countGrowth ?? growthRows[0].countGrowth : undefined;
  function change(name, value) {
    setSelection(null);
    selectedButton.current = null;
    setFilters(current => ({ ...current, page: 0, [name]: value }));
  }
  function setCheckedRow(row, checkedValue, additive = true) {
    const key = `${row.groupIndex}:${row.index}`;
    setChecked(previous => {
      const next = additive ? new Map(previous) : new Map();
      if (checkedValue ?? !previous.has(key)) next.set(key, row);
      else next.delete(key);
      return next;
    });
  }
  function selectRow(event, row) {
    selectedButton.current = event.target.closest('tr')?.querySelector('button');
    const additive = event.ctrlKey || event.metaKey;
    setCheckedRow(row, additive ? undefined : true, additive);
    setSelection({ groupIndex: row.groupIndex, index: row.index });
  }
  return <section className="object-explorer" data-compact-map={showMap} aria-label="Object Explorer">
    <div className="filters">
      <label><span><Icon name="controls/filter" />Search</span><input value={filters.search} onChange={event => change('search', event.target.value)} /></label>
      <label>Search by<select value={filters.field} onChange={event => change('field', event.target.value)}>
        <option value="">All fields</option><option value="type">Type (SID)</option>
        <option value="id">Exact ID</option><option value="node">Exact node</option>
      </select></label>
      <label>Object type<select value={filters.sid} onChange={event => change('sid', event.target.value)}>
        <option value="">All types</option>
        {types.map(({ sid, count }) => <option value={sid} key={sid}>{sid} ({count.toLocaleString()})</option>)}
      </select></label>
      <label><span><Icon name="controls/sort-up" />Sort by</span><select value={filters.sort} onChange={event => change('sort', event.target.value)}>
        <option value="">Map order</option><option value="type">Type</option>
        <option value="id">ID</option><option value="node">Node</option>
      </select></label>
      <label className="category-picker">Category<select value={category} onChange={event => change('category', event.target.value)}>
        <option value="">All categories</option>
        {categories.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select></label>
      <button className="compact-view-toggle" type="button" aria-pressed={showMap} onClick={() => {
        selectedButton.current = null;
        setShowMap(value => !value);
      }}>2D preview</button>
    </div>
    {comparison && <Comparison response={compared} placements={comparison} moves={moves}
      width={sizeX} height={sizeZ} close={() => setComparison(null)} />}
    {canEdit && result?.total > 0 && (sid || category || search.trim()) &&
      <div><button type="button" disabled={removing} onClick={() => {
        setSelection(null);
        removeMatches({ sid, search, field, category, count: result.total, ...working });
      }}>Remove all {result.total.toLocaleString()} matches…</button></div>}
    {page?.error && <p role="alert">{page.error}</p>}
    {!page && <p role="status">Searching objects…</p>}

      <div className="object-layout" data-list-expanded={listExpanded} ref={layout} data-split={listBelow || detailsBelow} style={{
        '--details-share': detailsShare + '%', '--upper-track': (100 - detailsShare) + 'fr', '--lower-track': detailsShare + 'fr',
      }}>
        <aside className="category-rail" aria-label="Map categories">
          <button type="button" aria-expanded={showCategories} onClick={() => setShowCategories(value => !value)}><Icon name="controls/chevron" />Categories</button>
          {showCategories && <div className="pane-scroll">
            {[['', 'All categories'], ...categories].map(([key, label]) => <button key={key} type="button"
              aria-pressed={category === key} onClick={() => change('category', key)}>
              <Icon name={`categories/${key || 'all'}`} /><span>{label}</span>
              <small>{types.reduce((sum, type) => sum + (!key || objectCategory(type.sid) === key ? type.count : 0), 0).toLocaleString()}</small>
            </button>)}
          </div>}
        </aside>
        <MapPreview width={stats.sizeX} height={stats.sizeZ} response={preview}
          selection={selection} checked={checked} moves={moves} applyMove={applyMove} canMove={canEdit}
          onSelect={(row, element, additive) => {
            selectedButton.current = element;
            if (additive) setCheckedRow(row);
            setSelection(row);
          }} />
        <div id="map-object-list" className="results-pane object-table" data-expanded={listExpanded}>
          <div className="pane-heading">
            <h2>Map objects {result && <small>{result.total.toLocaleString()}</small>}</h2>
            <button type="button" className="list-collapse" aria-expanded={listExpanded}
              onClick={() => setListExpanded(value => !value)}><Icon name="controls/collapse-panel" />
              {listExpanded ? 'Collapse list' : 'Expand list'}
            </button>
          </div>
    {selectedRows.length > 0 && <div className="selection-tools">
      <span>{selectedRows.length} selected</span>
      <button type="button" disabled={!canCompare} onClick={() => setComparison(selectedRows)}><Icon name="controls/compare-selected" />Compare selected</button>
      {canEdit && <button type="button" disabled={removing} onClick={() => {
        setSelection(null);
        removeMatches({
          selected: selectedRows.map(row => `${row.groupIndex}:${row.index}`),
          count: selectedRows.length, ...working,
        });
      }}><Icon name="controls/remove-selected" />Remove selected…</button>}
      <button type="button" onClick={() => setChecked(new Map())}><Icon name="controls/clear-selection" />Clear selection</button>
      {selectedRows.length >= 2 && !canCompare && <span>Compare 2–4 objects of the same type.</span>}
    </div>}

          <div className="pane-scroll" tabIndex={0} role="region" aria-label="Matching objects">
          {result?.rows.length > 0 && <table><thead><tr>
            <th scope="col">Select</th><th scope="col">ID</th><th scope="col">Type (SID)</th><th scope="col">Node</th><th scope="col">Level</th>
          </tr></thead><tbody>{result.rows.map(row => {
            const key = `${row.groupIndex}:${row.index}`;
            const selected = selection?.groupIndex === row.groupIndex && selection.index === row.index;
            return <tr key={key} className={checked.has(key) || selected ? 'selected' : undefined}
              onClick={event => selectRow(event, row)}>
              <td><input type="checkbox" aria-label={`Select object ${row.id}`}
                checked={checked.has(key)} onClick={event => event.stopPropagation()}
                onChange={event => setCheckedRow(row, event.target.checked)} /></td>
              <td><button type="button" aria-pressed={selected}>{row.id}</button></td>
              <td className="sid-cell" title={row.sid}><Icon name={markerIcon(row.sid)} />{row.sid}</td>
              <td>{row.node}</td><td>{row.level}</td>
            </tr>;
          })}</tbody></table>}
          </div>
          {result && <div className="pager">
            <button type="button" disabled={result.page === 0} onClick={() => change('page', result.page - 1)}>Previous</button>
            <span>Page {result.page + 1} of {result.pages}</span>
            <button type="button" disabled={result.page + 1 >= result.pages} onClick={() => change('page', result.page + 1)}>Next</button>
          </div>}
        </div>
          {(listBelow || detailsBelow) && <div className="pane-divider" role="separator" tabIndex={0}
            aria-label={listBelow ? 'Resize map object list' : 'Resize object details'}
            title="Drag or use the arrow keys to resize" aria-orientation="horizontal" aria-controls={splitTarget}
            aria-valuemin={25} aria-valuemax={70} aria-valuenow={Math.round(detailsShare)}
            onPointerDown={event => {
              if (event.button !== 0) return;
              drag.current = { y: event.clientY, share: detailsShare };
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerMove={event => {
              if (!drag.current) return;
              const height = layout.current.clientHeight;
              resize(drag.current.share + 100 * (drag.current.y - event.clientY) / height);
            }}
            onLostPointerCapture={() => { drag.current = null; }}
            onKeyDown={event => {
              const sizes = { ArrowUp: detailsShare + 5, ArrowDown: detailsShare - 5, Home: 25, End: 70 };
              if (!Object.hasOwn(sizes, event.key)) return;
              event.preventDefault();
              resize(sizes[event.key]);
            }} />}
        {selection && <>
          <aside id="object-details" aria-labelledby="object-details-title">
            <div className="pane-heading">
              <h2 id="object-details-title">Object details</h2>
              <button type="button" onClick={closeDetails}><Icon name="controls/close" />Close</button>
            </div>
            <div className="pane-scroll detail-content" key={`${selection.groupIndex}:${selection.index}`}
              tabIndex={0} role="region" aria-label="Object properties">
          {!detail && <p role="status">Loading object…</p>}
          {detail?.error && <p role="alert">{detail.error}</p>}
          {detail?.result && <>
            <h3 className="placement-name"><Icon name={markerIcon(fields.sid)} />{fields.sid}</h3>
            <dl className="placement-facts">
              <dt>ID</dt><dd>{fields.ids}</dd>
              <dt>Coordinates</dt><dd>{coordinates ? `X ${coordinates.x}, Z ${coordinates.z}` : 'Unavailable'}{appliedMove?.node !== undefined && ' (staged)'}</dd>
              <dt>Level</dt><dd>{fields.levels}</dd>
              <dt>Rotation index</dt><dd>{orientation?.rotation ?? 'Unknown'}</dd>
              <dt>Mirror</dt><dd>{orientation ? orientation.mirrored ? 'On' : 'Off' : 'Unknown'}</dd>
              {growth !== undefined && <><dt>Growth count</dt><dd>{growth}</dd></>}
            </dl>
            {canEdit && <EditPlacement key={JSON.stringify([orientation, growth])} orientation={orientation} growth={growth}
              save={changes => setMoves(previous => {
                const next = new Map(previous);
                next.set(selectionKey, {
                  groupIndex: selection.groupIndex, index: selection.index, ...next.get(selectionKey), ...changes,
                });
                return next;
              })} />}
            <h3>Object properties</h3>
            {Object.entries(detail.result.propertyGroups).map(([table, records]) =>
              <details key={table}>
                <summary>{table} ({records.length})</summary>
                <pre>{JSON.stringify(records, null, 2)}</pre>
              </details>)}
            {Object.keys(detail.result.propertyGroups).length === 0 &&
              <p>No linked property records.</p>}
            <details><summary>Raw placement</summary><pre>{JSON.stringify(fields, null, 2)}</pre></details>
          </>}
            </div>
          </aside>
        </>}
      </div>
  </section>;
}
