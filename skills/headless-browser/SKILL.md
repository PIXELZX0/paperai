---
name: headless-browser
description: Use the container-bundled Chromium browser from PaperAI agents for screenshots, DOM dumps, PDF exports, and lightweight browser checks. Trigger when an agent needs to inspect a live page, capture evidence, or run a browser script inside the Docker container.
kind: skill
slug: headless-browser
---

# Headless Browser

Use this skill when a PaperAI agent is running inside the Docker image and needs a real browser engine.

## What is available

- `paperai-browser` points to the container-safe Chromium wrapper.
- `PAPERAI_HEADLESS_BROWSER_BIN` is the system browser path.
- `PUPPETEER_EXECUTABLE_PATH`, `CHROME_BIN`, and `CHROMIUM_BIN` are set for Node-based browser tooling.

## Default workflow

1. Prefer `paperai-browser` for one-shot inspection tasks.
2. Save artifacts under `/tmp` unless the task explicitly needs them in the repo.
3. Use `--virtual-time-budget=5000` for client-rendered pages so the app has time to settle.
4. Attach screenshots, PDFs, or DOM captures back to the task or report the file path in the result.

## Common commands

Check the browser:

```bash
paperai-browser --version
```

Dump the rendered DOM:

```bash
paperai-browser --virtual-time-budget=5000 --dump-dom "https://example.com" > /tmp/page.html
```

Capture a screenshot:

```bash
paperai-browser \
  --virtual-time-budget=5000 \
  --window-size=1440,1024 \
  --screenshot=/tmp/page.png \
  "https://example.com"
```

Export a PDF:

```bash
paperai-browser \
  --virtual-time-budget=5000 \
  --print-to-pdf=/tmp/page.pdf \
  "https://example.com"
```

## Using Node browser libraries

If the working repo already includes Puppeteer or Playwright, reuse the bundled Chromium instead of downloading another browser.

```js
const browser = await chromium.launch({
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
```

## Guardrails

- Prefer the wrapper over raw `chromium`; it creates an isolated temporary profile automatically.
- Keep runs headless and non-interactive.
- Do not write screenshots or PDFs into the git workspace unless the task explicitly asks for durable artifacts.
- If a task needs complex interaction and no browser library is installed in the target repo, report that limitation instead of improvising an unreliable scraper.
