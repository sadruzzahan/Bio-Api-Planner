import type { Request, Response, NextFunction, RequestHandler } from "express";

/**
 * Privacy & defense-in-depth response headers. These are deliberately
 * conservative for an API service that is consumed from a same-origin SPA
 * served behind a reverse proxy; the SPA host will set its own CSP.
 */
export const securityHeaders: RequestHandler = (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Don't leak full URLs to third-party origins (e.g. Anthropic, analytics).
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  // Prevent MIME sniffing of API responses.
  res.setHeader("X-Content-Type-Options", "nosniff");
  // Disallow framing entirely; the SPA never embeds the API directly.
  res.setHeader("X-Frame-Options", "DENY");
  // Disable powerful browser features by default. The SPA can opt in itself.
  res.setHeader(
    "Permissions-Policy",
    [
      "geolocation=()",
      "microphone=()",
      "camera=()",
      "payment=()",
      "usb=()",
      "fullscreen=(self)",
    ].join(", "),
  );
  // Tell the browser any cross-origin frame must be opted-in by the embedee.
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
  next();
};
