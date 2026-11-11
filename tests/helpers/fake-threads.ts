/** 테스트용 Threads Graph API 흉내 (fetch 대체) */
export type Call = { method: string; path: string; params: Record<string, string> };

export class FakeThreads {
  calls: Call[] = [];
  containers = new Map<string, { params: Record<string, string>; statusQueue: string[]; published: boolean }>();
  private n = 0;
  /** 새로 만든 컨테이너가 처음 상태 조회에서 돌려줄 상태 목록 (기본: 바로 FINISHED) */
  initialStatuses: (params: Record<string, string>) => string[] = () => [];
  failPublish: null | { status: number; body: unknown } = null;
  quotaUsage = 0;

  fetch = async (input: string | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input));
    const method = init?.method ?? "GET";
    const params: Record<string, string> = {};
    url.searchParams.forEach((v, k) => (params[k] = v));
    if (init?.body instanceof URLSearchParams) init.body.forEach((v, k) => (params[k] = v));
    const path = url.pathname;
    this.calls.push({ method, path, params });
    const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

    let m: RegExpMatchArray | null;
    if (method === "POST" && (m = path.match(/^\/v1\.0\/([^/]+)\/threads$/))) {
      const id = `c${++this.n}`;
      this.containers.set(id, { params, statusQueue: this.initialStatuses(params), published: false });
      return json(200, { id });
    }
    if (method === "POST" && (m = path.match(/^\/v1\.0\/([^/]+)\/threads_publish$/))) {
      if (this.failPublish) return json(this.failPublish.status, this.failPublish.body);
      const c = this.containers.get(params.creation_id);
      if (!c) return json(400, { error: { message: "no container", code: 100 } });
      c.published = true;
      return json(200, { id: `m${params.creation_id.slice(1)}` });
    }
    if (method === "GET" && path.endsWith("/threads_publishing_limit")) {
      return json(200, { data: [{ quota_usage: this.quotaUsage, config: { quota_total: 250, quota_duration: 86400 } }] });
    }
    if (method === "GET" && (m = path.match(/^\/v1\.0\/(c\d+)$/))) {
      const c = this.containers.get(m[1])!;
      const status = c.published ? "PUBLISHED" : (c.statusQueue.shift() ?? "FINISHED");
      return json(200, { id: m[1], status });
    }
    if (method === "GET" && (m = path.match(/^\/v1\.0\/(m\d+)$/))) {
      return json(200, { id: m[1], permalink: `https://www.threads.com/@tester/post/${m[1]}` });
    }
    return json(404, { error: { message: `unhandled ${method} ${path}`, code: 0 } });
  };

  created(filter?: (p: Record<string, string>) => boolean) {
    return this.calls.filter((c) => c.method === "POST" && /\/threads$/.test(c.path) && (!filter || filter(c.params)));
  }
  published() {
    return this.calls.filter((c) => c.method === "POST" && c.path.endsWith("/threads_publish"));
  }
}
