import { pluginManifestSchema, type PluginManifest } from "@paperai/shared";

export function validatePluginManifest(input: unknown): PluginManifest {
  return pluginManifestSchema.parse(input);
}
