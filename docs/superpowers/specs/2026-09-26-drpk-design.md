# drpk (Daily Random Programming Knowledge) — Design Spec

- **Date:** 2026-09-26
- **Status:** Draft, awaiting review
- **Repo:** https://github.com/torisutanjon/daily-random-programming-knowledge
- **App name:** drpk — used for the window title, heading, notifications, package name, and data folder

## 1. Purpose

A personal Windows desktop app that gives Tristan one programming "word of the day" (a concept, technique, or technology) and a short checklist of topics to research about it. Each topic carries one or two questions that Tristan answers in their own words; an LLM grades the answers. The goal is a **roadmap from mid-level to senior developer**, tailored to Tristan's stack, where progress means *demonstrably understanding* each word — not trivia.

### Success criteria

- At the configured time each day, a Windows notification announces the new word, even when the app window is closed.
- The day's word is persisted; reopening the app never generates a different word for the same day.
- Each word has 4–8 topics, 1–2 questions per topic, and **at most 12 questions total**.
- Free-text answers are graded as pass / partial / fail with feedback that points at what is missing without giving the answer away. Unlimited retries; a "reveal" escape hatch.
- Over time, words spread across senior-level areas rather than clustering in one.

### Non-goals (YAGNI)

- No accounts, sync, cloud backend, or multi-user support.
- No mobile or macOS/Linux packaging (Windows only).
- No spaced repetition, streaks, or gamification.
- No end-to-end test suite in v1.

## 2. Decisions log

| Decision | Choice | Reason |
|---|---|---|
| Content source | LLM generates word, topics, questions; LLM grades | Only an LLM can judge free-text answers meaningfully |
| Word scope | Configurable areas + level; default mid→senior, tailored to Tristan's stack | Avoid trivial or irrelevant words; roadmap framing |
| Wrong answers | Unlimited retries, hint-style feedback, "reveal" marks question `revealed` (not `learned`) | Pushes back into research instead of giving answers away |
| Day boundary | New word every day; unfinished words go to a backlog, reopenable anytime | Life happens; no punishment |
| Desktop wrapper | Electron hosting a Next.js server | All-TypeScript; Next route handlers keep API key server-side |
| Target OS | Windows (developed in WSL2) | Where the app runs day to day |
| Storage | JSON files behind a repository interface (no SQLite) | Tiny data; avoids native-module pain for Windows builds from WSL |
| LLM | Anthropic Claude API, default model `claude-opus-5-5`, configurable | Quality of generation and grading |
| Window chrome | Hidden title bar with native window controls (`titleBarStyle: 'hidden'` + `titleBarOverlay`) | Matches the design while keeping Windows' own controls and snap layouts |
| Visual design | Claude Design export in `docs/design/` is the visual reference | One agreed look before UI work |

## 3. Default profile

**Stack (from portfolio, editable in Settings):** TypeScript/JavaScript, React, Next.js, Node.js, PostgreSQL, GraphQL, Supabase, MongoDB, Jest, Tailwind, Vercel, Git.

**Default level:** mid → senior.

**Default areas (all enabled):**
React internals · Next.js · Node runtime · Advanced TypeScript · Postgres & databases · GraphQL & API design · Testing strategy · Web performance · Security · System design · Architecture patterns · Distributed systems · CI/CD & DevOps · Observability · CS fundamentals · Engineering leadership & practices.

## 4. Architecture

```
Electron main (desktop concerns only)   Next.js server (all app logic)
├─ lifecycle: single-instance lock,      ├─ pages: Today · Backlog · Word/[dayKey] · Settings
│  starts Next on a localhost port       ├─ route handlers:
├─ window: close → hide to tray          │    GET  /api/today        (get-or-generate)
├─ tray: Open / Quit                     │    POST /api/answer       (grade an answer)
├─ launch at login (Windows)             │    POST /api/reveal       (reveal model answer)
└─ scheduler ──HTTP──▶ /api/today        │    GET/PUT /api/settings
     then shows a Windows toast          │    GET  /api/history      (backlog + coverage)
                                         ├─ lib/llm     LlmProvider interface
                                         │    ├─ FakeProvider   (no key; canned data)
                                         │    └─ AnthropicProvider
                                         ├─ lib/store   JSON repository
                                         └─ lib/domain  day logic, coverage picker, status derivation
```

### Rules

- **All logic lives in Next.js.** Electron never touches data or the LLM. This keeps one source of truth and lets the whole app run in a plain browser via `next dev` during development.
- **Day rule:** the current word changes at the user's configured time, not at midnight. With `notifyTime = 09:00`, at 08:30 on Tuesday the current word is still Monday's. The `dayKey` (`YYYY-MM-DD`, local time) of the current word is computed by a pure function `currentDayKey(now, notifyTime)`.
- **Missed triggers:** the scheduler checks on app start and on resume from sleep (Electron `powerMonitor` `resume`). If the current `dayKey` has no word, it calls `/api/today` and shows the toast immediately. Opening the UI performs the same get-or-generate, so a word is never missing.
- **First run:** the first word is generated immediately, regardless of the configured time.
- **Window chrome:** the BrowserWindow uses `titleBarStyle: 'hidden'` with `titleBarOverlay` (colours from the design's title bar), so the app draws its own title bar and Windows keeps the native minimize / maximize / close buttons.
- **Demo mode:** with no API key set, `FakeProvider` is used and the UI shows a "demo mode" badge.

## 5. Units

| Unit | Responsibility | Depends on |
|---|---|---|
| `electron/main.ts` | App lifecycle, single-instance lock, start Next server, BrowserWindow (hidden title bar + native controls overlay), hide-to-tray, launch-at-login | Electron, `electron/scheduler.ts` |
| `electron/scheduler.ts` | Compute next fire time (pure `nextFireAt(now, notifyTime)`), set timer, handle resume, call `/api/today`, show `Notification` | settings via `/api/settings` |
| `lib/domain/day.ts` | `currentDayKey`, `nextFireAt` — pure, DST-safe, local time | none |
| `lib/domain/coverage.ts` | `pickArea(history, enabledAreas, rng)` — weighted-random favouring least-covered areas | none |
| `lib/domain/status.ts` | Derive topic/word status from question statuses | none |
| `lib/domain/sanitize.ts` | Strip `rubric` and unrevealed `modelAnswer` from words before they leave the server | none |
| `lib/llm/types.ts` | `LlmProvider { generateWord(input): Promise<GeneratedWord>; gradeAnswer(input): Promise<Grade> }` + zod schemas | zod |
| `lib/llm/fake.ts` | Deterministic canned words and grades | types |
| `lib/llm/anthropic.ts` | Claude API implementation | `@anthropic-ai/sdk`, types |
| `lib/store/repo.ts` | `getWord(dayKey)`, `saveWord(word)`, `listWords()`, `getSettings()`, `saveSettings()`; atomic writes | node `fs` |
| `lib/services/today.ts` | Get-or-generate with a per-`dayKey` in-flight lock | domain, llm, store |
| `lib/services/grading.ts` | Grade an answer, append attempt, update question status | llm, store |

## 6. Data model

Stored under the Electron `userData` dir (e.g. `%APPDATA%\drpk\`); in plain-browser dev mode, under a `DATA_DIR` env var (default `./.data`).

- `settings.json`
- `words/<dayKey>.json` — one file per word

```ts
type Level = 'mid' | 'mid-senior' | 'senior';

interface Settings {
  notifyTime: string;          // "HH:mm", default "09:00"
  level: Level;                // default 'mid-senior'
  areas: AreaId[];             // enabled areas, default all
  stackProfile: string[];      // default: stack from section 3
  apiKey: string | null;       // null → demo mode (FakeProvider)
  model: string;               // default 'claude-opus-5-5'
  launchAtLogin: boolean;      // default true
}

interface Word {
  dayKey: string;              // "2026-09-26"
  term: string;
  subtitle: string;            // short expansion, e.g. "Multi-version concurrency control"
  area: AreaId;
  level: Level;
  topics: Topic[];             // 4–8
  createdAt: string;           // ISO
  provider: 'anthropic' | 'fake';
}

interface Topic { id: string; title: string; questions: Question[] }   // title = short phrase, no description; 1–2 questions

interface Question {
  id: string;
  prompt: string;
  rubric: string[];            // hidden: key points a passing answer must cover
  modelAnswer: string;         // hidden until revealed
  status: 'unanswered' | 'partial' | 'learned' | 'revealed';
  revealedAt: string | null;   // ISO; set when revealed, null otherwise
  attempts: Attempt[];
}

interface Attempt { answer: string; verdict: 'pass' | 'partial' | 'fail'; feedback: string; at: string }
```

- Topic and word status are **derived**, never stored. A topic is *done* when every question is `learned` or `revealed`; *learned* when every question is `learned`.
- Status transitions: a `pass` sets `learned`; `partial` sets `partial`; `fail` leaves the current status (or `unanswered`). `revealed` is terminal. Answering after reveal is allowed but does not change the status. A `learned` question stays `learned`: later attempts are recorded but never downgrade it.
- Writes are atomic: write `<file>.tmp`, then rename over the target.

## 7. Generation flow

1. `pickArea` chooses an area from enabled areas, weighted toward those with the fewest past words (weight = 1 / (1 + count)); random tie-breaking via an injectable RNG.
2. One LLM call with: chosen area, level, stack profile, and the list of all past terms (to avoid repeats). It returns `{ term, subtitle, topics: [{ title, questions: [{ prompt, rubric[], modelAnswer }] }] }`.
3. Validate with the zod schema (4–8 topics, 1–2 questions each, ≤12 questions total). Reject if the term case-insensitively matches a past term.
4. On invalid output or a repeat, retry once; on a second failure, surface an error with a Retry action.
5. Persist, then return the sanitized word.

A per-`dayKey` in-flight promise guarantees one generation even if the scheduler and the UI request simultaneously.

## 8. Grading flow

1. Input: question prompt, rubric, the user's answer.
2. LLM returns `{ verdict: 'pass' | 'partial' | 'fail', feedback }`. The prompt instructs it to name which aspects are missing or wrong **without stating the rubric points or the answer**.
3. Append an `Attempt`, update the question status, persist, return the sanitized question.
4. `POST /api/reveal` sets `revealed` and `revealedAt`, and returns that question's `modelAnswer` and rubric.

The rubric is fixed at generation time, so grading stays consistent across retries. `rubric` and `modelAnswer` never appear in any API response for a question that isn't `revealed`.

## 9. LLM integration (Anthropic)

- SDK: `@anthropic-ai/sdk`. Client constructed with the key from Settings.
- Default model `claude-opus-5-5`; configurable in Settings (e.g. to a cheaper model — the user's choice).
- Structured output via `client.messages.parse({ ..., output_config: { format: zodOutputFormat(schema) } })` using `zodOutputFormat` from `@anthropic-ai/sdk/helpers/zod`; the same zod schemas used for validation. Guard `parsed_output` being null.
- Adaptive thinking (default on Opus 5). Effort: `high` for generation, `low` for grading.
- `max_tokens`: 16000 for generation (non-streaming), 2000 for grading.
- Check `stop_reason` before reading output; treat `refusal` and `max_tokens` as generation/grading failures. Enable server-side refusal fallbacks (`fallbacks: "default"` with beta `server-side-fallback-2026-07-01`) per current SDK guidance.
- Errors: catch SDK typed errors most-specific first — `AuthenticationError` → "invalid key, check Settings"; `RateLimitError` / 5xx / connection → "try again". Never string-match messages.
- "Test key" in Settings makes a minimal request and reports success or the typed error.
- API key stored in plaintext in `settings.json` in the user's profile directory. Acceptable for a personal single-user app; Electron `safeStorage` (DPAPI) is a possible later upgrade.

## 10. UI

- **Visual reference:** `docs/design/drpk.dc.html` (Claude Design export; open it in a browser — it needs `support.js` beside it). Reference images: `docs/design/wireframe.png` (layout sketch) and `docs/design/style-reference.png` (tone reference). Dark theme; IBM Plex Sans + JetBrains Mono; status colours: pass/learned green, partial amber, fail ("Not yet") red, revealed blue.
- **Shell:** app-drawn title bar (drpk mark, current view title, demo-mode badge) with native window controls; left nav — Today, Backlog, Settings with counts, and a "Next word" footer showing the next notify time; main column; right panel with **Unfinished** (words not yet done, with progress; each opens its word view) and **Log** (today's attempts and reveals, newest first: time, verdict, topic).
- **Today (home):** large term with its subtitle, area and level chips, progress ("6/10 learned · 1 revealed"). Checklist of topics (title only); a topic auto-ticks when done, with distinct icons for learned vs revealed. Expanding a topic shows its questions: textarea, Submit, attempts list (verdict + feedback), "Reveal answer" behind a confirmation. A done question offers "Answer again" (learned) or "Write it in your own words anyway" (revealed).
- **Backlog:** past words with filter (in progress / learned / all); each opens the same word view. Coverage panel: count of words per area, disabled areas dimmed. Empty states for the first day and for an empty filter.
- **Settings:** notify time, level, area checkboxes, stack tags, API key with "Test key", model, launch-at-login.
- States: generating (loading), error card with Retry (key errors link to Settings), grading in progress, grading failed (answer kept), demo-mode badge and note.

## 11. Error handling

| Failure | Behaviour |
|---|---|
| Generation fails (network, key, rate limit, invalid output twice) | Error card with Retry; key errors link to Settings. Scheduled toast reads "Couldn't fetch today's word — open to retry". |
| Grading fails | Answer stays in the textarea, no attempt recorded, inline "Couldn't grade — try again". |
| Concurrent generation for the same day | Per-`dayKey` in-flight lock → generated once. |
| Corrupt JSON file | Renamed to `<file>.corrupt`, error surfaced; app does not crash. Corrupt settings fall back to defaults. |
| Time / DST | All day logic uses local time via pure, tested functions. |
| Second app instance launched | Single-instance lock focuses the existing window. |

## 12. Testing

Jest + Testing Library (matching Tristan's existing projects).

- **Unit:** `currentDayKey` / `nextFireAt` (before/after notify time, midnight, DST transitions), `pickArea` (seeded RNG), status derivation, sanitization, zod schema validation (bounds incl. ≤12 questions), status transitions.
- **Integration:** route handlers against `FakeProvider` and a temp `DATA_DIR` — get-or-generate idempotency, concurrent generation lock, grading flow, reveal, corrupt file handling.
- **Component:** answer → feedback → retry → reveal flow; topic auto-tick.
- **Manual Windows smoke checklist:** tray, hide-to-tray, toast at configured time, resume-from-sleep trigger, launch at login, installer.

## 13. Development & packaging

- Develop in WSL2 with `next dev` in a browser (FakeProvider by default).
- Package with `electron-builder` (NSIS installer) run from **Windows-side Node**, since building Windows installers on Linux requires Wine.
- **Risk (confidence 70%):** Electron + Next.js packaging on Windows. Mitigation: the first implementation task is a walking skeleton — a packaged Windows build showing a tray icon, a toast, and a Next.js page — before any feature work.

## 14. Open items for later (not v1)

- Encrypt API key with `safeStorage`.
- SQLite migration if history querying outgrows JSON files.
- Export history (Markdown) to the Obsidian vault.
