import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import { securityHeaders } from "./middlewares/securityHeaders";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// Privacy / security headers on every response.
app.use(securityHeaders);

// Clerk frontend API proxy must be mounted before any body parsers because it
// streams raw bytes to the upstream service.
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(cors({ credentials: true, origin: true }));
// Webhook receivers (provider → us) need access to the raw request body to
// verify HMAC signatures. They MUST be mounted before the global JSON parser
// — otherwise express.json() consumes the bytes and signature verification
// fails. Each handler in webhookRouter calls express.raw({type:'*/*'})
// itself, so we just need to make sure the global parser does not run for
// those URLs.
app.use((req, res, next) => {
  if (req.path.startsWith("/api/webhooks/")) return next();
  return express.json()(req, res, next);
});
app.use((req, res, next) => {
  if (req.path.startsWith("/api/webhooks/")) return next();
  return express.urlencoded({ extended: true })(req, res, next);
});

app.use(
  clerkMiddleware((req) => ({
    publishableKey: publishableKeyFromHost(
      getClerkProxyHost(req) ?? "",
      process.env.CLERK_PUBLISHABLE_KEY,
    ),
  })),
);

app.use("/api", router);

export default app;
