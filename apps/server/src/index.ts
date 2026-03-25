import { createApp } from "./app.js";
import { getConfig } from "./config.js";

async function main() {
  const config = getConfig();
  const app = await createApp();
  await app.listen({
    port: config.port,
    host: "0.0.0.0",
  });
}

void main();
