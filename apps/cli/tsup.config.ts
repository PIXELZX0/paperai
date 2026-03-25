import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"],
  target: "es2022",
  minify: true,
  noExternal: [/@paperai\//],
  external: ["embedded-postgres", /^@embedded-postgres\//],
  splitting: false,
  clean: true,
  outExtension() {
    return { js: ".cjs" };
  },
});
