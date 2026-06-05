// Lightweight "a newer build is deployed" check. No service worker — freshness
// over offline caching. Fetches the deployed version.json (cache-busted) and
// compares its build id to the running app's build.

import { APP_BUILD } from '../version.js';

/** Pure: is the remote version.json a different build than the running one? */
export function isDifferentBuild(remote, currentBuild = APP_BUILD) {
  return Boolean(
    remote && typeof remote.build === 'string' && currentBuild && remote.build !== currentBuild,
  );
}

/** Fetch the deployed version.json, bypassing caches. Throws on non-200. */
export async function fetchRemoteVersion() {
  const base = import.meta.env.BASE_URL || '/';
  const res = await fetch(`${base}version.json?ts=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`version.json ${res.status}`);
  return res.json();
}

/** True when the deployed build differs from the running build. Never throws. */
export async function isUpdateAvailable() {
  try {
    return isDifferentBuild(await fetchRemoteVersion());
  } catch {
    return false;
  }
}
