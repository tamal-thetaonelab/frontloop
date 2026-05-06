# DOM Inspector — Key Method Implementations

Reference implementations for the core methods added on top of the base template. Claude should read this file when creating or modifying `dom-inspector.ts`, not during initial setup.

## Table column highlighting

When the user hovers a table header (`<th>`), the entire column highlights instead of just the single cell. When they click, the container context is enriched with all cell values from that column.

### onHover — column detection

```typescript
private onHover = (e: MouseEvent): void => {
  const el = e.target as HTMLElement;
  if (el.closest('#__outpost_highlight__') || el.closest('#__outpost_panel__')) return;

  const th = el.closest('th');
  if (th) {
    this.highlightTableColumn(th as HTMLTableCellElement);
    return;
  }

  const rect = el.getBoundingClientRect();
  Object.assign(this.highlight.style, {
    display: 'block',
    top: `${rect.top + window.scrollY}px`,
    left: `${rect.left + window.scrollX}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
  });
};
```

### getColumnBoundingRect — column rect calculator

Shared by `highlightTableColumn` (visual highlight) and `onClick` (shimmer overlay positioning). Returns the combined bounding rect of all cells at the same `cellIndex` across every row.

```typescript
private getColumnBoundingRect(
  th: HTMLTableCellElement
): { top: number; left: number; width: number; height: number } | null {
  const table = th.closest('table');
  if (!table) return null;

  const index = th.cellIndex;
  const rows = Array.from(
    table.querySelectorAll(':scope > thead tr, :scope > tbody tr, :scope > tfoot tr')
  );
  if (rows.length === 0) return null;

  let top = Infinity, left = Infinity, right = -Infinity, bottom = -Infinity;
  let found = false;

  rows.forEach((row) => {
    const cells = row.querySelectorAll('th, td');
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
```

### highlightTableColumn — applies column highlight

Delegates the rect calculation to `getColumnBoundingRect`.

```typescript
private highlightTableColumn(th: HTMLTableCellElement): void {
  const colRect = this.getColumnBoundingRect(th);
  if (!colRect) return;

  Object.assign(this.highlight.style, {
    display: 'block',
    top: `${colRect.top + window.scrollY}px`,
    left: `${colRect.left + window.scrollX}px`,
    width: `${colRect.width}px`,
    height: `${colRect.height}px`,
  });
}
```

### enrichContainerWithColumn — column data in payload

Populates `ctx.container` so the TASK payload includes all cell values from the clicked column.

```typescript
private enrichContainerWithColumn(th: HTMLTableCellElement, ctx: ElementContext): void {
  const table = th.closest('table');
  if (!table) return;
  const index = th.cellIndex;
  const rows = Array.from(
    table.querySelectorAll(':scope > thead tr, :scope > tbody tr, :scope > tfoot tr')
  );
  if (rows.length === 0) return;

  const cellTexts: string[] = [];
  rows.forEach((row) => {
    const cells = row.querySelectorAll('th, td');
    const cell = cells[index] as HTMLElement | undefined;
    if (!cell) return;
    const text = cell.textContent?.trim() || '';
    if (text) cellTexts.push(text);
  });

  ctx.container.text = cellTexts.join(' | ');
  ctx.container.description = 'table column';
  ctx.container.dataKeys = cellTexts;
  ctx.container.title = ctx.textContent.slice(0, 100);
}
```

## Highlight persistence + column-aware click

When a `<th>` is clicked, `onClick` overrides `ctx.boundingRect` with the column rect so the shimmer overlay covers the full column, and enriches the container with column data.

```typescript
private onClick = (e: MouseEvent): void => {
  e.preventDefault();
  e.stopPropagation();
  const el = e.target as HTMLElement;
  if (el.closest('#__outpost_panel__')) return;

  const ctx = captureContext(el, e);

  this.active = false;
  this.fab.classList.remove('__outpost_fab_active');
  this.fab.style.display = 'none';
  document.body.style.cursor = '';
  document.removeEventListener('mouseover', this.onHover, true);
  document.removeEventListener('click', this.onClick, true);
  document.removeEventListener('keydown', this.onKey, true);

  const clickedTh = el.closest('th') as HTMLTableCellElement | null;
  if (clickedTh) {
    this.highlightTableColumn(clickedTh);
    this.enrichContainerWithColumn(clickedTh, ctx);
    const colRect = this.getColumnBoundingRect(clickedTh);
    if (colRect) ctx.boundingRect = colRect;  // shimmer covers the full column
  } else {
    Object.assign(this.highlight.style, {
      display: 'block',
      top: `${ctx.boundingRect.top + window.scrollY}px`,
      left: `${ctx.boundingRect.left + window.scrollX}px`,
      width: `${ctx.boundingRect.width}px`,
      height: `${ctx.boundingRect.height}px`,
    });
  }

  this.showPromptPanel(ctx);
};
```

## FAB active state CSS

Injected into the `__outpost_styles__` `<style>` element at module load time.

```css
@keyframes __outpost_pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(5,150,105,0.5); }
  50% { box-shadow: 0 0 0 8px rgba(5,150,105,0); }
}
.__outpost_fab_active {
  background: #059669 !important;
  box-shadow: 0 2px 12px rgba(5,150,105,0.4) !important;
  animation: __outpost_pulse 1.5s ease-in-out infinite !important;
}
```

## FAB state transitions

- **Idle** — no class, orange (#F97316) background
- **Active selection** — `activate()` adds `__outpost_fab_active` class (emerald green + pulse)
- **Panel open** — `onClick` removes the class and hides the FAB; `deactivate()` restores it
