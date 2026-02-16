import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
import { createApiApp } from "./app.js";
import { createD1Db } from "@bitlog/db/worker";

export interface WorkerEnv {
  DB: D1Database;
  ASSETS_R2?: R2Bucket;
}

export default {
  fetch(request: Request, env: WorkerEnv, ctx: ExecutionContext) {
    void ctx;
    const db = createD1Db(env.DB);
    const app = createApiApp({
      db,
      ...(env.ASSETS_R2 ? { assetsR2: env.ASSETS_R2 } : {})
    });
    return app.fetch(request, env, ctx);
  }
};
