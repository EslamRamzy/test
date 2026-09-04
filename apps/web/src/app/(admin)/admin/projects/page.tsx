'use client';

import type { ProjectAdminRow } from '@portfolio/shared';
import type { DataTableColumn } from '@/features/admin/components/DataTable';
import { AdminResourceListPage } from '@/features/admin/components/AdminResourceListPage';
import { StatusBadge, type ContentStatus } from '@/features/admin/components/StatusBadge';
import { useToast } from '@/features/admin/components/ToastProvider';
import { projectsHooks, useSetFeatured } from '@/features/admin/projects/client';

function FeaturedToggle({ project }: { project: ProjectAdminRow }): React.JSX.Element {
  const { show } = useToast();
  const setFeatured = useSetFeatured();

  return (
    <div className="form-check form-switch mb-0">
      <input
        type="checkbox"
        className="form-check-input"
        checked={project.featured}
        disabled={setFeatured.isPending}
        onChange={(event) =>
          setFeatured.mutate(
            { id: project.id, featured: event.target.checked },
            {
              onError: () =>
                show({ message: 'Couldn’t update the featured flag.', variant: 'danger' }),
            },
          )
        }
        aria-label={`Featured: ${project.title}`}
      />
    </div>
  );
}

const columns: Array<DataTableColumn<ProjectAdminRow>> = [
  { key: 'title', label: 'Title', render: (row) => row.title, sortKey: 'title' },
  {
    key: 'status',
    label: 'Status',
    render: (row) => <StatusBadge status={row.status as ContentStatus} />,
  },
  { key: 'category', label: 'Category', render: (row) => row.category.replaceAll('_', ' ') },
  { key: 'featured', label: 'Featured', render: (row) => <FeaturedToggle project={row} /> },
];

/** `/admin/projects` — doc07 §3's largest module. Reorder buttons AND a status filter coexist here (Project is the one publish-workflow resource that ALSO has `displayOrder`) — `AdminResourceListPage` supports both independently. */
export default function ProjectsListPage(): React.JSX.Element {
  return (
    <AdminResourceListPage
      title="Projects"
      hooks={projectsHooks}
      columns={columns}
      searchPlaceholder="Search projects…"
      newHref="/admin/projects/new"
      newLabel="New project"
      getEditHref={(row) => `/admin/projects/${row.id}`}
      getEntityLabel={(row) => row.title}
      resourceNameSingular="project"
      emptyMessage="No projects yet."
      statusFilter
      reorderable
      pageSize={50}
    />
  );
}
