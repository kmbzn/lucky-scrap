import { supabaseUrl, supabasePublicKey } from "./lib/config";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const client = createServerClient(supabaseUrl, supabasePublicKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        for (const v of values) request.cookies.set(v.name, v.value);
        response = NextResponse.next({ request });
        for (const v of values)
          response.cookies.set(v.name, v.value, v.options);
      },
    },
  });
  await client.auth.getUser();
  return response;
}
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|item-icons).*)",
  ],
};
