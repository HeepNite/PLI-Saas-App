import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { MAX_BYTES, cliStatus, run, scanText } from "../../scripts/check-secrets.mjs";

const join = (...parts: string[]) => parts.join("");
const candidate = (name = "sample.txt", text = "clean") => ({ name, text });

function execute(files: ReturnType<typeof candidate>[], staged = false, fail = false) {
  const output: string[] = [];
  const git = vi.fn((args: string[]) => {
    if (fail) throw new Error("leaked-error");
    if (args[0] === "ls-files" || args[0] === "grep") return Buffer.from(files.map(({ name }) => name).join("\0") + "\0");
    if (args[0] === "diff") return Buffer.from((staged ? files : []).map(({ name }) => name).join("\0"));
    const file = args.at(-1)?.slice(1);
    const text = files.find(({ name }) => name === file)?.text ?? "";
    return Buffer.from(args[0] === "cat-file" ? String(Buffer.byteLength(text)) : text);
  });
  const read = vi.fn((file: string) => Buffer.from(files.find(({ name }) => file.endsWith(name))?.text ?? ""));
  return { code: run({ argv: staged ? ["--staged"] : [], git, read, report: (line: string) => output.push(line) }), git, read, output };
}

describe("check-secrets", () => {
  it("leaves clean input clean", () => {
    const result = execute([candidate()]);
    expect(result.code).toBe(0);
    expect(result.output).toEqual([]);
  });

  it("uses encoded CLI paths and fails closed without argv", () => {
    const argvPath = resolve("scanner # % name.mjs");
    const scanner = vi.fn(() => 0);
    expect(cliStatus({ moduleUrl: pathToFileURL(argvPath).href, argvPath, scanner })).toBe(0);
    expect(scanner).toHaveBeenCalledOnce();
    expect(cliStatus({ moduleUrl: pathToFileURL(argvPath).href, argvPath: undefined, scanner })).toBe(2);
  });

  it.each([
    ["DATABASE_URL", join("postgres://user:", "pass@db.example/app")],
    ["PEM_PRIVATE_KEY", join("-----BEGIN ", "PRIVATE KEY-----")],
    ["GITHUB_TOKEN", join("gh", "p_", "a".repeat(20))],
    ["STRIPE_SECRET", join("sk_live_", "a".repeat(20))],
    ["SENTRY_TOKEN", join("sntrys_", "a".repeat(20))],
    ["SLACK_TOKEN", join("xoxb-", "a".repeat(12))],
    ["AWS_ACCESS_KEY", join("AKIA", "A".repeat(16))],
  ])("detects %s", (rule, text) => expect(scanText(text).findings[0]?.rule).toBe(rule));

  it("redacts findings and supports only exact-line suppression", () => {
    const secret = join("sk_live_", "a".repeat(20));
    const finding = execute([candidate("secret.txt", secret)]);
    expect(finding.code).toBe(1);
    expect(finding.output.join("\n")).toBe("STRIPE_SECRET secret.txt:1");
    expect(finding.output.join("\n")).not.toContain(secret);
    expect(execute([candidate("ok.txt", `${secret} // secret-scan: allow`)]).output[0]).toBe("SUPPRESSED STRIPE_SECRET ok.txt:1");
    expect(execute([candidate("no.txt", `${secret}\n// secret-scan: allow`)]).code).toBe(1);
  });

  it("uses staged added or modified paths instead of working-tree reads", () => {
    const result = execute([candidate("staged.txt", join("gh", "p_", "a".repeat(20)))], true);
    expect(result.code).toBe(1);
    expect(result.read).not.toHaveBeenCalled();
    expect(result.git).toHaveBeenCalledWith(expect.arrayContaining(["--cached"]));
  });

  it("excludes binary and oversized input and returns 2 for failures", () => {
    expect(execute([candidate("binary.txt", "\0" + join("gh", "p_", "a".repeat(20)))]).code).toBe(0);
    expect(execute([candidate("large.txt", "a".repeat(MAX_BYTES + 1))]).code).toBe(0);
    const env = execute([candidate(".env.local", join("gh", "p_", "a".repeat(20)))]);
    expect(env.code).toBe(0);
    expect(env.git.mock.calls.some(([args]) => args[0] === "grep")).toBe(false);
    const failed = execute([], false, true);
    expect(failed.code).toBe(2);
    expect(failed.output).toEqual(["ERROR scanner failure"]);
  });
});
