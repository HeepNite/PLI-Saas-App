#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const [, , modeArg, specFolderArg] = process.argv;

const VALID_MODES = new Set([
    "analysis",
    "resolve",
    "plan",
    "implement",
    "validate",
    "list",
    "new",
]);

const REQUIRED_SPEC_FILES = ["requirements.md", "design.md", "tasks.md"];
const TEMPLATE_SPEC_FOLDER = "_template";

function fail(message) {
    console.error(`Error: ${message}`);
    process.exit(1);
}

function repoPath(...segments) {
    return path.join(process.cwd(), ...segments);
}

function fileExists(filePath) {
    return fs.existsSync(filePath);
}

function readFile(filePath) {
    return fs.readFileSync(filePath, "utf8");
}

function writeFile(filePath, content) {
    fs.writeFileSync(filePath, content, "utf8");
}

function getSpecDirectories(specsRoot) {
    if (!fileExists(specsRoot)) return [];

    const entries = fs.readdirSync(specsRoot, { withFileTypes: true });

    const directories = entries
        .filter((entry) => entry.isDirectory())
        .filter((entry) => !entry.name.startsWith("."))
        .filter((entry) => !entry.name.startsWith("_"))
        .map((entry) => entry.name);

    directories.sort((a, b) => a.localeCompare(b, "en", { numeric: true }));

    return directories;
}

function humanizeSpecFolder(specFolder) {
    const withoutPrefix = specFolder.replace(/^\d+-/, "");
    return withoutPrefix
        .split("-")
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

function createSpecFromTemplate(specsRoot, specFolder, title) {
    const templateRoot = path.join(specsRoot, TEMPLATE_SPEC_FOLDER);
    if (!fileExists(templateRoot)) {
        fail(`Missing template folder: ${templateRoot}`);
    }

    const newSpecRoot = path.join(specsRoot, specFolder);
    if (fileExists(newSpecRoot)) {
        fail(`Spec folder already exists: ${specFolder}`);
    }

    fs.mkdirSync(newSpecRoot, { recursive: true });

    const templateEntries = fs.readdirSync(templateRoot, { withFileTypes: true });
    const resolvedTitle = title?.trim() || humanizeSpecFolder(specFolder);
    const specId = specFolder.split("-")[0] || "XXX";

    for (const entry of templateEntries) {
        if (!entry.isFile()) continue;
        const sourceFile = path.join(templateRoot, entry.name);
        const targetFile = path.join(newSpecRoot, entry.name);
        const content = readFile(sourceFile)
            .replaceAll("SPEC-XXX", `SPEC-${specId}`)
            .replaceAll("Title", resolvedTitle);
        writeFile(targetFile, content);
    }

    console.log(`\nCreated spec: docs/specs/${specFolder}\n`);
    console.log("Files:");
    for (const fileName of fs.readdirSync(newSpecRoot).sort()) {
        console.log(`- docs/specs/${specFolder}/${fileName}`);
    }
    console.log("");
}

function getMissingSpecFiles(specDirPath) {
    return REQUIRED_SPEC_FILES.filter(
        (fileName) => !fileExists(path.join(specDirPath, fileName))
    );
}

function getSpecStatus(specsRoot, specFolder) {
    const fullPath = path.join(specsRoot, specFolder);
    const missingFiles = getMissingSpecFiles(fullPath);

    return {
        name: specFolder,
        path: fullPath,
        missingFiles,
        isValid: missingFiles.length === 0,
    };
}

function getAllSpecStatuses(specsRoot) {
    const directories = getSpecDirectories(specsRoot);
    return directories.map((dirName) => getSpecStatus(specsRoot, dirName));
}

function detectLatestValidSpecFolder(specsRoot) {
    const statuses = getAllSpecStatuses(specsRoot);
    const validSpecs = statuses.filter((spec) => spec.isValid);

    if (validSpecs.length === 0) return null;

    return validSpecs[validSpecs.length - 1].name;
}

function printSpecList(specsRoot) {
    const statuses = getAllSpecStatuses(specsRoot);
    const latestValid = detectLatestValidSpecFolder(specsRoot);

    console.log("\nSpecs found in docs/specs:\n");

    for (const spec of statuses) {
        if (spec.isValid) {
            const latestMark = spec.name === latestValid ? " ← latest valid" : "";
            console.log(`✓ ${spec.name}${latestMark}`);
        } else {
            console.log(`✗ ${spec.name}`);
            console.log(`  Missing: ${spec.missingFiles.join(", ")}`);
        }
    }

    console.log("");
}

function buildPrompt({
                         mode,
                         template,
                         specFolder,
                         requirementsFile,
                         designFile,
                         tasksFile,
                         analysisFile,
                         resolveFile,
                     }) {
    return template
        .replaceAll("SPEC_FOLDER", specFolder)
        .replaceAll("REQUIREMENTS_FILE", requirementsFile)
        .replaceAll("DESIGN_FILE", designFile)
        .replaceAll("TASKS_FILE", tasksFile)
        .replaceAll("ANALYSIS_FILE", analysisFile || "")
        .replaceAll("RESOLVE_FILE", resolveFile || "");
}

if (!modeArg) {
    fail(
        "Usage: node scripts/codex-spec.mjs [analysis|resolve|plan|implement|validate|list|new] [spec-folder]"
    );
}

if (!VALID_MODES.has(modeArg)) {
    fail(`Unknown mode "${modeArg}"`);
}

const specsRoot = repoPath("docs", "specs");
const promptsRoot = repoPath("docs", "Prompts");

if (modeArg === "list") {
    printSpecList(specsRoot);
    process.exit(0);
}

if (modeArg === "new") {
    if (!specFolderArg) {
        fail('Usage: node scripts/codex-spec.mjs new <spec-folder> ["Spec Title"]');
    }
    const titleArg = process.argv.slice(4).join(" ");
    createSpecFromTemplate(specsRoot, specFolderArg, titleArg);
    process.exit(0);
}

let specFolder = specFolderArg;

if (!specFolder) {
    specFolder = detectLatestValidSpecFolder(specsRoot);
    if (!specFolder) {
        fail("No valid specs found.");
    }
}

const specBase = path.join(specsRoot, specFolder);

if (!fileExists(specBase)) {
    fail(`Spec folder does not exist: ${specFolder}`);
}

const specStatus = getSpecStatus(specsRoot, specFolder);

if (!specStatus.isValid) {
    fail(
        `Spec "${specFolder}" is incomplete. Missing: ${specStatus.missingFiles.join(", ")}`
    );
}

const promptTemplateFile = path.join(promptsRoot, `spec-${modeArg}.md`);

if (!fileExists(promptTemplateFile)) {
    fail(`Missing prompt template: ${promptTemplateFile}`);
}

const requirementsRel = `docs/specs/${specFolder}/requirements.md`;
const designRel = `docs/specs/${specFolder}/design.md`;
const tasksRel = `docs/specs/${specFolder}/tasks.md`;
const analysisRel = `docs/specs/${specFolder}/analysis.md`;
const resolveRel = `docs/specs/${specFolder}/resolve.md`;

if (modeArg === "resolve" && !fileExists(path.join(specBase, "analysis.md"))) {
    fail(`Cannot run resolve. Missing: ${analysisRel}`);
}

if (modeArg === "plan" && !fileExists(path.join(specBase, "resolve.md"))) {
    fail(`Cannot run plan. Missing: ${resolveRel}`);
}

const template = readFile(promptTemplateFile);

const finalPrompt = buildPrompt({
    mode: modeArg,
    template,
    specFolder,
    requirementsFile: requirementsRel,
    designFile: designRel,
    tasksFile: tasksRel,
    analysisFile: analysisRel,
    resolveFile: resolveRel,
});

const promptOutFile = path.join(specBase, `${modeArg}-prompt.md`);
writeFile(promptOutFile, finalPrompt);

console.log("\n================ PROMPT ================\n");
console.log(finalPrompt);
console.log("\n========================================\n");
console.log(`Saved prompt to: docs/specs/${specFolder}/${modeArg}-prompt.md\n`);
