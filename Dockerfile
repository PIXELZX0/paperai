FROM node:22-bookworm-slim AS base

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable

WORKDIR /app

FROM base AS build

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm build
RUN pnpm --filter @paperai/server deploy --legacy --prod /prod/server

FROM base AS runner

ARG OPENCODE_VERSION=latest
ARG CLAUDE_CODE_VERSION=latest
ARG GEMINI_CLI_VERSION=latest
ARG CODEX_VERSION=latest
ARG HERMES_AGENT_VERSION=latest

ENV NODE_ENV=production \
    PAPERAI_HEADLESS_BROWSER_BIN=/usr/bin/chromium \
    PAPERAI_HEADLESS_BROWSER_WRAPPER=/usr/local/bin/paperai-browser \
    CHROME_BIN=/usr/bin/chromium \
    CHROMIUM_BIN=/usr/bin/chromium \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    NPM_CONFIG_UPDATE_NOTIFIER=false

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    bash \
    chromium \
    ca-certificates \
    curl \
    fonts-liberation \
    fonts-noto-cjk \
    fonts-noto-color-emoji \
    git \
    less \
    python3 \
    python3-pip \
    ripgrep \
  && rm -rf /var/lib/apt/lists/*

RUN npm install -g \
    "opencode-ai@${OPENCODE_VERSION}" \
    "@anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}" \
    "@google/gemini-cli@${GEMINI_CLI_VERSION}" \
    "@openai/codex@${CODEX_VERSION}" \
  && npm cache clean --force

RUN if [ "$HERMES_AGENT_VERSION" = "latest" ]; then \
      pip3 install --break-system-packages --no-cache-dir hermes-agent; \
    else \
      pip3 install --break-system-packages --no-cache-dir "hermes-agent==${HERMES_AGENT_VERSION}"; \
    fi \
  && opencode --version \
  && claude --version \
  && gemini --version \
  && codex --version \
  && command -v hermes

COPY --from=build /prod/server ./apps/server
COPY --from=build /app/apps/web/dist ./apps/web/dist
COPY tools/paperai-browser.sh /usr/local/bin/paperai-browser

RUN chmod +x /usr/local/bin/paperai-browser

EXPOSE 3001

CMD ["node", "apps/server/dist/index.cjs"]
