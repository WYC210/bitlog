import { createWebApp } from "./app.js";

import type { WebEnv } from "./app.js";

export default {
  fetch(request: Request, env: WebEnv, ctx: ExecutionContext) {
    void ctx;
    return createWebApp().fetch(request, env, ctx);
  }
};

