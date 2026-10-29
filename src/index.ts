import { execSync } from "node:child_process";

export interface ParsedCommit {
  type: string;
  scope: string;
  subject: string;
  breaking: boolean;
}

export interface ReleasePlan {
  previousVersion: string;
  nextVersion: string;
  bumpType: "major" | "minor" | "patch";
  markdownChangelog: string;
}

export function parseCommitLine(rawLine: string): ParsedCommit {
  const trimmed = rawLine.trim();
  const match = trimmed.match(/^([a-z]+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/i);
  if (!match) {
    return { type: "chore", scope: "general", subject: trimmed, breaking: false };
  }
  return {
    type: match[1].toLowerCase(),
    scope: match[2] || "core",
    breaking: Boolean(match[3]) || /BREAKING CHANGE/i.test(trimmed),
    subject: match[4]
  };
}

export function incrementSemVer(version: string, bump: "major" | "minor" | "patch"): string {
  const parts = version.replace(/^v/, "").split(".").map((n) => Number(n) || 0);
  const [major = 1, minor = 0, patch = 0] = parts;
  if (bump === "major") return `${major + 1}.0.0`;
  if (bump === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

export function buildReleasePlan(currentVersion: string, commitLines: string[]): ReleasePlan {
  const parsed = commitLines.filter(Boolean).map(parseCommitLine);
  const hasBreaking = parsed.some((c) => c.breaking);
  const hasFeature = parsed.some((c) => c.type === "feat");
  const bumpType: "major" | "minor" | "patch" = hasBreaking ? "major" : hasFeature ? "minor" : "patch";
  const nextVersion = incrementSemVer(currentVersion, bumpType);
  const dateIso = new Date().toISOString().slice(0, 10);

  const features = parsed.filter((c) => c.type === "feat");
  const fixes = parsed.filter((c) => c.type === "fix");
  const others = parsed.filter((c) => c.type !== "feat" && c.type !== "fix");

  const sections: string[] = [
    `## v${nextVersion} (${dateIso})`,
    ""
  ];
  if (features.length > 0) {
    sections.push("### Features / Новые возможности");
    features.forEach((f) => sections.push(`- **${f.scope}**: ${f.subject}`));
    sections.push("");
  }
  if (fixes.length > 0) {
    sections.push("### Bug Fixes / Исправления ошибок");
    fixes.forEach((f) => sections.push(`- **${f.scope}**: ${f.subject}`));
    sections.push("");
  }
  if (others.length > 0) {
    sections.push("### Maintenance / Прочие изменения");
    others.forEach((o) => sections.push(`- **${o.scope}**: ${o.subject}`));
  }

  return {
    previousVersion: currentVersion,
    nextVersion,
    bumpType,
    markdownChangelog: sections.join("\n").trim()
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const currentVer = process.argv[2] || "1.2.0";
  let rawCommits: string[] = [];
  try {
    const gitOut = execSync("git log -n 20 --pretty=format:%s", { encoding: "utf8" });
    rawCommits = gitOut.split(/\r?\n/);
  } catch {
    rawCommits = ["feat(api): add OAuth2 token refresh", "fix(ui): resolve table overflow"];
  }
  const plan = buildReleasePlan(currentVer, rawCommits);
  console.log(plan.markdownChangelog);
}