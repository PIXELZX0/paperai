import { createHttpAdapter } from "@paperai/adapter-sdk";

export const httpApiAdapter = createHttpAdapter({
  type: "http_api",
  label: "HTTP API Worker",
  description: "Calls a remote worker endpoint over HTTP.",
  endpoint: process.env.PAPERAI_HTTP_ADAPTER_URL ?? "http://localhost:8787/execute",
});
