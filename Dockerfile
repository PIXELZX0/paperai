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

ENV NODE_ENV=production \
    PAPERAI_HEADLESS_BROWSER_BIN=/usr/bin/chromium \
    PAPERAI_HEADLESS_BROWSER_WRAPPER=/usr/local/bin/paperai-browser \
    CHROME_BIN=/usr/bin/chromium \
    CHROMIUM_BIN=/usr/bin/chromium \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    chromium \
    ca-certificates \
    fonts-liberation \
    fonts-noto-cjk \
    fonts-noto-color-emoji \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /prod/server ./apps/server
COPY --from=build /app/apps/web/dist ./apps/web/dist
COPY tools/paperai-browser.sh /usr/local/bin/paperai-browser

RUN chmod +x /usr/local/bin/paperai-browser

EXPOSE 3001

CMD ["node", "apps/server/dist/index.cjs"]
