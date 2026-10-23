export interface VercelDeployCheck {
  ok: boolean
  reason: string
}

export function checkVercelDeploy(env: Record<string, string | undefined>): VercelDeployCheck
