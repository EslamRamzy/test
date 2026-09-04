'use client';

import type { SkillCategoryDto } from '@portfolio/shared';
import { useState } from 'react';

/**
 * Categories, not percentages (design concept §12) — a numeric skill level
 * ("React 90%") claims a precision nobody actually has; a category tab
 * switch plus a stagger reveal communicates the same "here's what I work
 * in, grouped" without the fake number. `skillCategories` (and each
 * skill's real `level`, shown as a word — Beginner/Intermediate/Advanced —
 * not a bar) is exactly what the API already returns; nothing here is
 * invented.
 */
export function SkillsPreview({
  skillCategories,
}: {
  skillCategories: SkillCategoryDto[];
}): React.JSX.Element | null {
  const categoriesWithSkills = skillCategories.filter((category) => category.skills.length > 0);
  const [activeId, setActiveId] = useState(categoriesWithSkills[0]?.id ?? null);

  if (categoriesWithSkills.length === 0) return null;

  const active =
    categoriesWithSkills.find((category) => category.id === activeId) ?? categoriesWithSkills[0]!;

  return (
    <section className="skills-preview">
      <div className="container">
        <h2 className="section-heading">Skills</h2>

        <div className="skills-preview__tabs" role="tablist" aria-label="Skill categories">
          {categoriesWithSkills.map((category) => (
            <button
              key={category.id}
              type="button"
              role="tab"
              aria-selected={category.id === active.id}
              className={`skills-preview__tab${category.id === active.id ? ' skills-preview__tab--active' : ''}`}
              onClick={() => setActiveId(category.id)}
            >
              {category.icon && <span className={category.icon} aria-hidden="true" />}
              {category.name}
            </button>
          ))}
        </div>

        <div className="skills-preview__grid" key={active.id}>
          {active.skills.map((skill, index) => (
            <div
              className="skills-preview__item"
              key={skill.id}
              style={{ '--i': index } as React.CSSProperties}
            >
              {skill.icon && (
                <span className={`skills-preview__item-icon ${skill.icon}`} aria-hidden="true" />
              )}
              <span className="skills-preview__item-name">{skill.name}</span>
              <span className="skills-preview__item-level">{skill.level.toLowerCase()}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
