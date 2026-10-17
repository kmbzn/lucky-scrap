import { NextResponse } from "next/server";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { waitForDraw } from "@/lib/draw";
import { assertDiscoveredTrade } from "@/lib/trade-discovery";
import { sessionClient, adminClient } from "@/lib/server";
import { strokesSchema } from "@/lib/handwriting";
export const runtime = "nodejs";
export const maxDuration = 60;
const line = z.object({
  itemId: z.number().int().min(0).max(63),
  quantity: z.number().int().min(1).max(1000000),
});
const schemas = {
  nickname: z.object({
    nickname: z.string().regex(/^[가-힣a-zA-Z0-9_]{2,12}$/),
  }),
  challenge: z.object({}),
  submit: z.object({
    id: z.uuid(),
    strokes: strokesSchema,
  }),
  craft: z.object({
    itemId: z.number().int().min(24).max(63),
    quantity: z.number().int().min(1).max(1000000),
  }),
  offer: z.object({
    give: z.array(line).min(1).max(64),
    want: z.array(line).min(1).max(64),
  }),
  accept: z.object({ id: z.uuid() }),
  cancel: z.object({ id: z.uuid() }),
};
async function authenticated() {
  const db = await sessionClient();
  const {
    data: { user },
    error,
  } = await db.auth.getUser();
  if (error || !user) throw new Error("로그인이 필요합니다");
  return { db, user };
}
export async function GET(request: Request) {
  try {
    const { db, user } = await authenticated();
    const params = new URL(request.url).searchParams;
    const section = params.get("section");
    if (section) {
      const page = z.coerce
        .number()
        .int()
        .min(0)
        .max(1000000)
        .parse(params.get("page") || 0);
      const query =
        section === "offers"
          ? db
              .from("trade_offers")
              .select(
                "*,profiles!trade_offers_owner_id_fkey(nickname),trade_offer_lines(*)",
              )
              .order("created_at", { ascending: false })
              .order("id")
          : null;
      if (!query) throw new Error("잘못된 목록입니다");
      const { data, error } = await query.range(page * 100, page * 100 + 99);
      if (error) throw new Error(error.message);
      return NextResponse.json(
        { rows: data },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    const results = await Promise.all([
      db.from("profiles").select("*").eq("id", user.id).single(),
      db
        .from("inventory_balances")
        .select("item_id,quantity")
        .eq("user_id", user.id),
      db.from("item_discoveries").select("item_id").eq("user_id", user.id),
      db
        .from("trade_offers")
        .select(
          "*,profiles!trade_offers_owner_id_fkey(nickname),trade_offer_lines(*)",
        )
        .order("created_at", { ascending: false })
        .order("id")
        .limit(100),
    ]);
    for (const r of results) if (r.error) throw new Error(r.error.message);
    return NextResponse.json(
      {
        userId: user.id,
        profile: results[0].data,
        inventory: results[1].data,
        discoveries: results[2].data,
        offers: results[3].data,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "불러오기 실패" },
      { status: 401 },
    );
  }
}
export async function POST(req: Request) {
  try {
    if (
      req.headers.get("origin") !==
      new URL(process.env.NEXT_PUBLIC_SITE_URL || req.url).origin
    )
      return NextResponse.json(
        { error: "허용하지 않는 요청입니다" },
        { status: 403 },
      );
    if (Number(req.headers.get("content-length") || 0) > 600000)
      return NextResponse.json(
        { error: "입력이 너무 큽니다" },
        { status: 413 },
      );
    const { db, user } = await authenticated();
    const raw = await req.text();
    if (raw.length > 600000) throw new Error("입력이 너무 큽니다");
    const body = JSON.parse(raw);
    const action = body.action as keyof typeof schemas;
    if (!Object.hasOwn(schemas, action)) throw new Error("잘못된 요청입니다");
    const payload = schemas[action].parse(body.payload);
    const key = z.uuid().parse(body.requestId);
    if (action === "nickname") {
      const { data, error } = await db.rpc("set_nickname", {
        new_nickname: schemas.nickname.parse(payload).nickname,
      });
      if (error)
        throw new Error(
          error.code === "23505"
            ? "이미 사용 중인 닉네임입니다"
            : error.message,
        );
      return NextResponse.json(data);
    }
    if (action === "offer") {
      const offer = schemas.offer.parse(payload);
      const lines = [...offer.give, ...offer.want];
      const ids = [...new Set(lines.map((line) => line.itemId))];
      const { data, error } = await db
        .from("item_discoveries")
        .select("item_id")
        .eq("user_id", user.id)
        .in("item_id", ids);
      if (error) throw new Error("도감 등록 정보를 확인할 수 없습니다");
      assertDiscoveredTrade(
        lines,
        new Set((data || []).map((row) => row.item_id)),
      );
    }
    const admin = adminClient();
    async function mutate(a: string, p: unknown, k = key) {
      const { data, error } = await admin.rpc("game_mutate", {
        actor: user.id,
        action: a,
        payload: p,
        request_id: k,
      });
      if (error)
        throw new Error(
          error.code === "23505"
            ? "이미 사용한 필기 또는 닉네임입니다"
            : error.message,
        );
      return data;
    }
    if (action === "submit") {
      const p = schemas.submit.parse(payload);
      const { data: receipt, error: receiptError } = await admin
        .from("game_requests")
        .select("action,payload,result")
        .eq("user_id", user.id)
        .eq("request_id", key)
        .maybeSingle();
      if (receiptError) throw new Error("이전 요청을 확인할 수 없습니다");
      if (receipt) {
        if (receipt.action !== "draw" || receipt.payload.id !== p.id)
          throw new Error("중복 요청 내용이 다릅니다");
        return NextResponse.json(receipt.result);
      }
      await mutate("claim", { id: p.id }, randomUUID());
      await waitForDraw();
      return NextResponse.json(
        await mutate("draw", { id: p.id, verified: true }, key),
      );
    }
    return NextResponse.json(await mutate(action, payload));
  } catch (e) {
    return NextResponse.json(
      {
        error:
          e instanceof z.ZodError
            ? "입력값을 확인해 주세요"
            : e instanceof Error
              ? e.message
              : "요청 실패",
      },
      { status: 400 },
    );
  }
}
