import { app, BrowserWindow, Menu, Tray, Notification, dialog, globalShortcut, ipcMain, nativeImage, safeStorage, screen, session } from "electron";
import fs from "node:fs";
import fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";

type Mode = "full" | "compact" | "bubble" | "tray";
type Manifest = {
  schemaVersion: number;
  assistantId: string;
  assistantName: string;
  assistantColor?: string;
  assistantIcon?: string;
  assistantInstructions?: string;
  appId: string;
  productName: string;
  protocol: string;
  apiUrl: string;
  webUrl?: string;
  bootstrapToken?: string;
  bootstrapExpiresAt?: string;
  userDataDirectoryName: string;
};
type Credentials = { sessionToken: string; sessionId: string; ownerId: string; assistantId: string };
type DesktopAssistantPayload = { displayName?: string; icon?: string; color?: string; webUrl?: string; snapshot?: { displayName?: string; icon?: string; manifest?: Record<string, unknown> } };
type ApprovedFolders = { folders: string[] };
type UndoRecord = { id: string; source: string; destination?: string; csvPath?: string; previousCsv?: string; movedFrom?: string; movedTo?: string; expectedCsvHash?: string; createdAt: string };
type WindowBounds = { x: number; y: number; width: number; height: number };
type DesktopState = {
  mode?: Mode;
  bubbleBounds?: WindowBounds;
  compactBounds?: WindowBounds;
  fullBounds?: WindowBounds;
  updatedAt?: string;
};
type LoadedView = "bubble" | "chat";

let manifest!: Manifest;
let mainWindow: BrowserWindow | undefined;
let tray: Tray | undefined;
let credentials: Credentials | undefined;
let revoked = false;
let offline = false;
let isQuitting = false;
let currentMode: Mode = "bubble";
let loadedView: LoadedView | undefined;
let watchers: fs.FSWatcher[] = [];
const seenEvents = new Map<string, number>();

const hash = (value: string | Buffer) => createHash("sha256").update(value).digest("hex");
const statePath = (name: string) => path.join(app.getPath("userData"), name);
const bubbleSize = { width: 64, height: 64 };
const compactSize = { width: 360, height: 560 };
const fullSize = { width: 1080, height: 820 };
let pendingInstallIntent: string | undefined;

function desktopState() {
  return loadJson<DesktopState>(statePath("desktop-state.json"), {});
}

function saveDesktopState(update: Partial<DesktopState>) {
  return saveJson(statePath("desktop-state.json"), {
    ...desktopState(),
    ...update,
    updatedAt: new Date().toISOString()
  });
}

function assistantSeed() {
  return Number.parseInt(hash(manifest.assistantId).slice(0, 8), 16) || 0;
}

function clampBounds(bounds: WindowBounds, fallback: WindowBounds): WindowBounds {
  const display = screen.getDisplayMatching(bounds);
  const area = display?.workArea ?? screen.getPrimaryDisplay().workArea;
  const width = Math.min(bounds.width, area.width);
  const height = Math.min(bounds.height, area.height);
  const x = Math.min(Math.max(bounds.x, area.x), area.x + area.width - width);
  const y = Math.min(Math.max(bounds.y, area.y), area.y + area.height - height);
  if (!Number.isFinite(x) || !Number.isFinite(y) || width < 60 || height < 60) return fallback;
  return { x, y, width, height };
}

function defaultBubbleBounds(): WindowBounds {
  const area = screen.getPrimaryDisplay().workArea;
  const seed = assistantSeed();
  const column = seed % 5;
  const row = Math.floor(seed / 5) % 4;
  return {
    width: bubbleSize.width,
    height: bubbleSize.height,
    x: area.x + area.width - bubbleSize.width - 24 - column * (bubbleSize.width + 10),
    y: area.y + area.height - bubbleSize.height - 48 - row * (bubbleSize.height + 10)
  };
}

function getBubbleBounds() {
  const fallback = defaultBubbleBounds();
  const saved = desktopState().bubbleBounds;
  return saved ? clampBounds(saved, fallback) : fallback;
}

function defaultSizedBounds(size: { width: number; height: number }): WindowBounds {
  const area = screen.getPrimaryDisplay().workArea;
  return {
    width: Math.min(size.width, area.width),
    height: Math.min(size.height, area.height),
    x: area.x + Math.max(0, Math.floor((area.width - size.width) / 2)),
    y: area.y + Math.max(0, Math.floor((area.height - size.height) / 2))
  };
}

function rememberWindowBounds() {
  if (!mainWindow || currentMode === "tray" || mainWindow.isDestroyed()) return;
  const bounds = mainWindow.getBounds();
  const key = currentMode === "bubble" ? "bubbleBounds" : currentMode === "compact" ? "compactBounds" : "fullBounds";
  void saveDesktopState({ mode: currentMode, [key]: bounds }).catch(() => undefined);
}

function readManifest(): Manifest {
  const candidates = [
    path.join(process.resourcesPath, "manifest.json"),
    path.join(app.getAppPath(), "manifest.json"),
    path.join(__dirname, "..", "manifest.json")
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return JSON.parse(fs.readFileSync(candidate, "utf8")) as Manifest;
  }
  throw new Error("Desktop manifest is missing.");
}

function loadJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

async function saveJson(file: string, value: unknown) {
  await fsp.mkdir(path.dirname(file), { recursive: true });
  await fsp.writeFile(file, JSON.stringify(value, null, 2));
}

async function markRevoked(reason: string) {
  revoked = true;
  await saveJson(statePath("runtime-state.json"), {
    status: "revoked",
    reason: reason.slice(0, 500),
    updatedAt: new Date().toISOString()
  }).catch(() => undefined);
  if (Notification.isSupported()) {
    new Notification({ title: manifest.assistantName, body: "Desktop session needs to be re-authorized." }).show();
  }
}

function saveCredentials(value: Credentials) {
  const raw = JSON.stringify(value);
  const data = safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(raw) : Buffer.from(raw, "utf8");
  fs.writeFileSync(statePath("credentials.enc"), data);
}

function loadCredentials() {
  try {
    const data = fs.readFileSync(statePath("credentials.enc"));
    const raw = safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(data) : data.toString("utf8");
    credentials = JSON.parse(raw) as Credentials;
  } catch {
    credentials = undefined;
  }
}

function refreshAssistantIdentity(assistant?: DesktopAssistantPayload) {
  if (!assistant) return;
  const displayName = assistant.displayName ?? assistant.snapshot?.displayName;
  const icon = assistant.icon ?? assistant.snapshot?.icon;
  if (displayName) manifest.assistantName = displayName;
  if (icon) manifest.assistantIcon = icon;
  if (assistant.color) manifest.assistantColor = assistant.color;
  if (assistant.webUrl) manifest.webUrl = assistant.webUrl;
  mainWindow?.setTitle(manifest.assistantName);
  tray?.setToolTip(manifest.assistantName);
  if (loadedView) {
    loadedView = undefined;
    if (currentMode === "bubble") loadBubbleView();
    else if (currentMode !== "tray") loadChatView();
  }
}

async function api(pathname: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (credentials?.sessionToken) headers.set("Authorization", `Bearer ${credentials.sessionToken}`);
  let response: Response;
  try {
    response = await fetch(`${manifest.apiUrl}${pathname}`, { ...init, headers });
  } catch (err) {
    // Network error — backend unreachable. NOT revoked.
    offline = true;
    pushStatusUpdate();
    throw new Error(`Offline — could not reach ${manifest.apiUrl}`);
  }
  // We got a response — we are online
  offline = false;
  if (response.status === 401 || response.status === 403) {
    // Only mark revoked if backend explicitly says so
    let code = "";
    try {
      const body = await response.json() as { code?: string };
      code = body.code ?? "";
    } catch { /* ignore parse errors */ }
    if (code === "DEVICE_SESSION_INVALID") {
      await markRevoked(`Desktop session rejected by API: ${response.status}`);
    }
    throw new Error(`${response.status} ${response.statusText}`);
  }
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return response.json() as Promise<Record<string, unknown>>;
}

function pushStatusUpdate() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.executeJavaScript(
    `typeof refresh === 'function' && refresh()`
  ).catch(() => undefined);
}

async function bootstrap() {
  loadCredentials();
  if (credentials) {
    try {
      const data = await api("/api/platform/desktop/session") as { assistant?: DesktopAssistantPayload };
      revoked = false;
      offline = false;
      refreshAssistantIdentity(data.assistant);
      return;
    } catch (err) {
      if (offline) {
        // Backend not reachable — keep credentials, stay offline, don't revoke
        return;
      }
      if (revoked && manifest.bootstrapToken) {
        // Credentials were revoked but we have a bootstrap token — try re-bootstrap
        credentials = undefined;
        try { fs.unlinkSync(statePath("credentials.enc")); } catch { /* ok */ }
        // Fall through to bootstrap exchange below
      } else {
        throw err;
      }
    }
  }
  if (pendingInstallIntent) {
    let response: Response;
    try {
      response = await fetch(`${manifest.apiUrl}/api/platform/desktop/install-intents/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent: pendingInstallIntent, installationId: `${manifest.appId}:${os.hostname()}`, deviceName: os.hostname() })
      });
    } catch {
      offline = true;
      pushStatusUpdate();
      return;
    }
    if (!response.ok) throw new Error(`Install intent claim failed: ${response.status}`);
    const data = await response.json() as { sessionToken: string; session: { id: string; ownerId: string; assistantId: string }; assistant?: DesktopAssistantPayload };
    credentials = { sessionToken: data.sessionToken, sessionId: data.session.id, ownerId: data.session.ownerId, assistantId: data.session.assistantId };
    revoked = false;
    offline = false;
    refreshAssistantIdentity(data.assistant);
    saveCredentials(credentials);
    await saveJson(statePath("assistant-snapshot.json"), data.assistant?.snapshot ?? {});
    pendingInstallIntent = undefined;
    return;
  }
  if (!manifest.bootstrapToken) {
    await saveJson(statePath("runtime-state.json"), { status: "waiting_for_web_connection", updatedAt: new Date().toISOString() }).catch(() => undefined);
    return;
  }
  let response: Response;
  try {
    response = await fetch(`${manifest.apiUrl}/api/platform/desktop/bootstrap/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: manifest.bootstrapToken, installationId: `${manifest.appId}:${os.hostname()}`, deviceName: os.hostname() })
    });
  } catch {
    offline = true;
    pushStatusUpdate();
    return;
  }
  if (!response.ok) throw new Error(`Bootstrap exchange failed: ${response.status}`);
  const data = await response.json() as { sessionToken: string; session: { id: string; ownerId: string; assistantId: string }; assistant?: DesktopAssistantPayload };
  credentials = { sessionToken: data.sessionToken, sessionId: data.session.id, ownerId: data.session.ownerId, assistantId: data.session.assistantId };
  revoked = false;
  offline = false;
  refreshAssistantIdentity(data.assistant);
  saveCredentials(credentials);
}

function extractInstallIntent(argv: string[]) {
  for (const arg of argv) {
    try {
      const url = new URL(arg);
      if (!["archmind:", `${manifest.protocol}:`].includes(url.protocol) && !url.protocol.startsWith("archmind-assistant-")) continue;
      if (url.hostname !== "install-assistant") continue;
      const intent = url.searchParams.get("intent");
      if (intent && /^[A-Za-z0-9_-]{32,}$/.test(intent)) return intent;
    } catch {
      continue;
    }
  }
  return undefined;
}

async function audit(actionType: string, status: string, details: Record<string, unknown>, preview?: Record<string, unknown>) {
  if (!credentials || revoked) return;
  await api("/api/platform/desktop/audit", {
    method: "POST",
    body: JSON.stringify({ actionType, status, details, preview })
  }).catch(() => undefined);
}

async function canonicalInside(root: string, target: string) {
  const rootReal = await fsp.realpath(root);
  const targetParent = await fsp.realpath(path.dirname(target));
  const rootStat = await fsp.lstat(rootReal);
  const targetStat = await fsp.lstat(target).catch(() => undefined);
  if (rootStat.isSymbolicLink() || targetStat?.isSymbolicLink()) throw new Error("Symlinks are not allowed for approved-folder automation.");
  const relative = path.relative(rootReal, targetParent);
  if (relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Path is outside the approved folder.");
  return target;
}

function extractInvoiceFields(text: string, filename: string) {
  const invoiceNumber = text.match(/invoice\s*(?:#|number|no\.?)?\s*[:\-]?\s*([A-Z0-9-]+)/i)?.[1] ?? path.basename(filename, path.extname(filename));
  const total = text.match(/(?:total|amount due)\s*[:\-]?\s*\$?\s*([0-9,.]+)/i)?.[1] ?? "";
  const date = text.match(/(?:date|invoice date)\s*[:\-]?\s*([0-9]{4}-[0-9]{2}-[0-9]{2}|[0-9]{1,2}\/[0-9]{1,2}\/[0-9]{2,4})/i)?.[1] ?? "";
  const vendor = text.match(/(?:vendor|from)\s*[:\-]?\s*(.+)/i)?.[1]?.trim() ?? "";
  return { invoiceNumber, date, vendor, total, sourceFile: path.basename(filename) };
}

function csvLine(values: string[]) {
  return values.map((value) => `"${value.replace(/"/g, '""')}"`).join(",") + "\n";
}

async function approvePreview(row: Record<string, string>) {
  const result = await dialog.showMessageBox(mainWindow!, {
    type: "question",
    buttons: ["Approve", "Deny"],
    defaultId: 0,
    cancelId: 1,
    title: "Approve invoice row",
    message: "Add this invoice row?",
    detail: Object.entries(row).map(([key, value]) => `${key}: ${value}`).join("\n")
  });
  return result.response === 0;
}

async function processInvoice(folder: string, file: string) {
  if (revoked) return;
  const now = Date.now();
  const prior = seenEvents.get(file);
  if (prior && now - prior < 5000) return;
  seenEvents.set(file, now);

  await canonicalInside(folder, file);
  const text = await fsp.readFile(file, "utf8");
  const row = extractInvoiceFields(text, file);
  await audit("desktop.invoice.preview", "waiting_for_permission", { file }, row);
  if (!(await approvePreview(row))) {
    await audit("desktop.invoice.denied", "denied", { file }, row);
    return;
  }

  const csvPath = path.join(folder, "invoices.csv");
  const processedDir = path.join(folder, "processed");
  await fsp.mkdir(processedDir, { recursive: true });
  await canonicalInside(folder, csvPath).catch(async () => {
    await fsp.writeFile(csvPath, "");
    await canonicalInside(folder, csvPath);
  });
  const previousCsv = await fsp.readFile(csvPath, "utf8").catch(() => "");
  const line = csvLine([row.invoiceNumber, row.date, row.vendor, row.total, row.sourceFile]);
  await fsp.appendFile(csvPath, line);

  const destination = path.join(processedDir, path.basename(file));
  await canonicalInside(folder, destination);
  await fsp.rename(file, destination);
  const undo: UndoRecord = { id: randomUUID(), source: file, destination, csvPath, previousCsv, movedFrom: file, movedTo: destination, expectedCsvHash: hash(previousCsv + line), createdAt: new Date().toISOString() };
  const records = loadJson<UndoRecord[]>(statePath("undo-records.json"), []);
  records.push(undo);
  await saveJson(statePath("undo-records.json"), records);
  await audit("desktop.invoice.processed", "completed", { file, destination, csvPath, undoId: undo.id }, row);
  new Notification({ title: manifest.assistantName, body: "Invoice processed." }).show();
}

function stopWatchers() {
  for (const watcher of watchers) watcher.close();
  watchers = [];
}

async function startWatchers() {
  stopWatchers();
  const approved = loadJson<ApprovedFolders>(statePath("approved-folders.json"), { folders: [] });
  for (const folder of approved.folders) {
    const realFolder = await fsp.realpath(folder).catch(() => undefined);
    if (!realFolder) continue;
    watchers.push(fs.watch(realFolder, (_event, filename) => {
      if (!filename || filename.toString().startsWith(".")) return;
      const target = path.join(realFolder, filename.toString());
      fsp.stat(target)
        .then((stat) => { if (stat.isFile()) return processInvoice(realFolder, target); })
        .catch(() => undefined);
    }));
  }
}

async function undoLast() {
  const records = loadJson<UndoRecord[]>(statePath("undo-records.json"), []);
  const record = records.pop();
  if (!record) return { undone: false };
  if (record.csvPath && record.expectedCsvHash) {
    const current = await fsp.readFile(record.csvPath, "utf8");
    if (hash(current) !== record.expectedCsvHash) throw new Error("CSV changed after automation; undo stopped.");
    await fsp.writeFile(record.csvPath, record.previousCsv ?? "");
  }
  if (record.movedTo && record.movedFrom && fs.existsSync(record.movedTo)) await fsp.rename(record.movedTo, record.movedFrom);
  await saveJson(statePath("undo-records.json"), records);
  await audit("desktop.undo", "completed", { undoId: record.id });
  return { undone: true };
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function render() {
  return renderChat();
  const color = /^#[0-9a-f]{6}$/i.test(manifest.assistantColor ?? "") ? manifest.assistantColor! : "#2563eb";
  const assistantName = escapeHtml(manifest.assistantName);
  const assistantNameJson = JSON.stringify(manifest.assistantName);
  return `<!doctype html><meta charset="utf-8"><title>${assistantName}</title>
  <style>
    :root{color-scheme:light}
    *{box-sizing:border-box}
    html,body{width:100%;height:100%;overflow:hidden}
    body{margin:0;font:14px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;background:transparent;color:#111827;display:grid;place-items:center}
    main{width:100%;height:100%;background:rgba(255,255,255,.98);border:1px solid rgba(17,24,39,.14);border-radius:24px;box-shadow:0 18px 54px rgba(15,23,42,.24);display:flex;flex-direction:column;overflow:hidden}
    header{-webkit-app-region:drag;display:flex;gap:12px;align-items:center}
    .top{padding:14px 14px 10px;border-bottom:1px solid #e2e8f0}
    .mark{width:38px;height:38px;border-radius:50%;background:${color};box-shadow:inset 0 0 0 1px rgba(255,255,255,.42);display:grid;place-items:center;color:#fff;font-weight:800;flex:0 0 auto}
    h1{font-size:15px;line-height:1.2;margin:0;max-width:185px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .muted{color:#475569;font-size:12px;margin:2px 0 0}
    .spacer{flex:1}
    button{-webkit-app-region:no-drag;min-height:34px;padding:7px 10px;border-radius:12px;border:1px solid #cbd5e1;background:#fff;color:#0f172a;font-weight:650;cursor:pointer}
    button:hover{filter:brightness(.98)}
    .icon-button{width:34px;min-width:34px;padding:0;font-size:18px;line-height:1;border-radius:999px}
    .tool{font-size:12px}
    #messages{flex:1;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:10px;background:linear-gradient(#ffffff,#f8fafc)}
    .bubble{max-width:86%;border-radius:16px;padding:10px 12px;white-space:pre-wrap;word-break:break-word;box-shadow:0 1px 2px rgba(15,23,42,.05)}
    .assistant{align-self:flex-start;background:#fff;border:1px solid #e2e8f0;color:#1f2937}
    .user{align-self:flex-end;background:${color};border:1px solid ${color};color:#fff}
    .pending{color:#64748b}
    .composer{border-top:1px solid #e2e8f0;padding:10px;background:#fff}
    .input-wrap{display:grid;grid-template-columns:1fr auto;gap:8px;align-items:end;border:1px solid #cbd5e1;border-radius:16px;padding:8px;background:#f8fafc}
    textarea{width:100%;max-height:120px;min-height:42px;resize:none;border:0;background:transparent;padding:8px;font:14px/1.4 system-ui,-apple-system,Segoe UI,sans-serif;outline:none;color:#0f172a}
    .send{background:${color};border-color:${color};color:#fff;min-width:68px}
    .mini-actions{display:flex;justify-content:space-between;align-items:center;margin-top:8px;color:#64748b;font-size:11px}
    .mini-actions button{min-height:28px;padding:5px 8px;border-radius:999px;font-size:11px}
  </style><main>
    <div class="top">
      <header><div class="mark">${manifest.assistantName.slice(0, 1).toUpperCase()}</div><div><h1>${manifest.assistantName}</h1><p class="muted" id="session">Connecting...</p></div><div class="spacer"></div><button class="tool" title="Approve invoice folder" onclick="selectFolder()">Folder</button><button class="icon-button" title="Hide to tray" onclick="mode('tray')">×</button></header>
    </div>
    <section id="messages" aria-live="polite"></section>
    <form class="composer" id="composer">
      <div class="input-wrap">
        <textarea id="input" rows="1" placeholder="Message ${manifest.assistantName.replace(/"/g, "&quot;")}..."></textarea>
        <button class="send" id="send" type="submit">Send</button>
      </div>
      <div class="mini-actions"><span id="folderStatus">No folder selected</span><div><button type="button" onclick="undo()">Undo</button><button type="button" onclick="mode('full')">Full</button></div></div>
    </form>
    <script>
      let conversationId;
      const messages = document.getElementById('messages');
      const input = document.getElementById('input');
      const send = document.getElementById('send');
      const session = document.getElementById('session');
      const folderStatus = document.getElementById('folderStatus');
      function addMessage(role, text, pending){
        const item = document.createElement('div');
        item.className = 'bubble ' + role + (pending ? ' pending' : '');
        item.textContent = text;
        messages.appendChild(item);
        messages.scrollTop = messages.scrollHeight;
        return item;
      }
      function describe(state){
        if(state.revoked) return { session: 'Session revoked', folder: 'Re-authorize from a new installer' };
        if(!state.connected) return { session: 'Waiting for web connection', folder: 'Open from the Install Assistant page to connect this bubble' };
        const folders = state.folders || [];
        if(folders.length === 0) return { session: 'Connected', folder: 'No folder selected' };
        return { session: 'Connected', folder: 'Watching ' + folders.length + ' approved folder' + (folders.length === 1 ? '' : 's') };
      }
      async function refresh(){
        const label = describe(await window.archmindDesktop.status());
        session.textContent = label.session;
        folderStatus.textContent = label.folder;
      }
      async function selectFolder(){await window.archmindDesktop.selectFolder(); await refresh()}
      async function mode(value){await window.archmindDesktop.setMode(value); await refresh()}
      async function undo(){try{await window.archmindDesktop.undoLast(); refresh()}catch(e){alert(e.message)}}
      async function sendMessage(event){
        event.preventDefault();
        const text = input.value.trim();
        if(!text) return;
        addMessage('user', text);
        input.value = '';
        input.style.height = 'auto';
        send.disabled = true;
        const pending = addMessage('assistant', 'Thinking...', true);
        try {
          const result = await window.archmindDesktop.chat({ message: text, conversationId });
          conversationId = result.conversationId;
          pending.textContent = result.answer || 'Done.';
        } catch (error) {
          pending.textContent = 'I could not reach the assistant service. ' + (error && error.message ? error.message : '');
        } finally {
          pending.classList.remove('pending');
          send.disabled = false;
          input.focus();
          messages.scrollTop = messages.scrollHeight;
        }
      }
      document.getElementById('composer').addEventListener('submit', sendMessage);
      input.addEventListener('keydown', (event) => {
        if(event.key === 'Enter' && !event.shiftKey){ sendMessage(event); }
      });
      input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 120) + 'px';
      });
      addMessage('assistant', 'Hi, I am ${manifest.assistantName.replace(/'/g, "\\'")}. Ask me anything, or approve an invoice folder when you want me to watch local files.');
      refresh()
      setInterval(refresh, 10000)
    </script>
  </main>`;
}

function assistantIconGlyph() {
  const normalized = manifest.assistantIcon === "Sparkles" ? "Bot" : manifest.assistantIcon;
  const glyphs: Record<string, string> = {
    BarChart3: "▥",
    BookOpen: "📖",
    Bot: "🤖",
    Brain: "🧠",
    BriefcaseBusiness: "💼",
    Calculator: "∑",
    Code2: "</>",
    DatabaseZap: "⚡",
    FileText: "📄",
    GraduationCap: "🎓",
    Headphones: "🎧",
    Languages: "文",
    LifeBuoy: "◎",
    Megaphone: "📣",
    MessageCircle: "💬",
    Microscope: "🔬",
    PenTool: "✎",
    Scale: "⚖",
    ShieldCheck: "🛡",
    ShoppingCart: "🛒",
    Stethoscope: "⚕",
    Target: "◎"
  };
  if (normalized && glyphs[normalized]) return glyphs[normalized];
  if (normalized && /\p{Extended_Pictographic}/u.test(normalized)) return normalized;
  return manifest.assistantName.slice(0, 1).toUpperCase();
}

function renderBubble() {
  const color = /^#[0-9a-f]{6}$/i.test(manifest.assistantColor ?? "") ? manifest.assistantColor! : "#2563eb";
  const assistantName = escapeHtml(manifest.assistantName);
  const iconLabel = escapeHtml(assistantIconGlyph());
  return `<!doctype html><meta charset="utf-8"><title>${assistantName}</title>
  <style>
    :root{color-scheme:dark;--accent:${color}}
    *{box-sizing:border-box}
    html,body{width:100%;height:100%;margin:0;overflow:hidden;background:transparent}
    body{font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;display:grid;place-items:center}
    .drag-ring{-webkit-app-region:drag;width:64px;height:64px;border-radius:999px;display:grid;place-items:center;background:radial-gradient(circle at 35% 25%,rgba(255,255,255,.42),transparent 28%),linear-gradient(135deg,var(--accent),#3b82f6);box-shadow:0 18px 46px rgba(15,23,42,.34),0 0 0 1px rgba(255,255,255,.18) inset}
    button{-webkit-app-region:no-drag;width:48px;height:48px;border:0;border-radius:999px;background:rgba(8,12,24,.86);color:#fff;font-size:15px;font-weight:950;letter-spacing:-.04em;cursor:pointer;box-shadow:0 0 0 1px rgba(255,255,255,.18) inset;display:grid;place-items:center}
    button:hover+.label,button:focus+.label,.drag-ring:hover .label{opacity:1;transform:translate(-50%,-4px)}
    .label{pointer-events:none;position:fixed;left:50%;bottom:62px;max-width:260px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transform:translate(-50%,2px);opacity:0;padding:8px 12px;border-radius:999px;background:rgba(15,23,42,.94);color:#fff;font-size:13px;font-weight:800;box-shadow:0 16px 36px rgba(0,0,0,.26);transition:opacity .14s ease,transform .14s ease}
  </style>
  <div class="drag-ring" title="${assistantName}">
    <button title="Open ${assistantName}" aria-label="Open ${assistantName}" onclick="window.archmindDesktop.setMode('compact')">${iconLabel}</button>
    <div class="label">${assistantName}</div>
  </div>`;
}

function renderChat() {
  const color = /^#[0-9a-f]{6}$/i.test(manifest.assistantColor ?? "") ? manifest.assistantColor! : "#7c3aed";
  const assistantName = escapeHtml(manifest.assistantName);
  const assistantNameJson = JSON.stringify(manifest.assistantName).replace(/</g, '\\u003c');
  const iconLabel = escapeHtml(assistantIconGlyph());
  return `<!doctype html><meta charset="utf-8"><title>${assistantName}</title>
  <style>
    :root{color-scheme:dark;--accent:${color};--muted:#c4b5fd;--text:#fff}
    *{box-sizing:border-box}
    html,body{width:100%;height:100%;overflow:hidden;margin:0}
    body{font:13.5px/1.45 Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;background:#0b091c;color:var(--text)}
    main{width:100%;height:100%;background:#0b091c;display:flex;flex-direction:column;overflow:hidden;border:1px solid rgba(124,58,237,.35);border-radius:18px}
    header{-webkit-app-region:drag;height:56px;min-height:56px;display:flex;gap:10px;align-items:center;padding:0 14px;border-bottom:1px solid rgba(124,58,237,.25);background:#120e2e}
    .mark{width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,var(--accent),#3b82f6);box-shadow:0 4px 14px rgba(124,58,237,.35);display:grid;place-items:center;color:#fff;font-weight:900;flex:0 0 auto;font-size:14px}
    .title-group{min-width:0;flex:1}
    h1{font-size:13.5px;line-height:1.2;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:800;color:#fff}
    .muted{display:flex;align-items:center;gap:5px;margin-top:2px;color:#a78bfa;font-size:11px;font-weight:600}
    .status-dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:#22c55e;flex-shrink:0}
    .win-actions{display:flex;align-items:center;gap:4px;-webkit-app-region:no-drag}
    .icon-button{width:26px;height:26px;padding:0;font-size:13px;line-height:1;border-radius:8px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.05);color:#cbd5e1;cursor:pointer;display:grid;place-items:center;transition:all .15s ease}
    .icon-button:hover{background:rgba(255,255,255,.15);color:#fff}
    .icon-button.close:hover{background:#ef4444;color:#fff;border-color:#ef4444}
    #messages{position:relative;flex:1;overflow-y:auto;padding:12px 14px;display:flex;flex-direction:column;gap:10px;background:#060511}
    #messages::-webkit-scrollbar{width:5px}
    #messages::-webkit-scrollbar-thumb{background:#26204c;border-radius:999px}
    .bubble{max-width:88%;border-radius:14px;padding:9px 13px;white-space:pre-wrap;word-break:break-word;font-size:13px;line-height:1.45}
    .assistant{align-self:flex-start;background:#161233;border:1px solid rgba(124,58,237,.3);color:#f1f5f9;border-bottom-left-radius:4px}
    .user{align-self:flex-end;background:linear-gradient(135deg,var(--accent),#3b82f6);border:1px solid rgba(147,197,253,.3);color:#fff;border-bottom-right-radius:4px}
    .pending{color:#94a3b8;font-style:italic}
    .composer{border-top:1px solid rgba(124,58,237,.25);padding:10px 12px;background:#0d0a24}
    .input-wrap{display:flex;align-items:center;gap:8px;border:1px solid rgba(124,58,237,.35);border-radius:12px;padding:6px 8px 6px 12px;background:#130f2d}
    .input-wrap:focus-within{border-color:#8b5cf6;box-shadow:0 0 0 2px rgba(139,92,246,.2)}
    textarea{flex:1;min-height:22px;max-height:80px;resize:none;border:0;background:transparent;padding:2px 0;font:13px/1.4 Inter,ui-sans-serif,system-ui,-apple-system,sans-serif;outline:none;color:#fff;overflow-y:auto}
    textarea::-webkit-scrollbar{width:4px}
    textarea::-webkit-scrollbar-thumb{background:#3d3578;border-radius:999px}
    textarea::placeholder{color:#7c72b8}
    .send{background:linear-gradient(135deg,var(--accent),#3b82f6);border:0;border-radius:8px;color:#fff;padding:6px 14px;font-size:12px;font-weight:800;cursor:pointer;transition:opacity .15s ease}
    .send:hover{opacity:.9}
    .send:disabled{opacity:.4;cursor:not-allowed}
    .mini-actions{display:flex;justify-content:space-between;align-items:center;margin-top:6px;padding-top:6px;border-top:1px solid rgba(255,255,255,.06);color:#94a3b8;font-size:11px}
    .mini-actions button{min-height:24px;padding:3px 8px;border-radius:6px;font-size:11px;background:transparent;border:0;color:#c4b5fd;cursor:pointer;transition:color .12s ease}
    .mini-actions button:hover{color:#fff;background:rgba(255,255,255,.08)}
  </style><main>
    <header>
      <div class="mark">${iconLabel}</div>
      <div class="title-group">
        <h1>${assistantName}</h1>
        <div class="muted"><span class="status-dot"></span><span id="session">Connecting...</span></div>
      </div>
      <div class="win-actions">
        <button class="icon-button" title="Minimize to bubble" onclick="mode('bubble')">−</button>
        <button class="icon-button" title="Full Window" onclick="mode('full')">⤢</button>
        <button class="icon-button close" title="Quit App" onclick="quitApp()">×</button>
      </div>
    </header>
    <section id="messages" aria-live="polite">
      <div class="bubble assistant">Hi, I am your ${assistantName}. I stay accessible on your desktop anytime! What would you like to review?</div>
    </section>
    <form class="composer" id="composer">
      <div class="input-wrap">
        <textarea id="input" rows="1" placeholder="Message ${assistantName}..."></textarea>
        <button class="send" id="send" type="submit">Send</button>
      </div>
      <div class="mini-actions">
        <span id="folderStatus">No folder selected</span>
        <div>
          <button type="button" onclick="selectFolder()">Folder</button>
          <button type="button" onclick="mode('bubble')">Bubble</button>
          <button type="button" onclick="mode('full')">Full</button>
          <button type="button" onclick="quitApp()" style="color:#f87171">Quit</button>
        </div>
      </div>
    </form>p()" style="color:#ef4444">Quit App</button></div></div>
    </form>
    <script>
      let conversationId;
      const assistantName = ${assistantNameJson};
      const messages = document.getElementById('messages');
      const input = document.getElementById('input');
      const send = document.getElementById('send');
      const session = document.getElementById('session');
      const folderStatus = document.getElementById('folderStatus');
      function addMessage(role, text, pending){
        const item = document.createElement('div');
        item.className = 'bubble ' + role + (pending ? ' pending' : '');
        item.textContent = text;
        messages.appendChild(item);
        messages.scrollTop = messages.scrollHeight;
        return item;
      }
      const dot = document.querySelector('.status-dot');
      function describe(state){
        if(state.revoked) { dot.style.background='#ef4444'; return { session: 'Session revoked — re-authorize from website', folder: '' }; }
        if(state.offline) { dot.style.background='#f59e0b'; return { session: 'Offline — waiting for ArchMind service', folder: '' }; }
        if(!state.connected) { dot.style.background='#f59e0b'; return { session: 'Waiting for web connection', folder: 'Open from the Install Assistant page' }; }
        dot.style.background='#22c55e';
        const folders = state.folders || [];
        if(folders.length === 0) return { session: 'Online — Ready to assist', folder: 'No folder selected' };
        return { session: 'Online — Ready to assist', folder: 'Watching ' + folders.length + ' folder' + (folders.length === 1 ? '' : 's') };
      }
      async function refresh(){
        try {
          const label = describe(await window.archmindDesktop.status());
          session.textContent = label.session;
          folderStatus.textContent = label.folder;
        } catch(e) { /* ignore */ }
      }
      async function selectFolder(){await window.archmindDesktop.selectFolder(); await refresh()}
      async function mode(value){await window.archmindDesktop.setMode(value); await refresh()}
      async function undo(){try{await window.archmindDesktop.undoLast(); refresh()}catch(e){alert(e.message)}}
      async function quitApp(){await window.archmindDesktop.quitApp()}
      let offlineBannerShown = false;
      async function sendMessage(event){
        event.preventDefault();
        const text = input.value.trim();
        if(!text) return;
        addMessage('user', text);
        input.value = '';
        input.style.height = 'auto';
        send.disabled = true;
        const pending = addMessage('assistant', 'Thinking...', true);
        try {
          const result = await window.archmindDesktop.chat({ message: text, conversationId });
          conversationId = result.conversationId;
          pending.textContent = result.answer || 'Done.';
          offlineBannerShown = false;
        } catch (error) {
          const msg = error && error.message ? error.message : '';
          if (msg.includes('Offline') || msg.includes('could not reach')) {
            if (!offlineBannerShown) {
              pending.textContent = 'Offline — waiting for ArchMind service.';
              offlineBannerShown = true;
            } else {
              pending.remove();
            }
          } else if (msg.includes('revoked')) {
            pending.textContent = 'Session revoked — re-authorize from the website.';
          } else {
            pending.textContent = 'Could not get a response. ' + msg;
          }
        } finally {
          pending.classList.remove('pending');
          send.disabled = false;
          input.focus();
          messages.scrollTop = messages.scrollHeight;
        }
      }
      document.getElementById('composer').addEventListener('submit', sendMessage);
      input.addEventListener('keydown', (event) => {
        if(event.key === 'Enter' && !event.shiftKey){ sendMessage(event); }
      });
      input.addEventListener('input', () => {
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 120) + 'px';
      });
      refresh();
      setInterval(refresh, 10000);
      input.focus();
    </script>
  </main>`;
}

function chatUrl() {
  const fallbackUrl = `data:text/html;charset=utf-8,${encodeURIComponent(renderChat())}`;
  return { fallbackUrl, preferredUrl: fallbackUrl };
}

function loadBubbleView() {
  if (!mainWindow || mainWindow.isDestroyed() || loadedView === "bubble") return;
  loadedView = "bubble";
  void mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(renderBubble())}`).catch(() => undefined);
}

function loadChatView() {
  if (!mainWindow || mainWindow.isDestroyed() || loadedView === "chat") return;
  loadedView = "chat";
  const { fallbackUrl, preferredUrl } = chatUrl();
  mainWindow.loadURL(preferredUrl).catch(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return undefined;
    return mainWindow.loadURL(fallbackUrl);
  });
}

function applyMode(mode: Mode) {
  currentMode = mode;
  void saveDesktopState({ mode }).catch(() => undefined);
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.setMenuBarVisibility(false);
  if (mode === "tray") {
    mainWindow.setSkipTaskbar(true);
    mainWindow.hide();
  } else if (mode === "bubble") {
    loadBubbleView();
    mainWindow.restore();
    mainWindow.unmaximize();
    mainWindow.setSkipTaskbar(true);
    mainWindow.setBounds(getBubbleBounds(), false);
    mainWindow.setAlwaysOnTop(true, "floating");
    mainWindow.setResizable(false);
    mainWindow.setMovable(true);
    mainWindow.show();
  } else if (mode === "compact") {
    loadChatView();
    mainWindow.restore();
    mainWindow.unmaximize();
    mainWindow.setSkipTaskbar(false);
    const fallback = defaultSizedBounds(compactSize);
    mainWindow.setBounds(clampBounds(desktopState().compactBounds ?? fallback, fallback), false);
    mainWindow.setAlwaysOnTop(false);
    mainWindow.setResizable(true);
    mainWindow.show();
    mainWindow.focus();
  } else {
    loadChatView();
    mainWindow.restore();
    mainWindow.unmaximize();
    mainWindow.setSkipTaskbar(false);
    const fallback = defaultSizedBounds(fullSize);
    mainWindow.setBounds(clampBounds(desktopState().fullBounds ?? fallback, fallback), false);
    mainWindow.setAlwaysOnTop(false);
    mainWindow.setResizable(true);
    mainWindow.show();
    mainWindow.focus();
  }
}

function createWindow() {
  const initialBounds = currentMode === "bubble" ? getBubbleBounds() : defaultSizedBounds(fullSize);
  mainWindow = new BrowserWindow({
    x: initialBounds.x,
    y: initialBounds.y,
    width: initialBounds.width,
    height: initialBounds.height,
    minWidth: 56,
    minHeight: 56,
    title: manifest.assistantName,
    frame: false,
    resizable: false,
    autoHideMenuBar: true,
    backgroundColor: "#00000000",
    webPreferences: { preload: path.join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false }
  });
  mainWindow.setMenuBarVisibility(false);
  if (currentMode === "bubble") loadBubbleView();
  else loadChatView();
  mainWindow.on("move", rememberWindowBounds);
  mainWindow.on("resize", rememberWindowBounds);
  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      applyMode("bubble");
    }
  });
  (mainWindow as unknown as { on(eventName: "minimize", listener: (event: { preventDefault(): void }) => void): void }).on("minimize", (event) => {
    event.preventDefault();
    applyMode("bubble");
  });
  mainWindow.once("ready-to-show", () => applyMode(currentMode));
}

function createTray() {
  const color = /^#[0-9a-f]{6}$/i.test(manifest.assistantColor ?? "") ? manifest.assistantColor! : "#2563eb";
  const iconText = escapeHtml(assistantIconGlyph());
  const icon = nativeImage.createFromDataURL(`data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${color}"/><stop offset="1" stop-color="#60A5FA"/></linearGradient></defs><rect width="32" height="32" rx="10" fill="url(#g)"/><circle cx="16" cy="16" r="10" fill="rgba(15,23,42,.84)"/><text x="16" y="19.5" text-anchor="middle" font-family="Segoe UI,Arial" font-size="8" font-weight="800" fill="#fff">${iconText}</text></svg>`)}`);
  tray = new Tray(icon);
  tray.setToolTip(manifest.assistantName);
  tray.on("click", () => applyMode("compact"));
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Open Chat", click: () => applyMode("compact") },
    { label: "Show Bubble", click: () => applyMode("bubble") },
    { type: "separator" },
    { label: "Quit App", click: () => { isQuitting = true; app.quit(); } }
  ]));
}

async function selectFolder() {
  const result = await dialog.showOpenDialog(mainWindow!, { properties: ["openDirectory"] });
  if (result.canceled || !result.filePaths[0]) return { selected: false };
  const folder = await fsp.realpath(result.filePaths[0]);
  const approved = loadJson<ApprovedFolders>(statePath("approved-folders.json"), { folders: [] });
  if (!approved.folders.includes(folder)) approved.folders.push(folder);
  await saveJson(statePath("approved-folders.json"), approved);
  await audit("desktop.folder.approved", "completed", { folder });
  await startWatchers();
  return { selected: true, folder };
}

function registerIpc() {
  ipcMain.handle("archmind:status", () => ({
    assistantId: manifest.assistantId,
    assistantName: manifest.assistantName,
    assistantIcon: manifest.assistantIcon,
    assistantColor: manifest.assistantColor,
    mode: currentMode,
    connected: Boolean(credentials),
    revoked,
    offline,
    folders: loadJson<ApprovedFolders>(statePath("approved-folders.json"), { folders: [] }).folders
  }));
  ipcMain.handle("archmind:chat", async (_event, input: { message?: string; conversationId?: string }) => {
    const message = input?.message?.trim();
    if (!message) throw new Error("Message is required.");
    if (revoked) throw new Error("Session revoked — re-authorize from the website.");
    if (offline) throw new Error("Offline — backend not reachable.");
    if (!credentials) throw new Error("Offline — no active session.");
    return api("/api/platform/desktop/chat", {
      method: "POST",
      body: JSON.stringify({ message, conversationId: input.conversationId, responseLength: "balanced", language: "English" })
    });
  });
  ipcMain.handle("archmind:select-folder", () => selectFolder());
  ipcMain.handle("archmind:set-mode", (_event, mode: Mode) => { applyMode(mode); return { mode }; });
  ipcMain.handle("archmind:undo-last", () => undoLast());
  ipcMain.handle("archmind:set-launch-at-login", (_event, enabled: boolean) => { app.setLoginItemSettings({ openAtLogin: enabled }); return { enabled }; });
  ipcMain.handle("archmind:quit-app", () => { isQuitting = true; app.quit(); });
}

function configureIdentity() {
  manifest = readManifest();
  pendingInstallIntent = extractInstallIntent(process.argv);
  app.setName(manifest.productName);
  app.setAppUserModelId(manifest.appId);
  app.setPath("userData", path.join(app.getPath("appData"), "ArchMind", manifest.userDataDirectoryName));
  currentMode = "bubble";
}

async function start() {
  Menu.setApplicationMenu(null);
  app.setAsDefaultProtocolClient(manifest.protocol);
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => {
    if (!new Set(["clipboard-read", "media", "display-capture"]).has(permission)) {
      callback(false);
      return;
    }
    const options = {
      type: "question" as const,
      buttons: ["Allow", "Deny"],
      defaultId: 1,
      cancelId: 1,
      title: `${manifest.assistantName} permission`,
      message: `Allow ${manifest.assistantName} to use ${permission}?`,
      detail: "Sensitive desktop permissions require your explicit approval."
    };
    const request = mainWindow ? dialog.showMessageBox(mainWindow, options) : dialog.showMessageBox(options);
    void request.then((result) => callback(result.response === 0)).catch(() => callback(false));
  });
  registerIpc();
  createWindow();
  createTray();
  globalShortcut.register("CommandOrControl+Shift+A", () => applyMode(currentMode === "tray" ? "full" : "tray"));
  await bootstrap().then(async () => {
    if (!offline) {
      await saveJson(statePath("runtime-state.json"), { status: "active", updatedAt: new Date().toISOString() });
    }
  }).catch(async (error) => {
    const msg = error instanceof Error ? error.message : "";
    // Only mark revoked for explicit session-invalid, not for network errors
    if (msg.includes("Offline") || msg.includes("ECONNREFUSED") || msg.includes("could not reach")) {
      offline = true;
    } else {
      await markRevoked(msg || "Desktop session is unavailable.");
    }
  });
  await startWatchers();
  // Periodic session check + reconnection
  setInterval(async () => {
    if (revoked) return;
    try {
      const data = await api("/api/platform/desktop/session") as { assistant?: DesktopAssistantPayload };
      if (offline) {
        offline = false;
        revoked = false;
        refreshAssistantIdentity(data.assistant);
        pushStatusUpdate();
      }
    } catch {
      pushStatusUpdate();
    }
  }, 15000);
}

configureIdentity();
const singleInstanceLock = app.requestSingleInstanceLock({ assistantId: manifest.assistantId, appId: manifest.appId });
if (!singleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    const intent = extractInstallIntent(argv);
    if (intent) {
      pendingInstallIntent = intent;
      void bootstrap().then(() => {
        if (mainWindow) mainWindow.setTitle(manifest.assistantName);
        applyMode("bubble");
      }).catch((error) => markRevoked(error instanceof Error ? error.message : "Install intent could not be claimed."));
    } else {
      applyMode("bubble");
    }
  });

  app.whenReady().then(start).catch((error) => {
    console.error("Desktop startup failed", error);
    app.quit();
  });
}
app.on("window-all-closed", () => {
  if (!isQuitting) {
    // Don't quit — re-create the window as a bubble
    currentMode = "bubble";
  }
});
app.on("before-quit", () => {
  isQuitting = true;
});
app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  stopWatchers();
});
