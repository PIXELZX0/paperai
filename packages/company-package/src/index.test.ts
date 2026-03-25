import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { exportCompanyPackage, parseCompanyPackage } from "./index.js";

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
  tempDirs.length = 0;
});

describe("company package parsing", () => {
  it("parses markdown docs and vendor config", async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "paperai-package-"));
    tempDirs.push(root);

    await mkdir(path.join(root, "agents", "ceo"), { recursive: true });
    await writeFile(
      path.join(root, "COMPANY.md"),
      `---\nslug: acme\nname: Acme\n---\n\nBuild a general autonomous company.\n`,
    );
    await writeFile(
      path.join(root, "agents", "ceo", "AGENTS.md"),
      `---\nslug: ceo\nname: CEO\n---\n\nLead the company.\n`,
    );
    await writeFile(path.join(root, ".zero.yaml"), `adapters:\n  ceo:\n    type: http_api\n`);

    const manifest = await parseCompanyPackage(root);
    expect(manifest.company?.slug).toBe("acme");
    expect(manifest.docs).toHaveLength(2);
    expect(manifest.vendorConfig).toMatchObject({ adapters: { ceo: { type: "http_api" } } });
  });

  it("exports files from a manifest", () => {
    const files = exportCompanyPackage({
      root: "acme",
      company: null,
      docs: [
        {
          kind: "company",
          path: "COMPANY.md",
          slug: "acme",
          frontmatter: { slug: "acme", name: "Acme" },
          body: "Hello world",
        },
      ],
      vendorConfig: { adapters: { ceo: { type: "http_api" } } },
    });

    expect(files["COMPANY.md"]).toContain("slug: acme");
    expect(files[".zero.yaml"]).toContain("http_api");
  });
});
