<div align="center">
  <img src="./frontloop-logo.png" alt="frontloop" height="64" />
</div>

---
<div align="center">
Frontloop is a Claude Code plugin marketplace for frontend development.<br/>
It ships skills that close the loop between your browser and your coding agent.
</div>

---

![demo](./fl-gif.gif)

---

## Install

### Claude Code
```
/plugin marketplace add tamal-thetaonelab/frontloop
/plugin install frontloop
```

---

## Skills

### `/live-ui-generation`

Click any element on your running app. Describe the change. Claude Code receives the full DOM context — selector, outer HTML, computed styles, container context, and page URL — edits the source file directly, and hot reload delivers the result.

An orange shimmer appears over the selected element while Claude works and clears on completion.

![side-by-side](./side-by-side.png)
![demo](./demo.png)

What Claude receives per task:

```json
{
  "id": "a3f9bc12",
  "type": "dom-fix",
  "prompt": "make this card background light grey and increase padding to 24px",
  "element": {
    "selector": "#employee-card > div.header",
    "tag": "div",
    "html": "<div class=\"header\">...</div>",
    "styles": { "background": "rgb(255,255,255)", "padding": "16px" }
  },
  "container": { "title": "Employee Card", "dataKeys": ["Name", "Role"] },
  "page": "http://localhost:4300/app/employee"
}
```

Not a CSS override. A real source edit with full codebase context.

**How it works:**

- A floating button (FAB) appears in your browser in dev mode
- Click it, select an element, type your fix — a shimmer appears
- A WebSocket server streams the task payload to Claude as a real-time notification
- Claude edits the source file, runs a type check, then sends a completion signal
- Shimmer clears, HMR delivers the change

**Framework support:** React (CRA), Next.js (App Router)

---

## Update

### Claude Code
```
/plugin marketplace update frontloop
```
( set auto-update to true for automatic updates )


---

## Requirements

- Claude Code
- Node.js 18 or higher
- React (CRA) or Next.js project
- Dev server running before invoking the skill

---

## Roadmap

Each item ships as its own plugin — nothing is bundled unless you want it.

### `mock-setup` *(in development)*

A complete mock backend layer using Mock Service Worker. The agent reads your existing API calls, generates stateful MSW handlers, wires up working auth without touching production code, and verifies every route renders correctly.

Run your frontend entirely offline. Demo without a real backend. Build features before the API exists.

---

### Agent support beyond Claude Code

`live-ui-generation` works with Claude Code today. The WebSocket server and DOM inspector are agent-agnostic — any coding agent that can read from a WebSocket endpoint can consume the task payload.

Planned: Cursor, GitHub Copilot Workspace, Gemini CLI, Windsurf.

---

### UI platform support

Planned additions: Vue 3 / Nuxt, Svelte / SvelteKit, Angular, React Native web (Expo).

---

## What this is not

- Not active in production — dev mode only
- Not a cloud service — everything runs on localhost
- Not a no-code tool — Claude writes real source code against your real codebase
- Not a CSS inspector — changes persist in source files, not browser overrides

---

## Contributing

New plugins and skills welcome. Fixing bugs, improving docs, and expanding agent or framework support are all great ways to contribute.

---

## License

MIT

---
Built with ❤️ by [Tamal Sen](https://github.com/tamal-thetaonelab).
