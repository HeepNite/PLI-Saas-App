import { expect, test } from "@playwright/test"

const PROMOTION_DEADLINE_MS = new Date("2026-08-30T14:00:00.000Z").getTime()
const promotionActive = Date.now() < PROMOTION_DEADLINE_MS
const expectedPrice = promotionActive ? "$20" : "$25"
const expectedReserveLabel = `Reserve for ${expectedPrice}`

test.beforeEach(async ({ page }) => {
  await page.route("**/videos/SalsaClass.mp4", (route) => route.fulfill({ status: 204 }))
})

for (const viewport of [
  { name: "mobile", width: 375, height: 812 },
  { name: "desktop", width: 1440, height: 900 },
]) {
  test(`active banner opens and safely reopens the one reservation dialog on ${viewport.name}`, async ({ page }) => {
    test.skip(!promotionActive, "The promotion banner is intentionally absent after its deadline.")
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.goto("/special-salsa-class?campaign=social")

    const bannerCta = page.getByRole("link", { name: "Reserve now" })
    await expect(bannerCta).toHaveAttribute("href", "/special-salsa-class?campaign=social&reserve=1")
    await bannerCta.click()

    const dialog = page.getByRole("dialog", { name: "Reserve your spot" })
    await expect(dialog).toHaveCount(1)
    await expect(dialog.getByLabel("Name")).toBeFocused()
    await dialog.getByLabel("Name").fill("Banner Guest")
    await expect(page).toHaveURL(/\/special-salsa-class\?campaign=social(?:&reserve=1)?$/)

    await dialog.getByRole("button", { name: "Close reservation dialog" }).click()
    await expect(dialog).toHaveCount(0)
    await expect(page).toHaveURL(/\/special-salsa-class\?campaign=social$/)
    await expect(page.getByRole("link", { name: "Reserve now" })).toBeFocused()

    const landingCta = page.getByRole("button", { name: "Reserve here" })
    await landingCta.click()
    await expect(dialog).toHaveCount(1)
    await expect(dialog.getByLabel("Name")).toBeFocused()
    await expect(dialog.getByLabel("Name")).toHaveValue("Banner Guest")
    await dialog.getByRole("button", { name: "Close reservation dialog" }).click()
    await expect(landingCta).toBeFocused()

    await page.getByRole("link", { name: "Reserve now" }).click()
    await expect(dialog).toHaveCount(1)
    await expect(dialog.getByLabel("Name")).toHaveValue("Banner Guest")
    await dialog.getByRole("button", { name: "Close reservation dialog" }).click()
    await page.goBack()
    await expect(dialog).toHaveCount(0)
    await page.goForward()
    expect(await dialog.count()).toBeLessThanOrEqual(1)
    if (await dialog.count()) {
      await expect(dialog.getByLabel("Name")).toBeFocused()
      await dialog.getByRole("button", { name: "Close reservation dialog" }).click()
    }
    await expect(page).toHaveURL(/\/special-salsa-class\?campaign=social$/)
  })
}

test("direct reservation URL preserves unrelated query and does not reopen after close and refresh", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto("/special-salsa-class?campaign=direct&reserve=1")

  const dialog = page.getByRole("dialog", { name: "Reserve your spot" })
  await expect(dialog).toHaveCount(1)
  await expect(dialog.getByLabel("Name")).toBeFocused()
  await dialog.getByRole("button", { name: "Close reservation dialog" }).click()
  await expect(page).toHaveURL(/\/special-salsa-class\?campaign=direct$/)

  await page.reload()
  await expect(dialog).toHaveCount(0)
  await page.getByRole("button", { name: "Reserve here" }).click()
  await expect(dialog).toHaveCount(1)
})

test("expired promotion removes the banner while the landing opens the regular-price dialog", async ({ page }) => {
  await page.clock.install({ time: new Date(PROMOTION_DEADLINE_MS) })
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto("/special-salsa-class")

  await expect(page.locator("[data-promotion-banner]")).toHaveCount(0)
  await expect(page.getByRole("link", { name: "Reserve now" })).toHaveCount(0)
  await expect(page.locator("[data-hero-price]")).toHaveText("$25")

  await page.getByRole("button", { name: "Reserve here" }).click()
  const dialog = page.getByRole("dialog", { name: "Reserve your spot" })
  await expect(dialog).toHaveCount(1)
  await expect(dialog.getByLabel("Name")).toBeFocused()
  await expect(dialog.getByRole("button", { name: "Reserve for $25" })).toBeVisible()
})

test("public mobile landing exposes accessible event facts and guest checkout", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.setViewportSize({ width: 375, height: 812 })
  const requestedMapAssets: string[] = []
  page.on("request", (request) => {
    if (request.url().includes("/images/salsa-de-cali-")) requestedMapAssets.push(request.url())
  })
  const mapResponse = page.waitForResponse((response) => response.url().endsWith("/images/salsa-de-cali-coles-st-map.png"))
  await page.goto("/special-salsa-class")
  await expect((await mapResponse).ok()).toBe(true)

  await expect(page).toHaveTitle("Salsa de Cali | PLI")
  await expect(page.getByRole("heading", { name: "Salsa de Cali" })).toBeVisible()
  await expect(page.getByRole("link", { name: "Home" })).toBeVisible()
  await expect(page.getByRole("searchbox", { name: "Search courses" })).toHaveAttribute("placeholder", "Search courses...")
  await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible()
  await page.getByRole("button", { name: "Open menu" }).click()
  await expect(page.getByRole("button", { name: "Log in" })).toBeVisible()
  await page.keyboard.press("Escape")
  await expect(page.locator('time[datetime="2026-08-30T16:00:00-04:00"]')).toHaveAttribute("aria-label", "Sunday, August 30, 2026 at 4:00 PM")
  await expect(page.getByText("4:00 PM", { exact: true })).toBeVisible()
  await expect(page.getByText("54 Coles St, Jersey City")).toBeVisible()
  await expect(page.getByLabel("Promotional video for Salsa de Cali")).toHaveJSProperty("autoplay", false)
  await expect(page.locator("body")).not.toContainText("America/New_York")
  await expect(page.getByLabel("Name")).toHaveCount(0)
  await expect(page.getByLabel("Phone")).toHaveCount(0)
  await expect(page.getByLabel("Email")).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Open assistant" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Home", exact: true })).toHaveCount(0)
  await expect(page.locator(".assistant-bubble, .floating-top")).toHaveCount(0)
  await expect(page.getByRole("button", { name: "View details" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Reserve here" })).toBeVisible()
  await expect(page.locator("[data-hero-price]")).toHaveText(expectedPrice)
  await expect(page.locator("[data-hero-details]").getByRole("button", { name: expectedReserveLabel })).toHaveCount(0)
  if (promotionActive) {
    await expect(page.getByText("Get your spot for $20 — save 20% until Sunday at 10:00 AM.")).toBeVisible()
    await expect(page.getByRole("link", { name: "Reserve now" })).toHaveAttribute("href", "/special-salsa-class?reserve=1")
    await expect(page.locator("[data-promotion-time]")).toContainText(/(?:day|hour|min)/)
    await expect(page.locator("[data-countdown-icon]")).toHaveCount(0)
    await expect(page.locator("[data-promotion-banner]")).not.toContainText(/\d{2}:\d{2}:\d{2}/)
    expect((await page.locator("[data-promotion-banner]").boundingBox())?.height).toBeLessThanOrEqual(100)
  } else {
    await expect(page.getByText(/Get your spot for \$20/)).toHaveCount(0)
  }
  const mapCard = page.locator("[data-map-thumbnail]")
  const mapLink = mapCard.getByRole("link", { name: /Open 54 Coles St, Jersey City in Apple Maps/ })
  const attributionLink = mapCard.getByRole("link", { name: /OpenStreetMap map data attribution/ })
  await expect(mapLink).toHaveAttribute("href", "https://maps.apple.com/?q=54%20Coles%20St%2C%20Jersey%20City%2C%20NJ%2007302")
  await expect(mapLink).toHaveAttribute("target", "_blank")
  await expect(mapLink).toHaveAttribute("rel", "noopener noreferrer")
  await expect(mapLink.locator("img")).toHaveAttribute("src", "/images/salsa-de-cali-coles-st-map.png")
  expect(requestedMapAssets.some((url) => url.endsWith("/images/salsa-de-cali-coles-st-map.png"))).toBe(true)
  expect(requestedMapAssets.some((url) => url.endsWith("/images/salsa-de-cali-street-map.png"))).toBe(false)
  await expect(mapLink.locator("img")).toHaveAttribute("alt", "Close color street map with one PLI location marker near 54 Coles St, Jersey City")
  await expect(mapLink.locator("[data-map-image]")).toBeVisible()
  await expect(mapLink.locator("[data-map-image] img")).toHaveCSS("filter", "brightness(0.82)")
  await expect(mapLink.locator("[data-map-caption]")).toContainText("54 Coles St, Jersey City")
  await expect(mapLink.locator("[data-map-caption]")).toHaveCSS("filter", "none")
  await expect(mapLink.locator("[data-map-caption] svg")).toHaveCount(0)
  await expect(mapLink.locator("[data-map-attribution]")).toHaveCount(0)
  await expect(page.locator("[data-map-attribution]")).toHaveCount(1)
  await expect(mapCard.locator("[data-map-attribution]")).toHaveText("Map data © OpenStreetMap contributors")
  await expect(mapCard.locator("[data-map-attribution]")).toHaveCSS("filter", "none")
  await expect(attributionLink).toHaveAttribute("href", "https://www.openstreetmap.org/copyright")
  await expect(attributionLink).toHaveAttribute("target", "_blank")
  await expect(attributionLink).toHaveAttribute("rel", "noopener noreferrer")
  await expect(mapCard.locator("a a")).toHaveCount(0)
  await expect(page.locator("[data-date-representation]")).not.toHaveAttribute("aria-hidden", "true")
  await expect(page.locator("[data-date-month]")).toHaveAttribute("aria-hidden", "true")
  await expect(page.locator("[data-date-day]")).toHaveAttribute("aria-hidden", "true")
  await expect(page.locator("[data-date-month]")).toHaveCSS("color", "rgb(251, 113, 133)")
  await expect(page.locator("[data-date-day]")).toHaveText("30")
  await expect(page.locator("[data-date-weekday]")).toHaveText("SUNDAY AT")
  await expect(page.locator("[data-date-weekday]")).toHaveCSS("color", "rgb(251, 113, 133)")
  await expect(page.locator("[data-event-time]")).toHaveText("4:00 PM")
  await expect(page.locator("[data-event-time]")).toHaveCSS("color", "rgb(248, 250, 252)")
  await expect(page.locator("[data-date-supporting-line]")).toHaveText("SUNDAY AT4:00 PM")
  await expect(page.locator("[data-calendar-footer]")).toHaveCount(0)
  await expect(page.locator("[data-date-card]")).not.toContainText("Salsa de Cali")
  await expect(page.locator("[data-date-card] button, [data-date-card] [role='grid']")).toHaveCount(0)
  await expect(mapLink.locator("canvas, button")).toHaveCount(0)
  await expect(page.locator("[data-hero-cta]")).toHaveCSS("font-size", "15px")
  await page.locator("[data-hero-cta]").click()
  const dialog = page.getByRole("dialog", { name: "Reserve your spot" })
  await expect(dialog).toBeVisible()
  await expect(page.getByLabel("Name")).toBeFocused()
  await expect(page.locator("body")).toHaveCSS("overflow", "hidden")
  const dialogGeometry = await dialog.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    const scrollRegion = element.querySelector("[data-reservation-scroll]") as HTMLElement
    return {
      top: rect.top,
      bottom: rect.bottom,
      left: rect.left,
      right: rect.right,
      overflowY: getComputedStyle(scrollRegion).overflowY,
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
    }
  })
  expect(dialogGeometry.top).toBeGreaterThanOrEqual(0)
  expect(dialogGeometry.bottom).toBeLessThanOrEqual(812)
  expect(dialogGeometry.left).toBeGreaterThanOrEqual(0)
  expect(dialogGeometry.right).toBeLessThanOrEqual(375)
  expect(dialogGeometry.overflowY).toBe("auto")
  expect(dialogGeometry.documentWidth).toBe(dialogGeometry.viewportWidth)
  await page.getByLabel("Name").fill("Ada Lovelace")
  await page.locator("[data-reservation-scroll]").evaluate((element) => { element.scrollTop = element.scrollHeight })
  await expect(dialog.getByRole("button", { name: expectedReserveLabel })).toBeVisible()
  await expect(dialog.getByRole("button", { name: "Close reservation dialog" })).toBeVisible()
  await dialog.getByRole("button", { name: "Close reservation dialog" }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.locator("[data-hero-cta]")).toBeFocused()
  await page.locator("[data-hero-cta]").click()
  await expect(page.getByLabel("Name")).toHaveValue("Ada Lovelace")
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
})

test("desktop hero is one joined 40/60 card with aligned media and details", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/special-salsa-class")

  const hero = page.locator("[data-special-hero]")
  const geometry = await hero.evaluate((element) => {
    const media = element.querySelector("[data-hero-media]") as HTMLElement
    const details = element.querySelector("[data-hero-details]") as HTMLElement
    const factsRow = element.querySelector("[data-event-facts-row]") as HTMLElement
    const purchaseRow = element.querySelector("[data-purchase-row]") as HTMLElement
    const price = purchaseRow.querySelector("[data-hero-price]") as HTMLElement
    const action = purchaseRow.querySelector("[data-hero-cta]") as HTMLElement
    const heroRect = element.getBoundingClientRect()
    const mediaRect = media.getBoundingClientRect()
    const detailsRect = details.getBoundingClientRect()
    const factRects = Array.from(factsRow.children).map((child) => child.getBoundingClientRect())
    const priceRect = price.getBoundingClientRect()
    const actionRect = action.getBoundingClientRect()
    const style = getComputedStyle(element)
    return {
      columns: style.gridTemplateColumns.split(" ").filter(Boolean).length,
      borderWidth: style.borderTopWidth,
      overflow: style.overflow,
      mediaRatio: mediaRect.width / heroRect.width,
      heightDelta: Math.abs(mediaRect.height - detailsRect.height),
      joinGap: Math.abs(detailsRect.left - mediaRect.right),
      factsShareRow: Math.abs((factRects[0]?.top ?? 0) - (factRects[1]?.top ?? 0)) <= 1,
      factsColumns: getComputedStyle(factsRow).gridTemplateColumns.split(" ").filter(Boolean).length,
      factsWidthDelta: Math.abs((factRects[0]?.width ?? 0) - (factRects[1]?.width ?? 0)),
      factsHeightDelta: Math.abs((factRects[0]?.height ?? 0) - (factRects[1]?.height ?? 0)),
      factHeight: factRects[0]?.height ?? 0,
      attributionInsideMapCard: Boolean(element.querySelector("[data-map-thumbnail] [data-map-attribution]")),
      attributionOneLine: (() => {
        const attribution = element.querySelector("[data-map-attribution]") as HTMLElement
        const attributionLink = attribution.querySelector("a") as HTMLAnchorElement
        return attributionLink.getBoundingClientRect().height <= Number.parseFloat(getComputedStyle(attribution).lineHeight) + 1
      })(),
      purchaseSharesRow: Math.abs(
        (priceRect.top + priceRect.height / 2) - (actionRect.top + actionRect.height / 2),
      ) <= 1,
      factsBeforePurchase: factsRow.compareDocumentPosition(purchaseRow) & Node.DOCUMENT_POSITION_FOLLOWING,
      priceBeforeAction: price.compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING,
      purchaseJustify: getComputedStyle(purchaseRow).justifyContent,
      actionDisplay: getComputedStyle(action).display,
      actionFlexGrow: getComputedStyle(action).flexGrow,
      actionWidthRatio: actionRect.width / purchaseRow.getBoundingClientRect().width,
      noInlineForm: document.querySelector("#reserve, [data-reservation-form]") === null,
    }
  })

  expect(geometry.columns).toBe(2)
  expect(geometry.borderWidth).toBe("1px")
  expect(geometry.overflow).toBe("hidden")
  expect(geometry.mediaRatio).toBeGreaterThanOrEqual(0.38)
  expect(geometry.mediaRatio).toBeLessThanOrEqual(0.42)
  expect(geometry.heightDelta).toBeLessThanOrEqual(1)
  expect(geometry.joinGap).toBeLessThanOrEqual(1)
  expect(geometry.factsShareRow).toBe(true)
  expect(geometry.factsColumns).toBe(2)
  expect(geometry.factsWidthDelta).toBeLessThanOrEqual(1)
  expect(geometry.factsHeightDelta).toBeLessThanOrEqual(1)
  expect(geometry.factHeight).toBeGreaterThanOrEqual(204)
  expect(geometry.factHeight).toBeLessThanOrEqual(224)
  expect(geometry.attributionInsideMapCard).toBe(true)
  expect(geometry.attributionOneLine).toBe(true)
  expect(geometry.purchaseSharesRow).toBe(true)
  expect(geometry.factsBeforePurchase).toBeTruthy()
  expect(geometry.priceBeforeAction).toBeTruthy()
  expect(geometry.purchaseJustify).toBe("space-between")
  expect(geometry.actionDisplay).toBe("flex")
  expect(geometry.actionFlexGrow).toBe("0")
  expect(geometry.actionWidthRatio).toBeLessThan(0.6)
  expect(geometry.noInlineForm).toBe(true)
  await expect(page.locator("[data-hero-media] video")).toHaveCSS("object-fit", "cover")
  await expect(page.getByRole("button", { name: "View details" })).toHaveCount(0)
  await expect(page.locator("[data-map-thumbnail] img")).toBeVisible()
})

test("mobile hero keeps the same media-first card without an inline form", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto("/special-salsa-class")

  const hero = page.locator("[data-special-hero]")
  const geometry = await hero.evaluate((element) => {
    const media = element.querySelector("[data-hero-media]") as HTMLElement
    const details = element.querySelector("[data-hero-details]") as HTMLElement
    const factsRow = element.querySelector("[data-event-facts-row]") as HTMLElement
    const purchaseRow = element.querySelector("[data-purchase-row]") as HTMLElement
    const price = purchaseRow.querySelector("[data-hero-price]") as HTMLElement
    const action = purchaseRow.querySelector("[data-hero-cta]") as HTMLElement
    const mediaRect = media.getBoundingClientRect()
    const detailsRect = details.getBoundingClientRect()
    const factRects = Array.from(factsRow.children).map((child) => child.getBoundingClientRect())
    const purchaseRect = purchaseRow.getBoundingClientRect()
    const priceRect = price.getBoundingClientRect()
    const actionRect = action.getBoundingClientRect()
    return {
      columns: getComputedStyle(element).gridTemplateColumns.split(" ").filter(Boolean).length,
      mediaHeight: mediaRect.height,
      mediaBeforeDetails: mediaRect.top < detailsRect.top,
      factsColumns: getComputedStyle(factsRow).gridTemplateColumns.split(" ").filter(Boolean).length,
      factsShareRow: Math.abs((factRects[0]?.top ?? 0) - (factRects[1]?.top ?? 0)) <= 1,
      factsWidthDelta: Math.abs((factRects[0]?.width ?? 0) - (factRects[1]?.width ?? 0)),
      factsHeightDelta: Math.abs((factRects[0]?.height ?? 0) - (factRects[1]?.height ?? 0)),
      factHeight: factRects[0]?.height ?? 0,
      attributionInsideMapCard: Boolean(element.querySelector("[data-map-thumbnail] [data-map-attribution]")),
      purchaseSharesRow: Math.abs(
        (priceRect.top + priceRect.height / 2) - (actionRect.top + actionRect.height / 2),
      ) <= 1,
      purchaseJustify: getComputedStyle(purchaseRow).justifyContent,
      actionDisplay: getComputedStyle(action).display,
      actionFlexGrow: getComputedStyle(action).flexGrow,
      purchaseOverflow: actionRect.right > purchaseRect.right + 1,
      factsBeforePurchase: factsRow.compareDocumentPosition(purchaseRow) & Node.DOCUMENT_POSITION_FOLLOWING,
      priceBeforeAction: price.compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING,
      noInlineForm: document.querySelector("#reserve, [data-reservation-form]") === null,
    }
  })

  expect(geometry.columns).toBe(1)
  expect(geometry.mediaHeight).toBeGreaterThanOrEqual(320)
  expect(geometry.mediaHeight).toBeLessThanOrEqual(380)
  expect(geometry.mediaBeforeDetails).toBe(true)
  expect(geometry.factsColumns).toBe(2)
  expect(geometry.factsShareRow).toBe(true)
  expect(geometry.factsWidthDelta).toBeLessThanOrEqual(1)
  expect(geometry.factsHeightDelta).toBeLessThanOrEqual(1)
  expect(geometry.factHeight).toBeGreaterThanOrEqual(204)
  expect(geometry.factHeight).toBeLessThanOrEqual(224)
  expect(geometry.attributionInsideMapCard).toBe(true)
  expect(geometry.purchaseSharesRow).toBe(true)
  expect(geometry.purchaseJustify).toBe("space-between")
  expect(geometry.actionDisplay).toBe("flex")
  expect(geometry.actionFlexGrow).toBe("0")
  expect(geometry.purchaseOverflow).toBe(false)
  expect(geometry.factsBeforePurchase).toBeTruthy()
  expect(geometry.priceBeforeAction).toBeTruthy()
  expect(geometry.noInlineForm).toBe(true)
  const mapCard = page.locator("[data-map-thumbnail]")
  const mapLink = mapCard.locator("[data-map-link]")
  const mapGeometry = await mapCard.evaluate((element) => {
    const image = element.querySelector("[data-map-image]") as HTMLElement
    const imageElement = image.querySelector("img") as HTMLImageElement
    const caption = element.querySelector("[data-map-caption]") as HTMLElement
    const attribution = element.querySelector("[data-map-attribution]") as HTMLElement
    const initialRect = element.getBoundingClientRect()
    const imageRect = image.getBoundingClientRect()
    const captionRect = caption.getBoundingClientRect()
    const attributionRect = attribution.getBoundingClientRect()
    const captionStyle = getComputedStyle(caption)
    return {
      imageAboveCaption: imageRect.bottom <= captionRect.top + 1,
      attributionBelowCaption: captionRect.bottom <= attributionRect.top + 1,
      imageHeight: imageRect.height,
      naturalWidth: imageElement.naturalWidth,
      naturalHeight: imageElement.naturalHeight,
      captionHeight: captionRect.height,
      captionInsideCard: captionRect.bottom <= initialRect.bottom + 1,
      attributionInsideCard: attributionRect.bottom <= initialRect.bottom + 1,
      cardHeight: initialRect.height,
      captionFont: Number.parseFloat(captionStyle.fontSize),
      captionAlignment: captionStyle.textAlign,
      captionFits: caption.scrollWidth <= caption.clientWidth,
      captionIcons: caption.querySelectorAll("svg").length,
      anchorCount: element.querySelectorAll("a").length,
      nestedAnchorCount: element.querySelectorAll("a a").length,
    }
  })
  expect(mapGeometry.imageAboveCaption).toBe(true)
  expect(mapGeometry.attributionBelowCaption).toBe(true)
  expect(mapGeometry.imageHeight).toBeGreaterThanOrEqual(152)
  expect(mapGeometry.naturalWidth).toBe(1200)
  expect(mapGeometry.naturalHeight).toBe(700)
  expect(mapGeometry.captionHeight).toBeGreaterThanOrEqual(35)
  expect(mapGeometry.captionHeight).toBeLessThanOrEqual(37)
  expect(mapGeometry.captionInsideCard).toBe(true)
  expect(mapGeometry.attributionInsideCard).toBe(true)
  expect(mapGeometry.cardHeight).toBe(216)
  expect(mapGeometry.captionFont).toBe(13)
  expect(mapGeometry.captionAlignment).toBe("center")
  expect(mapGeometry.captionFits).toBe(true)
  expect(mapGeometry.captionIcons).toBe(0)
  expect(mapGeometry.anchorCount).toBe(2)
  expect(mapGeometry.nestedAnchorCount).toBe(0)

  const attributionGeometry = await page.locator("[data-map-attribution]").evaluate((attribution) => {
    const attributionRect = attribution.getBoundingClientRect()
    const cardRect = attribution.closest("[data-map-thumbnail]")!.getBoundingClientRect()
    const lineHeight = Number.parseFloat(getComputedStyle(attribution).lineHeight)
    return {
      readable: attributionRect.width > 0 && attributionRect.height > 0 && Number.parseFloat(getComputedStyle(attribution).fontSize) >= 8,
      lineCount: Math.round(attributionRect.height / lineHeight),
      fullyInsideCard: attributionRect.top >= cardRect.top && attributionRect.bottom <= cardRect.bottom,
      notClipped: attribution.scrollHeight <= attribution.clientHeight,
      notOverflowing: attributionRect.left >= 0 && attributionRect.right <= document.documentElement.clientWidth,
    }
  })
  expect(attributionGeometry.readable).toBe(true)
  expect(attributionGeometry.lineCount).toBeLessThanOrEqual(2)
  expect(attributionGeometry.fullyInsideCard).toBe(true)
  expect(attributionGeometry.notClipped).toBe(true)
  expect(attributionGeometry.notOverflowing).toBe(true)

  const beforeHover = await mapLink.boundingBox()
  await mapLink.hover()
  const afterHover = await mapLink.boundingBox()
  expect(afterHover?.width).toBe(beforeHover?.width)
  expect(afterHover?.height).toBe(beforeHover?.height)
  await mapLink.focus()
  await expect(mapLink).toBeFocused()
  expect(await mapLink.evaluate((element) => getComputedStyle(element).boxShadow)).not.toBe("none")

  const dateMetrics = await page.locator("[data-date-card]").evaluate((calendar) => {
    const month = calendar.querySelector("[data-date-month]") as HTMLElement
    const day = calendar.querySelector("[data-date-day]") as HTMLElement
    const weekday = calendar.querySelector("[data-date-weekday]") as HTMLElement
    const supportingLine = calendar.querySelector("[data-date-supporting-line]") as HTMLElement
    const time = calendar.querySelector("[data-event-time]") as HTMLElement
    const weekdayRect = weekday.getBoundingClientRect()
    const timeRect = time.getBoundingClientRect()
    return {
      monthFont: Number.parseFloat(getComputedStyle(month).fontSize),
      monthColor: getComputedStyle(month).color,
      dayFont: Number.parseFloat(getComputedStyle(day).fontSize),
      weekdayFont: Number.parseFloat(getComputedStyle(weekday).fontSize),
      weekdayColor: getComputedStyle(weekday).color,
      timeColor: getComputedStyle(time).color,
      supportingFont: Number.parseFloat(getComputedStyle(supportingLine).fontSize),
      supportingTwoLines: timeRect.top >= weekdayRect.bottom - 1,
      supportingCentered: Math.abs((weekdayRect.left + weekdayRect.right) / 2 - (timeRect.left + timeRect.right) / 2) <= 1,
      supportingFits: supportingLine.scrollWidth <= supportingLine.clientWidth && supportingLine.scrollHeight <= supportingLine.clientHeight,
      footerCount: calendar.querySelectorAll("[data-calendar-footer]").length,
    }
  })
  expect(dateMetrics.monthFont).toBe(13)
  expect(dateMetrics.monthColor).toBe("rgb(251, 113, 133)")
  expect(dateMetrics.dayFont).toBe(84)
  expect(dateMetrics.weekdayFont).toBe(13)
  expect(dateMetrics.weekdayColor).toBe("rgb(251, 113, 133)")
  expect(dateMetrics.timeColor).toBe("rgb(248, 250, 252)")
  expect(dateMetrics.supportingFont).toBe(13)
  expect(dateMetrics.supportingTwoLines).toBe(true)
  expect(dateMetrics.supportingCentered).toBe(true)
  expect(dateMetrics.supportingFits).toBe(true)
  expect(dateMetrics.footerCount).toBe(0)
  await expect(page.locator("[data-hero-cta]")).toHaveCSS("font-size", "15px")
  const heroToQuoteGap = await page.evaluate(() => {
    const hero = document.querySelector("[data-special-hero]")?.getBoundingClientRect()
    const quoteCard = document.querySelector("#site-footer blockquote")?.parentElement?.getBoundingClientRect()
    return hero && quoteCard ? quoteCard.top - hero.bottom : null
  })
  expect(heroToQuoteGap).not.toBeNull()
  expect(heroToQuoteGap!).toBeGreaterThanOrEqual(24)
  expect(heroToQuoteGap!).toBeLessThanOrEqual(40)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
})

test("default public layout retains its floating assistant and back-to-top control", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 })
  await page.goto("/")

  await expect(page.locator("[data-countdown-icon]")).toBeVisible()
  await expect(page.locator("[data-countdown-icon]").locator("..")).toContainText(/\d{2}:\d{2}:\d{2}/)
  await expect(page.locator("[data-promotion-time]")).toHaveCount(0)
  await expect(page.locator('a[href="/courses/salsa-nocturno?enroll=1"]')).toBeVisible()
  await expect(page.getByRole("button", { name: "Open assistant" })).toBeVisible()
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await expect(page.getByRole("button", { name: "Back to top" })).toBeVisible()
})

test("desktop landing renders its initial state and focuses a generic API error", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.route("**/api/checkout/session", (route) => route.fulfill({
    status: 500,
    contentType: "application/json",
    body: JSON.stringify({ error: "Checkout could not be started." }),
  }))
  await page.goto("/special-salsa-class")

  await expect(page.getByRole("heading", { name: "Salsa de Cali" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Reserve your spot" })).toHaveCount(0)
  const desktopColumns = await page.locator("[data-special-hero]").evaluate((section) =>
    getComputedStyle(section).gridTemplateColumns.split(" ").filter(Boolean).length,
  )
  expect(desktopColumns).toBeGreaterThan(1)

  await page.getByRole("button", { name: "Reserve here" }).click()
  const dialog = page.getByRole("dialog", { name: "Reserve your spot" })
  await dialog.getByLabel("Name").fill("Ada Lovelace")
  await dialog.getByLabel("Phone").fill("+12015550123")
  await dialog.getByLabel("Email").fill("ada@example.com")
  await dialog.getByRole("button", { name: expectedReserveLabel }).click()

  const error = page.getByRole("alert", { name: "" }).filter({ hasText: "Checkout could not be started." })
  await expect(error).toBeVisible()
  await expect(error).toBeFocused()
})

test("keyboard validation focuses the first invalid field", async ({ page }) => {
  await page.goto("/special-salsa-class")
  await page.getByRole("button", { name: "Reserve here" }).click()
  await page.getByRole("dialog", { name: "Reserve your spot" }).getByRole("button", { name: expectedReserveLabel }).focus()
  await page.keyboard.press("Enter")

  await expect(page.getByLabel("Name")).toBeFocused()
  await expect(page.getByText("Please enter your name.")).toBeVisible()
})

test("raced sold-out outcome remains public and focused inside the dialog", async ({ page }) => {
  await page.goto("/special-salsa-class")
  await page.route("**/api/checkout/session", (route) => route.fulfill({
    status: 409,
    contentType: "application/json",
    body: JSON.stringify({ code: "SOLD_OUT", error: "This class is sold out." }),
  }))
  await page.getByRole("button", { name: "Reserve here" }).click()
  const dialog = page.getByRole("dialog", { name: "Reserve your spot" })
  await dialog.getByLabel("Name").fill("Ada Lovelace")
  await dialog.getByLabel("Phone").fill("+12015550123")
  await dialog.getByLabel("Email").fill("ada@example.com")
  await dialog.getByRole("button", { name: expectedReserveLabel }).click()

  await expect(page.getByRole("heading", { name: "Sold out" })).toBeVisible()
  await expect(dialog.getByRole("button", { name: "Sold out" })).toBeDisabled()
  await expect(page.getByRole("status").filter({ hasText: "All 40 spots" })).toBeFocused()
})

test.describe("public confirmation outcomes", () => {
  test.skip(!process.env.PLAYWRIGHT_SPECIAL_CLASS_MOCKS, "PLAYWRIGHT_SPECIAL_CLASS_MOCKS=1 is required for server-side confirmation mocks.")

  test("focuses the confirmed outcome without nesting main landmarks", async ({ page }) => {
    await page.goto("/special-salsa-class/confirmation?test_state=confirmed")

    await expect(page.getByRole("heading", { name: "Reservation confirmed" })).toBeVisible()
    await expect(page.getByRole("status")).toBeFocused()
    await expect(page.locator("main")).toHaveCount(1)
    await expect(page.locator(".assistant-bubble, .floating-top")).toHaveCount(0)
  })

  test("focuses the finalizing outcome while webhook persistence is pending", async ({ page }) => {
    await page.goto("/special-salsa-class/confirmation?test_state=finalizing")

    await expect(page.getByRole("heading", { name: "Payment received" })).toBeVisible()
    await expect(page.getByText("We are finalizing your reservation now.")).toBeVisible()
    await expect(page.getByRole("status")).toBeFocused()
    await expect(page.locator("main")).toHaveCount(1)
    await expect(page.locator(".assistant-bubble, .floating-top")).toHaveCount(0)
  })
})
