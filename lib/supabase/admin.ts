import "server-only";

import { readSupabaseJson } from "@/lib/supabase/rest";

type SupabaseAdminOptions = RequestInit & {
  prefer?: string;
};

function supabaseAdminConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase admin access is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }

  return { url, serviceRoleKey };
}

export function isSupabaseAdminConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

export async function supabaseAdminFetch(
  resource: string,
  options: SupabaseAdminOptions = {},
) {
  const { url, serviceRoleKey } = supabaseAdminConfig();
  const headers = new Headers(options.headers);
  headers.set("apikey", serviceRoleKey);
  headers.set("Authorization", `Bearer ${serviceRoleKey}`);
  headers.set("Accept", "application/json");

  if (options.body !== undefined) {
    headers.set("Content-Type", "application/json");
  }
  if (options.prefer) {
    headers.set("Prefer", options.prefer);
  }

  return fetch(`${url}/rest/v1/${resource.replace(/^\/+/, "")}`, {
    ...options,
    headers,
    cache: "no-store",
  });
}

export async function readSupabaseAdminJson<T>(response: Response): Promise<T> {
  return readSupabaseJson<T>(response);
}
