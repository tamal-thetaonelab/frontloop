// Live UI Generation — WS (7332) + HTTP completion (7333)
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const wsModule = require('ws');
const WebSocketServer = wsModule.WebSocketServer || wsModule.Server;

const WS_PORT = 7332;
const HTTP_PORT = 7333;

const connections = new Map(); // taskId → ws
const monitors = new Set();    // monitor connections (no task id)

// Strip verbose fields that cause notification truncation.
// Keeps id, type, prompt, element.tag, element.componentHierarchy,
// element.text, container.title, pageTitle, page — enough to identify
// the route, component, and intent without the long HTML blobs.
function slimPayload(data) {
  const slim = { id: data.id, type: data.type, prompt: data.prompt };
  if (data.screenshotPath) slim.screenshotPath = data.screenshotPath;
  if (data.targetTaskId) slim.targetTaskId = data.targetTaskId;
  if (data.element) {
    slim.element = {};
    for (const k of ['selector','tag','text','componentHierarchy','columnIndex']) {
      if (data.element[k]) slim.element[k] = data.element[k];
    }
  }
  if (data.container && data.container.title) {
    slim.container = { title: data.container.title };
  }
  if (data.pageTitle) slim.pageTitle = data.pageTitle;
  if (data.page) slim.page = data.page;
  return slim;
}

const wss = new WebSocketServer({ port: WS_PORT });
wss.on('connection', (ws) => {
  monitors.add(ws);

  ws.on('message', (raw) => {
    let data;
    let isUndo = false;
    try {
      const str = raw.toString();
      if (str.startsWith('UNDO: ')) {
        isUndo = true;
        data = JSON.parse(str.slice('UNDO: '.length));
      } else {
        const json = str.startsWith('TASK: ') ? str.slice('TASK: '.length) : str;
        data = JSON.parse(json);
      }
    } catch { return; }

    if (data && data.id) {
      if (!isUndo) {
        connections.set(data.id, ws);
        monitors.delete(ws);
      }
      // Log full payload to stderr (accessible via TaskOutput), slim version
      // to stdout for the Monitor notification.
      console.error(JSON.stringify(data));
      console.log(`TASK: ${JSON.stringify(slimPayload(data))}`);
    }
  });

  ws.on('close', () => {
    monitors.delete(ws);
    for (const [id, conn] of connections) {
      if (conn === ws) connections.delete(id);
    }
  });
});

const server = http.createServer((req, res) => {
  // CORS for cross-origin requests (browser on port 4300, server on 7333)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const match = req.url?.match(/^\/complete\/([a-z0-9]+)$/i);
  if (req.method === 'POST' && match) {
    const taskId = match[1];
    const ws = connections.get(taskId);
    if (ws && ws.readyState === ws.OPEN) {
      ws.send(`COMPLETE:${taskId}`);
      connections.delete(taskId);
      res.writeHead(200);
      res.end(`ok (task ${taskId})`);
    } else {
      res.writeHead(404);
      res.end(`not found (task ${taskId})`);
    }
  } else if (req.method === 'POST' && req.url === '/reload') {
    const all = new Set(monitors);
    for (const [, ws] of connections) all.add(ws);
    let count = 0;
    for (const ws of all) {
      if (ws.readyState === ws.OPEN) { ws.send('RELOAD'); count++; }
    }
    res.writeHead(200);
    res.end(`reload sent to ${count} client(s)`);
  } else if (req.method === 'POST' && req.url === '/screenshot') {
    let body = '';
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      try {
        const { id, data: dataUrl } = JSON.parse(body);
        const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
        const filePath = path.join(os.tmpdir(), `liveui-screenshot-${id}.png`);
        fs.writeFileSync(filePath, base64Data, 'base64');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ path: filePath }));
      } catch (e) {
        res.writeHead(400);
        res.end(`bad request: ${e.message}`);
      }
    });
  } else {
    res.writeHead(404);
    res.end('not found');
  }
});

server.listen(HTTP_PORT, () => {
  console.log(`ws-task-server: WS on ${WS_PORT}, HTTP on ${HTTP_PORT}`);
});
