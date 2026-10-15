# Roll out the October Heritage classes

Create two replacement courses and their delivered-pin promotions only after the course-promotions code is deployed. Preserve old course rows and package history.

## Target

| Setting | Required value |
| --- | --- |
| Railway project/service | `PLI-SaaS / Postgres-g1Qy` |
| Application branch | `codex/develop` |
| Time zone | `America/New_York` |
| Backup mode | `0600` |

Never run this procedure against historical `PLI-SaaS / Postgres`.

## Course definitions

| Field | Thursday course | Sunday course |
| --- | --- | --- |
| Slug | `bachata-beginners` | `salsa-cubana-absolute-beginners` |
| Title | `Bachata Beginners` | `Cuban Salsa — Absolute Beginners` |
| Category | `Bachata` | `Salsa` |
| Level | `Beginner` | `Beginner` |
| Duration | 55 minutes | 55 minutes |
| Schedule | Thursday 21:10 | Sunday 17:00 |
| Drop-in / first class | US$20 / US$15 | US$20 / US$15 |
| Location | `54 Coles St, Jersey City, NJ` | `54 Coles St, Jersey City, NJ` |
| Replaces | `salsa-night-beginner-rueda` | `salsa-afternoon-beginner` |

Use a dance-appropriate image or the normal catalog fallback; do not reuse misleading Rueda artwork.

## Promotion on both courses

```json
{
  "id": "heritage-pin-october-2026",
  "label": "Heritage pin benefit",
  "active": true,
  "pricing": { "kind": "fixed", "amountCents": 1500 },
  "window": {
    "basis": "class_date",
    "startDate": "2026-10-01",
    "endDate": "2026-10-31"
  },
  "audience": "heritage_pin_delivered",
  "channels": ["public_booking", "profile"]
}
```

## Safe procedure

1. Prove the Railway project, service, database host, and branch deployment.
2. Create a timestamped `pg_dump` with mode `0600`; record its SHA-256.
3. Read and save affected `CourseCatalog` rows and every `PackagePlan` containing either replaced slug.
4. Dry-run the proposed rows through the staff course API normalization without writing.
5. Confirm no target slug already exists and no unrelated course owns either target slot.
6. Obtain explicit authorization for the exact snapshot and mutation.
7. In one database transaction:
   - create the two new active course rows;
   - copy schedule/publication structure with the exact new title/category/time;
   - attach the promotion above;
   - add each new slug to every package plan that contains its replaced slug, without removing historical slugs;
   - set the two replaced course rows inactive;
   - re-read all affected rows before commit.
8. Commit only when row counts and values match the dry-run.
9. Verify `/api/catalog/courses`, `/booking`, profile class selection, and checkout pricing read-only.

## Rollback

Inside a new transaction:

1. Restore the affected `PackagePlan.courseSlugs` arrays from the mode-0600 snapshot.
2. Reactivate the two replaced course rows to their captured state.
3. Deactivate the two new rows; do not delete them if a booking or purchase references either slug.
4. Re-read and compare every affected row before commit.
5. Use the database dump only if row-level rollback is insufficient.

## Acceptance evidence

- Both new courses appear once at the intended time.
- Replaced Rueda courses no longer appear as active catalog options.
- Applicable packages include the new slugs.
- Public booking and profile show `Heritage pin benefit` for eligible October occurrences.
- Delivered-pin checkout charges US$15; pending/no-pin checkout remains at its independently authorized price.
- November occurrences receive no Heritage price.
