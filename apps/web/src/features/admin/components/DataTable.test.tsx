import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DataTable, type DataTableColumn } from './DataTable';

interface Row {
  id: number;
  name: string;
}

const columns: Array<DataTableColumn<Row>> = [
  { key: 'name', label: 'Name', render: (row) => row.name, sortKey: 'name' },
];

describe('DataTable', () => {
  it("renders rows via each column's render function", () => {
    render(
      <DataTable
        columns={columns}
        rows={[{ id: 1, name: 'Alpha' }]}
        getRowKey={(row) => row.id}
        page={1}
        pageSize={20}
        total={1}
        onPageChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Alpha')).toBeInTheDocument();
  });

  it('shows the empty message when there are no rows and not loading', () => {
    render(
      <DataTable
        columns={columns}
        rows={[]}
        getRowKey={(row) => row.id}
        page={1}
        pageSize={20}
        total={0}
        onPageChange={vi.fn()}
        emptyMessage="No projects yet"
      />,
    );
    expect(screen.getByText('No projects yet')).toBeInTheDocument();
  });

  it('shows skeleton rows, not the empty message, while loading', () => {
    render(
      <DataTable
        columns={columns}
        rows={[]}
        getRowKey={(row) => row.id}
        loading
        page={1}
        pageSize={20}
        total={0}
        onPageChange={vi.fn()}
        emptyMessage="No projects yet"
      />,
    );
    expect(screen.queryByText('No projects yet')).not.toBeInTheDocument();
    expect(document.querySelectorAll('.admin-data-table__skeleton-row')).toHaveLength(5);
  });

  it('clicking a sortable header toggles asc/desc and calls onSortChange', () => {
    const onSortChange = vi.fn();
    const { rerender } = render(
      <DataTable
        columns={columns}
        rows={[{ id: 1, name: 'Alpha' }]}
        getRowKey={(row) => row.id}
        page={1}
        pageSize={20}
        total={1}
        onPageChange={vi.fn()}
        onSortChange={onSortChange}
      />,
    );

    fireEvent.click(screen.getByText('Name'));
    expect(onSortChange).toHaveBeenCalledWith('name', 'asc');

    rerender(
      <DataTable
        columns={columns}
        rows={[{ id: 1, name: 'Alpha' }]}
        getRowKey={(row) => row.id}
        page={1}
        pageSize={20}
        total={1}
        onPageChange={vi.fn()}
        onSortChange={onSortChange}
        sort="name"
        order="asc"
      />,
    );
    fireEvent.click(screen.getByText('Name'));
    expect(onSortChange).toHaveBeenCalledWith('name', 'desc');
  });

  it('renders pagination only when there is more than one page, and calls onPageChange', () => {
    const onPageChange = vi.fn();
    const { rerender } = render(
      <DataTable
        columns={columns}
        rows={[{ id: 1, name: 'Alpha' }]}
        getRowKey={(row) => row.id}
        page={1}
        pageSize={20}
        total={1}
        onPageChange={onPageChange}
      />,
    );
    expect(screen.queryByLabelText('Next page')).not.toBeInTheDocument();

    rerender(
      <DataTable
        columns={columns}
        rows={[{ id: 1, name: 'Alpha' }]}
        getRowKey={(row) => row.id}
        page={1}
        pageSize={1}
        total={3}
        onPageChange={onPageChange}
      />,
    );
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Next page'));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('renders row actions in a trailing column when provided', () => {
    render(
      <DataTable
        columns={columns}
        rows={[{ id: 1, name: 'Alpha' }]}
        getRowKey={(row) => row.id}
        page={1}
        pageSize={20}
        total={1}
        onPageChange={vi.fn()}
        rowActions={(row) => <button type="button">Edit {row.name}</button>}
      />,
    );
    expect(screen.getByRole('button', { name: 'Edit Alpha' })).toBeInTheDocument();
  });
});
