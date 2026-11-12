import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './inspector.css';
import { Icon } from './icons.jsx';
import { layouts } from './layouts.js';
import { ObjectExplorer } from './object-explorer.jsx';

const vscode = acquireVsCodeApi();
const number = new Intl.NumberFormat();
function display(value) {
  if (value === undefined || value === null) return 'Unavailable';
  if (value === '') return 'Empty';
  return typeof value === 'number' ? number.format(value) : value;
}

function Inspector() {
  const [result, setResult] = useState(null);
  const [layout, setLayout] = useState('atlas');
  const [view, setView] = useState('Overview');
  const [moves, setMoves] = useState(() => new Map());
  const [initialType, setInitialType] = useState('');
  const [removed, setRemoved] = useState(() => new Map());
  const [removing, setRemoving] = useState(false);
  const [savedSignature, setSavedSignature] = useState(null);
  const changes = {
    removed: [...removed.keys()],
    edits: [...moves].filter(([key]) => !removed.has(key)).map(([, edit]) => edit),
  };
  const signature = JSON.stringify(changes);
  function saveCopy() {
    vscode.postMessage({ type: 'saveCopy', ...changes, signature });
  }
  function removeMatches(request) {
    setRemoving(true);
    vscode.postMessage({ type: 'removeMatches', ...request });
  }
  function openObjects(sid = '') {
    setInitialType(sid);
    setView('Objects');
  }
  useEffect(() => {
    function receive({ data }) {
      if (data?.type === 'snapshot') {
        setResult(data);
        if (Object.hasOwn(layouts, data.layout)) setLayout(data.layout);
      }
      if (data?.type === 'matchesRemoved') {
        setRemoved(previous => new Map([...previous, ...data.result.map(row => [row.key, row.sid])]));
      }
      if (data?.type === 'copySaved') setSavedSignature(data.signature);
      if (data?.type === 'removalFinished') setRemoving(false);
    }
    window.addEventListener('message', receive);
    vscode.postMessage({ type: 'ready' });
    return () => window.removeEventListener('message', receive);
  }, []);
  if (!result) return <main><p role="status">Reading map…</p></main>;
  if (result.error) return <main><h1>Unable to open map</h1><p role="alert">{result.error}</p></main>;
  const { summary } = result;
  const { stats } = summary;
  const removedTypes = new Map();
  for (const sid of removed.values()) removedTypes.set(sid, (removedTypes.get(sid) ?? 0) + 1);
  const types = summary.types.map(({ sid, count }) => ({ sid, count: count - (removedTypes.get(sid) ?? 0) }));
  const editCount = [...moves.keys()].filter(key => !removed.has(key)).length;
  const facts = [
    ['Game version', summary.version],
    ['Dimensions', stats.sizeX != null && stats.sizeZ != null ? `${stats.sizeX} × ${stats.sizeZ}` : undefined],
    ['Players', stats.players], ['Game mode', summary.mode], ['Object placements', stats.total - removed.size],
    ['Prisons', stats.prisons - (removedTypes.get('prison') ?? 0), 'prison'], ['Random Squads', stats.randomSquads - (removedTypes.get('random-squad') ?? 0), 'random-squad'],
  ];
  return <main data-layout={layout} className={view === 'Objects' ? 'objects-view' : undefined}>
    <header><h1>{summary.name || summary.fileMapName || 'Olden Era Map Inspector'}</h1>
      <p>{editCount || removed.size ? `${editCount} edited · ${removed.size} removed · ${signature === savedSignature ? 'Saved to copy' : 'Unsaved changes'}` : 'Map inspection'}</p></header>
    <nav aria-label="Inspector views">{['Overview', 'Objects', 'Scenario'].map(name =>
      <button type="button" key={name} aria-pressed={view === name}
        onClick={() => name === 'Objects' ? openObjects() : setView(name)}>{name}</button>)}
      {(editCount > 0 || removed.size > 0) && <>
        <button type="button" disabled={removing} onClick={saveCopy}><Icon name="controls/save-copy" />Save edited copy…</button>
        <button type="button" disabled={removing} onClick={() => {
          setMoves(new Map());
          setRemoved(new Map());
        }}><Icon name="controls/reset" />Discard all changes</button>
      </>}
      <label className="layout-picker">Layout <select value={layout} onChange={event => {
        const next = event.target.value;
        setLayout(next);
        vscode.postMessage({ type: 'setLayout', layout: next });
      }}>{Object.entries(layouts).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
    </nav>
    {view === 'Objects' && <ObjectExplorer key={initialType} vscode={vscode} layoutName={layout} canEdit={summary.version === '0.82.08'} types={types} stats={stats} moves={moves} setMoves={setMoves} removed={removed} removing={removing} removeMatches={removeMatches} initialType={initialType} />}
    {view === 'Scenario' && <section aria-label="Scenario data">{[
      ['Player spawns and faction settings', summary.scenario.spawns],
      ['Restrictions', summary.scenario.restrictions],
      ['Hero settings', summary.scenario.heroSettings],
      ['Start settings', summary.scenario.startSettings],
      ['Map settings', summary.scenario.mapSettings],
    ].map(([name, value]) => <details key={name}><summary>{name}</summary>
      {value === undefined ? <p>Unavailable</p> : <pre>{JSON.stringify(value, null, 2)}</pre>}
    </details>)}</section>}
    {view === 'Overview' && <>
    <dl className="facts">{facts.map(([label, value, sid]) =>
      <div key={label}><dt>{label}</dt><dd>{sid ? <button type="button" onClick={() => openObjects(sid)} aria-label={`Browse ${label}`}>{display(value)}</button> : display(value)}</dd></div>)}</dl>
    {summary.description && <p className="description">{summary.description}</p>}
    {summary.warnings.length > 0 && <section><h2>Parser diagnostics</h2>
      <ul>{summary.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></section>}
    <section><h2>Decompressed sections</h2>
      <table><thead><tr><th scope="col">Section</th><th scope="col">Start byte</th><th scope="col">Size in bytes</th></tr></thead>
        <tbody>{summary.sections.map(({ name, start, end }) =>
          <tr key={name}><th scope="row">{name}</th><td>{display(start)}</td><td>{display(end - start)}</td></tr>)}</tbody>
      </table>
    </section>
    </>}
  </main>;
}

createRoot(document.getElementById('root')).render(<Inspector />);
