type CheckInUserLookupInput = {
  userClerkId?: string
  email?: string
}

type UserLookupCriterion =
  | {
      clerkId: string
    }
  | {
      email: string
    }

export function buildCheckInUserLookupCriteria(input: CheckInUserLookupInput): UserLookupCriterion[] {
  const criteria: UserLookupCriterion[] = []

  if (input.userClerkId) {
    criteria.push({ clerkId: input.userClerkId })
  }

  if (input.email) {
    criteria.push({ email: input.email })
  }

  return criteria
}
