# Heritage Pin Campaign — Resolved Decisions

## Product Decisions

1. **Beneficiaries:** Any student may earn one Heritage country pin; the campaign is not limited to first-time students.
2. **Acquisition:** A successful card/wallet payment from the public campaign journey during the bounded acquisition window creates a pending entitlement.
3. **Country:** The visitor selects a country from a controlled list. Country of origin is campaign data, not the billing-address country.
4. **Physical handoff:** Payment does not claim physical possession. Staff must mark the pin delivered.
5. **Recurring benefit:** A delivered holder pays a fixed US$15 for eligible Sunday/Monday class occurrences during the bounded benefit window.
6. **Extension:** October 2026 is the default. Central configuration may extend acquisition and/or benefit end dates, including into the first week of November.
7. **Discount overlap:** The US$15 pin price is one complete price rule and never stacks with coupons, packages, new-student pricing, or other promotions.
8. **Remote payment:** Public remote booking uses card/wallet only.
9. **In-studio payment:** Trusted kiosk terminal/session flows retain cash because the customer is physically in the studio.
10. **Visibility:** Staff sees pending/delivered country-pin state, country, and source purchase in the student panel.
11. **Branding:** The booking form retains PLI identity and selected class information; the general course/home view must not flash during handoff.

## Contract Reconciliations

### Note versus structured state

The country may be rendered as a human-readable note, but entitlement, delivery, and pricing are derived from structured purchase metadata. This preserves the requested profile association without making free text an authorization mechanism.

### Existing authentication PIN

`StudentPinCredential` remains untouched. It authenticates students at kiosks and is unrelated to the physical flag/country pin. New types and labels use `heritagePin`/`countryPin` terminology.

### Existing new-student US$15 price

A new student may already pay US$15 under the existing first-purchase rule. That does not mean the Heritage pin discount is active. The recurring benefit activates only after staff confirms physical delivery. Pricing rules do not stack.

### Existing QR and kiosk flows

The public `/booking` handoff and a trusted kiosk flow both reuse enrollment infrastructure, but they are not equivalent payment contexts:

- public booking: remote, card/wallet only;
- trusted kiosk terminal/session: in studio, cash or card under current rules.

The server uses validated terminal/session authority, not a query parameter, to distinguish them.

## Metadata Contract

The qualifying source purchase stores normalized fields equivalent to:

```ts
{
  heritagePinCampaign: "latin-heritage-2026",
  heritagePinCountryCode: "CO",
  heritagePinStatus: "pending" | "delivered",
  heritagePinEarnedAt: string,
  heritagePinDeliveredAt?: string,
  heritagePinDeliveredBy?: string,
  heritagePinSource: "public_booking"
}
```

Names may be refined during implementation, but semantics and idempotency are fixed. Delivery updates preserve unrelated metadata.

## Staff Presentation

- Pending: `Country pin pending · Colombia`
- Delivered: `Heritage pin · Colombia`
- The delivery control appears only for pending entitlements and authorized staff.
- Repeating the action returns the existing delivered state without a second transition.

## Campaign Copy

Announcement direction:

> **Celebrate Latin Heritage Month with PLI**  
> Complete your booking online and receive a pin representing your country. Once you pick it up, eligible Sunday and Monday classes are only $15 during the campaign.

Country step direction:

> **Where are you from?**  
> Choose your country so we can prepare your pin. Your benefit activates after the pin is handed to you at PLI.

Final copy may be tightened for viewport constraints without changing these promises.

## Non-Goals

- No physical inventory count.
- No shipping workflow.
- No reusable public coupon code.
- No client-only entitlement state.
- No broad removal of cash from trusted kiosk or staff operations.
- No general-purpose promotion administration system.
