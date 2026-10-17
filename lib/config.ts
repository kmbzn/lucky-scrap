// Supabase publishable keys identify the project; they are intentionally public.
// Authorization remains enforced by Supabase Auth, RLS and server-only mutations.
export const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://dyiustatuxclpmsesoce.supabase.co";
export const supabasePublicKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "sb_publishable_q4M0-skkfoagIW-6XY6s0A_qBr5dr6Y";
