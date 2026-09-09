type SupabaseRestOptions = RequestInit & {
  prefer?: string;
};

function supabaseRestConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Supabase persistence is not configured.");
  }
  return { url, anonKey };
}

export async function supabaseRestFetch(
  resource: string,
  accessToken: string,
  options: SupabaseRestOptions = {},
) {
  const { url, anonKey } = supabaseRestConfig();
  const headers = new Headers(options.headers);
  headers.set("apikey", anonKey);
  headers.set("Authorization", `Bearer ${accessToken}`);
  headers.set("Accept", "application/json");
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  if (options.prefer) headers.set("Prefer", options.prefer);

  return fetch(`${url}/rest/v1/${resource.replace(/^\/+/, "")}`, {
    ...options,
    headers,
    cache: "no-store",
  });
}

export async function readSupabaseJson<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const data = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
    const message =
      [data.message, data.details, data.hint]
        .find((value): value is string => typeof value === "string" && value.length > 0)
      ?? "Learning data request failed.";
    throw new Error(message);
  }
  return payload as T;
}
