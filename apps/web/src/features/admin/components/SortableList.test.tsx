import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SortableList } from './SortableList';

interface Row {
  id: number;
  name: string;
}

const ROWS: Row[] = [
  { id: 1, name: 'First' },
  { id: 2, name: 'Second' },
  { id: 3, name: 'Third' },
];

describe('SortableList', () => {
  it('moving the middle item up calls onReorder with the full new sequential order', () => {
    const onReorder = vi.fn();
    render(<SortableList items={ROWS} renderItem={(item) => item.name} onReorder={onReorder} />);

    const upButtons = screen.getAllByRole('button', { name: 'Move up' });
    // Row order: First(0), Second(1), Third(2) — move Second up.
    upButtons[1]!.click();

    expect(onReorder).toHaveBeenCalledWith([
      { id: 2, displayOrder: 0 },
      { id: 1, displayOrder: 1 },
      { id: 3, displayOrder: 2 },
    ]);
  });

  it('moving the last item down does nothing (already at the boundary)', () => {
    const onReorder = vi.fn();
    render(<SortableList items={ROWS} renderItem={(item) => item.name} onReorder={onReorder} />);

    const downButtons = screen.getAllByRole('button', { name: 'Move down' });
    expect(downButtons[2]).toBeDisabled();
  });

  it('the first item cannot move up, the last cannot move down', () => {
    render(<SortableList items={ROWS} renderItem={(item) => item.name} onReorder={vi.fn()} />);
    expect(screen.getAllByRole('button', { name: 'Move up' })[0]).toBeDisabled();
    expect(screen.getAllByRole('button', { name: 'Move down' })[2]).toBeDisabled();
  });
});
