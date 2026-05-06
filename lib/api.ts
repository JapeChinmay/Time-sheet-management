let _token: string | null = null;
let _ready = false;                       // true after first session bootstrap
let _readyPromise: Promise<void> | null = null;

/** Called by TokenSync whenever session changes */
export function setAccessToken(token: string | null) {
  _token = token;
  _ready = true;
}

/** On first call (page refresh), fetch session once to seed the token */
function ensureToken(): Promise<void> {
  if (_ready) return Promise.resolve();
  if (_readyPromise) return _readyPromise;

  _readyPromise = (async () => {
    if (typeof window === "undefined") return;
    try {
      const { getSession } = await import("next-auth/react");
      const session = await getSession();
      _token = (session as any)?.accessToken ?? null;
    } catch { /* ignore */ } finally {
      _ready = true;
    }
  })();

  return _readyPromise;
}

const BASE_URL = "/api";

export async function apiFetch(path: string, options: RequestInit = {}) {
  await ensureToken();

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(_token && { Authorization: `Bearer ${_token}` }),
      ...options.headers,
    },
  });

  let data;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!res.ok) {
    throw new Error(
      data?.message ||
      data?.error   ||
      JSON.stringify(data) ||
      `HTTP ${res.status}`
    );
  }

  return data;
}
