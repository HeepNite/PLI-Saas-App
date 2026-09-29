import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const MAX_BYTES = 1024 * 1024;
const SUPPRESSION = "secret-scan: allow";
const RULES = [
  ["DATABASE_URL", /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis(?:s)?):\/\/[^\s:@/]+:[^\s@/]+@/i],
  ["PEM_PRIVATE_KEY", /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ["GITHUB_TOKEN", /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/],
  ["STRIPE_SECRET", /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/],
  ["SENTRY_TOKEN", /\bsntrys_[A-Za-z0-9]{20,}\b/],
  ["SLACK_TOKEN", /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/],
  ["AWS_ACCESS_KEY", /\b(?:AKIA|ASIA|A3T[A-Z])[A-Z0-9]{16}\b/],
];

function paths(buffer) {
  return buffer.toString("utf8").split("\0").filter(Boolean);
}

function git(args, allowNoMatch = false) {
  try {
    return execFileSync("git", args, { cwd: process.cwd(), encoding: null, stdio: ["ignore", "pipe", "ignore"], maxBuffer: MAX_BYTES + 1 });
  } catch (error) {
    if (allowNoMatch && error.status === 1) return Buffer.alloc(0);
    throw new Error("scanner failure");
  }
}

function ignoredPath(file) {
  return file.split("/").some((part) => part.startsWith(".env"));
}

function workingFile(file) {
  const target = resolve(process.cwd(), file);
  const info = lstatSync(target);
  if (!info.isFile() || info.size > MAX_BYTES) return null;
  return readFileSync(target);
}

export function scanText(text) {
  const findings = [];
  const suppressions = [];
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    for (const [rule, pattern] of RULES) {
      pattern.lastIndex = 0;
      if (!pattern.test(line)) continue;
      (line.includes(SUPPRESSION) ? suppressions : findings).push({ rule, line: index + 1 });
    }
  }
  return { findings, suppressions };
}

export function run({ argv = process.argv.slice(2), git: runGit = git, read = workingFile, report = console.log } = {}) {
  if (argv.length > 1 || (argv.length === 1 && argv[0] !== "--staged")) {
    report("ERROR scanner failure");
    return 2;
  }
  try {
    const staged = argv[0] === "--staged";
    const candidates = paths(runGit(staged ? ["diff", "--cached", "--name-only", "--diff-filter=AM", "-z"] : ["ls-files", "-z"])).filter((file) => !ignoredPath(file));
    const textFiles = candidates.length ? new Set(paths(runGit(["grep", ...(staged ? ["--cached"] : []), "-Ilz", "-e", "", "--", ...candidates], true))) : new Set();
    const selected = candidates.filter((file) => textFiles.has(file));
    const load = staged ? (file) => {
      const size = Number(runGit(["cat-file", "-s", `:${file}`]).toString("utf8"));
      return Number.isSafeInteger(size) && size <= MAX_BYTES ? runGit(["show", `:${file}`]) : null;
    } : read;
    let found = false;
    for (const file of selected) {
      if (ignoredPath(file)) continue;
      const content = load(file);
      if (!content || content.length > MAX_BYTES || content.includes(0)) continue;
      const result = scanText(content.toString("utf8"));
      for (const item of result.suppressions) report(`SUPPRESSED ${item.rule} ${file}:${item.line}`);
      for (const item of result.findings) {
        found = true;
        report(`${item.rule} ${file}:${item.line}`);
      }
    }
    return found ? 1 : 0;
  } catch {
    report("ERROR scanner failure");
    return 2;
  }
}

export function cliStatus(options = {}) {
  const { moduleUrl = import.meta.url, scanner = run } = options;
  const argvPath = Object.hasOwn(options, "argvPath") ? options.argvPath : process.argv[1];
  if (typeof argvPath !== "string" || !argvPath) return 2;
  try {
    return moduleUrl === pathToFileURL(resolve(argvPath)).href ? scanner() : null;
  } catch {
    return 2;
  }
}

const status = cliStatus();
if (status !== null) process.exitCode = status;
