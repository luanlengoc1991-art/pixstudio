// The site lives at https://lms.luangroup.asia (gateway/worker.js forwards to this
// Pages project with the shared GW_SECRET header). Anyone reaching the old
// *.pages.dev address directly is sent to the new one.
const HOME = "https://lms.luangroup.asia";

type Env = { GW_SECRET?: string };

export const onRequest = async (ctx: {
  request: Request;
  env: Env;
  next: () => Promise<Response>;
}): Promise<Response> => {
  const url = new URL(ctx.request.url);
  const secret = ctx.env.GW_SECRET;
  const viaGateway = !!secret && ctx.request.headers.get("x-lms-gw") === secret;
  if (url.hostname.endsWith(".pages.dev") && secret && !viaGateway) {
    return new Response(null, {
      status: 308,
      headers: { location: HOME + url.pathname + url.search, "cache-control": "no-store" },
    });
  }
  return ctx.next();
};
