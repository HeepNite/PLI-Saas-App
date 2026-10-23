export const formatEnrollmentOptionPrice = (price: number | null | undefined) => {
  if (typeof price !== "number" || !Number.isFinite(price)) return null
  return `$${Number.isInteger(price) ? price.toFixed(0) : price.toFixed(2)}`
}
