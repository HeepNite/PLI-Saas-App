import { NextResponse } from "next/server"
import { auth, clerkClient } from "@clerk/nextjs/server"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    const authResult = await auth()
    if (!authResult.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get("file")

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Archivo inválido." }, { status: 400 })
    }

    const client = await clerkClient()
    const updated = await client.users.updateUserProfileImage(authResult.userId, { file })

    return NextResponse.json({ imageUrl: updated.imageUrl })
  } catch (error) {
    console.error("Avatar update failed", error)
    return NextResponse.json({ error: "No se pudo actualizar el avatar." }, { status: 500 })
  }
}
