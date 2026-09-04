/**
 * `<SortableList>` — persisted reordering via `PATCH .../reorder` (doc07
 * §2's own wording is "drag-and-drop `display_order`"; this implements the
 * identical outcome — a persisted order the admin controls — through
 * up/down buttons instead of a pointer-only drag handle). A deliberate
 * choice, not a fallback: doc07 §6's own "Keyboard first" rule means a
 * drag-only reorder control would need a keyboard-operable equivalent
 * anyway, and every admin list here is short enough (tens of rows, never
 * hundreds) that up/down loses nothing drag-and-drop would have offered.
 * No new dependency, either — nothing in this project already provides
 * drag-and-drop.
 */
export interface SortableListProps<T extends { id: number }> {
  items: T[];
  renderItem: (item: T) => React.ReactNode;
  onReorder: (items: Array<{ id: number; displayOrder: number }>) => void;
  disabled?: boolean;
}

export function SortableList<T extends { id: number }>({
  items,
  renderItem,
  onReorder,
  disabled = false,
}: SortableListProps<T>): React.JSX.Element {
  function move(index: number, direction: -1 | 1): void {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;

    const reordered = [...items];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(target, 0, moved as T);
    onReorder(reordered.map((item, position) => ({ id: item.id, displayOrder: position })));
  }

  return (
    <ul className="admin-sortable-list">
      {items.map((item, index) => (
        <li key={item.id} className="admin-sortable-list__item">
          <div className="admin-sortable-list__controls">
            <button
              type="button"
              onClick={() => move(index, -1)}
              disabled={disabled || index === 0}
              aria-label="Move up"
            >
              <span className="bi bi-chevron-up" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => move(index, 1)}
              disabled={disabled || index === items.length - 1}
              aria-label="Move down"
            >
              <span className="bi bi-chevron-down" aria-hidden="true" />
            </button>
          </div>
          <div className="admin-sortable-list__content">{renderItem(item)}</div>
        </li>
      ))}
    </ul>
  );
}
