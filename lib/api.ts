const BASE_URL = "/api";

export async function apiFetch(
  path: string,
  options: RequestInit = {}
) {
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("token")
      : null;

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });

  let data;
  try {
    data = await res.json();
  } catch {
    data = null;
  }


  console.log("API DEBUG:", {
    url: path,
    status: res.status,
    ok: res.ok,
    response: data,
  });

  if (!res.ok) {
    throw new Error(
      data?.message ||
      data?.error ||
      JSON.stringify(data) ||
      `HTTP ${res.status}`
    );
  }

  return data;
}