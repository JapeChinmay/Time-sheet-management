let _token: string | null = null;

export function setAccessToken(token: string | null) {
  _token = token;
}

const BASE_URL = "/api";

export async function apiFetch(path: string, options: RequestInit = {}) {
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
