import { redirect } from "next/navigation"

type PageProps = {
  params: Promise<{ slug: string }>
}

export default async function StaffSchoolCourseRedirectPage({ params }: PageProps) {
  const { slug } = await params
  const safeSlug = typeof slug === "string" ? slug.trim() : ""
  if (!safeSlug) {
    redirect("/staff/portal?nav=schedule")
  }
  redirect(`/staff/portal?nav=schedule&course=${encodeURIComponent(safeSlug)}`)
}

