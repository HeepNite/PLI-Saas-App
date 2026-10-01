# Heritage Pin Campaign — Resolved Decisions

## Product Decisions

1. **Beneficiaries:** Any student may earn one Heritage country pin; the campaign is not limited to first-time students.
2. **Acquisition:** A successful card/wallet payment from the public campaign journey during the bounded acquisition window creates a pending entitlement.
3. **Country:** The visitor selects a country from a controlled list. Country of origin is campaign data, not the billing-address country.
4. **Physical handoff:** Payment does not claim physical possession. Staff must mark the pin delivered.
5. **No pricing authority:** Pending, delivered, or absent physical pin state never changes class price or package eligibility.
6. **Pricing:** Verified first-time customers retain the existing US$15 new-student price; existing customers without an applicable package receive the regular price.
7. **Packages:** Existing customers with an applicable active package reserve the selected class against that package; reservation capacity is held at booking and credit is consumed when attendance is completed.
8. **Extension:** October 2026 is the default. Central configuration may extend the acquisition end date.
9. **Remote payment:** Public remote purchases use card/wallet only when payment is actually required.
10. **In-studio payment:** Trusted kiosk terminal/session flows retain cash because the customer is physically in the studio.
11. **Visibility:** Staff sees pending/delivered country-pin state, country, and source purchase in the student panel.
12. **Branding:** The booking form retains PLI identity and selected class information; the general course/home view must not flash during handoff.

## Contract Reconciliations

### Note versus structured state

The country may be rendered as a human-readable note, but entitlement and delivery are derived from structured purchase metadata. Physical-pin metadata is never a pricing or package authorization mechanism.

### Existing authentication PIN

`StudentPinCredential` remains untouched. It authenticates students at kiosks and is unrelated to the physical flag/country pin. New types and labels use `heritagePin`/`countryPin` terminology.

### Existing pricing and package routing

A verified customer with no successful purchase and no package history may pay US$15 under the existing first-purchase rule. Existing customers pay the regular price unless an active package applies to the selected course. In that case the public booking reserves the class against the package, prevents credit oversubscription, and finalizes consumption only when attendance becomes attended. Heritage pin state is irrelevant to every branch.

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
> Complete your booking online and receive a pin representing your country.

Country step direction:

> **Where are you from?**  
> Choose your country so we can prepare your pin for pickup at PLI.

Final copy may be tightened for viewport constraints without changing these promises.

## Non-Goals

- No physical inventory count.
- No shipping workflow.
- No reusable public coupon code.
- No client-only entitlement state.
- No broad removal of cash from trusted kiosk or staff operations.
- No general-purpose promotion administration system.
