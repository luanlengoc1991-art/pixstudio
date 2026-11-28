// Front door for https://lms.luangroup.asia: forwards every request to the Pages
// project. The shared GW_SECRET header tells Pages the request came through here,
// so the old *.pages.dev address can redirect everyone else (functions/_middleware.ts).
const ORIGIN = "https://lms-studio-c9y.pages.dev";

const isCacheableStaticAsset = (pathname) => {
  if (pathname.startsWith("/api/") || pathname.startsWith("/admin") || pathname.startsWith("/models/")) {
    return false;
  }
  return (
    pathname.startsWith("/_next/static/") ||
    pathname.startsWith("/wasm/") ||
    pathname.startsWith("/icons3d/") ||
    /\.(?:png|svg|webp|jpg|jpeg|ico|woff2?)$/i.test(pathname)
  );
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const canEdgeCache =
      (request.method === "GET" || request.method === "HEAD") && isCacheableStaticAsset(url.pathname);
    const cache = caches.default;
    const cacheKey = canEdgeCache ? new Request(url.toString(), { method: "GET" }) : null;

    if (cacheKey) {
      const cached = await cache.match(cacheKey);
      if (cached) {
        const hit = new Response(request.method === "HEAD" ? null : cached.body, cached);
        hit.headers.set("CF-Cache-Status", "HIT");
        return hit;
      }
    }

    const target = new URL(url.pathname + url.search, ORIGIN);
    const headers = new Headers(request.headers);
    headers.set("x-lms-gw", env.GW_SECRET || "");
    const clientIp = request.headers.get("cf-connecting-ip");
    if (clientIp) headers.set("x-lms-client-ip", clientIp);
    const country = request.cf?.country;
    if (country) headers.set("x-lms-client-country", String(country));
    const res = await fetch(target, {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
      redirect: "manual",
    });
    const loc = res.headers.get("location");
    if (loc && loc.includes(".pages.dev")) {
      const out = new Response(res.body, res);
      const l = new URL(loc);
      out.headers.set("location", url.origin + l.pathname + l.search + l.hash);
      return out;
    }

    if (cacheKey && res.status === 200 && !res.headers.has("set-cookie")) {
      if (request.method === "GET") {
        ctx.waitUntil(cache.put(cacheKey, res.clone()));
      }
      const miss = new Response(res.body, res);
      miss.headers.set("CF-Cache-Status", "MISS");
      return miss;
    }
    return res;
  },
};
