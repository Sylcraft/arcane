import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseForESLint, clearCaches } from "@typescript-eslint/parser";

test("typed lint can match the root JS config through allowDefaultProject", () => {
  // Exercise typescript-estree's real minimatch consumer, beyond ordinary lint
  // which does not enable projectService in this repository.
  const root = fileURLToPath(new URL("../", import.meta.url));
  const file = fileURLToPath(new URL("../eslint.config.js", import.meta.url));
  try {
    const parsed = parseForESLint(readFileSync(file, "utf8"), {
      filePath: file,
      tsconfigRootDir: root,
      projectService: { allowDefaultProject: ["*.config.js"] },
      sourceType: "module",
    });
    assert.ok(parsed.services.program);
    assert.ok(parsed.ast.body.length > 0);
  } finally {
    clearCaches();
  }
});
