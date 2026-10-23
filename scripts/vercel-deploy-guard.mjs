import { pathToFileURL } from "node:url"

// Only these branches may build on Vercel. Production builds must come from main,
// preview builds from codex/develop. Deploys from any other branch, or from a local
// folder with no git branch (`vercel --prod`), fail before touching any database.
const ALLOWED_BRANCH_BY_ENV = {
  production: "main",
  preview: "codex/develop",
}

export function checkVercelDeploy(env) {
  if (env.VERCEL !== "1") return { ok: true, reason: "not a Vercel build" }

  const target = env.VERCEL_ENV
  const allowedBranch = ALLOWED_BRANCH_BY_ENV[target]
  if (!allowedBranch) return { ok: true, reason: `no branch rule for ${target}` }

  const branch = env.VERCEL_GIT_COMMIT_REF || ""
  if (branch === allowedBranch) return { ok: true, reason: `${target} from ${branch}` }

  return {
    ok: false,
    reason:
      `Blocked ${target} deploy from ${branch ? `branch "${branch}"` : "a local folder with no git branch"}. ` +
      `${target} only deploys from "${allowedBranch}": merge a PR into it instead of running vercel deploy.`,
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const result = checkVercelDeploy(process.env)
  if (!result.ok) {
    console.error(`[vercel-deploy-guard] ${result.reason}`)
    process.exit(1)
  }
  console.log(`[vercel-deploy-guard] ok: ${result.reason}`)
}
