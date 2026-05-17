# Provider wiring — framework templates

## Vite + React — primary

```tsx
// src/lib/LiveUIProvider.tsx
import React, { useEffect } from 'react';

// Eagerly import console error capture so the patch runs before React renders
import '../mocks/capture-console-errors';

export default function LiveUIProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    import('../mocks/dom-inspector').then(({ setupDomInspector }) => {
      setupDomInspector();
    });
  }, []);
  return <>{children}</>;
}
```

Wire in `App.tsx` wrapping `<Router>` children. Use `import.meta.env.DEV` — Vite replaces this at build time.

## Vite + Vue 3

```ts
// src/plugins/liveUI.ts
import '../mocks/capture-console-errors';

export default {
  install() {
    if (import.meta.env.DEV) {
      import('../mocks/dom-inspector').then(({ setupDomInspector }) => {
        setupDomInspector();
      });
    }
  },
};
// main.ts: app.use(liveUIPlugin)
```

## Vite + Svelte

```ts
// src/lib/liveUI.ts
import '../mocks/capture-console-errors';

if (import.meta.env.DEV) {
  import('../mocks/dom-inspector').then(({ setupDomInspector }) => {
    setupDomInspector();
  });
}
// +layout.svelte: import '$lib/liveUI';
```

## React (CRA / CRACO)

```tsx
// src/lib/LiveUIProvider.tsx
import React, { useEffect } from 'react';

// Eagerly import console error capture so the patch runs before React renders
import '../mocks/capture-console-errors';

export default function LiveUIProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    import('../mocks/dom-inspector').then(({ setupDomInspector }) => {
      setupDomInspector();
    });
  }, []);
  return <>{children}</>;
}
```

Wire in `App.tsx` wrapping `<Router>` children. Use relative `../` paths, not `@/` aliases.

## Next.js (App Router)

```tsx
// src/lib/LiveUIProvider.tsx
'use client';
import { useEffect } from 'react';

// Eagerly import console error capture so the patch runs before React renders
import '@/mocks/capture-console-errors';

export default function LiveUIProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    import('@/mocks/dom-inspector').then(({ setupDomInspector }) => {
      setupDomInspector();
    });
  }, []);
  return <>{children}</>;
}
```

Wire inside `<body>` in `layout.tsx`.

## Angular

```ts
// In root AppComponent ngOnInit or APP_INITIALIZER
if (!environment.production) {
  import('./mocks/capture-console-errors');
  import('./mocks/dom-inspector').then(({ setupDomInspector }) => setupDomInspector());
}
```

## Vanilla JS/TS

```ts
if (process.env.NODE_ENV === 'development') {
  import('./mocks/capture-console-errors');
  import('./mocks/dom-inspector').then(({ setupDomInspector }) => setupDomInspector());
}
```

## Rule: call from ONE place only

`setupDomInspector()` is idempotent (returns `null` on the second call) but double-calling from two entry points (e.g. entry script + framework provider) creates two FAB instances — one hides, the other stays visible. Guard at the call site.
