import { test, expect } from "@playwright/test"

test("profile page renders", async ({ page }) => {
  await page.goto("/client-profile?lang=es")
  await expect(page.getByText("Completa tu perfil y gana puntos")).toBeVisible()
})

test("profile form can be closed and reopened", async ({ page }) => {
  await page.goto("/client-profile?lang=es")

  const closeBtn = page.getByRole("button", { name: "Cerrar" })
  await expect(closeBtn).toBeVisible()
  await closeBtn.click()

  await expect(page.getByText("Completa tu perfil y gana puntos")).toBeHidden()

  await page.getByRole("button", { name: "Editar perfil" }).click()
  await expect(page.getByText("Completa tu perfil y gana puntos")).toBeVisible()
})
