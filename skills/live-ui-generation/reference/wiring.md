# Provider wiring — framework templates

## React (CRA / Vite / CRACO) — primary

```tsx
// src/lib/LiveUIProvider.tsx
import React, { useEffect } from 'react';

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

Wire in `App.tsx` wrapping `<Router>` children.

> **CRA/CRACO**: use `process.env.NODE_ENV`, not `import.meta.env.DEV`. Use relative `../` paths, not `@/` aliases.

## Next.js (App Router)

```tsx
// src/lib/LiveUIProvider.tsx
'use client';
import { useEffect } from 'react';

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

## Vue 3

```ts
// src/plugins/liveUI.ts
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

## Angular

```ts
// In root AppComponent ngOnInit or APP_INITIALIZER
if (!environment.production) {
  import('./mocks/dom-inspector').then(({ setupDomInspector }) => setupDomInspector());
}
```

## Vanilla JS/TS

```ts
if (process.env.NODE_ENV === 'development') {
  import('./mocks/dom-inspector').then(({ setupDomInspector }) => setupDomInspector());
}
```

## Rule: call from ONE place only

`setupDomInspector()` is idempotent (returns `null` on the second call) but double-calling from two entry points (e.g. entry script + framework provider) creates two FAB instances — one hides, the other stays visible. Guard at the call site.
