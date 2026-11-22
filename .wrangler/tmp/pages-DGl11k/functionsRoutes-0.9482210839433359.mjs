import { onRequestGet as __models__name__ts_onRequestGet } from "D:\\CLAUDE CURSO WEBSITE LUAN\\pixstudio\\pixstudio\\web\\functions\\models\\[name].ts"
import { onRequest as __api___path___ts_onRequest } from "D:\\CLAUDE CURSO WEBSITE LUAN\\pixstudio\\pixstudio\\web\\functions\\api\\[[path]].ts"

export const routes = [
    {
      routePath: "/models/:name",
      mountPath: "/models",
      method: "GET",
      middlewares: [],
      modules: [__models__name__ts_onRequestGet],
    },
  {
      routePath: "/api/:path*",
      mountPath: "/api",
      method: "",
      middlewares: [],
      modules: [__api___path___ts_onRequest],
    },
  ]