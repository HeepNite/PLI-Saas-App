import { NextResponse } from "next/server"

export const apiError = (error: string, status: number, details?: unknown) =>
  NextResponse.json(details === undefined ? { error } : { error, details }, { status })

const apiOk = <T>(data: T, status = 200) =>
  NextResponse.json(data, { status })

export async function readJsonBody(req: Request): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; response: NextResponse }> {
  try {
    const body = await req.json()

    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return { ok: false, response: apiError("Invalid JSON body", 400) }
    }

    return { ok: true, body: body as Record<string, unknown> }
  } catch {
    return { ok: false, response: apiError("Invalid JSON body", 400) }
  }
}
