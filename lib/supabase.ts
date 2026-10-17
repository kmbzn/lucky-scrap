import { createBrowserClient } from "@supabase/ssr";
import { supabaseUrl, supabasePublicKey } from "./config";
export const configured = Boolean(supabaseUrl && supabasePublicKey);
export function browserClient() {
  if (!configured) throw new Error("Supabase 설정이 필요합니다");
  return createBrowserClient(supabaseUrl, supabasePublicKey);
}
