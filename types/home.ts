export type HomeCourse = {
  id: string
  title: string
  teacher: string
  image: string
  students?: string | number
  duration?: string
  badge?: string
  category?: string
  size?: "sm" | "md" | "lg"
  description?: string
  slug?: string
  previewVideo?: string
}

export type HomeReviewSlide = {
  image: string
  text: string
  author: string
  role?: string
}
