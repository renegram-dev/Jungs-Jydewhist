import { describe, it, expect } from 'vitest';
import { isDifferentBuild } from '../lib/updateCheck.js';

describe('update check — isDifferentBuild', () => {
  it('is true when the remote build differs from the running build', () => {
    expect(isDifferentBuild({ build: 'abc123' }, 'def456')).toBe(true);
  });

  it('is false when the builds match', () => {
    expect(isDifferentBuild({ build: 'abc123' }, 'abc123')).toBe(false);
  });

  it('is false for missing or malformed remote data', () => {
    expect(isDifferentBuild(null, 'abc123')).toBe(false);
    expect(isDifferentBuild({}, 'abc123')).toBe(false);
    expect(isDifferentBuild({ build: 123 }, 'abc123')).toBe(false);
  });

  it('is false when the current build id is unknown', () => {
    expect(isDifferentBuild({ build: 'abc123' }, '')).toBe(false);
  });
});
