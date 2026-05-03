import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      "res.headers['set-cookie']",
      // Wearable / CGM OAuth secrets must never reach the log stream,
      // even by accident. Match both top-level and nested occurrences.
      "*.access_token",
      "*.refresh_token",
      "*.accessToken",
      "*.refreshToken",
      "*.client_secret",
      "*.clientSecret",
      "*.api_key",
      "*.apiKey",
      "tokens.access_token",
      "tokens.refresh_token",
      "tokens.accessToken",
      "tokens.refreshToken",
      "integration.access_token_encrypted",
      "integration.refresh_token_encrypted",
      "integration.accessTokenEncrypted",
      "integration.refreshTokenEncrypted",
      "metadata.access_token",
      "metadata.refresh_token",
      "metadata.client_secret",
      "metadata.api_key",
    ],
    censor: "[REDACTED]",
  },
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
});
