import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { readdirSync, readFileSync, lstatSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const root = resolve(".");
const excluded = new Set([
  "node_modules",
  "dist",
  ".git",
  ".vercel",
  ".publication",
  ".agents",
  ".codex",
  ".aws",
  "coverage",
  "reports",
]);
const privatePath =
  /(^|\/)(?:\.env[^/]*|sources|\.aws|\.codex|\.agents|\.publication|\.vercel)(\/|$)|\.(?:pem|key|p12|pfx|zip|7z)$/i;
const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/,
  /\bgh[pousr]_[A-Za-z0-9]{30,}\b/,
  /\bgithub_pat_[A-Za-z0-9_]{40,}\b/,
  /\bAKIA[A-Z0-9]{16}\b/,
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{32,}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{24,}\b/,
  /https?:\/\/[^\s/:]+:[^\s/@]+@[^\s]+/i,
];
function walk(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (directory === root && excluded.has(entry.name)) return [];
    const path = join(directory, entry.name);
    assert.ok(
      !entry.isSymbolicLink(),
      `Lien symbolique à examiner : ${relative(root, path)}`,
    );
    return entry.isDirectory()
      ? walk(path)
      : [relative(root, path).replaceAll("\\", "/")];
  });
}
const git = spawnSync("git", ["rev-parse", "--show-toplevel"], {
  encoding: "utf8",
});
const files =
  git.status === 0 && resolve(git.stdout.trim()) === root
    ? execFileSync(
        "git",
        ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
        { encoding: "utf8" },
      )
        .split("\0")
        .filter(Boolean)
    : walk(root).filter((file) => !/\.tsbuildinfo$|\.log$|\.local$/.test(file));
for (const file of files) {
  assert.ok(!privatePath.test(file), `Fichier privé candidat : ${file}`);
  assert.ok(
    !file.split("/").some((part) => excluded.has(part)),
    `Sortie ou fichier local candidat : ${file}`,
  );
  const path = join(root, file);
  assert.ok(lstatSync(path).isFile(), `Fichier absent ou lien : ${file}`);
  const data = readFileSync(path);
  if (data.includes(0)) continue;
  assert.ok(
    !secretPatterns.some((pattern) => pattern.test(data.toString("utf8"))),
    `Secret potentiel : ${file}. Examiner sans exposer sa valeur.`,
  );
}
for (const file of [".gitignore", ".vercelignore"]) {
  const rules = readFileSync(file, "utf8").split(/\r?\n/);
  for (const required of [
    ".env*",
    ".vercel/",
    ".publication/",
    "node_modules/",
    "dist/",
  ])
    assert.ok(
      rules.includes(required),
      `${file} : exclusion manquante ${required}`,
    );
}
assert.equal(JSON.parse(readFileSync("package.json", "utf8")).private, true);
console.log(
  `${files.length} fichiers candidats vérifiés : aucun chemin privé ni motif de secret connu détecté.`,
);
console.log(
  git.status === 0
    ? "Index Git examiné avec les fichiers candidats."
    : "Pas de dépôt Git local : analyse du dossier publiable, sans historique à examiner.",
);
console.log(
  "Cette analyse de motifs ne garantit pas l’absence de tout secret possible.",
);
