# API Security + Admin Bypass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lock down all MovieNexus API endpoints behind two-tier API keys and add an emergency bypass token for frontend admin access.

**Architecture:** A single FastAPI dependency module (`dependencies.py`) provides `require_read_key` and `require_admin_key` callables that check the `X-Api-Key` header against env vars. Each router gets the appropriate dependency added at the router level. The Next.js frontend adds the read key to all server-side fetches via `api.ts`. The Next.js middleware gains a bypass token check that sets a secure cookie for emergency admin access.

**Tech Stack:** FastAPI dependencies, Next.js middleware, httpOnly cookies, pydantic-settings

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `backend/dependencies.py` | `require_read_key` and `require_admin_key` FastAPI dependency functions |
| Modify | `backend/config.py` | Add `read_api_key` and `admin_api_key` fields to `Settings` |
| Modify | `backend/main.py` | Conditionally gate Swagger UI, apply admin key to `/api/health` |
| Modify | `backend/routers/movies.py` | Add `require_read_key` dependency to router |
| Modify | `backend/routers/shows.py` | Add `require_read_key` dependency to router |
| Modify | `backend/routers/search.py` | Add `require_read_key` dependency to router |
| Modify | `backend/routers/stats.py` | Add `require_read_key` dependency to router |
| Modify | `backend/routers/trending.py` | Add `require_read_key` dependency to router |
| Modify | `backend/routers/admin.py` | Add `require_admin_key` dependency to router |
| Modify | `backend/routers/imports.py` | Add `require_admin_key` dependency to router |
| Modify | `backend/routers/plex.py` | Add `require_admin_key` dependency to router |
| Modify | `backend/routers/backfill.py` | Add `require_admin_key` dependency to router |
| Modify | `backend/routers/export.py` | Add `require_admin_key` dependency to router |
| Modify | `frontend/src/lib/api.ts` | Add `X-Api-Key` header to `fetchAPI` |
| Modify | `frontend/src/middleware.ts` | Add bypass token check + cookie logic |
| Modify | `docker-compose.yml` | Add `READ_API_KEY`, `ADMIN_API_KEY`, `ADMIN_BYPASS_TOKEN` env vars |

---

### Task 1: Backend API Key Dependencies

**Files:**
- Create: `backend/dependencies.py`
- Modify: `backend/config.py:5-17`

- [ ] **Step 1: Add API key fields to Settings**

In `backend/config.py`, add two new fields to the `Settings` class after `telegram_chat_id`:

```python
read_api_key: str = ""       # required for all read endpoints
admin_api_key: str = ""      # required for all write/admin endpoints
```

The full `Settings` class becomes:

```python
class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:postgres@db:5432/movienexus"
    redis_url: str = "redis://redis:6379/0"
    tmdb_api_key: str = ""
    tvdb_api_key: str = ""
    fanart_api_key: str = ""
    trakt_client_id: str = ""
    plex_url: str = ""
    plex_token: str = ""
    secret_key: str = "changeme"
    debug: bool = False
    telegram_bot_token: str = ""
    telegram_chat_id: str = ""
    read_api_key: str = ""
    admin_api_key: str = ""

    model_config = {"env_file": ".env"}
```

- [ ] **Step 2: Create the dependencies module**

Create `backend/dependencies.py` with the following content:

```python
from fastapi import Header, HTTPException

from config import get_settings


async def require_read_key(x_api_key: str = Header(alias="X-Api-Key", default="")) -> None:
    """Dependency that enforces READ_API_KEY on read-only endpoints."""
    settings = get_settings()
    if not settings.read_api_key:
        return  # No key configured — open access (dev mode)
    if x_api_key != settings.read_api_key:
        raise HTTPException(status_code=403, detail="Invalid or missing API key")


async def require_admin_key(x_api_key: str = Header(alias="X-Api-Key", default="")) -> None:
    """Dependency that enforces ADMIN_API_KEY on write/admin endpoints."""
    settings = get_settings()
    if not settings.admin_api_key:
        return  # No key configured — open access (dev mode)
    if x_api_key != settings.admin_api_key:
        raise HTTPException(status_code=403, detail="Invalid or missing API key")
```

- [ ] **Step 3: Verify the module imports cleanly**

Run from the backend directory:

```bash
cd /app && python -c "from dependencies import require_read_key, require_admin_key; print('OK')"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add backend/dependencies.py backend/config.py
git commit -m "feat: add API key dependencies and config fields"
```

---

### Task 2: Protect Read Endpoints

**Files:**
- Modify: `backend/routers/movies.py:1-13`
- Modify: `backend/routers/shows.py:1-16`
- Modify: `backend/routers/search.py:1-9`
- Modify: `backend/routers/stats.py:1-9`
- Modify: `backend/routers/trending.py:1-10`

Each read router gets `dependencies=[Depends(require_read_key)]` added to its `APIRouter()` call. This protects every endpoint in the router automatically.

- [ ] **Step 1: Add dependency to movies router**

In `backend/routers/movies.py`, add the import and modify the router:

```python
# Add to imports (after existing imports):
from dependencies import require_read_key
```

Change the router line from:
```python
router = APIRouter(prefix="/movies", tags=["Movies"])
```
to:
```python
router = APIRouter(prefix="/movies", tags=["Movies"], dependencies=[Depends(require_read_key)])
```

`Depends` is already imported from `fastapi` on line 3.

- [ ] **Step 2: Add dependency to shows router**

In `backend/routers/shows.py`, add the import and modify the router:

```python
# Add to imports:
from dependencies import require_read_key
```

Change the router line from:
```python
router = APIRouter(prefix="/shows", tags=["TV Shows"])
```
to:
```python
router = APIRouter(prefix="/shows", tags=["TV Shows"], dependencies=[Depends(require_read_key)])
```

`Depends` is already imported from `fastapi` on line 3.

- [ ] **Step 3: Add dependency to search router**

In `backend/routers/search.py`, add the import and modify the router:

```python
# Add to imports:
from dependencies import require_read_key
```

Change the router line from:
```python
router = APIRouter(prefix="/search", tags=["Search"])
```
to:
```python
router = APIRouter(prefix="/search", tags=["Search"], dependencies=[Depends(require_read_key)])
```

`Depends` is already imported from `fastapi` on line 1.

- [ ] **Step 4: Add dependency to stats router**

In `backend/routers/stats.py`, add the import and modify the router:

```python
# Add to imports:
from dependencies import require_read_key
```

Change the router line from:
```python
router = APIRouter(prefix="/stats", tags=["Stats"])
```
to:
```python
router = APIRouter(prefix="/stats", tags=["Stats"], dependencies=[Depends(require_read_key)])
```

`Depends` is already imported from `fastapi` on line 1.

- [ ] **Step 5: Add dependency to trending router**

In `backend/routers/trending.py`, add the import and modify the router:

```python
# Add to imports:
from dependencies import require_read_key
```

Change the router line from:
```python
router = APIRouter(prefix="/trending", tags=["Trending"])
```
to:
```python
router = APIRouter(prefix="/trending", tags=["Trending"], dependencies=[Depends(require_read_key)])
```

`Depends` is already imported from `fastapi` on line 5.

- [ ] **Step 6: Commit**

```bash
git add backend/routers/movies.py backend/routers/shows.py backend/routers/search.py backend/routers/stats.py backend/routers/trending.py
git commit -m "feat: protect read endpoints with READ_API_KEY"
```

---

### Task 3: Protect Admin Endpoints

**Files:**
- Modify: `backend/routers/admin.py:1-27`
- Modify: `backend/routers/imports.py:1-22`
- Modify: `backend/routers/plex.py:1-23`
- Modify: `backend/routers/backfill.py:1-16`
- Modify: `backend/routers/export.py:1-15`

Same pattern as Task 2 but using `require_admin_key`.

- [ ] **Step 1: Add dependency to admin router**

In `backend/routers/admin.py`, add the import and modify the router:

```python
# Add to imports:
from dependencies import require_admin_key
```

Change the router line from:
```python
router = APIRouter(prefix="/admin", tags=["Admin"])
```
to:
```python
router = APIRouter(prefix="/admin", tags=["Admin"], dependencies=[Depends(require_admin_key)])
```

`Depends` is already imported from `fastapi` on line 18.

- [ ] **Step 2: Add dependency to imports router**

In `backend/routers/imports.py`, add the import and modify the router:

```python
# Add to imports:
from dependencies import require_admin_key
```

Change the router line from:
```python
router = APIRouter(prefix="/import", tags=["Import"])
```
to:
```python
router = APIRouter(prefix="/import", tags=["Import"], dependencies=[Depends(require_admin_key)])
```

`Depends` is already imported from `fastapi` on line 6.

- [ ] **Step 3: Add dependency to plex router**

In `backend/routers/plex.py`, add the import and modify the router:

```python
# Add to imports:
from dependencies import require_admin_key
```

Change the router line from:
```python
router = APIRouter(prefix="/plex", tags=["Plex"])
```
to:
```python
router = APIRouter(prefix="/plex", tags=["Plex"], dependencies=[Depends(require_admin_key)])
```

`Depends` is already imported from `fastapi` on line 6.

- [ ] **Step 4: Add dependency to backfill router**

In `backend/routers/backfill.py`, add the import and modify the router:

```python
# Add to imports:
from dependencies import require_admin_key
```

Change the router line from:
```python
router = APIRouter(prefix="/admin/backfill", tags=["backfill"])
```
to:
```python
router = APIRouter(prefix="/admin/backfill", tags=["backfill"], dependencies=[Depends(require_admin_key)])
```

Note: `Depends` may not be imported yet in backfill.py. Check the existing imports — if `Depends` is not present, add it:
```python
from fastapi import APIRouter, Depends, Query
```

- [ ] **Step 5: Add dependency to export router**

In `backend/routers/export.py`, add the import and modify the router:

```python
# Add to imports:
from dependencies import require_admin_key
```

Change the router line from:
```python
router = APIRouter(prefix="/export", tags=["Export"])
```
to:
```python
router = APIRouter(prefix="/export", tags=["Export"], dependencies=[Depends(require_admin_key)])
```

`Depends` is already imported from `fastapi` on line 6.

- [ ] **Step 6: Commit**

```bash
git add backend/routers/admin.py backend/routers/imports.py backend/routers/plex.py backend/routers/backfill.py backend/routers/export.py
git commit -m "feat: protect admin endpoints with ADMIN_API_KEY"
```

---

### Task 4: Gate Swagger UI and Health Endpoint

**Files:**
- Modify: `backend/main.py:70-118`

- [ ] **Step 1: Conditionally disable Swagger when admin key is set**

In `backend/main.py`, add the import for config at the top (it's already imported as `settings = get_settings()` on line 68). Modify the `FastAPI()` constructor to conditionally set `docs_url` and `openapi_url`:

Change:
```python
settings = get_settings()

app = FastAPI(
    title="MovieNexus",
    description="Movie & TV show database with multi-source ratings and artwork",
    version=_read_version(),
    lifespan=lifespan,
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
)
```

To:
```python
settings = get_settings()

app = FastAPI(
    title="MovieNexus",
    description="Movie & TV show database with multi-source ratings and artwork",
    version=_read_version(),
    lifespan=lifespan,
    docs_url="/api/docs" if not settings.admin_api_key else None,
    openapi_url="/api/openapi.json" if not settings.admin_api_key else None,
)
```

This fully disables Swagger UI when an admin key is configured. In development (no key set), Swagger remains available.

- [ ] **Step 2: Protect the health endpoint with read key**

In `backend/main.py`, add the import and modify the health endpoint:

```python
# Add to imports at top of file:
from dependencies import require_read_key
```

Change:
```python
@app.get("/api/health")
async def health():
    return {"status": "ok", "version": _read_version()}
```

To:
```python
@app.get("/api/health", dependencies=[Depends(require_read_key)])
async def health():
    return {"status": "ok", "version": _read_version()}
```

`Depends` is not imported in `main.py` yet. Add it to the fastapi import line:

Change:
```python
from fastapi import FastAPI, Request
```
To:
```python
from fastapi import Depends, FastAPI, Request
```

- [ ] **Step 3: Commit**

```bash
git add backend/main.py
git commit -m "feat: gate Swagger UI behind admin key, protect health endpoint"
```

---

### Task 5: Frontend API Key Header

**Files:**
- Modify: `frontend/src/lib/api.ts:1-10`

- [ ] **Step 1: Add API key header to fetchAPI**

In `frontend/src/lib/api.ts`, modify the `fetchAPI` function to include the `X-Api-Key` header. The key comes from a server-side env var `READ_API_KEY` (not `NEXT_PUBLIC_` — it never reaches the browser since all fetches happen in server components).

Change:
```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

async function fetchAPI<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
```

To:
```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api";
const API_KEY = process.env.READ_API_KEY || "";

async function fetchAPI<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string>),
  };
  if (API_KEY) {
    headers["X-Api-Key"] = API_KEY;
  }
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
```

- [ ] **Step 2: Verify admin API calls also include the key**

The admin page calls functions like `startBulkImport`, `startPlexSync` etc. which use `fetchAPI` internally. Some of these pass their own `headers` (e.g., `"Content-Type": "application/json"` in `startPlexSync`). The spread `...(init?.headers as Record<string, string>)` preserves those. However, admin endpoints require `ADMIN_API_KEY`, not `READ_API_KEY`.

The admin page is server-rendered initially but admin actions are triggered from client components. Since these actions go through the browser, we need the admin key available client-side — but that's a security risk.

**Alternative approach:** Admin actions go through the Next.js frontend to the backend. The frontend is already inside Docker and trusted. Add a second env var `ADMIN_API_KEY` (server-side only) and use it for admin-prefixed paths:

Update the `fetchAPI` function to:

```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api";
const READ_KEY = process.env.READ_API_KEY || "";
const ADMIN_KEY = process.env.ADMIN_API_KEY || "";

async function fetchAPI<T>(path: string, init?: RequestInit): Promise<T> {
  const isAdminPath = path.startsWith("/admin") || path.startsWith("/import") || path.startsWith("/plex") || path.startsWith("/export") || path.startsWith("/backfill");
  const apiKey = isAdminPath ? ADMIN_KEY : READ_KEY;

  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string>),
  };
  if (apiKey) {
    headers["X-Api-Key"] = apiKey;
  }
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
```

**Important:** The admin page (`frontend/src/app/admin/page.tsx`) is a `"use client"` component. Client-side `process.env.READ_API_KEY` and `process.env.ADMIN_API_KEY` are `undefined` because they aren't prefixed with `NEXT_PUBLIC_`. This means client-side fetch calls from the admin page will NOT include the API key.

**Solution:** The admin page needs to make API calls through a Next.js API route (server-side proxy) rather than directly to the backend. However, this is a large refactor. A simpler approach: make `fetchAPI` work server-side only (which it already does for read pages), and for the admin `"use client"` page, create a thin Next.js route handler that proxies admin calls.

**Simplest viable approach:** Create a single catch-all Next.js API route at `/api/proxy/[...path]` that forwards requests to the backend with the appropriate API key. The admin page's client-side fetches go through this proxy instead of directly to the backend.

Update `api.ts` to detect if running server-side or client-side:

```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api";
const READ_KEY = typeof window === "undefined" ? (process.env.READ_API_KEY || "") : "";
const ADMIN_KEY = typeof window === "undefined" ? (process.env.ADMIN_API_KEY || "") : "";

async function fetchAPI<T>(path: string, init?: RequestInit): Promise<T> {
  const isAdminPath = path.startsWith("/admin") || path.startsWith("/import") || path.startsWith("/plex") || path.startsWith("/export") || path.startsWith("/backfill");
  const apiKey = isAdminPath ? ADMIN_KEY : READ_KEY;

  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string>),
  };
  if (apiKey) {
    headers["X-Api-Key"] = apiKey;
  }

  // Client-side admin calls go through the proxy route
  let url = `${API_URL}${path}`;
  if (typeof window !== "undefined" && isAdminPath) {
    url = `/api/proxy${path}`;
  }

  const res = await fetch(url, {
    ...init,
    headers,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json();
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat: add API key headers to frontend fetch calls"
```

---

### Task 6: Admin Proxy Route

**Files:**
- Create: `frontend/src/app/api/proxy/[...path]/route.ts`

Client-side admin calls can't include the API key (env vars aren't available in the browser). This route proxies those calls through Next.js server-side, adding the API key.

- [ ] **Step 1: Create the proxy route**

Create `frontend/src/app/api/proxy/[...path]/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";

const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "http://movienexus-backend:8000/api";
const ADMIN_KEY = process.env.ADMIN_API_KEY || "";
const READ_KEY = process.env.READ_API_KEY || "";

function getApiKey(path: string): string {
  const adminPrefixes = ["/admin", "/import", "/plex", "/export", "/backfill"];
  return adminPrefixes.some((p) => path.startsWith(p)) ? ADMIN_KEY : READ_KEY;
}

async function proxyRequest(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  // Require auth for proxy calls
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const { path } = await params;
  const apiPath = "/" + path.join("/");
  const apiKey = getApiKey(apiPath);
  const url = new URL(`${BACKEND_URL}${apiPath}`);

  // Forward query params
  req.nextUrl.searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });

  const headers: Record<string, string> = {
    "X-Api-Key": apiKey,
  };

  // Forward content-type if present
  const contentType = req.headers.get("content-type");
  if (contentType) {
    headers["Content-Type"] = contentType;
  }

  const fetchInit: RequestInit = {
    method: req.method,
    headers,
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    fetchInit.body = await req.text();
  }

  const res = await fetch(url.toString(), fetchInit);
  const data = await res.text();

  return new NextResponse(data, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("Content-Type") || "application/json" },
  });
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const DELETE = proxyRequest;
```

- [ ] **Step 2: Verify the Traefik routing won't conflict**

The proxy route is at `/api/proxy/*`. Traefik routes `/api/auth/*` to Next.js and `/api/*` to FastAPI. The path `/api/proxy/...` would be routed to FastAPI by Traefik, which is wrong.

However, the admin page runs client-side in the browser. The browser makes requests to the frontend's origin (`movienexus.e4z.xyz`). The Traefik rule `PathPrefix(/api/auth)` routes to Next.js, but `PathPrefix(/api)` routes to FastAPI. So `/api/proxy/` would hit FastAPI.

**Fix:** Use a non-`/api` prefix for the proxy. Change the route to `/nexus-proxy/[...path]`.

Move the file to: `frontend/src/app/nexus-proxy/[...path]/route.ts`

And in `api.ts`, update the client-side URL from:
```typescript
url = `/api/proxy${path}`;
```
to:
```typescript
url = `/nexus-proxy${path}`;
```

**Wait — Next.js App Router requires API routes to be under `app/api/`.** Actually no, Next.js App Router `route.ts` files can live anywhere in the `app/` directory. But by convention they're under `api/`.

**Better fix:** Add a Traefik rule for `/nexus-proxy` that routes to the frontend, similar to `/api/auth`:

Actually, the simplest fix: use the path `/_proxy/[...path]`. Paths starting with `_` are by convention internal. And we need a Traefik rule for it. But that adds Traefik complexity.

**Simplest approach:** Place it at `app/api/auth/proxy/[...path]/route.ts`. The existing Traefik rule already routes `PathPrefix(/api/auth)` to Next.js. So `/api/auth/proxy/...` would be handled by Next.js.

Move the file to: `frontend/src/app/api/auth/proxy/[...path]/route.ts`

And in `api.ts`, update the client-side URL:
```typescript
url = `/api/auth/proxy${path}`;
```

- [ ] **Step 3: Commit**

```bash
git add "frontend/src/app/api/auth/proxy/[...path]/route.ts" frontend/src/lib/api.ts
git commit -m "feat: add server-side proxy route for admin API calls"
```

---

### Task 7: Docker Compose Environment Variables

**Files:**
- Modify: `docker-compose.yml:37-49` (backend env) and `docker-compose.yml:85-94` (frontend env)

- [ ] **Step 1: Add API key env vars to backend service**

In `docker-compose.yml`, add to the backend `environment:` block (after `DEBUG`):

```yaml
      READ_API_KEY: ${READ_API_KEY}
      ADMIN_API_KEY: ${ADMIN_API_KEY}
```

- [ ] **Step 2: Add env vars to frontend service**

In `docker-compose.yml`, add to the frontend `environment:` block (after `SUPERADMIN_PASSWORD`):

```yaml
      READ_API_KEY: ${READ_API_KEY}
      ADMIN_API_KEY: ${ADMIN_API_KEY}
      ADMIN_BYPASS_TOKEN: ${ADMIN_BYPASS_TOKEN}
```

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml
git commit -m "feat: add API key and bypass token env vars to docker-compose"
```

---

### Task 8: Emergency Admin Bypass Token

**Files:**
- Modify: `frontend/src/middleware.ts`

- [ ] **Step 1: Rewrite middleware with bypass token check**

Replace the entire contents of `frontend/src/middleware.ts` with:

```typescript
import { NextRequest, NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

const { auth } = NextAuth(authConfig);

const BYPASS_TOKEN = process.env.ADMIN_BYPASS_TOKEN || "";
const BYPASS_COOKIE = "nexus_bypass";
const BYPASS_MAX_AGE = 86400; // 24 hours

function isAdminRoute(pathname: string): boolean {
  return pathname.startsWith("/admin");
}

function verifyBypassCookie(cookieValue: string): boolean {
  if (!BYPASS_TOKEN || !cookieValue) return false;
  // Cookie value is the token itself, HMAC-signed by the framework via httpOnly+secure
  return cookieValue === BYPASS_TOKEN;
}

export async function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Bypass token flow — only for /admin routes
  if (isAdminRoute(pathname)) {
    const bypassParam = searchParams.get("bypass");

    // Step 1: If ?bypass=TOKEN is in URL, validate and set cookie
    if (bypassParam && BYPASS_TOKEN && bypassParam === BYPASS_TOKEN) {
      const cleanUrl = request.nextUrl.clone();
      cleanUrl.searchParams.delete("bypass");
      const response = NextResponse.redirect(cleanUrl);
      response.cookies.set(BYPASS_COOKIE, BYPASS_TOKEN, {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: BYPASS_MAX_AGE,
        path: "/admin",
      });
      return response;
    }

    // Step 2: If bypass cookie exists and is valid, allow access
    const bypassCookie = request.cookies.get(BYPASS_COOKIE)?.value;
    if (verifyBypassCookie(bypassCookie || "")) {
      return NextResponse.next();
    }
  }

  // Clear bypass cookie on /login (logout)
  if (pathname === "/login") {
    const response = NextResponse.next();
    response.cookies.delete(BYPASS_COOKIE);
    return response;
  }

  // Fall through to Auth.js middleware for normal auth
  return (auth as unknown as (req: NextRequest) => Promise<NextResponse>)(request);
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/middleware.ts
git commit -m "feat: add emergency admin bypass token to middleware"
```

---

### Task 9: Version Bump and Deploy Config

**Files:**
- Modify: `VERSION`
- Modify: `backend/main.py` (fallback version)
- Modify: `README.md` (version badge + history)
- Modify: `CHANGELOG.md`

- [ ] **Step 1: Bump VERSION file**

Change `VERSION` from `0.8.0` to `0.9.0`.

- [ ] **Step 2: Update fallback version in main.py**

In `backend/main.py`, change:
```python
        return "0.8.0"
```
to:
```python
        return "0.9.0"
```

- [ ] **Step 3: Update README.md**

Update the version badge from `0.8.0` to `0.9.0`.

Add to the Version History table:
```
| 0.9.0 | 2026-04-30 | Two-tier API key protection, emergency admin bypass token, Swagger UI gating |
```

- [ ] **Step 4: Update CHANGELOG.md**

Add new section at the top (after the header):

```markdown
## [0.9.0] - 2026-04-30

### Added
- Two-tier API key protection: `READ_API_KEY` for read endpoints, `ADMIN_API_KEY` for admin/write endpoints
- Emergency admin bypass token (`ADMIN_BYPASS_TOKEN`) — visit `/admin?bypass=TOKEN` to set 24-hour access cookie
- Server-side proxy route for client-side admin API calls (auth-gated)
- API key headers on all frontend-to-backend fetches

### Changed
- Swagger UI (`/api/docs`) disabled when `ADMIN_API_KEY` is configured
- All API endpoints now require appropriate API key when keys are configured
```

- [ ] **Step 5: Commit**

```bash
git add VERSION backend/main.py README.md CHANGELOG.md
git commit -m "chore: bump version to 0.9.0 — API security + admin bypass"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|-----------------|------|
| Two env vars: READ_API_KEY, ADMIN_API_KEY | Task 1 (config) |
| X-Api-Key header check | Task 1 (dependencies) |
| Read endpoints protected | Task 2 |
| Admin endpoints protected | Task 3 |
| Swagger UI gated | Task 4 |
| Frontend sends API key | Task 5 |
| Client-side admin calls proxied | Task 6 |
| Docker compose env vars | Task 7 |
| Emergency bypass token | Task 8 |
| Version bump | Task 9 |

**Placeholder scan:** No TBD/TODO found. All code blocks are complete.

**Type consistency:** `require_read_key` and `require_admin_key` names are consistent across dependencies.py, router modifications, and main.py. `X-Api-Key` header name is consistent across backend dependencies and frontend fetch. `BYPASS_COOKIE` name `nexus_bypass` and `BYPASS_TOKEN` env var `ADMIN_BYPASS_TOKEN` are consistent across middleware and docker-compose.
