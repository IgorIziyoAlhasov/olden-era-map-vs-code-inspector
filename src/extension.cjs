const vscode = require('vscode');
const { Worker } = require('node:worker_threads');
const { writeFile } = require('node:fs/promises');
const { join } = require('node:path');

const viewType = 'olden-era-map-inspector.map';

function activate(context) {
  const assets = vscode.Uri.joinPath(context.extensionUri, 'dist');
  const provider = {
    openCustomDocument(uri) {
      let worker;
      let snapshot;
      let nextId = 0;
      let stopped = false;
      const pending = new Map();
      function stop(error) {
        stopped = true;
        for (const resolve of pending.values()) resolve({ error });
        pending.clear();
      }
      return {
        uri,
        load() {
          snapshot ??= new Promise(resolve => {
            if (uri.scheme !== 'file') {
              resolve({ error: 'Open a map from the local filesystem.' });
              return;
            }
            worker = new Worker(join(__dirname, 'map-worker.js'), { workerData: uri.fsPath });
            worker.on('message', response => {
              if (response.requestId === undefined) {
                resolve(response);
                return;
              }
              pending.get(response.requestId)?.(response);
              pending.delete(response.requestId);
            });
            worker.on('error', error => stop(error.message));
            worker.on('exit', () => stop('The map reader has stopped.'));
            worker.once('error', error => resolve({ error: error.message }));
            worker.once('exit', () => resolve({ error: 'The map reader stopped before returning a result.' }));
          }).catch(error => ({ error: error.message }));
          return snapshot;
        },
        async request(message) {
          const initial = await this.load();
          if (initial.error) return initial;
          if (stopped) return { error: 'The map reader has stopped.' };
          const requestId = ++nextId;
          return new Promise(resolve => {
            pending.set(requestId, resolve);
            try {
              worker.postMessage({ ...message, requestId });
            } catch (error) {
              pending.delete(requestId);
              resolve({ error: error.message });
            }
          });
        },
        dispose() {
          stop('The map was closed.');
          void worker?.terminate();
        },
      };
    },
    resolveCustomEditor(document, panel) {
      const { webview } = panel;
      webview.options = { enableScripts: true, localResourceRoots: [assets] };
      let disposed = false;
      const subscription = webview.onDidReceiveMessage(async message => {
        if (message?.type === 'ready') {
          const result = await document.load();
          if (!disposed) await webview.postMessage({
            type: 'snapshot', ...result, layout: context.globalState.get('mapInspector.layout'),
          });
        } else if (message?.type === 'setLayout') {
          if (['atlas', 'cartographer', 'ledger', 'arcane', 'wayfarer'].includes(message.layout)) {
            await context.globalState.update('mapInspector.layout', message.layout);
          }
        } else if (message?.type === 'removeMatches') {
          try {
            const action = await vscode.window.showWarningMessage(
              `Remove ${message.count} matching placements from the working map?`,
              { modal: true, detail: message.selected
                ? 'This removes only checked objects. Scenario references are left as-is.'
                : 'Matches include every results page. Scenario references to removed objects are left as-is.' },
              'Remove matches');
            if (action !== 'Remove matches' || disposed) return;
            const { result, error } = await document.request(message);
            if (error) throw new Error(error);
            if (!disposed) await webview.postMessage({ type: 'matchesRemoved', result });
          } catch (error) {
            void vscode.window.showErrorMessage(error.message);
          } finally {
            if (!disposed) await webview.postMessage({ type: 'removalFinished' });
          }
        } else if (message?.type === 'saveCopy') {
          try {
            const { result, error } = await document.request(message);
            if (error) throw new Error(error);
            if (disposed) return;
            const target = await vscode.window.showSaveDialog({
              defaultUri: vscode.Uri.file(document.uri.fsPath.replace(/\.map$/i, '-edited.map')),
              filters: { 'Olden Era maps': ['map'] },
            });
            if (!target || disposed) return;
            if (target.scheme !== 'file' || !/\.map$/i.test(target.fsPath)) {
              throw new Error('Choose a local .map path.');
            }
            await writeFile(target.fsPath, result, { flag: 'wx' });
            if (!disposed) await webview.postMessage({ type: 'copySaved', signature: message.signature });
            const action = await vscode.window.showInformationMessage(
              `Saved edited map to ${target.fsPath}`, 'Open saved map');
            if (action === 'Open saved map') {
              await vscode.commands.executeCommand('vscode.openWith', target, viewType);
            }
          } catch (error) {
            void vscode.window.showErrorMessage(error.code === 'EEXIST'
              ? 'Choose a new filename. Existing maps are preserved.' : error.message);
          }
        } else if (['query', 'detail', 'preview', 'compare'].includes(message?.type)) {
          const { result, error } = await document.request(message);
          if (!disposed) await webview.postMessage({
            type: message.type, token: message.token, result, error,
          });
        }
      });
      panel.onDidDispose(() => {
        disposed = true;
        subscription.dispose();
      });
      const script = webview.asWebviewUri(vscode.Uri.joinPath(assets, 'inspector.js'));
      const style = webview.asWebviewUri(vscode.Uri.joinPath(assets, 'inspector.css'));
      webview.html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; script-src ${webview.cspSource}; style-src ${webview.cspSource};">
<title>Olden Era Map Inspector</title><link rel="stylesheet" href="${style}">
</head><body><div id="root"></div><script type="module" src="${script}"></script></body></html>`;
    },
  };
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(viewType, provider, { webviewOptions: { retainContextWhenHidden: true } }),
    vscode.commands.registerCommand('olden-era-map-inspector.open', async uri => {
      const [selected] = uri ? [uri] : await vscode.window.showOpenDialog({
        canSelectMany: false, filters: { 'Olden Era maps': ['map'] },
        openLabel: 'Open in Map Inspector',
      }) ?? [];
      if (selected) await vscode.commands.executeCommand('vscode.openWith', selected, viewType);
    }),
  );
}
module.exports = { activate };
