// Front door for https://lms.luangroup.asia: forwards every request to the Pages
// project. The shared GW_SECRET header tells Pages the request came through here,
// so the old *.pages.dev address can redirect everyone else (functions/_middleware.ts).
const ORIGIN = "https://lms-studio-c9y.pages.dev";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const target = new URL(url.pathname + url.search, ORIGIN);
    const headers = new Headers(request.headers);
    headers.set("x-lms-gw", env.GW_SECRET || "");
    const res = await fetch(target, {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
      redirect: "manual",
    });
    const loc = res.headers.get("location");
    if (!loc || !loc.includes(".pages.dev")) return res;
    const out = new Response(res.body, res);
    const l = new URL(loc);
    out.headers.set("location", url.origin + l.pathname + l.search + l.hash);
    return out;
  },
};
