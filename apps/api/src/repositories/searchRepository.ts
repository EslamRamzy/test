import { prisma } from '../config/prisma.js';

/**
 * FTS5 search (docs/architecture/02 §2, §9). `search_index` only ever
 * contains PUBLISHED content — draft rows are never inserted into it in the
 * first place (the triggers that maintain it are gated on `status =
 * 'PUBLISHED'`), so a bug in this query layer cannot leak a draft through
 * search even in principle (docs/architecture/05 §5).
 *
 * The raw SQL here is the one exception to "only repositories import
 * Prisma, and even they mostly don't touch raw SQL" — FTS5 has no Prisma
 * model, so `$queryRaw` is the only way to query it at all. The user's
 * search text is always passed as a BOUND PARAMETER (`${ftsQuery}`), never
 * concatenated into the SQL string — Prisma's tagged-template `$queryRaw`
 * parameterises every interpolated value the same way `?` placeholders do;
 * only the literal template text itself (never a variable) becomes SQL.
 */

export interface SearchRow {
  entityType: 'PROJECT' | 'ARTICLE' | 'RESEARCH' | 'TECHNOLOGY';
  entityId: number;
  slug: string;
  title: string;
  snippet: string;
}

interface RawSearchRow {
  entity_type: string;
  // The underlying better-sqlite3 driver returns every INTEGER column from a
  // raw query as a `bigint` (verified empirically — Prisma's own typed
  // models coerce this back to `number` for you, but `$queryRaw` bypasses
  // that entirely and hands back the driver's native value). `mapRow` below
  // converts it back to `number`, which is safe here: an autoincrement id
  // never approaches `Number.MAX_SAFE_INTEGER`.
  entity_id: bigint;
  slug: string;
  title: string;
  snippet: string;
}

/**
 * FTS5's MATCH argument is its own small query language (`AND`/`OR`/`NOT`,
 * `-prefix`, unescaped `"`, column filters via `col:`) — a raw user string
 * passed straight through would let a search for e.g. `security OR NOT x`
 * change what the query MEANS (not a SQL injection — parameter binding
 * already prevents that — but a functionally confusing or error-throwing
 * query). Quoting every token as an escaped phrase and appending `*` (FTS5
 * phrase-prefix syntax) neutralises all of that: the result always means
 * "AND of these literal prefixes," regardless of what FTS5 operators the
 * user typed.
 */
function buildFtsQuery(rawQuery: string): string {
  const tokens = rawQuery.trim().split(/\s+/).filter(Boolean).slice(0, 10);
  return tokens.map((token) => `"${token.replace(/"/g, '""')}"*`).join(' ');
}

function mapRow(row: RawSearchRow): SearchRow {
  return {
    entityType: row.entity_type as SearchRow['entityType'],
    entityId: Number(row.entity_id),
    slug: row.slug,
    title: row.title,
    snippet: row.snippet,
  };
}

export async function search(
  rawQuery: string,
  entityType: SearchRow['entityType'] | undefined,
  limit: number,
): Promise<SearchRow[]> {
  const ftsQuery = buildFtsQuery(rawQuery);
  if (!ftsQuery) return [];

  // Two literal query shapes rather than composing an optional fragment —
  // `$queryRaw` binds every `${}` interpolation as a parameter VALUE, never
  // as raw SQL text, so a conditionally-included clause has to be a
  // different literal template, not a string spliced into this one.
  const rows = entityType
    ? await prisma.$queryRaw<RawSearchRow[]>`
        SELECT entity_type, entity_id, slug, title,
               snippet(search_index, -1, '', '', '…', 12) AS snippet
        FROM search_index
        WHERE search_index MATCH ${ftsQuery} AND entity_type = ${entityType}
        ORDER BY rank
        LIMIT ${limit}
      `
    : await prisma.$queryRaw<RawSearchRow[]>`
        SELECT entity_type, entity_id, slug, title,
               snippet(search_index, -1, '', '', '…', 12) AS snippet
        FROM search_index
        WHERE search_index MATCH ${ftsQuery}
        ORDER BY rank
        LIMIT ${limit}
      `;

  return rows.map(mapRow);
}
