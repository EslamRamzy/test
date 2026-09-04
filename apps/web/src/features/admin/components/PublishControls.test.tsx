import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PublishControls } from './PublishControls';

describe('PublishControls', () => {
  it('DRAFT: shows only Publish and Duplicate', () => {
    render(
      <PublishControls
        status="DRAFT"
        onPublish={vi.fn()}
        onUnpublish={vi.fn()}
        onArchive={vi.fn()}
        onDuplicate={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /Publish/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Unpublish/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Archive/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Duplicate/ })).toBeInTheDocument();
  });

  it('PUBLISHED: shows Unpublish and Archive, not Publish', () => {
    render(
      <PublishControls
        status="PUBLISHED"
        onPublish={vi.fn()}
        onUnpublish={vi.fn()}
        onArchive={vi.fn()}
        onDuplicate={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: /^Publish$/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Unpublish/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Archive/ })).toBeInTheDocument();
  });

  it('ARCHIVED: shows "Restore to Draft" (same handler as Unpublish), not Publish or Archive', () => {
    const onUnpublish = vi.fn();
    render(
      <PublishControls
        status="ARCHIVED"
        onPublish={vi.fn()}
        onUnpublish={onUnpublish}
        onArchive={vi.fn()}
        onDuplicate={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: /^Publish$/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Archive$/ })).not.toBeInTheDocument();
    const restoreButton = screen.getByRole('button', { name: /Restore to Draft/ });
    fireEvent.click(restoreButton);
    expect(onUnpublish).toHaveBeenCalledTimes(1);
  });

  it('disables every button while busy', () => {
    render(
      <PublishControls
        status="DRAFT"
        onPublish={vi.fn()}
        onUnpublish={vi.fn()}
        onArchive={vi.fn()}
        onDuplicate={vi.fn()}
        busy
      />,
    );
    for (const button of screen.getAllByRole('button')) {
      expect(button).toBeDisabled();
    }
  });
});
