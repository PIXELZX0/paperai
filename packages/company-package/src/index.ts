import { readFile } from "node:fs/promises";
import path from "node:path";
import fg from "fast-glob";
import matter from "gray-matter";
import YAML from "yaml";
import type { CompanyPackageDoc, CompanyPackageManifest } from "@paperai/shared";

const FILE_KIND_MAP: Record<string, CompanyPackageDoc["kind"]> = {
  "COMPANY.md": "company",
  "TEAM.md": "team",
  "AGENTS.md": "agent",
  "PROJECT.md": "project",
  "TASK.md": "task",
  "SKILL.md": "skill",
};

export async function parseCompanyPackage(root: string): Promise<CompanyPackageManifest> {
  const entries = await fg(["**/*.md", ".zero.yaml"], {
    cwd: root,
    onlyFiles: true,
    dot: true,
  });

  const docs: CompanyPackageDoc[] = [];
  let vendorConfig: Record<string, unknown> | null = null;

  for (const entry of entries) {
    const absolutePath = path.join(root, entry);

    if (entry === ".zero.yaml") {
      vendorConfig = YAML.parse(await readFile(absolutePath, "utf8")) as Record<string, unknown>;
      continue;
    }

    const raw = await readFile(absolutePath, "utf8");
    const parsed = matter(raw);
    const filename = path.basename(entry);
    const kind = FILE_KIND_MAP[filename];

    if (!kind) {
      continue;
    }

    const slug = String(parsed.data.slug ?? path.basename(path.dirname(entry)) ?? path.basename(entry, ".md"));
    docs.push({
      kind,
      path: entry,
      slug,
      frontmatter: parsed.data as Record<string, unknown>,
      body: parsed.content.trim(),
    });
  }

  return {
    root,
    company: docs.find((doc) => doc.kind === "company") ?? null,
    docs,
    vendorConfig,
  };
}

export function exportCompanyPackage(manifest: CompanyPackageManifest): Record<string, string> {
  const files: Record<string, string> = {};

  for (const doc of manifest.docs) {
    files[doc.path] = matter.stringify(doc.body, doc.frontmatter);
  }

  if (manifest.vendorConfig) {
    files[".zero.yaml"] = YAML.stringify(manifest.vendorConfig);
  }

  return files;
}
