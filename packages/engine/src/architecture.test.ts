// Architectuurbewaking: de engine mag niets uit React, de browser of Node importeren.
// Zo blijft de engine overal bruikbaar en blijven spelregels op één plek.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(import.meta.dirname, '.');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return name.endsWith('.ts') && !name.endsWith('.test.ts') ? [full] : [];
  });
}

describe('architectuur van de engine', () => {
  it('importeert niets uit React, de browser of Node', () => {
    const forbidden =
      /from\s+['"](react|react-dom|node:[^'"]+|fs|path|@wargame\/web|@wargame\/server)['"]/;
    const offenders = sourceFiles(SRC).filter((file) => forbidden.test(readFileSync(file, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('gebruikt nergens Math.random', () => {
    const offenders = sourceFiles(SRC).filter((file) =>
      /Math\.random\s*\(/.test(readFileSync(file, 'utf8')),
    );
    expect(offenders).toEqual([]);
  });
});
