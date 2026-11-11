/**
 * 테스트용 Supabase 쿼리 빌더 흉내(메모리). 발행 로직이 쓰는 기능만 구현한다.
 */
import { randomUUID } from "node:crypto";

type Row = Record<string, unknown>;
type Filter = (r: Row) => boolean;

export class FakeDb {
  tables: Record<string, Row[]> = {};
  rows(t: string) {
    return (this.tables[t] ??= []);
  }
  from(t: string) {
    return new Query(this, t);
  }
  async rpc(name: string, args: Record<string, number>) {
    if (name === "claim_jobs") {
      const now = Date.now();
      const due = this.rows("jobs")
        .filter((j) => (j.status === "queued" || j.status === "running") && Date.parse(String(j.run_after ?? new Date(0).toISOString())) <= now && (!j.locked_until || Date.parse(String(j.locked_until)) < now))
        .slice(0, args.p_limit ?? 3);
      for (const j of due) {
        j.status = "running";
        j.locked_until = new Date(now + (args.p_lease_seconds ?? 300) * 1000).toISOString();
      }
      return { data: due.map((j) => ({ attempts: 0, progress: 0, total: 0, ...j })), error: null };
    }
    if (name !== "claim_due_posts") return { data: null, error: { message: `unknown rpc ${name}` } };
    const now = Date.now();
    const t = (v: unknown) => (v ? Date.parse(String(v)) : null);
    const due = this.rows("posts")
      .filter((p) => {
        const lock = t(p.locked_until);
        if (lock !== null && lock >= now) return false;
        const next = t(p.next_attempt_at);
        const sched = t(p.scheduled_at);
        if (p.status === "scheduled") return sched !== null && sched <= now && (next ?? sched) <= now;
        if (p.status === "processing") return (next ?? now) <= now;
        if (p.status === "published" && p.replies_pending) return (next ?? now) <= now;
        return false;
      })
      .sort((a, b) => (t(a.next_attempt_at) ?? t(a.scheduled_at) ?? 0) - (t(b.next_attempt_at) ?? t(b.scheduled_at) ?? 0))
      .slice(0, args.p_limit ?? 10);
    for (const p of due) p.locked_until = new Date(now + (args.p_lease_seconds ?? 120) * 1000).toISOString();
    return { data: due.map((p) => ({ ...p })), error: null };
  }
}

class Query implements PromiseLike<{ data: unknown; error: unknown; count?: number | null }> {
  private op: "select" | "insert" | "update" | "delete" = "select";
  private filters: Filter[] = [];
  private payload: Row[] | Row | null = null;
  private returning = false;
  private orderBy: { col: string; asc: boolean }[] = [];
  private limitN: number | null = null;
  private mode: "many" | "single" | "maybe" = "many";
  private head = false;
  private wantCount = false;

  constructor(private db: FakeDb, private table: string) {}

  select(_cols?: string, opts?: { count?: string; head?: boolean }) {
    if (this.op === "select") {
      this.head = !!opts?.head;
      this.wantCount = !!opts?.count;
    } else this.returning = true;
    return this;
  }
  insert(rows: Row | Row[]) {
    this.op = "insert";
    this.payload = rows;
    return this;
  }
  update(patch: Row) {
    this.op = "update";
    this.payload = patch;
    return this;
  }
  upsert(rows: Row | Row[]) {
    return this.insert(rows);
  }
  delete() {
    this.op = "delete";
    return this;
  }
  eq(c: string, v: unknown) {
    this.filters.push((r) => r[c] === v);
    return this;
  }
  neq(c: string, v: unknown) {
    this.filters.push((r) => r[c] !== v);
    return this;
  }
  in(c: string, vs: unknown[]) {
    this.filters.push((r) => vs.includes(r[c]));
    return this;
  }
  not(c: string, op: string, v: unknown) {
    if (op !== "is") throw new Error(`fake not(${op}) 미지원`);
    this.filters.push((r) => (r[c] ?? null) !== v);
    return this;
  }
  contains(c: string, v: Record<string, unknown>) {
    this.filters.push((r) => Object.entries(v).every(([k, x]) => (r[c] as Record<string, unknown> | undefined)?.[k] === x));
    return this;
  }
  is(c: string, v: unknown) {
    this.filters.push((r) => (r[c] ?? null) === v);
    return this;
  }
  like(c: string, pattern: string) {
    const re = new RegExp("^" + pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/%/g, ".*") + "$");
    this.filters.push((r) => re.test(String(r[c] ?? "")));
    return this;
  }
  lte(c: string, v: string) {
    this.filters.push((r) => String(r[c]) <= v);
    return this;
  }
  gte(c: string, v: string) {
    this.filters.push((r) => String(r[c]) >= v);
    return this;
  }
  lt(c: string, v: string) {
    this.filters.push((r) => String(r[c]) < v);
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.orderBy.push({ col, asc: opts?.ascending !== false });
    return this;
  }
  limit(n: number) {
    this.limitN = n;
    return this;
  }
  single() {
    this.mode = "single";
    return this;
  }
  maybeSingle() {
    this.mode = "maybe";
    return this;
  }

  private exec(): { data: unknown; error: unknown; count?: number | null } {
    const all = this.db.rows(this.table);
    const match = () => all.filter((r) => this.filters.every((f) => f(r)));
    let out: Row[] = [];
    if (this.op === "insert") {
      const list = Array.isArray(this.payload) ? this.payload : [this.payload!];
      out = list.map((r) => {
        const row = { id: randomUUID(), created_at: new Date().toISOString(), ...r };
        all.push(row);
        return row;
      });
    } else if (this.op === "update") {
      out = match();
      for (const r of out) Object.assign(r, this.payload, { updated_at: new Date().toISOString() });
    } else if (this.op === "delete") {
      out = match();
      this.db.tables[this.table] = all.filter((r) => !out.includes(r));
    } else {
      out = match();
      for (const o of [...this.orderBy].reverse()) {
        out = [...out].sort((a, b) => {
          const x = a[o.col] as number, y = b[o.col] as number;
          return (x > y ? 1 : x < y ? -1 : 0) * (o.asc ? 1 : -1);
        });
      }
      if (this.limitN !== null) out = out.slice(0, this.limitN);
      if (this.head) return { data: null, error: null, count: out.length };
    }
    const copy = out.map((r) => ({ ...r }));
    if (this.op !== "select" && !this.returning) return { data: null, error: null, count: this.wantCount ? copy.length : null };
    if (this.mode === "single") return copy.length ? { data: copy[0], error: null } : { data: null, error: { message: "no rows" } };
    if (this.mode === "maybe") return { data: copy[0] ?? null, error: null };
    return { data: copy, error: null, count: this.wantCount ? copy.length : null };
  }

  then<A, B>(ok?: ((v: { data: unknown; error: unknown; count?: number | null }) => A | PromiseLike<A>) | null, err?: ((e: unknown) => B | PromiseLike<B>) | null) {
    return Promise.resolve()
      .then(() => this.exec())
      .then(ok, err);
  }
}
