import { NextResponse } from "next/server"
import { getCatalogFrontData } from "@/lib/catalog-courses"

export const runtime = "nodejs"

export async function GET() {
  try {
    const { courses } = await getCatalogFrontData()
    return NextResponse.json({ courses })
  } catch (error) {
    console.error("Catalog courses GET failed", error)
    return NextResponse.json({ error: "Unable to load courses" }, { status: 500 })
  }
}
