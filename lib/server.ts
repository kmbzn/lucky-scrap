import "server-only";
import { supabaseUrl, supabasePublicKey } from "./config";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
export async function sessionClient() {
  const jar = await cookies();
  return createServerClient(supabaseUrl, supabasePublicKey, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll(values) {
        for (const v of values) jar.set(v.name, v.value, v.options);
      },
    },
  });
}
export function adminClient() {
  return createClient(supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
