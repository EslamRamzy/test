/**
 * Writes `docs/api/openapi.json` from `src/openapi/registry.ts` (docs/
 * architecture/03 §8: "the generated openapi.json is committed so the API
 * surface is diffable in code review"). Re-run and commit whenever a route
 * or a shared validation schema changes.
 *
 * Usage: npm run generate:openapi -w @portfolio/api
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateOpenApiDocument } from '../src/openapi/registry.js';

const outputDir = join(import.meta.dirname, '..', '..', '..', 'docs', 'api');
const outputPath = join(outputDir, 'openapi.json');

mkdirSync(outputDir, { recursive: true });
const document = generateOpenApiDocument();
writeFileSync(outputPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');

console.log(`✓ Wrote ${outputPath}`);
