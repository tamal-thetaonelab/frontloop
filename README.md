<div align="center">
  <img src="./frontloop-logo.png" alt="frontloop" height="64" />
</div>

---
<div align="center">
Frontloop is a Claude Code plugin marketplace for frontend development.<br/>
It ships skills that give your coding agent browser-native capabilities it does not have out of the box.
</div>

---

![demo](./fl-gif.gif)

---

## Install

Add the marketplace and install the plugin:

```
/plugin marketplace add tamal-thetaonelab/frontloop
/plugin install frontloop@frontloop
```

---

## Plugins

### `frontloop`

UI-focused skills for Claude Code. Currently ships one skill:

#### `/frontloop:live-ui-generation`

Turns your browser into a feedback surface for your coding agent.

Click any element on your running app. Describe the change. Claude Code receives
the full DOM context — selector, outer HTML, computed styles, card context, and
page URL — edits the source file, and hot reload delivers the result. An orange
shimmer appears on the selected element while the agent works and clears on
completion.

The intended setup is your browser and Claude Code terminal side by side. UI on
the left, agent output on the right. No terminal input required after the initial
command.

![side-by-side](./side-by-side.png)
![side-by-side](./demo.png)

What the agent receives per request:

```json
{
  "selector": "#employee-card > div.header",
  "outerHTML": "<div class=\"header\">...</div>",
  "computedStyles": { "background": "rgb(255,255,255)", "padding": "16px" },
  "cardContext": "Employee list row, inside a table layout",
  "pageURL": "http://localhost:4300/app/employee",
  "task": "make this card background light grey and increase padding to 24px"
}
```

Not a CSS override. An actual source edit with full codebase context.

---

## Update

To get the latest plugins after the marketplace has been updated:

```
/plugin marketplace update frontloop
/plugin update frontloop@frontloop
```

---

## Requirements

- Claude Code
- Node.js 18 or higher
- React (CRA) or Next.js project
- Dev server running before invoking the skill

---

## Roadmap

Each item ships as its own plugin — the marketplace stays modular, nothing is bundled unless you want it.

### `mock-setup` plugin *(in development)*

A complete mock backend layer using Mock Service Worker.

The agent reads your existing API calls, generates stateful MSW handlers that
mirror your real API responses, wires up working auth without touching your
production code, and verifies every route renders correctly with no unhandled
requests or console errors.

Run your frontend entirely offline. Demo it to clients without a real backend.
Develop new features before the API exists.

---

### Agent support beyond Claude Code

`live-ui-generation` currently works with Claude Code. The browser-to-agent
feedback loop is not Claude-specific — any coding agent that can read from a
WebSocket endpoint can consume the task payload.

Planned support: Cursor, GitHub Copilot Workspace, Gemini CLI, Windsurf.

The WebSocket server and DOM inspector are agent-agnostic by design. PRs for specific agents are welcome.

---

### UI platform support

Current framework support is React (CRA) and Next.js. Planned additions:

- Vue 3 (Vite and Nuxt)
- Svelte / SvelteKit
- Angular
- React Native web (Expo)

---

## What this is not

- Not active in production. Skills and servers are development-only.
- Not a cloud service. Everything runs on localhost.
- Not a no-code tool. The agent writes real source code against your real codebase.
- Not a CSS inspector. Changes persist in source files, not in browser overrides.

---

## Contributing

New plugins and skills welcome. Fixing bugs, improving docs, and expanding agent support are all great ways to contribute.

---

## License

MIT

---
Built with ❤️ by [Tamal Sen](https://github.com/tamal-thetaonelab).
