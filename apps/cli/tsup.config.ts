import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"],
  target: "es2022",
  minify: true,
  noExternal: [
    /@paperai\//,
    /^@fastify\//,
    /^commander$/,
    /^dotenv$/,
    /^drizzle-orm$/,
    /^fast-glob$/,
    /^fastify$/,
    /^gray-matter$/,
    /^postgres$/,
    /^yaml$/,
    /^zod$/,
  ],
  external: ["embedded-postgres", /^@embedded-postgres\//, "@resvg/resvg-js", /^@resvg\//],
  splitting: false,
  clean: true,
  outExtension() {
    return { js: ".cjs" };
  },
});
