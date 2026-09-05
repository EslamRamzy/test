'use client';

import type { AdminMediaFullRow, MediaKind } from '@portfolio/shared';
import { MEDIA_KINDS } from '@portfolio/shared';
import { useEffect, useRef, useState } from 'react';
import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Modal from 'react-bootstrap/Modal';
import Spinner from 'react-bootstrap/Spinner';
import { getApiBaseUrl } from '@/lib/config';
import { useMediaItem, useMediaList, useUploadMedia } from '../media/client';
import { useToast } from './ToastProvider';

/**
 * `<MediaPicker>` — "Modal browser over the media library + inline upload +
 * alt-text prompt" (doc07 §2). The one place every `coverMediaId` /
 * `certificateMediaId` / `avatarMediaId` / `resumeMediaId` / gallery-image
 * `mediaId` field in this codebase gets its UI from — Phase 8 shipped all
 * of these as a plain numeric-id text input (documented there as a known
 * gap, since the media library didn't exist yet); this component and the
 * retrofit that follows are what close it.
 */
export interface MediaPickerProps {
  /** The currently-selected media id, or `null`/`undefined` for "none chosen". */
  value: number | null | undefined;
  onChange: (mediaId: number | null) => void;
  /** Both the kind a NEW upload through this picker is classified as, and the library filter it opens pre-set to (still changeable inside the modal — e.g. reusing an existing screenshot as a cover). */
  kind: MediaKind;
  /** Accessible name for the trigger and modal title, e.g. "cover image". */
  label: string;
  disabled?: boolean;
}

function mediaUrl(filename: string): string {
  return `${getApiBaseUrl()}/uploads/${filename}`;
}

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

export function MediaPicker({
  value,
  onChange,
  kind,
  label,
  disabled = false,
}: MediaPickerProps): React.JSX.Element {
  const { show: showToast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<MediaKind | ''>(kind);
  const [page, setPage] = useState(1);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingAltText, setPendingAltText] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const selectedItem = useMediaItem(value ?? undefined);
  const listQuery = useMediaList({
    page,
    pageSize: PAGE_SIZE,
    q: debouncedSearch || undefined,
    kind: kindFilter || undefined,
  });
  const uploadMutation = useUploadMedia();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, kindFilter]);

  // The local preview needs an object URL for whatever file is currently
  // pending — created fresh per file and revoked on cleanup/replacement so
  // this never leaks memory across repeated open/select/cancel cycles.
  useEffect(() => {
    if (!pendingFile) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(pendingFile);
    objectUrlRef.current = url;
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
      objectUrlRef.current = null;
    };
  }, [pendingFile]);

  function openModal(): void {
    setSearch('');
    setDebouncedSearch('');
    setKindFilter(kind);
    setPage(1);
    setPendingFile(null);
    setPendingAltText('');
    setModalOpen(true);
  }

  function closeModal(): void {
    setModalOpen(false);
    setPendingFile(null);
  }

  function selectExisting(media: AdminMediaFullRow): void {
    onChange(media.id);
    closeModal();
  }

  function handleFileChosen(file: File | undefined): void {
    if (!file) return;
    setPendingFile(file);
    setPendingAltText('');
  }

  async function confirmUpload(): Promise<void> {
    if (!pendingFile) return;
    try {
      const uploaded = await uploadMutation.mutateAsync({
        file: pendingFile,
        kind,
        altText: pendingAltText.trim() || undefined,
      });
      onChange(uploaded.id);
      closeModal();
    } catch (error) {
      showToast({
        message: error instanceof Error ? error.message : 'Could not upload the file',
        variant: 'danger',
      });
    }
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files[0];
    handleFileChosen(file);
  }

  const items = listQuery.data?.items ?? [];
  const meta = listQuery.data?.meta;
  const selected = selectedItem.data?.media;

  return (
    <div className="admin-media-picker">
      <div className="admin-media-picker__trigger">
        {selected ? (
          <img
            src={mediaUrl(selected.filename)}
            alt=""
            className="admin-media-picker__thumb"
            width={72}
            height={72}
          />
        ) : (
          <div className="admin-media-picker__placeholder" aria-hidden="true">
            <span className="bi bi-image" />
          </div>
        )}
        <div className="admin-media-picker__trigger-actions">
          <Button
            type="button"
            variant="outline-secondary"
            size="sm"
            onClick={openModal}
            disabled={disabled}
          >
            {selected ? 'Change' : 'Choose'} {label}
          </Button>
          {selected && (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="text-danger"
              onClick={() => onChange(null)}
              disabled={disabled}
            >
              Remove
            </Button>
          )}
        </div>
      </div>

      <Modal show={modalOpen} onHide={closeModal} size="lg" centered>
        <Modal.Header closeButton>
          <Modal.Title>Choose {label}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {pendingFile ? (
            <div className="admin-media-picker__pending">
              {previewUrl && pendingFile.type.startsWith('image/') ? (
                <img src={previewUrl} alt="" className="admin-media-picker__pending-preview" />
              ) : (
                <div className="admin-media-picker__pending-preview admin-media-picker__pending-preview--file">
                  <span className="bi bi-file-earmark" aria-hidden="true" />
                  {pendingFile.name}
                </div>
              )}
              <Form.Group className="mb-3" controlId="media-picker-alt-text">
                <Form.Label>Alt text</Form.Label>
                <Form.Control
                  type="text"
                  value={pendingAltText}
                  onChange={(event) => setPendingAltText(event.target.value)}
                  placeholder="Describe this image for screen readers"
                  autoFocus
                />
              </Form.Group>
              <div className="d-flex gap-2">
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => void confirmUpload()}
                  disabled={uploadMutation.isPending}
                >
                  {uploadMutation.isPending ? (
                    <>
                      <Spinner animation="border" size="sm" className="me-2" /> Uploading…
                    </>
                  ) : (
                    'Upload and use this file'
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline-secondary"
                  onClick={() => setPendingFile(null)}
                  disabled={uploadMutation.isPending}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div
                className={`admin-media-picker__dropzone${dragActive ? ' admin-media-picker__dropzone--active' : ''}`}
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
                >
                  Browse files
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="visually-hidden"
                  accept="image/jpeg,image/png,image/webp,image/avif,application/pdf"
                  aria-label="Upload a file"
                  onChange={(event) => handleFileChosen(event.target.files?.[0])}
                />
              </div>

              <hr />

              <div className="admin-media-picker__filters">
                <Form.Control
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search media…"
                  aria-label="Search media"
                  className="admin-media-picker__search"
                />
                <Form.Select
                  value={kindFilter}
                  onChange={(event) => setKindFilter(event.target.value as MediaKind | '')}
                  aria-label="Filter by kind"
                  className="admin-media-picker__kind-filter"
                >
                  <option value="">All kinds</option>
                  {MEDIA_KINDS.map((kindOption) => (
                    <option key={kindOption} value={kindOption}>
                      {KIND_LABELS[kindOption]}
                    </option>
                  ))}
                </Form.Select>
              </div>

              {listQuery.isLoading ? (
                <div className="text-center py-4">
                  <Spinner animation="border" size="sm" />
                </div>
              ) : items.length === 0 ? (
                <p className="text-body-secondary text-center py-4 mb-0">No media found.</p>
              ) : (
                <div className="admin-media-picker__grid">
                  {items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="admin-media-picker__grid-item"
                      onClick={() => selectExisting(item)}
                      aria-label={item.altText ?? item.originalName}
                    >
                      {item.mimeType === 'application/pdf' ? (
                        <span className="bi bi-file-earmark-pdf" aria-hidden="true" />
                      ) : (
                        <img src={mediaUrl(item.filename)} alt="" loading="lazy" />
                      )}
                      <span className="admin-media-picker__grid-item-name">
                        {item.originalName}
                      </span>
                    </button>
                  ))}
                </div>
              )}

              {meta && meta.totalPages > 1 && (
                <div className="d-flex justify-content-between align-items-center mt-3">
                  <Button
                    type="button"
                    variant="outline-secondary"
                    size="sm"
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                    disabled={page <= 1}
                  >
                    Previous
                  </Button>
                  <span className="small text-body-secondary">
                    Page {meta.page} of {meta.totalPages}
                  </span>
                  <Button
                    type="button"
                    variant="outline-secondary"
                    size="sm"
                    onClick={() => setPage((current) => Math.min(meta.totalPages, current + 1))}
                    disabled={page >= meta.totalPages}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </Modal.Body>
      </Modal>
    </div>
  );
}
