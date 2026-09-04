import BootstrapPagination from 'react-bootstrap/Pagination';
import BootstrapTable from 'react-bootstrap/Table';

/**
 * `<DataTable>` — "Columns, sorting, pagination, empty state, loading
 * skeleton, row actions" (doc07 §2). One column-definition array per
 * module, this component the same for all of them.
 */
export interface DataTableColumn<T> {
  key: string;
  label: string;
  render: (row: T) => React.ReactNode;
  /** Omit for a column with no meaningful server-side sort (e.g. a computed or joined value). */
  sortKey?: string;
}

export interface DataTableProps<T> {
  columns: Array<DataTableColumn<T>>;
  rows: T[];
  getRowKey: (row: T) => number | string;
  loading?: boolean;
  emptyMessage?: string;
  sort?: string | undefined;
  order?: 'asc' | 'desc' | undefined;
  onSortChange?: (sort: string, order: 'asc' | 'desc') => void;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  /** Rendered as a trailing, unlabelled column — Edit/Delete links or buttons, typically. */
  rowActions?: (row: T) => React.ReactNode;
}

const SKELETON_ROWS = 5;

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  loading = false,
  emptyMessage = 'Nothing here yet.',
  sort,
  order,
  onSortChange,
  page,
  pageSize,
  total,
  onPageChange,
  rowActions,
}: DataTableProps<T>): React.JSX.Element {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const columnCount = columns.length + (rowActions ? 1 : 0);

  function handleHeaderClick(column: DataTableColumn<T>): void {
    if (!column.sortKey || !onSortChange) return;
    const nextOrder: 'asc' | 'desc' = sort === column.sortKey && order === 'asc' ? 'desc' : 'asc';
    onSortChange(column.sortKey, nextOrder);
  }

  return (
    <div className="admin-data-table">
      <div className="admin-data-table__scroll">
        <BootstrapTable hover responsive className="admin-data-table__table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={column.sortKey ? 'admin-data-table__sortable' : undefined}
                  onClick={() => handleHeaderClick(column)}
                  aria-sort={
                    sort === column.sortKey
                      ? order === 'asc'
                        ? 'ascending'
                        : 'descending'
                      : undefined
                  }
                >
                  {column.label}
                  {column.sortKey && sort === column.sortKey && (
                    <span
                      className={`bi bi-caret-${order === 'asc' ? 'up' : 'down'}-fill admin-data-table__sort-icon`}
                      aria-hidden="true"
                    />
                  )}
                </th>
              ))}
              {rowActions && (
                <th scope="col" className="admin-data-table__actions-col">
                  <span className="visually-hidden">Actions</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {loading &&
              // Skeleton rows have no identity to key by — index is fine here.
              Array.from({ length: SKELETON_ROWS }, (_, index) => (
                <tr key={index} className="admin-data-table__skeleton-row" aria-hidden="true">
                  {Array.from({ length: columnCount }, (_, cellIndex) => (
                    <td key={cellIndex}>
                      <span className="admin-data-table__skeleton-cell" />
                    </td>
                  ))}
                </tr>
              ))}

            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={columnCount} className="admin-data-table__empty">
                  {emptyMessage}
                </td>
              </tr>
            )}

            {!loading &&
              rows.map((row) => (
                <tr key={getRowKey(row)}>
                  {columns.map((column) => (
                    <td key={column.key}>{column.render(row)}</td>
                  ))}
                  {rowActions && (
                    <td className="admin-data-table__actions-col">{rowActions(row)}</td>
                  )}
                </tr>
              ))}
          </tbody>
        </BootstrapTable>
      </div>

      {totalPages > 1 && (
        <BootstrapPagination className="admin-data-table__pagination">
          <BootstrapPagination.Prev
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label="Previous page"
          />
          <BootstrapPagination.Item disabled>
            Page {page} of {totalPages}
          </BootstrapPagination.Item>
          <BootstrapPagination.Next
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            aria-label="Next page"
          />
        </BootstrapPagination>
      )}
    </div>
  );
}
