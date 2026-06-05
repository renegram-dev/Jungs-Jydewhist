# Development pipeline

A lightweight loop. Keep it in this order so correctness is gated before UI work
and nothing ships unvalidated.

```
PLAN → IMPLEMENT → UNIT TEST → BROWSER SMOKE → BUILD → MANUAL IPHONE CHECK → COMMIT
```

1. **PLAN** — agree what changes and why. For scope changes, update
   [roadmap.md](roadmap.md) and get approval first.
2. **IMPLEMENT** — make the change. Respect the layering in
   [../CLAUDE.md](../CLAUDE.md): scoring pure, storage separate, UI on top.
3. **UNIT TEST** — `npm test`. For scoring changes, write the test first.
4. **BROWSER SMOKE** — `npm run smoke` (or
   [browser-smoke-manual.md](browser-smoke-manual.md) if Chromium isn't
   installed).
5. **BUILD** — `npm run build` must succeed.
6. **MANUAL IPHONE CHECK** — `npm run host`, open from the iPhone on the same
   Wi-Fi, sanity-check the change with large touch targets.
7. **COMMIT** — clear message. See
   [validation-checklist.md](validation-checklist.md) before committing.
