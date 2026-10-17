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
  const key =
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!key)
    throw new Error(
      "서버 설정 필요: Vercel에 SUPABASE_SECRET_KEY를 등록해 주세요",
    );
  return createClient(supabaseUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
