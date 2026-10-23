export const formatEnrollmentOptionPrice = (price: number | null | undefined) => {
  if (typeof price !== "number" || !Number.isFinite(price)) return null
  return `$${Number.isInteger(price) ? price.toFixed(0) : price.toFixed(2)}`
}

/** "regular $X price", or "regular price" when the price is unknown (never a made-up amount). */
export const formatRegularPricePhrase = (price: number | null | undefined) => {
  const formatted = formatEnrollmentOptionPrice(price)
  return formatted ? `regular ${formatted} price` : "regular price"
}
