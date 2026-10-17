"use client";
/* eslint-disable @next/next/no-img-element */
import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Flower2,
  Hammer,
  Leaf,
  LogOut,
  Package,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShoppingBasket,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { items, icon, maxCraft } from "@/lib/items";
import { itemName, matchesItem } from "@/lib/discovery";
import { itemDescriptions } from "@/lib/item-descriptions";
import { browserClient, configured } from "@/lib/supabase";
import WritingBoard, {
  type WritingBoardHandle,
} from "@/components/WritingBoard";
type Tab = "뽑기" | "조합" | "장터" | "도감" | "내정보";
type Line = { itemId: number; quantity: number };
type Offer = {
  id: string;
  owner_id: string;
  acceptor_id: string | null;
  status: string;
  created_at: string;
  profiles: { nickname: string };
  trade_offer_lines: { side: string; item_id: number; quantity: number }[];
};
type State = {
  userId: string;
  profile: { nickname: string | null };
  inventory: { item_id: number; quantity: string }[];
  discoveries: { item_id: number }[];
  offers: Offer[];
};
const tabs = [
  { name: "뽑기" as Tab, Icon: Flower2 },
  { name: "조합" as Tab, Icon: Hammer },
  { name: "장터" as Tab, Icon: ShoppingBasket },
  { name: "도감" as Tab, Icon: BookOpen },
  { name: "내정보" as Tab, Icon: UserRound },
];
const DiscoveryContext = createContext<ReadonlySet<number>>(new Set());
function Art({
  id,
  size = 48,
  reveal = false,
}: {
  id: number;
  size?: number;
  reveal?: boolean;
}) {
  const discovered = useContext(DiscoveryContext);
  if (!reveal && !discovered.has(id))
    return (
      <span
        className="item-art unknown-item"
        role="img"
        aria-label="???"
        style={{ width: size, height: size }}
      >
        ???
      </span>
    );
  return (
    <img
      className="item-art"
      src={icon(id)}
      width={size}
      height={size}
      alt={items[id].name}
      draggable={false}
    />
  );
}
export default function Game() {
  const [tab, setTab] = useState<Tab>("뽑기"),
    [state, setState] = useState<State | null>(null),
    [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [search, setSearch] = useState(""),
    [filter, setFilter] = useState("전체"),
    [detail, setDetail] = useState<number | null>(null),
    [nickname, setNickname] = useState(""),
    [challenge, setChallenge] = useState<{
      id: string;
      letter: string;
      expires_at: string;
    } | null>(null),
    [reward, setReward] = useState<number | null>(null),
    [writing, setWriting] = useState(false),
    [drawing, setDrawing] = useState(false),
    [showOffer, setShowOffer] = useState(false),
    [give, setGive] = useState<Line[]>([]),
    [want, setWant] = useState<Line[]>([]),
    [offerItem, setOfferItem] = useState(1),
    [offerQty, setOfferQty] = useState(1),
    [offerSide, setOfferSide] = useState("give");
  const pendingRequests = useRef(new Map<string, string>());
  const board = useRef<WritingBoardHandle>(null);
  const inventory = Object.fromEntries(
    (state?.inventory || []).map((r) => [r.item_id, Number(r.quantity)]),
  );
  const amount = (id: number) =>
    BigInt(
      state?.inventory.find((r) => r.item_id === id)?.quantity || "0",
    ).toLocaleString("ko-KR");
  const discovered = new Set(state?.discoveries.map((r) => r.item_id) || []),
    collection = [...discovered].filter((i) => i > 0).length;
  const visibleItems =
    tab === "뽑기" ? new Set(items.map((item) => item.id)) : discovered;
  const name = (id: number) => itemName(id, visibleItems);
  const tradeItems = items.filter(
    (item) =>
      discovered.has(item.id) &&
      (offerSide === "want" || (inventory[item.id] || 0) > 0),
  );
  const selectedOfferItem = tradeItems.some((item) => item.id === offerItem)
    ? offerItem
    : (tradeItems[0]?.id ?? null);
  const offerAffordable = give.every(
    (line) => (inventory[line.itemId] || 0) >= line.quantity,
  );
  const refresh = useCallback(async () => {
    if (!configured) return;
    try {
      const res = await fetch("/api/game", { cache: "no-store" });
      const data = await res.json();
      if (res.ok) setState(data);
      else setNotice(data.error || "게임 데이터를 불러올 수 없어요");
    } catch {
      setNotice("연결이 끊겼어요. 잠시 후 다시 시도해 주세요");
    }
  }, []);
  useEffect(() => {
    if (!configured) return;
    const client = browserClient();
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setState(null);
        if (new URLSearchParams(location.search).has("error")) {
          setNotice(
            "카카오 로그인에 실패했습니다. 카카오 설정을 확인하고 다시 시도해 주세요",
          );
          history.replaceState(null, "", location.pathname);
        }
      } else setTimeout(() => void refresh(), 0);
    });
    const channel = client
      .channel("game")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trade_offers" },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inventories" },
        () => void refresh(),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "item_discoveries" },
        () => void refresh(),
      )
      .subscribe();
    return () => {
      subscription.unsubscribe();
      void client.removeChannel(channel);
    };
  }, [refresh]);
  useEffect(() => {
    if (notice) {
      const t = setTimeout(() => setNotice(""), 7000);
      return () => clearTimeout(t);
    }
  }, [notice]);
  const scrollLocked = writing || drawing;
  useEffect(() => {
    if (!scrollLocked) return;
    const body = document.body,
      html = document.documentElement;
    const y = window.scrollY,
      x = window.scrollX;
    const old = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      width: body.style.width,
      overflow: body.style.overflow,
      overscroll: html.style.overscrollBehavior,
    };
    body.style.position = "fixed";
    body.style.top = `-${y}px`;
    body.style.left = `-${x}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";
    html.style.overscrollBehavior = "none";
    return () => {
      body.style.position = old.position;
      body.style.top = old.top;
      body.style.left = old.left;
      body.style.width = old.width;
      body.style.overflow = old.overflow;
      html.style.overscrollBehavior = old.overscroll;
      window.scrollTo(x, y);
    };
  }, [scrollLocked]);
  async function api(action: string, payload: unknown) {
    const fingerprint = JSON.stringify({ action, payload });
    const requestId =
      pendingRequests.current.get(fingerprint) || crypto.randomUUID();
    pendingRequests.current.set(fingerprint, requestId);
    const res = await fetch("/api/game", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, payload, requestId }),
    });
    const result = await res.json();
    pendingRequests.current.delete(fingerprint);
    if (!res.ok) throw new Error(result.error);
    return result;
  }
  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "다시 시도해 주세요");
    } finally {
      setBusy(false);
    }
  }
  async function loadMore(section: "offers") {
    if (!state) return;
    await run(async () => {
      const page = Math.floor(state[section].length / 100);
      const res = await fetch(`/api/game?section=${section}&page=${page}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      if (!data.rows.length) {
        setNotice("마지막 목록이에요");
        return;
      }
      setState((prev) => {
        if (!prev) return prev;
        const known = new Set(prev[section].map((r) => r.id));
        return {
          ...prev,
          [section]: [
            ...prev[section],
            ...data.rows.filter((r: { id: string }) => !known.has(r.id)),
          ],
        };
      });
    });
  }
  async function login() {
    await run(async () => {
      if (!configured)
        throw new Error(
          "카카오 로그인 설정 필요 · README의 Supabase 설정을 완료해 주세요",
        );
      const { error } = await browserClient().auth.signInWithOAuth({
        provider: "kakao",
        options: {
          redirectTo: `${location.origin}/auth/callback`,
          // Supabase Kakao appends `scopes`; singular `scope` overrides its defaults.
          queryParams: { scope: "profile_nickname" },
        },
      });
      if (error) throw error;
    });
  }
  function requireUser() {
    if (!state) {
      setNotice("카카오 로그인 후 이용할 수 있어요");
      return false;
    }
    return true;
  }
  async function newChallenge() {
    if (!requireUser()) return;
    await run(async () => {
      setChallenge(await api("challenge", {}));
      setReward(null);
      setWriting(true);
    });
  }
  function clearCanvas() {
    board.current?.clear();
  }
  async function submit() {
    if (!challenge || !board.current || busy || drawing) return;
    const strokes = board.current.getStrokes();
    if (!strokes.length) {
      setNotice("글자를 먼저 써 주세요");
      return;
    }
    await run(async () => {
      setDrawing(true);
      try {
        const result = await api("submit", {
          id: challenge.id,
          strokes,
        });
        setChallenge(null);
        setWriting(false);
        if (result.verified) {
          setReward(result.itemId);
          await refresh();
        }
      } finally {
        setDrawing(false);
      }
    });
  }
  async function craft(id: number, quantity: number) {
    if (!requireUser()) return;
    await run(async () => {
      await api("craft", { itemId: id, quantity });
      setState((current) =>
        current && !current.discoveries.some((item) => item.item_id === id)
          ? {
              ...current,
              discoveries: [...current.discoveries, { item_id: id }],
            }
          : current,
      );
      await refresh();
      setNotice(`${items[id].name} ${quantity}개를 만들었어요!`);
    });
  }
  const displayed = items.filter(
    (i) =>
      matchesItem(i.id, search, discovered) &&
      (tab === "조합" ? i.id >= 24 : true) &&
      (filter === "자연물"
        ? i.kind === "natural"
        : filter === "제작품"
          ? i.kind === "crafted"
          : filter === "보유 중"
            ? (inventory[i.id] || 0) > 0
            : filter === "제작 가능"
              ? i.id >= 24 && maxCraft(i.id, inventory) > 0
              : true),
  );
  function changeTab(t: Tab) {
    setTab(t);
    setDetail(null);
    setSearch("");
    setFilter("전체");
  }
  return (
    <DiscoveryContext.Provider value={visibleItems}>
      <main className="phone">
        <header className="header">
          <button className="brand" onClick={() => changeTab("뽑기")}>
            <span className="brand-mark">
              <Art id={2} size={27} reveal />
            </span>
            <span>Lucky Scrap</span>
          </button>
        </header>
        <div className="content">
          {tab === "뽑기" && (
            <>
              <h1>수집 · 조합 · 교환</h1>
              <section className="island" aria-label="자연물 아이템">
                <span className="pixel-sun" />
                <span className="cloud cloud-one" />
                <span className="cloud cloud-two" />
                <div className="land land-back" />
                <div className="land land-front" />
                <div className="sprout sprout-one">✦</div>
                <div className="sprout sprout-two">✦</div>
                <div className="scene-art scene-branch">
                  <Art id={1} size={104} />
                </div>
                <div className="scene-art scene-leaf">
                  <Art id={2} size={72} />
                </div>
                <div className="scene-art scene-stone">
                  <Art id={9} size={73} />
                </div>
                <div className="scene-art scene-shell">
                  <Art id={12} size={65} />
                </div>
                <div className="scene-art scene-gem">
                  <Art id={22} size={54} />
                </div>
              </section>
              {!state ? (
                <>
                  <button
                    className="kakao"
                    disabled={busy}
                    onClick={() => void login()}
                  >
                    <span className="kakao-bubble" />
                    카카오로 시작하기
                    <ArrowRight size={18} />
                  </button>
                </>
              ) : (
                <section className="draw-card">
                  <div className="row">
                    <div>
                      <span className="eyebrow">뽑기</span>
                      <h2>자연물 뽑기</h2>
                    </div>
                    <span className="badge">횟수 제한 없음</span>
                  </div>
                  <p>제시된 한글 한 글자를 쓰면 아이템 하나를 얻어요.</p>
                  <button
                    className="primary"
                    disabled={busy}
                    onClick={() => void newChallenge()}
                  >
                    <Sparkles size={18} />한 글자 쓰고 뽑기
                  </button>
                </section>
              )}
              <div className="section-title">
                <h2>아이템</h2>
                <button onClick={() => changeTab("도감")}>
                  도감 보기 <ArrowRight size={13} />
                </button>
              </div>
              <div className="specimen-row">
                {[1, 2, 3, 4, 5].map((id) => (
                  <button key={id} onClick={() => setDetail(id)}>
                    <Art id={id} />
                    <small>{name(id)}</small>
                  </button>
                ))}
              </div>
            </>
          )}
          {tab !== "뽑기" && (
            <>
              <div className="page-title">
                <div>
                  <h1>
                    {tab === "조합"
                      ? "조합"
                      : tab === "장터"
                        ? "장터"
                        : tab === "도감"
                          ? "도감"
                          : "내정보"}
                  </h1>
                </div>
                {tab === "조합" ? (
                  <Hammer size={28} />
                ) : tab === "장터" ? (
                  <ShoppingBasket size={28} />
                ) : tab === "도감" ? (
                  <BookOpen size={28} />
                ) : (
                  <UserRound size={28} />
                )}
              </div>
              {(tab === "도감" || tab === "조합") && (
                <>
                  <p className="subtext">
                    {tab === "도감"
                      ? "획득 기록은 아이템을 사용한 뒤에도 유지됩니다."
                      : "??? 아이템도 재료가 충분하면 제작할 수 있어요. 제작하면 이름과 모습이 공개돼요."}
                  </p>
                  {tab === "도감" && (
                    <section className="collection-card">
                      <div className="row">
                        <span>공식 도감 완성도</span>
                        <strong>
                          {collection}
                          <small> / 63</small>
                        </strong>
                      </div>
                      <div className="progress">
                        <i style={{ width: `${(collection / 63) * 100}%` }} />
                      </div>
                      <small>
                        {((collection / 63) * 100).toFixed(1)}%의 발견 · 비밀
                        아이템 제외
                      </small>
                    </section>
                  )}
                  <label className="search">
                    <Search size={17} />
                    <input
                      placeholder="어떤 아이템을 찾으세요?"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                  <div className="chips">
                    {(tab === "조합"
                      ? ["전체", "제작 가능"]
                      : ["전체", "자연물", "제작품", "보유 중"]
                    ).map((t) => (
                      <button
                        className={filter === t ? "selected" : ""}
                        onClick={() => setFilter(t)}
                        key={t}
                      >
                        {t}
                      </button>
                    ))}
                    <span>{displayed.length}종</span>
                  </div>
                  {tab === "도감" ? (
                    <div className="codex">
                      {displayed.map((i) => (
                        <button
                          className={`codex-cell ${discovered.has(i.id) ? "found" : ""}`}
                          key={i.id}
                          onClick={() => setDetail(i.id)}
                          aria-label={`${name(i.id)}, ${discovered.has(i.id) ? "획득" : "미발견"}`}
                        >
                          <small>{String(i.id).padStart(3, "0")}</small>
                          <Art id={i.id} size={38} />
                          <span>{name(i.id)}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="recipe-list">
                      {displayed.map((i) => (
                        <article className="recipe-card" key={i.id}>
                          <button
                            className="recipe-head"
                            onClick={() => setDetail(i.id)}
                          >
                            <Art id={i.id} />
                            <div>
                              <small>#{String(i.id).padStart(3, "0")}</small>
                              <h3>{name(i.id)}</h3>
                            </div>
                            <span className="owned">보유 {amount(i.id)}</span>
                          </button>
                          <div className="ingredients">
                            {Object.entries(i.recipe).map(([key, n]) => (
                              <div key={key}>
                                <Art id={Number(key)} size={26} />
                                <span>{name(Number(key))}</span>
                                <strong
                                  className={
                                    (inventory[key] || 0) < n ? "short" : ""
                                  }
                                >
                                  {amount(Number(key))}/{n}
                                </strong>
                              </div>
                            ))}
                          </div>
                          <div className="craft-actions">
                            <button
                              disabled={busy || !state}
                              onClick={() => void craft(i.id, 1)}
                            >
                              1개 제작
                            </button>
                            <button
                              disabled={busy || !state}
                              onClick={() =>
                                void craft(
                                  i.id,
                                  Math.max(
                                    1,
                                    Math.min(
                                      1000000,
                                      maxCraft(i.id, inventory),
                                    ),
                                  ),
                                )
                              }
                            >
                              가능한 만큼 제작
                            </button>
                          </div>
                        </article>
                      ))}
                      {!displayed.length && (
                        <div className="empty">
                          아직 제작 가능한 아이템이 없어요.
                          <br />
                          자연물을 조금 더 모아 보세요.
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
              {tab === "장터" && (
                <>
                  <p className="subtext">누구에게나 열려 있는 물물교환 장터</p>
                  <button
                    className="primary"
                    onClick={() => {
                      if (requireUser()) setShowOffer(true);
                    }}
                  >
                    <Plus size={18} />새 교환 등록
                  </button>
                  <label className="search">
                    <Search size={17} />
                    <input
                      placeholder="교환할 아이템 검색"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                  <div className="chips">
                    {["전체", "내 거래", "거래 기록"].map((f) => (
                      <button
                        key={f}
                        className={filter === f ? "selected" : ""}
                        onClick={() => setFilter(f)}
                      >
                        {f}
                      </button>
                    ))}
                    <span className="realtime">
                      <i />
                      실시간
                    </span>
                  </div>
                  {(state?.offers || [])
                    .filter(
                      (o) =>
                        (filter === "내 거래"
                          ? o.owner_id === state?.userId
                          : filter === "거래 기록"
                            ? o.status !== "open" &&
                              (o.owner_id === state?.userId ||
                                o.acceptor_id === state?.userId)
                            : o.status === "open") &&
                        o.trade_offer_lines.some((l) =>
                          matchesItem(l.item_id, search, discovered),
                        ),
                    )
                    .map((o) => (
                      <article className="trade-card" key={o.id}>
                        <div className="row">
                          <strong>{o.profiles?.nickname || "수집가"}</strong>
                          <small>
                            {new Date(o.created_at).toLocaleDateString("ko-KR")}
                          </small>
                        </div>
                        <div className="trade-sides">
                          {["give", "want"].map((side) => (
                            <div key={side}>
                              <small>
                                {side === "give" ? "드려요" : "받고 싶어요"}
                              </small>
                              {o.trade_offer_lines
                                .filter((l) => l.side === side)
                                .map((l) => (
                                  <div className="trade-line" key={l.item_id}>
                                    <Art id={l.item_id} size={30} />
                                    <span>
                                      {name(l.item_id)}
                                      <strong> ×{l.quantity}</strong>
                                    </span>
                                  </div>
                                ))}
                            </div>
                          ))}
                        </div>
                        {o.status === "open" ? (
                          <button
                            className="primary"
                            disabled={busy}
                            onClick={() =>
                              void run(async () => {
                                await api(
                                  o.owner_id === state?.userId
                                    ? "cancel"
                                    : "accept",
                                  { id: o.id },
                                );
                                await refresh();
                                setNotice(
                                  o.owner_id === state?.userId
                                    ? "거래를 취소하고 아이템을 돌려받았어요"
                                    : "교환이 완료되었어요!",
                                );
                              })
                            }
                          >
                            {o.owner_id === state?.userId
                              ? "등록 취소 · 재료 돌려받기"
                              : "이 조건으로 교환하기"}
                          </button>
                        ) : (
                          <span className="badge">
                            {o.status === "completed" ? "교환 완료" : "취소됨"}
                          </span>
                        )}
                      </article>
                    ))}
                  {!state?.offers?.some((o) =>
                    filter === "내 거래"
                      ? o.owner_id === state.userId
                      : filter === "거래 기록"
                        ? o.status !== "open" &&
                          (o.owner_id === state.userId ||
                            o.acceptor_id === state.userId)
                        : o.status === "open",
                  ) && (
                    <div className="empty">
                      <ShoppingBasket size={40} />
                      <h3>
                        {state
                          ? "아직 등록된 교환이 없어요"
                          : "로그인하고 장터를 만나 보세요"}
                      </h3>
                      <p>
                        내게 남는 조각이 누군가에게는
                        <br />꼭 필요한 발견일 수 있어요.
                      </p>
                    </div>
                  )}
                </>
              )}
              {tab === "내정보" &&
                (state ? (
                  <>
                    <section className="profile-card">
                      <div className="avatar">
                        <Leaf size={30} />
                      </div>
                      <h2>{state.profile.nickname}</h2>
                      <div className="profile-stats">
                        <div>
                          <strong>{amount(63)}</strong>
                          <small>{name(63)}</small>
                        </div>
                        <div>
                          <strong>
                            {collection}
                            <em>/63</em>
                          </strong>
                          <small>발견한 아이템</small>
                        </div>
                      </div>
                    </section>
                    <div className="section-title">
                      <h2>내 인벤토리</h2>
                      <Package size={18} />
                    </div>
                    <div className="chips">
                      {["전체", "자연물", "제작품"].map((f) => (
                        <button
                          key={f}
                          onClick={() => setFilter(f)}
                          className={filter === f ? "selected" : ""}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                    <div className="inventory-grid">
                      {items
                        .filter(
                          (i) =>
                            (inventory[i.id] || 0) > 0 &&
                            (filter === "자연물"
                              ? i.kind === "natural"
                              : filter === "제작품"
                                ? i.kind === "crafted"
                                : true),
                        )
                        .map((i) => (
                          <button key={i.id} onClick={() => setDetail(i.id)}>
                            <small>#{String(i.id).padStart(3, "0")}</small>
                            <Art id={i.id} />
                            <b>{name(i.id)}</b>
                            <span>× {amount(i.id)}</span>
                          </button>
                        ))}
                    </div>
                    {!Object.values(inventory).some((n) => n > 0) && (
                      <div className="empty">
                        아직 인벤토리가 비어 있어요.
                        <br />첫 번째 자연물을 발견해 보세요.
                      </div>
                    )}
                    <button
                      className="menu-row"
                      onClick={() => {
                        setTab("장터");
                        setTimeout(() => setFilter("거래 기록"), 0);
                      }}
                    >
                      내 거래 기록 <ChevronRight size={18} />
                    </button>
                    <button
                      className="logout"
                      onClick={() =>
                        void run(async () => {
                          const { error } =
                            await browserClient().auth.signOut();
                          if (error) throw error;
                          setState(null);
                          changeTab("뽑기");
                        })
                      }
                    >
                      <LogOut size={16} />
                      로그아웃
                    </button>
                  </>
                ) : (
                  <div className="empty">
                    <UserRound size={40} />
                    <h2>Lucky Scrap 로그인</h2>
                    <p>카카오 로그인으로 수집 기록을 안전하게 보관해요.</p>
                    <button className="kakao" onClick={() => void login()}>
                      카카오로 시작하기 <ArrowRight size={18} />
                    </button>
                  </div>
                ))}
            </>
          )}
          {tab === "장터" && state && state.offers.length >= 100 && (
            <button
              className="load-more"
              disabled={busy}
              onClick={() => void loadMore("offers")}
            >
              이전 거래 더 불러오기 <ChevronRight size={16} />
            </button>
          )}
        </div>
        <nav className="bottom-nav" aria-label="주요 메뉴">
          {tabs.map(({ name, Icon }) => (
            <button
              key={name}
              onClick={() => changeTab(name)}
              className={tab === name ? "active" : ""}
            >
              <span>
                <Icon size={21} strokeWidth={tab === name ? 2.2 : 1.7} />
              </span>
              {name}
              {tab === name && <i />}
            </button>
          ))}
        </nav>
        {notice && (
          <div role="status" className="toast">
            <span>{notice}</span>
            <button onClick={() => setNotice("")} aria-label="알림 닫기">
              <X size={16} />
            </button>
          </div>
        )}
        {state && !state.profile.nickname && (
          <div className="overlay">
            <section className="modal">
              <Leaf size={32} />
              <h2>닉네임을 설정해 주세요</h2>
              <p>한글, 영문, 숫자, 밑줄 2~12자</p>
              <input
                className="text-input"
                value={nickname}
                maxLength={12}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="닉네임"
              />
              <button
                className="primary"
                disabled={busy || !/^[가-힣a-zA-Z0-9_]{2,12}$/.test(nickname)}
                onClick={() =>
                  void run(async () => {
                    await api("nickname", { nickname });
                    await refresh();
                  })
                }
              >
                시작하기 <ArrowRight size={18} />
              </button>
            </section>
          </div>
        )}
        {writing && challenge && !drawing && (
          <div className="overlay">
            <section className="modal writing-modal">
              <button
                className="close"
                onClick={() => {
                  if (!busy) {
                    setWriting(false);
                    setChallenge(null);
                  }
                }}
                aria-label="닫기"
              >
                <X />
              </button>
              <h2>
                <em>‘{challenge.letter}’</em>
                {(challenge.letter.charCodeAt(0) - 0xac00) % 28 === 0
                  ? "를"
                  : "을"}{" "}
                써 주세요
              </h2>
              <p>아래 칸에 손가락으로 글자를 써 주세요.</p>
              <WritingBoard ref={board} letter={challenge.letter} />
              <div className="canvas-toolbar">
                <button onClick={clearCanvas} disabled={busy}>
                  <Trash2 size={16} />
                  지우기
                </button>
              </div>
              <button
                className="primary"
                disabled={busy}
                onClick={() => void submit()}
              >
                글자 제출하고 뽑기
                <Check size={18} />
              </button>
            </section>
          </div>
        )}
        {drawing && (
          <div className="overlay">
            <section
              className="modal draw-wait"
              role="status"
              aria-live="polite"
            >
              <div className="draw-spinner">
                <RefreshCw size={50} />
              </div>
              <h2>아이템을 뽑고 있어요...</h2>
              <div className="draw-progress">
                <span />
              </div>
            </section>
          </div>
        )}
        {reward !== null && !drawing && (
          <div className="overlay">
            <section className="modal reward">
              <h2>아이템 획득</h2>
              <div className="reward-art">
                <Art id={reward} size={126} reveal />
              </div>
              <span className="badge">
                자연물 · #{String(reward).padStart(3, "0")}
              </span>
              <h2>{items[reward].name} ×1</h2>
              <p>인벤토리에 담고 도감에 기록했어요.</p>
              <button
                className="primary"
                disabled={busy}
                onClick={() => void newChallenge()}
              >
                한 번 더 발견하기 <RefreshCw size={17} />
              </button>
              <button className="plain" onClick={() => setReward(null)}>
                돌아가기
              </button>
            </section>
          </div>
        )}
        {detail !== null && (
          <div className="overlay" onClick={() => setDetail(null)}>
            <section
              className="modal item-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="close"
                aria-label="닫기"
                onClick={() => setDetail(null)}
              >
                <X />
              </button>
              <span className="eyebrow">
                ITEM #{String(detail).padStart(3, "0")}
              </span>
              <div className="detail-art">
                <Art id={detail} size={108} />
              </div>
              <h2>{name(detail)}</h2>
              <p>
                {visibleItems.has(detail)
                  ? itemDescriptions[detail]
                  : "아직 획득하지 않은 아이템입니다."}
              </p>
              {visibleItems.has(detail) && detail > 0 && detail < 24 && (
                <div className="row">
                  <span>뽑기 확률</span>
                  <strong>{items[detail].weight / 10}%</strong>
                </div>
              )}
              <div className="row">
                <span>현재 보유</span>
                <strong>{amount(detail)}개</strong>
              </div>
              <div className="row">
                <span>도감 기록</span>
                <span>
                  {discovered.has(detail)
                    ? "발견 완료"
                    : "아직 발견하지 못했어요"}
                </span>
              </div>
              {detail >= 24 && (
                <>
                  <div className="ingredients">
                    {Object.entries(items[detail].recipe).map(([key, n]) => (
                      <div key={key}>
                        <Art id={Number(key)} size={28} />
                        <span>{name(Number(key))}</span>
                        <strong
                          className={(inventory[key] || 0) < n ? "short" : ""}
                        >
                          {amount(Number(key))} / {n}
                        </strong>
                      </div>
                    ))}
                  </div>
                  <button
                    className="primary"
                    disabled={busy || !state}
                    onClick={() => void craft(detail, 1)}
                  >
                    <Hammer size={18} />
                    1개 제작하기
                  </button>
                </>
              )}
            </section>
          </div>
        )}
        {showOffer && (
          <div className="overlay">
            <section className="modal offer-modal">
              <button
                className="close"
                aria-label="닫기"
                onClick={() => setShowOffer(false)}
              >
                <X />
              </button>
              <h2>새로운 교환 제안</h2>
              <p>
                도감에 등록된 아이템만 교환할 수 있어요. 등록하면 드려요 수량이
                보유량에서 즉시 차감되고, 취소하면 돌려받아요.
              </p>
              <div className="chips">
                {[
                  ["give", "내가 드려요"],
                  ["want", "받고 싶어요"],
                ].map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setOfferSide(key)}
                    className={offerSide === key ? "selected" : ""}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <select
                className="text-input"
                value={selectedOfferItem ?? ""}
                disabled={!tradeItems.length}
                onChange={(e) => setOfferItem(Number(e.target.value))}
              >
                {!tradeItems.length && (
                  <option value="">선택할 수 있는 아이템이 없습니다</option>
                )}
                {tradeItems.map((i) => (
                  <option value={i.id} key={i.id}>
                    #{String(i.id).padStart(3, "0")} · {name(i.id)}{" "}
                    {offerSide === "give" ? `(보유 ${amount(i.id)})` : ""}
                  </option>
                ))}
              </select>
              <label className="quantity-input">
                수량
                <input
                  type="number"
                  min="1"
                  max={
                    offerSide === "give" && selectedOfferItem !== null
                      ? Math.min(1000000, inventory[selectedOfferItem] || 0)
                      : 1000000
                  }
                  disabled={selectedOfferItem === null}
                  value={offerQty}
                  onChange={(e) => setOfferQty(Number(e.target.value))}
                />
                <button
                  disabled={selectedOfferItem === null}
                  onClick={() => {
                    if (selectedOfferItem === null) return;
                    if (
                      !Number.isInteger(offerQty) ||
                      offerQty < 1 ||
                      offerQty > 1000000
                    ) {
                      setNotice("수량은 1~1,000,000의 정수로 입력하세요");
                      return;
                    }
                    if (
                      offerSide === "give" &&
                      offerQty > (inventory[selectedOfferItem] || 0)
                    ) {
                      setNotice(
                        `보유 수량(${amount(selectedOfferItem)}개)을 초과할 수 없어요`,
                      );
                      return;
                    }
                    const setter = offerSide === "give" ? setGive : setWant;
                    setter((prev) => [
                      ...prev.filter((l) => l.itemId !== selectedOfferItem),
                      { itemId: selectedOfferItem, quantity: offerQty },
                    ]);
                  }}
                >
                  <Plus size={18} />
                  추가
                </button>
              </label>
              {[
                ["give", give],
                ["want", want],
              ].map(([key, lines]) => (
                <div className="offer-lines" key={key as string}>
                  <strong>{key === "give" ? "드려요" : "받고 싶어요"}</strong>
                  {(lines as Line[]).map((l) => (
                    <div key={l.itemId}>
                      <Art id={l.itemId} size={28} />
                      <span>
                        {name(l.itemId)} × {l.quantity}
                      </span>
                      <button
                        aria-label="항목 삭제"
                        onClick={() =>
                          (key === "give" ? setGive : setWant)((p) =>
                            p.filter((x) => x.itemId !== l.itemId),
                          )
                        }
                      >
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              ))}
              {!offerAffordable && (
                <p className="trade-warning">
                  제공할 아이템의 보유 수량이 부족합니다. 항목을 수정해 주세요.
                </p>
              )}
              <button
                className="primary"
                disabled={
                  busy || !give.length || !want.length || !offerAffordable
                }
                onClick={() =>
                  void run(async () => {
                    await api("offer", { give, want });
                    await refresh();
                    setShowOffer(false);
                    setGive([]);
                    setWant([]);
                    setNotice("장터에 공개 교환을 등록했어요");
                  })
                }
              >
                모두에게 공개 등록 <Send size={17} />
              </button>
            </section>
          </div>
        )}
      </main>
    </DiscoveryContext.Provider>
  );
}
