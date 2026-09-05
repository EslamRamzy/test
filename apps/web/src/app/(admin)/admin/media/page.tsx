'use client';

import type { AdminMediaFullRow, MediaKind } from '@portfolio/shared';
import { MEDIA_KINDS } from '@portfolio/shared';
import { useRef, useState } from 'react';
import BootstrapPagination from 'react-bootstrap/Pagination';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Spinner from 'react-bootstrap/Spinner';
import { ApiError } from '@/lib/api/ApiError';
import { ConfirmDialog } from '@/features/admin/components/ConfirmDialog';
import { useToast } from '@/features/admin/components/ToastProvider';
import { getApiBaseUrl } from '@/lib/config';
import {
  useMediaItem,
  useMediaList,
  useRemoveMedia,
  useUpdateMediaAltText,
  useUploadMedia,
} from '@/features/admin/media/client';

/**
 * `/admin/media` (doc07 §3: "Grid, upload (drag-drop), filter by kind,
 * alt-text editing, usage list, delete blocked while referenced"). The one
 * module not built on `<AdminResourceListPage>` — every other resource is a
 * row of named fields edited on its own `/[id]` page; media has no such
 * fields beyond alt text, and its "create" is a file upload with no form
 * to route to, so the whole module lives on this one page instead.
 */

const PAGE_SIZE = 12;
const KIND_LABELS: Record<MediaKind, string> = {
  AVATAR: 'Avatar',
  PROJECT_COVER: 'Project cover',
  SCREENSHOT: 'Screenshot',
  CERTIFICATE: 'Certificate',
  ARTICLE_COVER: 'Article cover',
  RESEARCH_COVER: 'Research cover',
  RESUME: 'Résumé',
  OTHER: 'Other',
};

function mediaUrl(filename: string): string {
  return `${getApiBaseUrl()}/uploads/${filename}`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${String(bytes)} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function UsagePanel({ mediaId }: { mediaId: number }): React.JSX.Element {
  const { data, isLoading } = useMediaItem(mediaId);
  if (isLoading) return <Spinner animation="border" size="sm" />;
  const usage = data?.usage ?? [];
  if (usage.length === 0) {
    return <p className="small text-body-secondary mb-0">Not used anywhere.</p>;
  }
  return (
    <ul className="admin-media-library__usage-list mb-0">
      {usage.map((ref, index) => (
        <li key={`${ref.entityType}-${String(ref.entityId)}-${String(index)}`}>
          {ref.label} <span className="text-body-secondary">({ref.entityType})</span>
        </li>
      ))}
    </ul>
  );
}

function MediaCard({ item }: { item: AdminMediaFullRow }): React.JSX.Element {
  const { show } = useToast();
  const [altTextDraft, setAltTextDraft] = useState(item.altText ?? '');
  const [usageOpen, setUsageOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const updateAltText = useUpdateMediaAltText();
  const removeMedia = useRemoveMedia();

  function saveAltText(): void {
    const trimmed = altTextDraft.trim();
    updateAltText.mutate(
      { id: item.id, altText: trimmed.length > 0 ? trimmed : null },
      {
        onSuccess: () => show({ message: 'Alt text saved.', variant: 'success' }),
        onError: (error) =>
          show({
            message: error instanceof ApiError ? error.message : "Couldn't save alt text.",
            variant: 'danger',
          }),
      },
    );
  }

  function confirmDelete(): void {
    removeMedia.mutate(item.id, {
      onSuccess: () => {
        show({ message: `${item.originalName} deleted.`, variant: 'success' });
        setConfirmOpen(false);
      },
      onError: (error) => {
        show({
          message:
            error instanceof ApiError ? error.message : `Couldn't delete ${item.originalName}.`,
          variant: 'danger',
          autohideMs: null,
        });
        setConfirmOpen(false);
      },
    });
  }

  return (
    <div className="admin-media-library__card">
      {item.mimeType === 'application/pdf' ? (
        <div className="admin-media-library__card-thumb admin-media-library__card-thumb--file">
          <span className="bi bi-file-earmark-pdf" aria-hidden="true" />
        </div>
      ) : (
        <img
          src={mediaUrl(item.filename)}
          alt=""
          className="admin-media-library__card-thumb"
          loading="lazy"
        />
      )}
      <div className="admin-media-library__card-body">
        <p className="admin-media-library__card-name" title={item.originalName}>
          {item.originalName}
        </p>
        <p className="small text-body-secondary mb-2">
          {KIND_LABELS[item.kind as MediaKind] ?? item.kind} · {formatBytes(item.sizeBytes)}
          {item.width && item.height ? ` · ${String(item.width)}×${String(item.height)}` : ''}
        </p>

        <Form.Group className="mb-2" controlId={`media-alt-${String(item.id)}`}>
          <Form.Label className="small">Alt text</Form.Label>
          <div className="d-flex gap-1">
            <Form.Control
              size="sm"
              type="text"
              value={altTextDraft}
              onChange={(event) => setAltTextDraft(event.target.value)}
            />
            <Button
              type="button"
              size="sm"
              variant="outline-secondary"
              onClick={saveAltText}
              disabled={updateAltText.isPending || altTextDraft === (item.altText ?? '')}
            >
              Save
            </Button>
          </div>
        </Form.Group>

        <div className="d-flex justify-content-between align-items-center">
          <Button
            type="button"
            size="sm"
            variant="link"
            className="p-0"
            onClick={() => setUsageOpen((current) => !current)}
            aria-expanded={usageOpen}
          >
            {usageOpen ? 'Hide usage' : 'View usage'}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline-danger"
            onClick={() => setConfirmOpen(true)}
          >
            Delete
          </Button>
        </div>

        {usageOpen && (
          <div className="admin-media-library__usage mt-2">
            <UsagePanel mediaId={item.id} />
          </div>
        )}
      </div>

      <ConfirmDialog
        show={confirmOpen}
        title={`Delete ${item.originalName}?`}
        message="This cannot be undone. Deletion is blocked while this file is still referenced anywhere."
        requireTypedConfirmation={item.originalName}
        confirming={removeMedia.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}

export default function MediaLibraryPage(): React.JSX.Element {
  const { show } = useToast();
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<MediaKind | ''>('');
  const [page, setPage] = useState(1);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const listQuery = useMediaList({
    page,
    pageSize: PAGE_SIZE,
    q: search || undefined,
    kind: kindFilter || undefined,
  });
  const uploadMedia = useUploadMedia();

  function uploadFile(file: File | undefined): void {
    if (!file) return;
    uploadMedia.mutate(
      { file, kind: 'OTHER' },
      {
        onSuccess: () => show({ message: `${file.name} uploaded.`, variant: 'success' }),
        onError: (error) =>
          show({
            message: error instanceof ApiError ? error.message : `Couldn't upload ${file.name}.`,
            variant: 'danger',
            autohideMs: null,
          }),
      },
    );
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    setDragActive(false);
    uploadFile(event.dataTransfer.files[0]);
  }

  const items = listQuery.data?.items ?? [];
  const meta = listQuery.data?.meta;
  const totalPages = meta?.totalPages ?? 1;

  return (
    <div className="admin-media-library">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="h3 mb-0">Media</h1>
      </div>

      <div
        className={`admin-media-picker__dropzone mb-4${dragActive ? ' admin-media-picker__dropzone--active' : ''}`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
      >
        <span className="bi bi-cloud-upload" aria-hidden="true" />
        <p className="mb-2">Drag a file here, or</p>
        <Button
          type="button"
          variant="outline-primary"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadMedia.isPending}
        >
          {uploadMedia.isPending ? 'Uploading…' : 'Browse files'}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          className="visually-hidden"
          accept="image/jpeg,image/png,image/webp,image/avif,application/pdf"
          aria-label="Upload a file"
          onChange={(event) => uploadFile(event.target.files?.[0])}
        />
        <p className="small text-body-secondary mb-0 mt-2">
          Uploaded here as kind &ldquo;Other&rdquo; — edit its alt text below, or pick it by kind
          from any project/article/profile field&rsquo;s own media picker.
        </p>
      </div>

      <div className="admin-media-library__filters mb-4">
        <Form.Control
          type="search"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(1);
          }}
          placeholder="Search media…"
          aria-label="Search media"
          className="admin-media-picker__search"
        />
        <Form.Select
          value={kindFilter}
          onChange={(event) => {
            setKindFilter(event.target.value as MediaKind | '');
            setPage(1);
          }}
          aria-label="Filter by kind"
          className="admin-media-picker__kind-filter"
        >
          <option value="">All kinds</option>
          {MEDIA_KINDS.map((kind) => (
            <option key={kind} value={kind}>
              {KIND_LABELS[kind]}
            </option>
          ))}
        </Form.Select>
      </div>

      {listQuery.isLoading ? (
        <div className="text-center py-5">
          <Spinner animation="border" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-body-secondary">No media found.</p>
      ) : (
        <div className="admin-media-library__grid">
          {items.map((item) => (
            <MediaCard key={item.id} item={item} />
          ))}
        </div>
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
  );
}
