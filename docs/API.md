# API reference

Base path `/api`. JSON in and out. Shared request and response types are in [`shared/src/index.ts`](../shared/src/index.ts).

**Errors** always look like:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "targetRating: Too big: expected number to be <=4000", "details": {} } }
```

| Status | Codes |
|---|---|
| 400 | `VALIDATION_ERROR`, `INVALID_JSON`, `INCOMPLETE_DAY`, `CODEFORCES_INVALID_HANDLE` |
| 401 | `UNAUTHORIZED`, `INVALID_CREDENTIALS` |
| 404 | `NOT_FOUND`, `CODEFORCES_NOT_FOUND` |
| 409 | `EMAIL_TAKEN`, `NO_REPLACEMENT`, `CONFLICT` |
| 422 | `UNRATED_PROFILE` |
| 429 | `TOO_MANY_REQUESTS` (with `Retry-After`), `CODEFORCES_RATE_LIMITED` |
| 502 / 504 | `CODEFORCES_UNAVAILABLE`, `CODEFORCES_BAD_RESPONSE` / `CODEFORCES_TIMEOUT` |
| 500 | `INTERNAL_ERROR` |

**Authentication:** a session cookie `cgp_token` (httpOnly JWT) is set by register and login. 🔒 marks endpoints that require it. A resource owned by another user returns 404.

Endpoints that depend on "today" accept `?date=YYYY-MM-DD` (the client sends the user's local date).

## Health

`GET /health` → `{ status: "ok", uptimeSeconds, database: "connected" | "connecting" | "disconnected", timestamp }`

## Auth

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/auth/register` | `{ name, email, password (≥ 8) }` | 201 `{ user }` + cookie |
| POST | `/auth/login` | `{ email, password }` | `{ user }` + cookie |
| POST | `/auth/logout` | – | `{ ok: true }`, clears the cookie |
| GET 🔒 | `/auth/me` | – | `{ user, activeRoadmapId }` |
| PATCH 🔒 | `/auth/me` | `{ name?, codeforcesHandle?, preferences?: { theme?, blindPractice? } }` | `{ user }` |
| DELETE 🔒 | `/auth/me` | `{ password }` | `{ ok: true }`, deletes all user data |
| DELETE 🔒 | `/auth/me/excluded/:problemId` | – | `{ user }`, allows that problem again |

Register, login and account deletion are rate limited (`AUTH_RATE_LIMIT` per IP per 15 minutes).

## Goals (public)

| Method | Path | Body | Response |
|---|---|---|---|
| POST | `/goals/analyze` | `{ currentRating, targetRating }` | `GoalAssessment`: current level, target rank, gap, goals, benchmark, difficulty, warning, notes |
| POST | `/goals/recommend` | `{ currentRating }` | `{ level, goals }` |

## Codeforces

`GET /codeforces/:handle` 🔒 → `{ profile: { handle, rating, maxRating, rank, maxRank, avatar }, level }`. `level` is `null` for unrated profiles. Only `user.info` is called.

## Roadmaps 🔒

### `POST /roadmaps/generate`

```json
{
  "codeforcesHandle": "optional",
  "currentRating": 1200,
  "targetRating": 1600,
  "hoursPerDay": 2,
  "daysPerWeek": 6,
  "contestParticipation": true,
  "mandatoryProblems": 2,
  "startDate": "2026-11-02"
}
```

A handle or a `currentRating` is required. With a rated handle, the Codeforces rating is used. An unrated handle without `currentRating` returns 422 `UNRATED_PROFILE`. Returns 201 `{ roadmap, assessment, notes }` and archives the previous active roadmap.

| Method | Path | Response |
|---|---|---|
| GET | `/roadmaps` | `{ roadmaps }` (newest first) |
| GET | `/roadmaps/:id` | `{ roadmap, days: DaySummary[90], notes, topics }` |
| GET | `/roadmaps/:id/today?date=` | `{ day, roadmap, currentDay }` (day number clamped to 1–90) |
| GET | `/roadmaps/:id/day/:dayNumber` | `{ day, roadmap }`; `day.progress` holds the recorded outcomes |
| PATCH | `/roadmaps/:id?date=` | body `{ targetRating?, hoursPerDay?, daysPerWeek?, contestParticipation?, mandatoryProblems? (null = auto), status? }` → `{ roadmap, regeneratedDays }`. Plan changes regenerate untouched days from today. |
| DELETE | `/roadmaps/:id` | `{ ok: true }` |

## Problems 🔒

| Method | Path | Body / query | Response |
|---|---|---|---|
| GET | `/problems` | `?q=&tags=a,b&min=&max=&limit=` (≤ 100) | `{ problems, catalogUpdatedAt, stale }` |
| POST | `/problems/exclude` | `{ problemId, roadmapId?, dayNumber? }` | `{ user, day }`; with a day, the problem is also replaced there |
| POST | `/problems/replace` | `{ roadmapId, dayNumber, problemId }` | `{ day }` (409 `NO_REPLACEMENT` if nothing fits) |

## Progress 🔒

`:id` is the daily plan id (`day.id`).

| Method | Path | Body | Response |
|---|---|---|---|
| PATCH | `/progress/:id` | `{ problemId, solvingStatus?, editorialUsed?, hintRevealed?, timeTakenMinutes?, confidence? (1–5), notes? }` | `{ day }` with the derived day status |
| PATCH | `/progress/:id/status` | `{ status: "pending" \| "completed" \| "skipped" }` | `{ day }`; completing requires outcomes for all mandatory problems |
| POST | `/progress/:id/feedback` | `{ feedback: DayFeedback[] }` | `{ day, adaptation \| null }` |

`DayFeedback` is one of `too-easy`, `appropriate`, `too-difficult`, `need-revision`, `understood`, `need-more-examples` ("too easy" and "too difficult" are mutually exclusive).

## Contests 🔒

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/contests` | – | `{ available, upcoming, virtualSuggestions }` (from `contest.list`; `available: false` when Codeforces is unreachable) |
| POST | `/contests` | `{ contestName, contestDate, kind, oldRating?, newRating?, problemsSolved, upsolvedProblems?, notes?, contestId?, roadmapId? }` | 201 `{ contest }` |
| GET | `/contests/history` | – | `{ contests }` |
| PATCH | `/contests/:id` | `{ upsolvedProblems?, notes?, newRating? }` | `{ contest }` |
| DELETE | `/contests/:id` | – | `{ ok: true }` |

## Analytics 🔒

| Method | Path | Response |
|---|---|---|
| GET | `/analytics/:roadmapId?date=` | `AnalyticsDTO`: totals, consistency, weekly, topics, solving breakdown, difficulty progression, highest independent solve, contests |
| GET | `/analytics/:roadmapId/weekly-review?week=&date=` | `WeeklyReviewDTO`: topics covered, solve counts by kind, pending mandatory problems, feedback summary, contests, next week's plan |
