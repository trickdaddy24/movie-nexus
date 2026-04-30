# API Security + Admin Bypass

## Goal

Lock down all MovieNexus API endpoints behind API keys (two-tier: read and admin) and add an emergency bypass token for frontend admin access when Auth.js is broken.

## Problem

1. **All backend endpoints are unprotected.** Anyone who discovers `/api/docs` can trigger imports, syncs, exports, and backfills. Read endpoints expose the full catalog as clean JSON, enabling scraping.
2. **Auth.js login breaks after Docker restart.** The superadmin login redirects to `/login/admin` (404) instead of `/admin`. No error is shown, no logs exist to diagnose the issue. The root cause is likely `NEXTAUTH_URL` or `AUTH_SECRET` mismatch after container recreation.
3. **No fallback access.** When Auth.js is broken, the only workaround is SSH into the server and debug env vars.

## Design

### 1. Two-Tier API Key Protection

Two env vars control access:

- `READ_API_KEY` - required for all read endpoints
- `ADMIN_API_KEY` - required for all write/admin endpoints

**Key delivery:** `X-Api-Key` request header. No query param support (avoids key leakage in logs/history).

**Endpoint classification:**

| Tier | Endpoints | Key Required |
|------|-----------|-------------|
| Read | `GET /api/movies`, `GET /api/movies/{id}`, `GET /api/shows`, `GET /api/shows/{id}`, `GET /api/search`, `GET /api/trending`, `GET /api/stats`, `GET /api/health` | `READ_API_KEY` |
| Admin | `POST /api/import/*`, `GET/POST /api/admin/*`, `GET/POST /api/plex/*`, `POST /api/backfill/*`, `GET /api/export/*` | `ADMIN_API_KEY` |
| Docs | `GET /api/docs`, `GET /api/openapi.json` | `ADMIN_API_KEY` |

**Implementation:** A shared FastAPI dependency (`require_read_key`, `require_admin_key`) that reads the `X-Api-Key` header and compares against the corresponding env var. Returns 403 with `{"detail": "Invalid or missing API key"}` on failure.

**Frontend integration:** The Next.js frontend fetches server-side (SSR). Add `READ_API_KEY` as a server-side env var in docker-compose.yml. The `api.ts` fetch helper includes `X-Api-Key` header on all requests. This key never reaches the browser since all fetches happen in server components.

**Swagger UI:** Protected by `ADMIN_API_KEY`. FastAPI's `docs_url` and `openapi_url` are wrapped with the admin key dependency. Swagger's "Authorize" button allows entering the key for interactive testing.

### 2. Emergency Admin Bypass Token

**Env var:** `ADMIN_BYPASS_TOKEN`

**Flow:**
1. User visits `https://movienexus.e4z.xyz/admin?bypass=YOUR_TOKEN`
2. Next.js middleware intercepts the request
3. Middleware compares `bypass` query param against `ADMIN_BYPASS_TOKEN` env var
4. If matched: sets a secure httpOnly cookie (`nexus_bypass`) with 24-hour expiry, redirects to `/admin` (without the token in URL)
5. On subsequent `/admin*` requests: middleware checks for valid `nexus_bypass` cookie. If present and valid, grants access without Auth.js session check
6. If Auth.js session exists, that also grants access (bypass is additive, not replacement)

**Cookie properties:**
- Name: `nexus_bypass`
- Value: HMAC signature of the token + expiry timestamp (not the raw token)
- httpOnly: true
- secure: true
- sameSite: strict
- maxAge: 86400 (24 hours)
- path: /admin

**Logout:** Visiting `/login` or explicitly logging out clears the bypass cookie.

**Access level:** Full admin (equivalent to superadmin). No restrictions.

### 3. Docker Compose Changes

New env vars added to `docker-compose.yml`:

**Backend service:**
```yaml
READ_API_KEY: ${READ_API_KEY}
ADMIN_API_KEY: ${ADMIN_API_KEY}
```

**Frontend service:**
```yaml
READ_API_KEY: ${READ_API_KEY}
ADMIN_BYPASS_TOKEN: ${ADMIN_BYPASS_TOKEN}
```

### 4. Config Changes

**Backend `config.py`** - Add `read_api_key` and `admin_api_key` fields to Settings.

**Frontend env** - `READ_API_KEY` (server-side only, not `NEXT_PUBLIC_`), `ADMIN_BYPASS_TOKEN` (server-side only).

## Files

| Action | File | Change |
|--------|------|--------|
| Create | `backend/dependencies.py` | `require_read_key` and `require_admin_key` FastAPI dependencies |
| Modify | `backend/config.py` | Add `read_api_key`, `admin_api_key` to Settings |
| Modify | `backend/main.py` | Conditionally set `docs_url`/`openapi_url` based on admin key; apply read key dependency globally or per-router |
| Modify | `backend/routers/movies.py` | Add `require_read_key` dependency |
| Modify | `backend/routers/shows.py` | Add `require_read_key` dependency |
| Modify | `backend/routers/search.py` | Add `require_read_key` dependency |
| Modify | `backend/routers/trending.py` | Add `require_read_key` dependency |
| Modify | `backend/routers/stats.py` | Add `require_read_key` dependency |
| Modify | `backend/routers/admin.py` | Add `require_admin_key` dependency |
| Modify | `backend/routers/imports.py` | Add `require_admin_key` dependency |
| Modify | `backend/routers/plex.py` | Add `require_admin_key` dependency |
| Modify | `backend/routers/backfill.py` | Add `require_admin_key` dependency |
| Modify | `backend/routers/export.py` | Add `require_admin_key` dependency |
| Modify | `frontend/src/middleware.ts` | Add bypass token check before Auth.js middleware |
| Modify | `frontend/src/lib/api.ts` | Add `X-Api-Key` header to all fetch calls |
| Modify | `docker-compose.yml` | Add `READ_API_KEY`, `ADMIN_API_KEY`, `ADMIN_BYPASS_TOKEN` env vars |

## Not in Scope

- Auth event logging (deferred; bypass token solves the lockout problem)
- Rate limiting on API endpoints
- Per-user API keys or key rotation UI
- Fixing the Auth.js redirect bug itself (memorized for next debug session)
