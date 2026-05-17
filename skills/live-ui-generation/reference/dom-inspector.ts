interface ContainerContext {
  selector: string;
  tag: string;
  html: string;
  text: string;
  title: string;
  value: string;
  description: string;
  dataKeys: string[];
}

interface ElementContext {
  selector: string;
  tagName: string;
  outerHTML: string;
  textContent: string;
  computedStyles: Record<string, string>;
  boundingRect: { top: number; left: number; width: number; height: number };
  attributes: Record<string, string>;
  xpath: string;
  container: ContainerContext;
  pageTitle: string;
  componentHierarchy: string | null;
  columnIndex: number | null;
}

type OnCapture = (ctx: ElementContext, prompt: string) => void;

const RELEVANT_STYLES = [
  "display",
  "position",
  "width",
  "height",
  "margin",
  "padding",
  "color",
  "background-color",
  "font-size",
  "font-weight",
  "flex-direction",
  "grid-template-columns",
  "overflow",
  "z-index",
];

// -------- console error capture (shared buffer from capture-console-errors.ts) --------

import { getCapturedConsoleErrors, getConsoleErrorCount } from "./capture-console-errors";

function buildConsoleErrorSection(): {
  wrapper: HTMLElement;
  getMode: () => "minimal" | "detailed" | null;
  destroy: () => void;
} {
  const wrapper = document.createElement("div");
  wrapper.style.cssText = "padding:4px 12px 8px;border-top:1px solid #1e1e3e;";

  const checkbox = document.createElement("label");
  Object.assign(checkbox.style, {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "11px",
    color: "#aaa",
    cursor: "pointer",
    padding: "4px 0",
    userSelect: "none",
  });

  const checkInput = document.createElement("input");
  checkInput.type = "checkbox";

  const settingsRow = document.createElement("div");
  Object.assign(settingsRow.style, {
    display: "none",
    flexDirection: "row",
    alignItems: "center",
    gap: "12px",
    paddingLeft: "18px",
    marginTop: "4px",
  });

  const minimalLabel = document.createElement("label");
  const minimalInput = document.createElement("input");
  minimalInput.type = "radio";
  minimalInput.name = "consoleErrorDetail";
  minimalInput.value = "minimal";
  minimalInput.checked = true;
  minimalLabel.style.cssText = "font-size:10px;color:#999;cursor:pointer;";
  minimalLabel.appendChild(minimalInput);
  minimalLabel.append(" Minimal");

  const detailedLabel = document.createElement("label");
  const detailedInput = document.createElement("input");
  detailedInput.type = "radio";
  detailedInput.name = "consoleErrorDetail";
  detailedInput.value = "detailed";
  detailedLabel.style.cssText = "font-size:10px;color:#999;cursor:pointer;";
  detailedLabel.appendChild(detailedInput);
  detailedLabel.append(" Detailed");

  settingsRow.appendChild(minimalLabel);
  settingsRow.appendChild(detailedLabel);

  const count = document.createElement("span");
  count.style.cssText = "font-size:10px;color:#888;margin-left:auto;font-weight:bold;";

  checkInput.addEventListener("change", () => {
    settingsRow.style.display = checkInput.checked ? "flex" : "none";
  });

  checkbox.appendChild(checkInput);
  checkbox.append(" Send console errors");
  checkbox.appendChild(count);
  wrapper.appendChild(checkbox);
  wrapper.appendChild(settingsRow);

  function updateCount() {
    const n = getConsoleErrorCount();
    count.textContent = n > 0 ? ` [${n} error${n !== 1 ? "s" : ""}]` : "";
  }
  updateCount();
  const interval = setInterval(updateCount, 1000);

  return {
    wrapper,
    getMode: (): "minimal" | "detailed" | null => {
      if (!checkInput.checked) return null;
      return detailedInput.checked ? "detailed" : "minimal";
    },
    destroy: () => clearInterval(interval),
  };
}

// -------- spinner CSS (injected once) --------

function injectSpinnerStyles(): void {
  const existing = document.getElementById("__frontloop_styles__");
  if (existing) existing.remove();
  const style = document.createElement("style");
  style.id = "__frontloop_styles__";
  style.textContent = `
    @keyframes __frontloop_spin {
      to { transform: rotate(360deg); }
    }
    @keyframes __frontloop_dots {
      0%, 20% { opacity: 0; }
      40% { opacity: 1; }
      60%, 100% { opacity: 0; }
    }
    .__frontloop_overlay {
      position: fixed;
      z-index: 2147483647;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 10px;
      background: rgba(18,18,42,0.82);
      border: 2px solid #F97316;
      border-radius: 4px;
      box-sizing: border-box;
      pointer-events: none;
    }
    .__frontloop_spinner {
      width: 28px;
      height: 28px;
      border: 3px solid rgba(249,115,22,0.2);
      border-top-color: #F97316;
      border-radius: 50%;
      animation: __frontloop_spin 0.7s linear infinite;
    }
    .__frontloop_label {
      font-family: "Fira Mono", monospace;
      font-size: 11px;
      color: #F97316;
      letter-spacing: 0.5px;
    }
    .__frontloop_label::after {
      content: '';
      animation: __frontloop_dots 1.6s steps(1) infinite;
    }
    @keyframes __frontloop_pulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(5,150,105,0.5); }
      50% { box-shadow: 0 0 0 8px rgba(5,150,105,0); }
    }
    .__frontloop_fab_active {
      background: #059669 !important;
      box-shadow: 0 2px 12px rgba(5,150,105,0.4) !important;
      animation: __frontloop_pulse 1.5s ease-in-out infinite !important;
    }
    #__frontloop_speed_dial__ {
      position: fixed;
      bottom: 16px;
      right: 16px;
      z-index: 2147483645;
      width: 36px;
      height: 36px;
    }
    #__frontloop_dial_items__ {
      position: absolute;
      right: 46px;
      bottom: 0;
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 10px;
      pointer-events: none;
      opacity: 0;
      transform: translateX(8px);
      transition: opacity 0.18s ease, transform 0.18s ease;
      white-space: nowrap;
    }
    #__frontloop_speed_dial__.open #__frontloop_dial_items__ {
      opacity: 1;
      pointer-events: auto;
      transform: translateX(0);
    }
    .__frontloop_dial_item {
      display: flex;
      flex-direction: row;
      align-items: center;
      gap: 6px;
    }
    .__frontloop_dial_label {
      font-family: "Fira Mono", monospace;
      font-size: 10px;
      color: #e0e0e0;
      background: rgba(18,18,42,0.9);
      padding: 3px 8px;
      border-radius: 4px;
      white-space: nowrap;
      box-shadow: 0 1px 4px rgba(0,0,0,0.4);
      pointer-events: none;
    }
    .__frontloop_dial_circle {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 13px;
      font-weight: bold;
      font-family: "Fira Mono", monospace;
      user-select: none;
      transition: transform 0.12s ease;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      color: #fff;
      flex-shrink: 0;
    }
    .__frontloop_dial_circle:hover {
      transform: scale(1.12);
    }
  `;
  document.head.appendChild(style);
}
injectSpinnerStyles();

// -------- generating overlay manager --------

const overlays: Record<string, HTMLElement> = {};
let _speedDialContainer: HTMLElement | null = null;

// -------- undo history --------

const UNDO_STACK_KEY = "__frontloop_undo_stack__";

const undoStack: string[] = (() => {
  try {
    return JSON.parse(sessionStorage.getItem(UNDO_STACK_KEY) || "[]");
  } catch {
    return [];
  }
})();

let _undoBtn: HTMLElement | null = null;

function saveUndoStack(): void {
  try {
    sessionStorage.setItem(UNDO_STACK_KEY, JSON.stringify(undoStack));
  } catch {}
}

function updateUndoBtnState(): void {
  if (!_undoBtn) return;
  const hasHistory = undoStack.length > 0;
  _undoBtn.style.background = hasHistory ? "#ef4444" : "#3a3a5a";
  _undoBtn.style.cursor = hasHistory ? "pointer" : "default";
  _undoBtn.style.opacity = hasHistory ? "1" : "0.4";
  _undoBtn.title = hasHistory
    ? `Undo last change (${undoStack.length} in history)`
    : "Nothing to undo";
}

function showGeneratingOverlay(
  taskId: string,
  rect: { top: number; left: number; width: number; height: number }
): void {
  if (_speedDialContainer) _speedDialContainer.style.display = "none";
  const overlay = document.createElement("div");
  overlay.className = "__frontloop_overlay";
  overlay.style.top = `${rect.top + window.scrollY}px`;
  overlay.style.left = `${rect.left + window.scrollX}px`;
  overlay.style.width = `${rect.width}px`;
  overlay.style.height = `${rect.height}px`;
  overlay.style.minWidth = "80px";
  overlay.style.minHeight = "80px";

  const spinner = document.createElement("div");
  spinner.className = "__frontloop_spinner";
  overlay.appendChild(spinner);

  const label = document.createElement("div");
  label.className = "__frontloop_label";
  label.textContent = "Generating";
  overlay.appendChild(label);

  document.body.appendChild(overlay);
  overlays[taskId] = overlay;
}

function removeGeneratingOverlay(taskId: string): void {
  const overlay = overlays[taskId];
  if (overlay) {
    overlay.remove();
    delete overlays[taskId];
  }
  if (_speedDialContainer && Object.keys(overlays).length === 0) {
    _speedDialContainer.style.display = "";
  }
}

// -------- selector / xpath helpers --------

function cssEscape(value: string): string {
  if (typeof value !== "string") return "";
  return value.replace(
    /[ !"#$%&'()*+,.\/:;<=>?@[\]^`{|}~\\]/g,
    (c) => `\\${c}`
  );
}

function findSelector(el: Element): string {
  if (el.id) return `#${cssEscape(el.id)}`;

  const parts: string[] = [];
  let current: Element | null = el;

  while (
    current &&
    current !== document.body &&
    current !== document.documentElement
  ) {
    const tag = current.tagName.toLowerCase();
    let selector = tag;

    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (c) => c.tagName === current!.tagName
      );
      if (siblings.length > 1) {
        const idx = siblings.indexOf(current) + 1;
        selector += `:nth-child(${idx})`;
      }
    }

    const classes = Array.from(current.classList).filter(
      (c) => !c.startsWith("__frontloop_")
    );
    if (classes.length > 0) {
      selector += "." + classes.map((c) => cssEscape(c)).join(".");
    }

    parts.unshift(selector);
    current = current.parentElement;

    if (current && current.id) {
      parts.unshift(`#${cssEscape(current.id)}`);
      break;
    }
  }

  return parts.join(" > ") || el.tagName.toLowerCase();
}

function getXPath(el: Node): string {
  if (el.nodeType === Node.ELEMENT_NODE) {
    const element = el as Element;
    if (element.id) return `//*[@id="${element.id}"]`;
  }

  const parts: string[] = [];
  let node: Node | null = el;
  while (node && node.nodeType === Node.ELEMENT_NODE) {
    const elNode = node as Element;
    let idx = 1;
    let sib: Node | null = elNode.previousSibling;
    while (sib) {
      if (
        sib.nodeType === Node.ELEMENT_NODE &&
        (sib as Element).tagName === elNode.tagName
      )
        idx++;
      sib = sib.previousSibling;
    }
    parts.unshift(`${elNode.tagName.toLowerCase()}[${idx}]`);
    node = elNode.parentNode;
  }
  return "/" + parts.join("/");
}

// -------- container enrichment --------

function enrichContainer(el: HTMLElement): ContainerContext {
  const empty: ContainerContext = {
    selector: "",
    tag: "",
    html: "",
    text: "",
    title: "",
    value: "",
    description: "",
    dataKeys: [],
  };

  // walk up max 10 levels to find a card-like ancestor
  let card: HTMLElement | null = el;
  for (let i = 0; i < 10; i++) {
    if (!card) break;
    const role = card.getAttribute("role");
    const cls = (
      typeof card.className === "string" ? card.className : ""
    ).toLowerCase();
    if (
      role === "card" ||
      role === "region" ||
      cls.includes("card") ||
      cls.includes("widget") ||
      cls.includes("panel") ||
      cls.includes("box") ||
      cls.includes("tile") ||
      cls.includes("container") ||
      cls.includes("metric") ||
      cls.includes("stat")
    ) {
      break;
    }
    card = card.parentElement;
  }
  if (!card || card === el) return empty;

  const text = card.textContent?.trim().slice(0, 1000) ?? "";

  // extract title, value, description
  const children = Array.from(card.querySelectorAll("*"));
  let title = "";
  let value = "";
  let description = "";
  const dataKeys: string[] = [];

  for (const child of children) {
    const t = child.textContent?.trim() || "";
    if (!t) continue;
    const tag = child.tagName.toLowerCase();
    if (["h1", "h2", "h3", "h4", "h5", "h6", "th"].includes(tag) && !title) {
      title = t.slice(0, 100);
    }
    if (
      !value &&
      (tag === "strong" ||
        tag === "b" ||
        (child instanceof HTMLElement && child.dataset.value))
    ) {
      value = t.slice(0, 50);
    }
    if (
      ["small", "span", "label"].includes(tag) &&
      child !== card &&
      !description.includes(t)
    ) {
      description += (description ? " " : "") + t;
    }
  }

  // fallbacks
  if (!title) {
    const first = card.querySelector(
      "h1, h2, h3, h4, h5, h6, th, [data-title]"
    );
    if (first) title = (first.textContent || "").trim().slice(0, 100);
  }

  if (!title) {
    // label elements and data attributes
    card
      .querySelectorAll("[aria-label], [data-label], [data-key]")
      .forEach((l) => {
        const lbl =
          l.getAttribute("aria-label") ||
          l.getAttribute("data-label") ||
          l.getAttribute("data-key") ||
          "";
        if (lbl) dataKeys.push(lbl);
      });
  }

  return {
    selector: findSelector(card),
    tag: card.tagName.toLowerCase(),
    html: card.outerHTML.slice(0, 3000),
    text,
    title: title.slice(0, 100),
    value: value.slice(0, 50),
    description: description.slice(0, 200),
    dataKeys,
  };
}

// -------- React component hierarchy --------

// Common framework wrapper names to skip — they don't help identify
// the application component that owns the clicked element.
const WRAPPER_RE =
  /^(Route|Switch|InnerLoadable|Loadable|ConnectFunction|Connect|ForwardRef|Provider|Consumer|Fragment|StrictMode|Context\.|with[A-Z])/;

function getComponentName(type: any): string | null {
  if (typeof type === "function") return type.displayName || type.name || null;
  if (typeof type === "object" && type !== null)
    return type.displayName || null;
  return null;
}

function getReactComponentHierarchy(el: Element): string | null {
  // React 16+ uses __reactFiber$<hash>; pre-fiber used __reactInternalInstance$<hash>
  const fiberKey = Object.keys(el).find(
    (k) =>
      k.startsWith("__reactFiber$") || k.startsWith("__reactInternalInstance$")
  );
  if (!fiberKey) return null;

  const names: string[] = [];
  // Skip the clicked element's own fiber (host component — type is a string like 'div')
  let fiber = (el as any)[fiberKey]?.return;
  let depth = 0;
  const seen = new Set<string>();

  while (fiber && depth < 50) {
    const name = getComponentName(fiber.type);
    if (
      name &&
      !seen.has(name) &&
      !name.startsWith("_") &&
      !WRAPPER_RE.test(name)
    ) {
      names.unshift(name);
      seen.add(name);
    }
    fiber = fiber.return;
    depth++;
  }

  const tag = el.tagName.toLowerCase();
  return names.length > 0 ? `${tag} (${names.join(" > ")})` : tag;
}

function captureContext(el: HTMLElement, _e: MouseEvent): ElementContext {
  const computed = window.getComputedStyle(el);
  const computedStyles = RELEVANT_STYLES.reduce((acc, prop) => {
    acc[prop] = computed.getPropertyValue(prop);
    return acc;
  }, {} as Record<string, string>);

  const attrs = Array.from(el.attributes).reduce((acc, a) => {
    acc[a.name] = a.value;
    return acc;
  }, {} as Record<string, string>);

  const rect = el.getBoundingClientRect();

  return {
    selector: findSelector(el),
    tagName: el.tagName.toLowerCase(),
    outerHTML: el.outerHTML.slice(0, 2000),
    textContent: el.textContent?.trim().slice(0, 500) ?? "",
    computedStyles,
    boundingRect: {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
    },
    attributes: attrs,
    xpath: getXPath(el),
    container: enrichContainer(el),
    pageTitle: document.title,
    componentHierarchy: getReactComponentHierarchy(el),
    columnIndex: null,
  };
}

// -------- WebSocket dispatch with live connection --------

// -------- reload listener (persistent WS for RELOAD messages) --------

function connectReloadListener(): void {
  let ws: WebSocket | null = null;

  function connect(): void {
    ws = new WebSocket("ws://localhost:7332");
    ws.onmessage = (event) => {
      if (event.data === "RELOAD") {
        window.location.reload();
      }
    };
    ws.onclose = () => {
      // auto-reconnect after 3s on unexpected disconnect
      setTimeout(() => {
        connect();
      }, 3000);
    };
    ws.onerror = () => {
      // onclose will fire after onerror, triggering reconnect
    };
  }

  connect();
}

function dispatchFixTask(
  ctx: ElementContext,
  userPrompt: string,
  consoleErrorMode?: "minimal" | "detailed" | null
): string {
  const id = Math.random().toString(36).slice(2, 10);
  undoStack.push(id);
  saveUndoStack();
  updateUndoBtnState();

  showGeneratingOverlay(id, ctx.boundingRect);

  const payload: Record<string, any> = {
    id,
    type: "dom-fix",
    prompt: userPrompt,
    element: {
      selector: ctx.selector,
      tag: ctx.tagName,
      html: ctx.outerHTML,
      text: ctx.textContent,
      styles: ctx.computedStyles,
      componentHierarchy: ctx.componentHierarchy,
      columnIndex: ctx.columnIndex,
    },
    container: ctx.container,
    pageTitle: ctx.pageTitle,
    page: window.location.href,
  };

  if (consoleErrorMode) {
    const errors = getCapturedConsoleErrors(consoleErrorMode);
    if (errors.length > 0) {
      payload.consoleErrors = { mode: consoleErrorMode, errors };
    }
  }

  const ws = new WebSocket("ws://localhost:7332");
  ws.onopen = () => {
    ws.send(`TASK: ${JSON.stringify(payload)}`);
  };
  ws.onmessage = (event) => {
    if (event.data === `COMPLETE:${id}`) {
      removeGeneratingOverlay(id);
      // Clean up inspector artifacts: highlight, cursor, FAB icon
      const highlight = document.getElementById("__frontloop_highlight__");
      if (highlight) highlight.style.display = "none";
      const fab = document.getElementById("__frontloop_fab__");
      if (fab) {
        fab.textContent = "⋞";
        fab.title = "Live UI Inspector";
      }
      document.body.style.cursor = "";
      ws.close();
    }
  };
  ws.onerror = () => {
    console.error("[Frontloop] monitor not reachable — is ws-monitor running?");
    removeGeneratingOverlay(id);
  };
  ws.onclose = () => {
    // if no COMPLETE was received within a reasonable time, clean up anyway
    setTimeout(() => removeGeneratingOverlay(id), 120000);
  };

  return id;
}

function dispatchUndoCommand(): void {
  const targetTaskId = undoStack.pop();
  saveUndoStack();
  updateUndoBtnState();
  const id = Math.random().toString(36).slice(2, 10);
  const payload = { id, type: "undo", targetTaskId };
  const ws = new WebSocket("ws://localhost:7332");
  ws.onopen = () => {
    ws.send(`UNDO: ${JSON.stringify(payload)}`);
    ws.close();
  };
  ws.onerror = () => {
    console.error("[Frontloop] undo: monitor not reachable");
  };
}

// -------- DOMInspector class --------

class DOMInspector {
  private highlight: HTMLElement;
  private active = false;
  private inspectBtn: HTMLElement;
  private container: HTMLElement;
  private panel: HTMLElement | null = null;
  private onCapture: OnCapture;

  constructor(
    onCapture: OnCapture,
    inspectBtn: HTMLElement,
    container: HTMLElement
  ) {
    this.onCapture = onCapture;
    this.inspectBtn = inspectBtn;
    this.container = container;
    this.highlight = this.createHighlight();
    document.body.appendChild(this.highlight);
  }

  private createHighlight(): HTMLElement {
    const div = document.createElement("div");
    div.id = "__frontloop_highlight__";
    Object.assign(div.style, {
      position: "fixed",
      pointerEvents: "none",
      border: "2px solid #F97316",
      backgroundColor: "rgba(249,115,22,0.08)",
      zIndex: "2147483647",
      transition: "all 0.1s ease",
      boxSizing: "border-box",
      borderRadius: "4px",
      display: "none",
    });
    return div;
  }

  activate(): void {
    this.active = true;
    this.container.style.display = "none";
    this.inspectBtn.classList.add("__frontloop_fab_active");
    document.body.style.cursor = "crosshair";
    document.addEventListener("mouseover", this.onHover, true);
    document.addEventListener("click", this.onClick, true);
    document.addEventListener("keydown", this.onKey, true);
  }

  deactivate(): void {
    this.active = false;
    this.inspectBtn.classList.remove("__frontloop_fab_active");
    if (Object.keys(overlays).length === 0) this.container.style.display = "";
    document.body.style.cursor = "";
    document.removeEventListener("mouseover", this.onHover, true);
    document.removeEventListener("click", this.onClick, true);
    document.removeEventListener("keydown", this.onKey, true);
    this.highlight.style.display = "none";
    this.removePanel();
  }

  isActive(): boolean {
    return this.active;
  }

  private removePanel(): void {
    if (this.panel) {
      const cleanup = (this.panel as any).__consoleErrorCleanup;
      if (typeof cleanup === "function") cleanup();
      this.panel.remove();
      this.panel = null;
    }
  }

  private onHover = (e: MouseEvent): void => {
    const el = e.target as HTMLElement;
    if (
      el.closest("#__frontloop_highlight__") ||
      el.closest("#__frontloop_panel__") ||
      el.closest("#__frontloop_speed_dial__")
    )
      return;

    // Hovering over a table header — highlight the entire column
    const th = el.closest("th");
    if (th) {
      this.highlightTableColumn(th as HTMLTableCellElement);
      return;
    }

    const rect = el.getBoundingClientRect();
    Object.assign(this.highlight.style, {
      display: "block",
      top: `${rect.top + window.scrollY}px`,
      left: `${rect.left + window.scrollX}px`,
      width: `${rect.width}px`,
      height: `${rect.height}px`,
    });
  };

  private getColumnBoundingRect(
    th: HTMLTableCellElement
  ): { top: number; left: number; width: number; height: number } | null {
    const table = th.closest("table");
    if (!table) return null;

    const index = th.cellIndex;
    const rows = Array.from(
      table.querySelectorAll(
        ":scope > thead tr, :scope > tbody tr, :scope > tfoot tr"
      )
    );
    if (rows.length === 0) return null;

    let top = Infinity,
      left = Infinity,
      right = -Infinity,
      bottom = -Infinity;
    let found = false;

    rows.forEach((row) => {
      const cells = row.querySelectorAll("th, td");
      const cell = cells[index] as HTMLElement | undefined;
      if (!cell) return;
      const rect = cell.getBoundingClientRect();
      top = Math.min(top, rect.top);
      left = Math.min(left, rect.left);
      right = Math.max(right, rect.right);
      bottom = Math.max(bottom, rect.bottom);
      found = true;
    });

    if (!found) return null;
    return { top, left, width: right - left, height: bottom - top };
  }

  private highlightTableColumn(th: HTMLTableCellElement): void {
    const colRect = this.getColumnBoundingRect(th);
    if (!colRect) return;

    Object.assign(this.highlight.style, {
      display: "block",
      top: `${colRect.top + window.scrollY}px`,
      left: `${colRect.left + window.scrollX}px`,
      width: `${colRect.width}px`,
      height: `${colRect.height}px`,
    });
  }

  private enrichContainerWithColumn(
    th: HTMLTableCellElement,
    ctx: ElementContext
  ): void {
    const table = th.closest("table");
    if (!table) return;
    const index = th.cellIndex;
    const rows = Array.from(
      table.querySelectorAll(
        ":scope > thead tr, :scope > tbody tr, :scope > tfoot tr"
      )
    );
    if (rows.length === 0) return;

    const cellTexts: string[] = [];
    rows.forEach((row) => {
      const cells = row.querySelectorAll("th, td");
      const cell = cells[index] as HTMLElement | undefined;
      if (!cell) return;
      const text = cell.textContent?.trim() || "";
      if (text) cellTexts.push(text);
    });

    if (cellTexts.length > 1) {
      ctx.container.text = cellTexts.join(" | ");
      ctx.container.description = "table column";
      ctx.container.dataKeys = cellTexts;
    }
    // Use column header as the container title
    if (!ctx.container.title) {
      ctx.container.title = ctx.textContent.slice(0, 100);
    }
  }

  private onClick = (e: MouseEvent): void => {
    e.preventDefault();
    e.stopPropagation();

    const el = e.target as HTMLElement;
    if (el.closest("#__frontloop_panel__")) return;

    const ctx = captureContext(el, e);

    // Deactivate interaction mode but keep highlight visible over captured element
    this.active = false;
    this.inspectBtn.classList.remove("__frontloop_fab_active");
    this.container.style.display = "none";
    document.body.style.cursor = "";
    document.removeEventListener("mouseover", this.onHover, true);
    document.removeEventListener("click", this.onClick, true);
    document.removeEventListener("keydown", this.onKey, true);

    // Pin highlight at the captured element's position
    // If a table header was clicked, highlight the entire column instead
    const clickedTh = el.closest("th") as HTMLTableCellElement | null;
    if (clickedTh) {
      this.highlightTableColumn(clickedTh);
      this.enrichContainerWithColumn(clickedTh, ctx);
      const colRect = this.getColumnBoundingRect(clickedTh);
      if (colRect) ctx.boundingRect = colRect;
      ctx.columnIndex = clickedTh.cellIndex;
      // Generate a column-wide selector covering both header and body cells
      const table = clickedTh.closest("table");
      if (table) {
        const tableSelector = findSelector(table);
        ctx.selector = `${tableSelector} th:nth-child(${
          ctx.columnIndex + 1
        }), ${tableSelector} td:nth-child(${ctx.columnIndex + 1})`;
      }
    } else {
      Object.assign(this.highlight.style, {
        display: "block",
        top: `${ctx.boundingRect.top + window.scrollY}px`,
        left: `${ctx.boundingRect.left + window.scrollX}px`,
        width: `${ctx.boundingRect.width}px`,
        height: `${ctx.boundingRect.height}px`,
      });
    }

    this.showPromptPanel(ctx);
  };

  private onKey = (e: KeyboardEvent): void => {
    if (e.key === "Escape") {
      this.deactivate();
    }
  };

  private showPromptPanel(ctx: ElementContext): void {
    this.removePanel();

    const panel = document.createElement("div");
    panel.id = "__frontloop_panel__";
    Object.assign(panel.style, {
      position: "fixed",
      bottom: "16px",
      right: "16px",
      zIndex: "2147483646",
      fontFamily: '"Fira Mono", monospace',
      fontSize: "12px",
      background: "#12122a",
      color: "#e0e0e0",
      border: "1.5px solid #F97316",
      borderRadius: "8px",
      boxShadow: "0 4px 24px rgba(0,0,0,0.6)",
      width: "340px",
      overflow: "hidden",
    });

    const header = document.createElement("div");
    Object.assign(header.style, {
      padding: "8px 12px",
      background: "#F97316",
      color: "#fff",
      fontWeight: "bold",
      fontSize: "11px",
      letterSpacing: "0.3px",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    });
    const compLabel = ctx.componentHierarchy
      ? ` — ${ctx.componentHierarchy}`
      : "";
    header.innerHTML = `<span>FRONTLOOP — ${ctx.tagName}${compLabel}</span>`;

    const closeBtn = document.createElement("span");
    closeBtn.textContent = "✕";
    closeBtn.style.cursor = "pointer";
    closeBtn.onclick = () => this.deactivate();
    header.appendChild(closeBtn);
    panel.appendChild(header);

    const summary = document.createElement("div");
    Object.assign(summary.style, {
      padding: "8px 12px",
      borderBottom: "1px solid #1e1e3e",
      fontSize: "10px",
      color: "#888",
      wordBreak: "break-all",
    });
    summary.textContent = ctx.selector;
    panel.appendChild(summary);

    const input = document.createElement("textarea");
    Object.assign(input.style, {
      width: "calc(100% - 24px)",
      margin: "8px 12px",
      padding: "8px",
      background: "#1a1a3a",
      color: "#e0e0e0",
      border: "1px solid #2a2a4a",
      borderRadius: "4px",
      fontFamily: "inherit",
      fontSize: "12px",
      resize: "vertical",
      minHeight: "60px",
      outline: "none",
    });
    input.placeholder =
      'Describe what to fix... (e.g., "change button color to red")';
    panel.appendChild(input);

    const consoleErrorUI = buildConsoleErrorSection();
    panel.appendChild(consoleErrorUI.wrapper);
    (panel as any).__consoleErrorCleanup = consoleErrorUI.destroy;

    const row = document.createElement("div");
    Object.assign(row.style, {
      display: "flex",
      justifyContent: "flex-end",
      gap: "8px",
      padding: "0 12px 8px",
    });

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    Object.assign(cancelBtn.style, {
      padding: "6px 14px",
      border: "1px solid #2a2a4a",
      borderRadius: "4px",
      background: "#1a1a3a",
      color: "#888",
      cursor: "pointer",
      fontSize: "11px",
    });
    cancelBtn.onclick = () => this.deactivate();

    const submitBtn = document.createElement("button");
    submitBtn.textContent = "Send Fix Task";
    Object.assign(submitBtn.style, {
      padding: "6px 14px",
      border: "none",
      borderRadius: "4px",
      background: "#F97316",
      color: "#fff",
      cursor: "pointer",
      fontSize: "11px",
      fontWeight: "bold",
    });
    submitBtn.onclick = () => {
      const text = input.value.trim();
      if (!text) return;
      dispatchFixTask(ctx, text, consoleErrorUI.getMode());
      this.removePanel();
    };

    row.appendChild(cancelBtn);
    row.appendChild(submitBtn);
    panel.appendChild(row);

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        submitBtn.click();
      }
      if (e.key === "Escape") {
        this.deactivate();
      }
    });
    setTimeout(() => input.focus(), 100);

    document.body.appendChild(panel);
    this.panel = panel;
  }
}

// -------- speed dial FAB --------

interface SpeedDialElements {
  container: HTMLElement;
  mainFab: HTMLElement;
  inspectBtn: HTMLElement;
  sshotBtn: HTMLElement;
  undoBtn: HTMLElement;
}

function createSpeedDial(
  onInspect: () => void,
  onScreenshot: () => void,
  onUndo: () => void
): SpeedDialElements {
  const container = document.createElement("div");
  container.id = "__frontloop_speed_dial__";

  // Items wrapper — absolutely positioned to the left of the FAB
  const itemsWrapper = document.createElement("div");
  itemsWrapper.id = "__frontloop_dial_items__";

  // Undo item
  const undoItem = document.createElement("div");
  undoItem.className = "__frontloop_dial_item";
  const undoLabel = document.createElement("span");
  undoLabel.className = "__frontloop_dial_label";
  undoLabel.textContent = "Undo";
  const undoBtn = document.createElement("div");
  undoBtn.id = "__frontloop_undo_btn__";
  undoBtn.className = "__frontloop_dial_circle";
  undoBtn.style.background = "#3a3a5a";
  undoBtn.style.opacity = "0.4";
  undoBtn.style.cursor = "default";
  undoBtn.textContent = "↩";
  undoBtn.title = "Nothing to undo";
  undoBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    onUndo();
  });
  undoItem.appendChild(undoLabel);
  undoItem.appendChild(undoBtn);

  // Screenshot item
  const sshotItem = document.createElement("div");
  sshotItem.className = "__frontloop_dial_item";
  const sshotLabel = document.createElement("span");
  sshotLabel.className = "__frontloop_dial_label";
  sshotLabel.textContent = "Screenshot";
  const sshotBtn = document.createElement("div");
  sshotBtn.id = "__frontloop_screenshot__";
  sshotBtn.className = "__frontloop_dial_circle";
  sshotBtn.style.background = "#6366f1";
  sshotBtn.textContent = "[]";
  sshotBtn.title = "Screenshot region";
  sshotBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    onScreenshot();
  });
  sshotItem.appendChild(sshotLabel);
  sshotItem.appendChild(sshotBtn);

  itemsWrapper.appendChild(undoItem);
  itemsWrapper.appendChild(sshotItem);

  // Inspect label inside the dial row — no circle, the FAB itself is the button
  const inspectDialItem = document.createElement("div");
  inspectDialItem.className = "__frontloop_dial_item";
  const inspectFabLabel = document.createElement("span");
  inspectFabLabel.className = "__frontloop_dial_label";
  inspectFabLabel.textContent = "Inspect";
  inspectDialItem.appendChild(inspectFabLabel);
  itemsWrapper.appendChild(inspectDialItem);

  // Main FAB — transforms into Inspect button on hover, 36×36
  const mainFab = document.createElement("div");
  mainFab.id = "__frontloop_fab__";
  Object.assign(mainFab.style, {
    width: "36px",
    height: "36px",
    borderRadius: "50%",
    background: "#F97316",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    fontSize: "16px",
    fontWeight: "bold",
    fontFamily: '"Fira Mono", monospace',
    boxShadow: "0 2px 12px rgba(249,115,22,0.4)",
    userSelect: "none",
  });
  mainFab.textContent = "⋞";
  mainFab.title = "Live UI Inspector";

  container.appendChild(itemsWrapper);
  container.appendChild(mainFab);

  // Hover open/close with a small delay so the mouse can travel from FAB to items
  let closeTimer: ReturnType<typeof setTimeout> | null = null;
  function openDial() {
    if (closeTimer) {
      clearTimeout(closeTimer);
      closeTimer = null;
    }
    container.classList.add("open");
    mainFab.textContent = "✛";
    mainFab.title = "Inspect element";
  }
  function closeDial() {
    closeTimer = setTimeout(() => {
      container.classList.remove("open");
      mainFab.textContent = "⋞";
      mainFab.title = "Live UI Inspector";
      closeTimer = null;
    }, 120);
  }
  mainFab.addEventListener("mouseenter", openDial);
  mainFab.addEventListener("mouseleave", closeDial);
  itemsWrapper.addEventListener("mouseenter", openDial);
  itemsWrapper.addEventListener("mouseleave", closeDial);

  // Click the FAB itself activates inspect mode
  mainFab.addEventListener("click", (e) => {
    e.stopPropagation();
    onInspect();
  });

  return { container, mainFab, inspectBtn: mainFab, sshotBtn, undoBtn };
}

// -------- screenshot capture --------

function inlineStylesInTree(clone: HTMLElement, original: HTMLElement): void {
  copyComputedStyles(original, clone);
  const clones = clone.querySelectorAll("*");
  const originals = original.querySelectorAll("*");
  clones.forEach((c, i) => {
    const orig = originals[i] as HTMLElement | undefined;
    if (orig) copyComputedStyles(orig, c as HTMLElement);
  });
}

function copyComputedStyles(src: HTMLElement, dest: HTMLElement): void {
  const computed = window.getComputedStyle(src);
  for (let i = 0; i < computed.length; i++) {
    const prop = computed[i];
    dest.style.setProperty(
      prop,
      computed.getPropertyValue(prop),
      computed.getPropertyPriority(prop)
    );
  }
}

async function captureElementToDataUrl(
  el: HTMLElement,
  cropViewportRect?: {
    top: number;
    left: number;
    width: number;
    height: number;
  }
): Promise<string> {
  const elRect = el.getBoundingClientRect();
  const w = Math.ceil(elRect.width);
  const h = Math.ceil(elRect.height);
  if (w < 1 || h < 1) throw new Error("element has zero dimensions");

  const clone = el.cloneNode(true) as HTMLElement;
  clone.style.overflow = "visible";
  clone.style.maxHeight = "none";
  inlineStylesInTree(clone, el);

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", String(w));
  svg.setAttribute("height", String(h));
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);

  const wrapper = document.createElement("div");
  wrapper.style.cssText = `width:${w}px;height:${h}px;overflow:hidden;`;
  wrapper.appendChild(clone);

  const fo = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "foreignObject"
  );
  fo.setAttribute("width", "100%");
  fo.setAttribute("height", "100%");
  fo.appendChild(wrapper);
  svg.appendChild(fo);

  const svgStr = new XMLSerializer().serializeToString(svg);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d")!;

      if (cropViewportRect) {
        // Calculate crop region relative to the element
        const cropX = Math.max(0, cropViewportRect.left - elRect.left);
        const cropY = Math.max(0, cropViewportRect.top - elRect.top);
        const cropW = Math.min(cropViewportRect.width, elRect.width - cropX);
        const cropH = Math.min(cropViewportRect.height, elRect.height - cropY);

        canvas.width = Math.ceil(cropW);
        canvas.height = Math.ceil(cropH);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(
          img,
          cropX,
          cropY,
          cropW,
          cropH,
          0,
          0,
          canvas.width,
          canvas.height
        );
      } else {
        canvas.width = w;
        canvas.height = h;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0);
      }
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => {
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = "#000000";
      ctx.font = "12px monospace";
      ctx.fillText(
        el.tagName.toLowerCase() +
          " " +
          (el.textContent || "").trim().slice(0, 80),
        4,
        16
      );
      resolve(canvas.toDataURL("image/png"));
    };
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgStr);
  });
}

async function uploadScreenshot(
  taskId: string,
  dataUrl: string
): Promise<string | null> {
  try {
    const resp = await fetch("http://localhost:7333/screenshot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: taskId, data: dataUrl }),
    });
    if (resp.ok) {
      const result = await resp.json();
      return result.path || null;
    }
  } catch {}
  return null;
}

function showScreenshotPanel(
  ctx: ElementContext,
  dataUrl: string,
  onCancel: () => void,
  onSubmit: (prompt: string, consoleErrorMode?: "minimal" | "detailed" | null) => void
): void {
  const existing = document.getElementById("__frontloop_sspanel__");
  if (existing) {
    const cleanup = (existing as any).__consoleErrorCleanup;
    if (typeof cleanup === "function") cleanup();
    existing.remove();
  }

  const panel = document.createElement("div");
  panel.id = "__frontloop_sspanel__";
  Object.assign(panel.style, {
    position: "fixed",
    bottom: "16px",
    right: "16px",
    zIndex: "2147483646",
    fontFamily: '"Fira Mono", monospace',
    fontSize: "12px",
    background: "#12122a",
    color: "#e0e0e0",
    border: "1.5px solid #6366f1",
    borderRadius: "8px",
    boxShadow: "0 4px 24px rgba(0,0,0,0.6)",
    width: "360px",
    overflow: "hidden",
  });

  const header = document.createElement("div");
  Object.assign(header.style, {
    padding: "8px 12px",
    background: "#6366f1",
    color: "#fff",
    fontWeight: "bold",
    fontSize: "11px",
    letterSpacing: "0.3px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  });
  header.innerHTML = "<span>SCREENSHOT — " + ctx.tagName + "</span>";
  const closeBtn = document.createElement("span");
  closeBtn.textContent = "✕";
  closeBtn.style.cursor = "pointer";
  closeBtn.onclick = onCancel;
  header.appendChild(closeBtn);
  panel.appendChild(header);

  // Preview thumbnail
  const preview = document.createElement("img");
  Object.assign(preview.style, {
    display: "block",
    maxWidth: "calc(100% - 24px)",
    maxHeight: "200px",
    margin: "8px 12px",
    border: "1px solid #2a2a4a",
    borderRadius: "4px",
    objectFit: "contain",
    background: "#fff",
  });
  preview.src = dataUrl;
  panel.appendChild(preview);

  const selector = document.createElement("div");
  Object.assign(selector.style, {
    padding: "4px 12px",
    fontSize: "10px",
    color: "#888",
    wordBreak: "break-all",
  });
  selector.textContent = ctx.selector;
  panel.appendChild(selector);

  const textarea = document.createElement("textarea");
  Object.assign(textarea.style, {
    width: "calc(100% - 24px)",
    margin: "8px 12px",
    padding: "8px",
    background: "#1a1a3a",
    color: "#e0e0e0",
    border: "1px solid #2a2a4a",
    borderRadius: "4px",
    fontFamily: "inherit",
    fontSize: "12px",
    resize: "vertical",
    minHeight: "60px",
    outline: "none",
  });
  textarea.placeholder = "Describe what to fix...";
  panel.appendChild(textarea);

  const consoleErrorUI = buildConsoleErrorSection();
  panel.appendChild(consoleErrorUI.wrapper);
  (panel as any).__consoleErrorCleanup = consoleErrorUI.destroy;

  const row = document.createElement("div");
  Object.assign(row.style, {
    display: "flex",
    justifyContent: "flex-end",
    gap: "8px",
    padding: "0 12px 8px",
  });

  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = "Cancel";
  Object.assign(cancelBtn.style, {
    padding: "6px 14px",
    border: "1px solid #2a2a4a",
    borderRadius: "4px",
    background: "#1a1a3a",
    color: "#888",
    cursor: "pointer",
    fontSize: "11px",
  });
  cancelBtn.onclick = onCancel;

  const submitBtn = document.createElement("button");
  submitBtn.textContent = "Send Screenshot Task";
  Object.assign(submitBtn.style, {
    padding: "6px 14px",
    border: "none",
    borderRadius: "4px",
    background: "#6366f1",
    color: "#fff",
    cursor: "pointer",
    fontSize: "11px",
    fontWeight: "bold",
  });
  submitBtn.onclick = () => {
    const text = textarea.value.trim();
    if (!text) return;
    const mode = consoleErrorUI.getMode();
    onSubmit(text, mode);
  };

  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitBtn.click();
    }
    if (e.key === "Escape") onCancel();
  });

  row.appendChild(cancelBtn);
  row.appendChild(submitBtn);
  panel.appendChild(row);

  document.body.appendChild(panel);
  setTimeout(() => textarea.focus(), 100);
}

// -------- FAB idle state helpers --------

function setScreenshotBtnIdle(btn: HTMLElement): void {
  btn.style.background = "#6366f1";
  btn.classList.remove("__frontloop_fab_active");
  document.body.style.cursor = "";
}

function setScreenshotBtnActive(btn: HTMLElement): void {
  btn.style.background = "#059669";
  btn.classList.add("__frontloop_fab_active");
  document.body.style.cursor = "crosshair";
}

export function setupDomInspector(): DOMInspector | null {
  // Prevent double-init (mock-main.tsx and LiveUIProvider both call this)
  if (document.getElementById("__frontloop_speed_dial__")) return null;
  connectReloadListener();

  // -------- screenshot mode (drag-to-select) --------
  let sshotActive = false;
  let sshotDragOverlay: HTMLElement | null = null;
  let sshotDragStart: { x: number; y: number } | null = null;

  const { container, inspectBtn, sshotBtn, undoBtn } = createSpeedDial(
    () => {
      if (!inspector.isActive()) inspector.activate();
    },
    () => {
      if (sshotActive) return;
      if (inspector.isActive()) inspector.deactivate();
      sshotActive = true;
      container.style.display = "none";
      setScreenshotBtnActive(sshotBtn);
      document.body.style.cursor = "crosshair";
      document.addEventListener("mousedown", sshotOnMouseDown, true);
      document.addEventListener("mousemove", sshotOnMouseMove, true);
      document.addEventListener("mouseup", sshotOnMouseUp, true);
      document.addEventListener("keydown", sshotOnKey, true);
    },
    () => {
      if (undoStack.length > 0) dispatchUndoCommand();
    }
  );
  _undoBtn = undoBtn;
  updateUndoBtnState();
  document.body.appendChild(container);
  _speedDialContainer = container;

  let inspector: DOMInspector = new DOMInspector(
    () => {},
    inspectBtn,
    container
  );

  function removeDragOverlay(): void {
    if (sshotDragOverlay) {
      sshotDragOverlay.remove();
      sshotDragOverlay = null;
    }
  }

  function createDragOverlay(): HTMLElement {
    const div = document.createElement("div");
    div.id = "__frontloop_drag_overlay__";
    Object.assign(div.style, {
      position: "fixed",
      pointerEvents: "none",
      border: "2px dashed #6366f1",
      backgroundColor: "rgba(99,102,241,0.08)",
      zIndex: "2147483647",
      boxSizing: "border-box",
      display: "none",
    });
    document.body.appendChild(div);
    return div;
  }

  function updateDragOverlay(
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ): void {
    if (!sshotDragOverlay) return;
    const left = Math.min(x1, x2);
    const top = Math.min(y1, y2);
    const width = Math.abs(x2 - x1);
    const height = Math.abs(y2 - y1);
    Object.assign(sshotDragOverlay.style, {
      display: width > 2 || height > 2 ? "block" : "none",
      top: `${top + window.scrollY}px`,
      left: `${left + window.scrollX}px`,
      width: `${width}px`,
      height: `${height}px`,
    });
  }

  function findBestElementForRect(rect: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  }): HTMLElement | null {
    const cx = rect.left + (rect.right - rect.left) / 2;
    const cy = rect.top + (rect.bottom - rect.top) / 2;
    const el = document.elementFromPoint(cx, cy) as HTMLElement | null;
    if (!el) return null;

    // Walk up to find a container that fully encloses the selection rect
    let current: HTMLElement | null = el;
    for (let i = 0; i < 15 && current; i++) {
      const r = current.getBoundingClientRect();
      if (
        r.left <= rect.left &&
        r.top <= rect.top &&
        r.right >= rect.right &&
        r.bottom >= rect.bottom
      ) {
        return current;
      }
      current = current.parentElement;
    }
    return el;
  }

  function cleanupScreenshotMode(): void {
    sshotActive = false;
    sshotDragStart = null;
    setScreenshotBtnIdle(sshotBtn);
    if (Object.keys(overlays).length === 0) container.style.display = "";
    document.removeEventListener("mousedown", sshotOnMouseDown, true);
    document.removeEventListener("mousemove", sshotOnMouseMove, true);
    document.removeEventListener("mouseup", sshotOnMouseUp, true);
    document.removeEventListener("keydown", sshotOnKey, true);
    removeDragOverlay();
    const existingPanel = document.getElementById("__frontloop_sspanel__");
    if (existingPanel) {
      const cleanup = (existingPanel as any).__consoleErrorCleanup;
      if (typeof cleanup === "function") cleanup();
      existingPanel.remove();
    }
  }

  function sshotOnMouseDown(e: MouseEvent): void {
    const el = e.target as HTMLElement;
    if (
      el.closest("#__frontloop_speed_dial__") ||
      el.closest("#__frontloop_sspanel__") ||
      el.closest("#__frontloop_panel__")
    )
      return;
    e.preventDefault();
    sshotDragStart = { x: e.clientX, y: e.clientY };
    removeDragOverlay();
    sshotDragOverlay = createDragOverlay();
  }

  function sshotOnMouseMove(e: MouseEvent): void {
    if (!sshotDragStart || !sshotDragOverlay) return;
    e.preventDefault();
    updateDragOverlay(sshotDragStart.x, sshotDragStart.y, e.clientX, e.clientY);
  }

  function sshotOnMouseUp(e: MouseEvent): void {
    if (!sshotDragStart) return;
    e.preventDefault();
    e.stopPropagation();

    const x1 = sshotDragStart.x;
    const y1 = sshotDragStart.y;
    const x2 = e.clientX;
    const y2 = e.clientY;
    sshotDragStart = null;

    removeDragOverlay();
    cleanupScreenshotMode();

    if (Math.abs(x2 - x1) < 10 && Math.abs(y2 - y1) < 10) return;

    const selRect = {
      left: Math.min(x1, x2),
      top: Math.min(y1, y2),
      right: Math.max(x1, x2),
      bottom: Math.max(y1, y2),
    };

    const targetEl = findBestElementForRect(selRect);
    if (!targetEl) return;

    let ctx: ElementContext;
    try {
      const fakeEvent = { target: targetEl } as unknown as MouseEvent;
      ctx = captureContext(targetEl, fakeEvent);
    } catch {
      cleanupScreenshotMode();
      return;
    }
    ctx.boundingRect = {
      top: selRect.top,
      left: selRect.left,
      width: selRect.right - selRect.left,
      height: selRect.bottom - selRect.top,
    };

    const loadingOverlay = document.createElement("div");
    loadingOverlay.style.cssText = `position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:2147483647;background:#12122a;color:#e0e0e0;border:1.5px solid #6366f1;border-radius:8px;padding:16px 24px;font-family:"Fira Mono",monospace;font-size:12px;`;
    loadingOverlay.textContent = "Capturing screenshot...";
    document.body.appendChild(loadingOverlay);

    captureElementToDataUrl(targetEl, {
      left: selRect.left,
      top: selRect.top,
      width: selRect.right - selRect.left,
      height: selRect.bottom - selRect.top,
    })
      .then((dataUrl) => {
        loadingOverlay.remove();
        const sshotId = Math.random().toString(36).slice(2, 10);
        showScreenshotPanel(
          ctx,
          dataUrl,
          () => {
            cleanupScreenshotMode();
          },
          async (prompt, consoleErrorMode) => {
            loadingOverlay.textContent = "Uploading screenshot...";
            document.body.appendChild(loadingOverlay);
            const screenshotPath = await uploadScreenshot(sshotId, dataUrl);
            loadingOverlay.remove();

            const id = Math.random().toString(36).slice(2, 10);
            undoStack.push(id);
            saveUndoStack();
            updateUndoBtnState();
            showGeneratingOverlay(id, ctx.boundingRect);

            const payload: Record<string, any> = {
              id,
              type: "dom-fix",
              prompt,
              element: {
                selector: ctx.selector,
                tag: ctx.tagName,
                html: ctx.outerHTML,
                text: ctx.textContent,
                styles: ctx.computedStyles,
                componentHierarchy: ctx.componentHierarchy,
                columnIndex: ctx.columnIndex,
              },
              container: ctx.container,
              pageTitle: ctx.pageTitle,
              page: window.location.href,
            };
            if (screenshotPath) payload.screenshotPath = screenshotPath;
            if (consoleErrorMode) {
              const errors = getCapturedConsoleErrors(consoleErrorMode);
              if (errors.length > 0) {
                payload.consoleErrors = { mode: consoleErrorMode, errors };
              }
            }

            const ws = new WebSocket("ws://localhost:7332");
            ws.onopen = () => {
              ws.send(`TASK: ${JSON.stringify(payload)}`);
            };
            ws.onmessage = (event) => {
              if (event.data === `COMPLETE:${id}`) {
                removeGeneratingOverlay(id);
                const highlight = document.getElementById("__frontloop_highlight__");
                if (highlight) highlight.style.display = "none";
                const fab = document.getElementById("__frontloop_fab__");
                if (fab) {
                  fab.textContent = "⋞";
                  fab.title = "Live UI Inspector";
                }
                document.body.style.cursor = "";
                ws.close();
              }
            };
            ws.onerror = () => {
              removeGeneratingOverlay(id);
            };
            ws.onclose = () => {
              setTimeout(() => removeGeneratingOverlay(id), 120000);
            };

            cleanupScreenshotMode();
          }
        );
      })
      .catch(() => {
        loadingOverlay.remove();
        cleanupScreenshotMode();
      });
  }

  function sshotOnKey(e: KeyboardEvent): void {
    if (e.key === "Escape") cleanupScreenshotMode();
  }

  return inspector;
}
