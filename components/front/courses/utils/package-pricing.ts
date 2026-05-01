export const formatEnrollmentOptionPrice = (price: number | null | undefined) => {
  if (typeof price !== "number" || !Number.isFinite(price)) return null
  return `$${price.toFixed(0)}`
}
