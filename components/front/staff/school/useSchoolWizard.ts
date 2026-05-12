"use client"

import { useCallback, useState } from "react"
import type { SchoolWizardEntity, SchoolWizardState, StepEnabledContext } from "./school-wizard-types"
import { WIZARD_STEP_CONFIGS } from "./school-wizard-configs"

function getEnabledStepIndices(entity: SchoolWizardEntity, ctx?: StepEnabledContext): number[] {
  const steps = WIZARD_STEP_CONFIGS[entity]
  return steps.reduce<number[]>((acc, step, i) => {
    if (!step.enabled || !ctx || step.enabled(ctx)) acc.push(i)
    return acc
  }, [])
}

export function useSchoolWizard(): SchoolWizardState {
  const [activeEntity, setActiveEntity] = useState<SchoolWizardEntity>("courses")
  const [stepByEntity, setStepByEntity] = useState<Record<SchoolWizardEntity, number>>({
    courses: 0,
    rooms: 0,
    packages: 0,
    points: 0,
  })

  const step = stepByEntity[activeEntity]
  const totalSteps = WIZARD_STEP_CONFIGS[activeEntity].length

  const setStep = useCallback(
    (n: number) => {
      setStepByEntity((prev) => ({
        ...prev,
        [activeEntity]: Math.max(0, Math.min(n, WIZARD_STEP_CONFIGS[activeEntity].length - 1)),
      }))
    },
    [activeEntity],
  )

  const goToEntity = useCallback((entity: SchoolWizardEntity) => {
    setActiveEntity(entity)
  }, [])

  const nextStep = useCallback(
    (ctx?: StepEnabledContext) => {
      setStepByEntity((prev) => {
        const current = prev[activeEntity]
        const enabled = getEnabledStepIndices(activeEntity, ctx)
        const nextEnabled = enabled.find((i) => i > current)
        if (nextEnabled === undefined) return prev
        return { ...prev, [activeEntity]: nextEnabled }
      })
    },
    [activeEntity],
  )

  const prevStep = useCallback(
    (ctx?: StepEnabledContext) => {
      setStepByEntity((prev) => {
        const current = prev[activeEntity]
        const enabled = getEnabledStepIndices(activeEntity, ctx)
        const prevEnabled = [...enabled].reverse().find((i) => i < current)
        if (prevEnabled === undefined) return prev
        return { ...prev, [activeEntity]: prevEnabled }
      })
    },
    [activeEntity],
  )

  return { activeEntity, step, setStep, goToEntity, nextStep, prevStep, totalSteps }
}
