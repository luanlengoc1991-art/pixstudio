// Serves the ONNX models from R2. Same origin as the site, so the browser can
// fetch them without CORS. The body is streamed straight from R2 (models reach
// ~180 MB, more than a Worker can buffer); browsers keep their own copy in
// Cache Storage (renderer/lib/web/onnx.ts).
interface Env {
  MODELS: R2Bucket;
}

export const onRequestGet: PagesFunction<Env, "name"> = async ({ params, env }) => {
  const name = String(params.name);
  if (!/^[\w.-]+\.onnx$/.test(name)) return new Response("Not found", { status: 404 });

  const object = await env.MODELS.get(name);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("content-length", String(object.size));
  headers.set("cache-control", "public, max-age=31536000, immutable");
  return new Response(object.body, { headers });
};
