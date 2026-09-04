import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ResourceToolbar } from './ResourceToolbar';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('ResourceToolbar', () => {
  it('debounces search input before calling onSearchChange', () => {
    const onSearchChange = vi.fn();
    render(<ResourceToolbar searchValue="" onSearchChange={onSearchChange} />);

    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'security' } });
    expect(onSearchChange).not.toHaveBeenCalled();

    vi.advanceTimersByTime(300);
    expect(onSearchChange).toHaveBeenCalledWith('security');
  });

  it('does not render a status filter unless onStatusChange is provided', () => {
    render(<ResourceToolbar searchValue="" onSearchChange={vi.fn()} />);
    expect(screen.queryByLabelText('Filter by status')).not.toBeInTheDocument();
  });

  it('status filter calls onStatusChange with undefined for "All statuses"', () => {
    const onStatusChange = vi.fn();
    render(
      <ResourceToolbar
        searchValue=""
        onSearchChange={vi.fn()}
        statusValue="DRAFT"
        onStatusChange={onStatusChange}
      />,
    );
    fireEvent.change(screen.getByLabelText('Filter by status'), { target: { value: '' } });
    expect(onStatusChange).toHaveBeenCalledWith(undefined);
  });

  it('renders a New link only when newHref is provided', () => {
    const { rerender } = render(<ResourceToolbar searchValue="" onSearchChange={vi.fn()} />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();

    rerender(
      <ResourceToolbar
        searchValue=""
        onSearchChange={vi.fn()}
        newHref="/admin/projects/new"
        newLabel="New Project"
      />,
    );
    const link = screen.getByRole('link', { name: /New Project/ });
    expect(link).toHaveAttribute('href', '/admin/projects/new');
  });
});
