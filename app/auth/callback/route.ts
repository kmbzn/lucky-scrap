import { NextResponse } from "next/server";
import { sessionClient } from "@/lib/server";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (code) {
    const client = await sessionClient();
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error)
      return NextResponse.redirect(
        new URL("/", process.env.NEXT_PUBLIC_SITE_URL || url.origin),
      );
  }
  return NextResponse.redirect(
    new URL("/?error=oauth", process.env.NEXT_PUBLIC_SITE_URL || url.origin),
  );
}
