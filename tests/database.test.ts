import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import pg from "pg";
const url = process.env.TEST_DATABASE_URL;
test(
  "PostgreSQL atomic economy, replay, escrow races, RLS and ranking integration",
  { skip: !url },
  async (t) => {
    const root = new pg.Client({ connectionString: url });
    await root.connect();
    const name = `jogak_test_${Date.now()}`;
    await root.query(`create database ${name}`);
    const parsed = new URL(url!);
    parsed.pathname = `/${name}`;
    const pool = new pg.Pool({ connectionString: parsed.toString(), max: 8 });
    const users = [randomUUID(), randomUUID(), randomUUID()];
    async function mutate(
      actor: string,
      action: string,
      payload: unknown,
      key = randomUUID(),
    ) {
      const r = await pool.query(
        "select public.game_mutate($1,$2,$3::jsonb,$4) as result",
        [actor, action, JSON.stringify(payload), key],
      );
      return r.rows[0].result;
    }
    async function qty(u: string, id: number) {
      return Number(
        (
          await pool.query(
            "select quantity from inventories where user_id=$1 and item_id=$2",
            [u, id],
          )
        ).rows[0]?.quantity || 0,
      );
    }
    async function grant(u: string, id: number, n: number) {
      await pool.query(
        "select inventory_delta($1,$2::smallint,$3::bigint,$4,$5)",
        [u, id, n, "test_fixture", randomUUID()],
      );
    }
    try {
      await pool.query(`do $$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon; end if; if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated; end if; if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role bypassrls; end if; end $$;
 create schema auth;create schema extensions;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema public,auth to authenticated,anon,service_role;create publication supabase_realtime;`);
      await pool.query(
        await readFile("supabase/migrations/202610170001_game.sql", "utf8"),
      );
      await pool.query(
        await readFile("supabase/migrations/202610170002_catalog.sql", "utf8"),
      );
      await pool.query(await readFile("supabase/seed.sql", "utf8"));
      for (let i = 0; i < users.length; i++) {
        await pool.query("insert into auth.users values($1)", [users[i]]);
        await mutate(users[i], "nickname", { nickname: `테스터${i}` });
      }
      await t.test("signup grants no items including secret", async () => {
        assert.equal(
          Number(
            (await pool.query("select count(*) from inventories")).rows[0]
              .count,
          ),
          0,
        );
      });
      await t.test(
        "all 40 recipes consume inputs and produce exact output",
        async () => {
          const data = JSON.parse(await readFile("lib/items.json", "utf8"));
          for (const item of data.filter((i: { id: number }) => i.id >= 24)) {
            for (const [id, n] of Object.entries(item.recipe))
              await grant(users[0], Number(id), Number(n));
            const before = await qty(users[0], item.id);
            const inputs = await Promise.all(
              Object.keys(item.recipe).map(async (id) => [
                Number(id),
                await qty(users[0], Number(id)),
              ]),
            );
            await mutate(users[0], "craft", { itemId: item.id, quantity: 1 });
            assert.equal(await qty(users[0], item.id), before + 1);
            for (const [id, n] of inputs)
              assert.equal(await qty(users[0], id), n - item.recipe[id]);
          }
        },
      );
      await t.test(
        "insufficient ingredients rollback; crafting cannot generate secret/natural",
        async () => {
          const before = await qty(users[2], 24);
          await assert.rejects(
            mutate(users[2], "craft", { itemId: 24, quantity: 1 }),
            /부족/,
          );
          assert.equal(await qty(users[2], 24), before);
          for (const id of [0, 1, 23])
            await assert.rejects(
              mutate(users[0], "craft", { itemId: id, quantity: 1 }),
              /잘못된/,
            );
          await assert.rejects(
            mutate(users[0], "craft", { itemId: 24, quantity: -1 }),
          );
        },
      );
      await t.test(
        "same key retries exactly once; mismatched payload rejected",
        async () => {
          await grant(users[0], 5, 4);
          const before = await qty(users[0], 24);
          const key = randomUUID();
          await mutate(users[0], "craft", { itemId: 24, quantity: 1 }, key);
          await mutate(users[0], "craft", { itemId: 24, quantity: 1 }, key);
          assert.equal(await qty(users[0], 24), before + 1);
          await assert.rejects(
            mutate(users[0], "craft", { itemId: 24, quantity: 2 }, key),
            /다릅니다/,
          );
        },
      );
      await t.test(
        "failed, expired and replayed challenges never issue items",
        async () => {
          let c = await mutate(users[1], "challenge", {});
          await mutate(users[1], "claim", { id: c.id, hash: randomUUID() });
          const r = await mutate(users[1], "draw", {
            id: c.id,
            verified: false,
          });
          assert.equal(r.verified, false);
          assert.equal(
            Number(
              (await pool.query("select count(*) from draw_events")).rows[0]
                .count,
            ),
            0,
          );
          await assert.rejects(
            mutate(users[1], "claim", { id: c.id, hash: randomUUID() }),
          );
          c = await mutate(users[1], "challenge", {});
          await pool.query(
            "update draw_challenges set expires_at=now()-interval '1 second' where id=$1",
            [c.id],
          );
          await assert.rejects(
            mutate(users[1], "claim", { id: c.id, hash: randomUUID() }),
          );
        },
      );
      await t.test(
        "simultaneous challenge submission grants exactly one natural item",
        async () => {
          const c = await mutate(users[1], "challenge", {});
          const claims = await Promise.allSettled([
            mutate(users[1], "claim", {
              id: c.id,
              hash: "same-rendered-image",
            }),
            mutate(users[1], "claim", {
              id: c.id,
              hash: "same-rendered-image",
            }),
          ]);
          assert.equal(
            claims.filter((r) => r.status === "fulfilled").length,
            1,
          );
          const results = await Promise.allSettled([
            mutate(users[1], "draw", { id: c.id, verified: true }),
            mutate(users[1], "draw", { id: c.id, verified: true }),
          ]);
          assert.equal(
            results.filter((r) => r.status === "fulfilled").length,
            1,
          );
          const event = (
            await pool.query(
              "select * from draw_events where challenge_id=$1",
              [c.id],
            )
          ).rows;
          assert.equal(event.length, 1);
          assert.ok(event[0].item_id >= 1 && event[0].item_id <= 23);
          const c2 = await mutate(users[1], "challenge", {});
          await assert.rejects(
            mutate(users[1], "claim", {
              id: c2.id,
              hash: "same-rendered-image",
            }),
            /unique/,
          );
        },
      );
      await t.test(
        "escrow immediately removed; two acceptors yield one winner and conserve stocks",
        async () => {
          await grant(users[0], 1, 20);
          await grant(users[1], 2, 20);
          await grant(users[2], 2, 20);
          const before = await qty(users[0], 1);
          const wanted = await qty(users[0], 2);
          const offer = await mutate(users[0], "offer", {
            give: [{ itemId: 1, quantity: 10 }],
            want: [{ itemId: 2, quantity: 5 }],
          });
          assert.equal(await qty(users[0], 1), before - 10);
          await assert.rejects(
            mutate(users[0], "accept", { id: offer.id }),
            /본인/,
          );
          const results = await Promise.allSettled([
            mutate(users[1], "accept", { id: offer.id }),
            mutate(users[2], "accept", { id: offer.id }),
          ]);
          assert.equal(
            results.filter((r) => r.status === "fulfilled").length,
            1,
          );
          assert.equal(await qty(users[0], 2), wanted + 5);
          await assert.rejects(
            mutate(users[1], "accept", { id: offer.id }),
            /종료/,
          );
        },
      );
      await t.test(
        "cancel/accept race conserves inventory; unauthorized cancel rejected",
        async () => {
          const before = await qty(users[0], 1);
          const totalBefore = Number(
            (
              await pool.query(
                "select sum(quantity) from inventories where item_id=1",
              )
            ).rows[0].sum,
          );
          const offer = await mutate(users[0], "offer", {
            give: [{ itemId: 1, quantity: 3 }],
            want: [{ itemId: 2, quantity: 2 }],
          });
          await assert.rejects(
            mutate(users[2], "cancel", { id: offer.id }),
            /본인/,
          );
          const race = await Promise.allSettled([
            mutate(users[0], "cancel", { id: offer.id }),
            mutate(users[2], "accept", { id: offer.id }),
          ]);
          assert.equal(race.filter((r) => r.status === "fulfilled").length, 1);
          assert.equal(
            Number(
              (
                await pool.query(
                  "select sum(quantity) from inventories where item_id=1",
                )
              ).rows[0].sum,
            ),
            totalBefore,
          );
          const status = (
            await pool.query("select status from trade_offers where id=$1", [
              offer.id,
            ])
          ).rows[0].status;
          assert.equal(
            await qty(users[0], 1),
            status === "cancelled" ? before : before - 3,
          );
        },
      );
      await t.test(
        "insufficient acceptor and duplicate/negative offer rollback escrow",
        async () => {
          const before = await qty(users[0], 1);
          await assert.rejects(
            mutate(users[0], "offer", {
              give: [
                { itemId: 1, quantity: 1 },
                { itemId: 1, quantity: 1 },
              ],
              want: [{ itemId: 2, quantity: 1 }],
            }),
          );
          assert.equal(await qty(users[0], 1), before);
          await assert.rejects(
            mutate(users[0], "offer", {
              give: [{ itemId: 1, quantity: -1 }],
              want: [{ itemId: 2, quantity: 1 }],
            }),
          );
          assert.equal(await qty(users[0], 1), before);
          const offer = await mutate(users[0], "offer", {
            give: [{ itemId: 1, quantity: 1 }],
            want: [{ itemId: 23, quantity: 1000000 }],
          });
          await assert.rejects(
            mutate(users[1], "accept", { id: offer.id }),
            /부족/,
          );
          await mutate(users[0], "cancel", { id: offer.id });
          assert.equal(await qty(users[0], 1), before);
        },
      );
      await t.test(
        "discovery persists after spending; trophy ranking changes with escrow and refund",
        async () => {
          const before = Number(
            (
              await pool.query("select trophies from rankings where id=$1", [
                users[0],
              ])
            ).rows[0].trophies,
          );
          assert.ok(before > 0);
          const o = await mutate(users[0], "offer", {
            give: [{ itemId: 63, quantity: 1 }],
            want: [{ itemId: 1, quantity: 1 }],
          });
          assert.equal(
            Number(
              (
                await pool.query("select trophies from rankings where id=$1", [
                  users[0],
                ])
              ).rows[0].trophies,
            ),
            before - 1,
          );
          assert.equal(
            (
              await pool.query(
                "select 1 from item_discoveries where user_id=$1 and item_id=63",
                [users[0]],
              )
            ).rowCount,
            1,
          );
          await mutate(users[0], "cancel", { id: o.id });
          assert.equal(
            Number(
              (
                await pool.query("select trophies from rankings where id=$1", [
                  users[0],
                ])
              ).rows[0].trophies,
            ),
            before,
          );
        },
      );
      await t.test(
        "authenticated role cannot mint, mutate, call trusted RPC, or read others inventory",
        async () => {
          const client = await pool.connect();
          try {
            await client.query("set role authenticated");
            await client.query(
              "select set_config('request.jwt.claim.sub',$1,false)",
              [users[1]],
            );
            assert.equal(
              (
                await client.query(
                  "select * from inventories where user_id=$1",
                  [users[0]],
                )
              ).rowCount,
              0,
            );
            await assert.rejects(
              client.query(
                "update inventories set quantity=999 where user_id=$1",
                [users[0]],
              ),
              /permission denied/,
            );
            await assert.rejects(
              client.query("insert into inventories values($1,63,999)", [
                users[1],
              ]),
              /permission denied/,
            );
            await assert.rejects(
              client.query("select game_mutate($1,$2,$3,$4)", [
                users[0],
                "craft",
                '{"itemId":63,"quantity":1}',
                randomUUID(),
              ]),
              /permission denied/,
            );
            assert.ok(
              (await client.query("select * from rankings")).rowCount! > 0,
            );
          } finally {
            await client.query("reset role");
            client.release();
          }
        },
      );
    } finally {
      await pool.end();
      await root.query(`drop database ${name} with (force)`);
      await root.end();
    }
  },
);
