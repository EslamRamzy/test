import type { SkillCategoryDto } from '@portfolio/shared';

export function SkillsPreview({
  skillCategories,
}: {
  skillCategories: SkillCategoryDto[];
}): React.JSX.Element | null {
  const categoriesWithSkills = skillCategories.filter((category) => category.skills.length > 0);
  if (categoriesWithSkills.length === 0) return null;

  return (
    <section className="py-5 border-bottom" style={{ backgroundColor: 'var(--color-surface)' }}>
      <div className="container">
        <h2 className="h3 mb-4">Skills</h2>
        <div className="row g-4">
          {categoriesWithSkills.map((category) => (
            <div className="col-sm-6 col-lg-3" key={category.id}>
              <h3
                className="h6 text-uppercase"
                style={{ color: 'var(--color-text-muted)', letterSpacing: '0.04em' }}
              >
                {category.icon && <span className={`${category.icon} me-2`} aria-hidden="true" />}
                {category.name}
              </h3>
              <ul className="list-unstyled d-flex flex-wrap gap-2 mt-2">
                {category.skills.map((skill) => (
                  <li key={skill.id} className="badge text-bg-secondary fw-normal">
                    {skill.name}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
