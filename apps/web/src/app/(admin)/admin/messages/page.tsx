'use client';

import type { ContactMessageAdminRow, MessageStatus } from '@portfolio/shared';
import { useEffect, useState } from 'react';
import Badge from 'react-bootstrap/Badge';
import BootstrapPagination from 'react-bootstrap/Pagination';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Spinner from 'react-bootstrap/Spinner';
import { ApiError } from '@/lib/api/ApiError';
import { ConfirmDialog } from '@/features/admin/components/ConfirmDialog';
import { useToast } from '@/features/admin/components/ToastProvider';
import {
  useMessagesList,
  useRemoveMessage,
  useUpdateMessageStatus,
} from '@/features/admin/messages/client';

/**
 * `/admin/messages` (doc03 §5, doc07 §3: "Inbox: unread/read/archived,
 * detail pane, mark read/unread, archive, delete, mailto: reply only — no
 * in-app reply-sending in v1"). Bespoke like the Media Library page, not
 * `<AdminResourceListPage>`: there is no create and no per-row edit route,
 * and doc03 defines no single-message GET — the "detail pane" is a second
 * view of the SAME row the list already fetched, not a page navigation.
 */

const PAGE_SIZE = 20;

const STATUS_LABELS: Record<MessageStatus, string> = {
  UNREAD: 'Unread',
  READ: 'Read',
  ARCHIVED: 'Archived',
};

const STATUS_VARIANTS: Record<MessageStatus, string> = {
  UNREAD: 'warning',
  READ: 'secondary',
  ARCHIVED: 'dark',
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

interface DetailPaneProps {
  message: ContactMessageAdminRow;
  onStatusChanged: (updated: ContactMessageAdminRow) => void;
  onDeleted: () => void;
  onClose: () => void;
}

function DetailPane({
  message,
  onStatusChanged,
  onDeleted,
  onClose,
}: DetailPaneProps): React.JSX.Element {
  const { show } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const updateStatus = useUpdateMessageStatus();
  const removeMessage = useRemoveMessage();

  // Auto-mark UNREAD -> READ the moment its detail is opened (doc07 §3),
  // once per message — keyed on `message.id` alone so a later status change
  // that flows back through `onStatusChanged` (same id, new status) never
  // re-fires this. `updateStatus.mutate` itself is deliberately not a
  // dependency: this project has no react-hooks lint plugin enforcing an
  // exhaustive list (see ResourceToolbar.tsx's own comment), and including
  // it here would only reintroduce the very re-fire this guards against.
  useEffect(() => {
    if (message.status === 'UNREAD') {
      updateStatus.mutate(
        { id: message.id, status: 'READ' },
        { onSuccess: (updated) => onStatusChanged(updated) },
      );
    }
  }, [message.id]);

  function setStatus(status: MessageStatus): void {
    updateStatus.mutate(
      { id: message.id, status },
      {
        onSuccess: (updated) => onStatusChanged(updated),
        onError: (error) =>
          show({
            message: error instanceof ApiError ? error.message : "Couldn't update the message.",
            variant: 'danger',
          }),
      },
    );
  }

  function confirmDelete(): void {
    removeMessage.mutate(message.id, {
      onSuccess: () => {
        show({ message: 'Message deleted.', variant: 'success' });
        setConfirmOpen(false);
        onDeleted();
      },
      onError: (error) => {
        show({
          message: error instanceof ApiError ? error.message : "Couldn't delete the message.",
          variant: 'danger',
          autohideMs: null,
        });
        setConfirmOpen(false);
      },
    });
  }

  const status = message.status as MessageStatus;
  const mailtoHref = `mailto:${message.email}?subject=${encodeURIComponent(
    message.subject ? `Re: ${message.subject}` : 'Re: your message',
  )}`;

  return (
    <div className="admin-messages-inbox__detail">
      <div className="admin-messages-inbox__detail-header">
        <div className="admin-messages-inbox__detail-heading">
          <h2 className="h5 mb-1">{message.subject ?? '(No subject)'}</h2>
          <p className="mb-0 small text-body-secondary">
            {message.name} &lt;{message.email}&gt; · {formatDate(message.createdAt)}
          </p>
        </div>
        <Button
          type="button"
          variant="link"
          className="admin-messages-inbox__detail-close d-lg-none"
          onClick={onClose}
          aria-label="Back to list"
        >
          <span className="bi bi-arrow-left" aria-hidden="true" />
        </Button>
      </div>

      <p className="admin-messages-inbox__detail-body">{message.message}</p>

      <div className="admin-messages-inbox__detail-actions">
        <a href={mailtoHref} className="btn btn-primary btn-sm">
          <span className="bi bi-reply" aria-hidden="true" /> Reply by email
        </a>
        {status === 'UNREAD' && (
          <Button
            type="button"
            variant="outline-secondary"
            size="sm"
            onClick={() => setStatus('READ')}
            disabled={updateStatus.isPending}
          >
            Mark read
          </Button>
        )}
        {status === 'READ' && (
          <Button
            type="button"
            variant="outline-secondary"
            size="sm"
            onClick={() => setStatus('UNREAD')}
            disabled={updateStatus.isPending}
          >
            Mark unread
          </Button>
        )}
        {status !== 'ARCHIVED' && (
          <Button
            type="button"
            variant="outline-secondary"
            size="sm"
            onClick={() => setStatus('ARCHIVED')}
            disabled={updateStatus.isPending}
          >
            Archive
          </Button>
        )}
        <Button
          type="button"
          variant="outline-danger"
          size="sm"
          className="ms-auto"
          onClick={() => setConfirmOpen(true)}
        >
          Delete
        </Button>
      </div>

      <ConfirmDialog
        show={confirmOpen}
        title="Delete this message?"
        message="This cannot be undone."
        requireTypedConfirmation={message.email}
        confirming={removeMessage.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}

export default function MessagesInboxPage(): React.JSX.Element {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<MessageStatus | ''>('');
  const [page, setPage] = useState(1);
  // The full row, not just an id: doc03's list is filtered by status, so a
  // status change made from the detail pane (e.g. marking read while the
  // "Unread" filter is active) can make the row drop out of the very list
  // it came from on the next refetch. Keeping the object itself here — kept
  // current via `onStatusChanged` below — means the open pane stays exactly
  // as the visitor left it instead of snapping shut mid-read.
  const [selected, setSelected] = useState<ContactMessageAdminRow | null>(null);

  const listQuery = useMessagesList({
    page,
    pageSize: PAGE_SIZE,
    q: search || undefined,
    status: statusFilter || undefined,
  });

  const items = listQuery.data?.items ?? [];
  const meta = listQuery.data?.meta;
  const totalPages = meta?.totalPages ?? 1;

  return (
    <div className="admin-messages-inbox">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h3 mb-0">Messages</h1>
      </div>

      <div className="admin-messages-inbox__filters mb-3">
        <Form.Control
          type="search"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="Search messages…"
          aria-label="Search messages"
          className="admin-messages-inbox__search"
        />
        <Form.Select
          value={statusFilter}
          onChange={(event) => {
            setStatusFilter(event.target.value as MessageStatus | '');
            setPage(1);
          }}
          aria-label="Filter by status"
          className="admin-messages-inbox__status-filter"
        >
          <option value="">All</option>
          <option value="UNREAD">Unread</option>
          <option value="READ">Read</option>
          <option value="ARCHIVED">Archived</option>
        </Form.Select>
      </div>

      <div
        className={`admin-messages-inbox__layout${
          selected ? ' admin-messages-inbox__layout--detail-open' : ''
        }`}
      >
        <div className="admin-messages-inbox__list">
          {listQuery.isLoading ? (
            <div className="text-center py-5">
              <Spinner animation="border" />
            </div>
          ) : items.length === 0 ? (
            <p className="text-body-secondary text-center py-4">No messages found.</p>
          ) : (
            <ul className="admin-messages-inbox__rows">
              {items.map((item) => {
                const itemStatus = item.status as MessageStatus;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={`admin-messages-inbox__row${
                        itemStatus === 'UNREAD' ? ' admin-messages-inbox__row--unread' : ''
                      }${item.id === selected?.id ? ' admin-messages-inbox__row--active' : ''}`}
                      onClick={() => setSelected(item)}
                    >
                      <span className="admin-messages-inbox__row-top">
                        <span className="admin-messages-inbox__row-name">{item.name}</span>
                        <Badge bg={STATUS_VARIANTS[itemStatus]}>{STATUS_LABELS[itemStatus]}</Badge>
                      </span>
                      <span className="admin-messages-inbox__row-subject">
                        {item.subject ?? '(No subject)'}
                      </span>
                      <span className="admin-messages-inbox__row-date">
                        {formatDate(item.createdAt)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {totalPages > 1 && (
            <BootstrapPagination className="admin-data-table__pagination">
              <BootstrapPagination.Prev
                disabled={page <= 1}
                onClick={() => setPage((current) => current - 1)}
                aria-label="Previous page"
              />
              <BootstrapPagination.Item disabled>
                Page {page} of {totalPages}
              </BootstrapPagination.Item>
              <BootstrapPagination.Next
                disabled={page >= totalPages}
                onClick={() => setPage((current) => current + 1)}
                aria-label="Next page"
              />
            </BootstrapPagination>
          )}
        </div>

        {selected ? (
          <DetailPane
            key={selected.id}
            message={selected}
            onStatusChanged={setSelected}
            onDeleted={() => setSelected(null)}
            onClose={() => setSelected(null)}
          />
        ) : (
          <div className="admin-messages-inbox__detail admin-messages-inbox__detail--empty">
            <p className="text-body-secondary mb-0">Select a message to read it.</p>
          </div>
        )}
      </div>
    </div>
  );
}
