import { Skeleton } from '@/components/ui/Skeleton';

/**
 * Shared across every public route (docs/architecture/06 §4): a generic
 * heading + card-grid shape that reasonably approximates most of this
 * site's pages without reserving a separate skeleton per route — content
 * detail pages (which look less like a grid) settle within a frame or two
 * regardless, since the data fetch they wait on is typically faster than
 * this boundary staying visible long enough to matter visually.
 */
export default function PublicLoading(): React.JSX.Element {
  return (
    <div className="container py-5">
      <Skeleton style={{ height: '2.5rem', width: '40%', marginBottom: '2rem' }} />
      <div className="row g-4">
        {[0, 1, 2].map((index) => (
          <div className="col-md-6 col-lg-4" key={index}>
            <Skeleton style={{ height: '200px', marginBottom: '1rem' }} />
            <Skeleton style={{ height: '1.25rem', width: '70%', marginBottom: '0.5rem' }} />
            <Skeleton style={{ height: '1rem', width: '90%' }} />
          </div>
        ))}
      </div>
    </div>
  );
}
