# Database migrations

Managed with [migrate-mongo](https://github.com/seppevs/migrate-mongo) (docs/05 §14, docs/06 task 2.2).

```bash
npm run db:migrate:create -- add-some-field   # new file in this folder
npm run db:migrate:status                     # what has run on MONGODB_URI
npm run db:migrate                            # run pending migrations
```

Rules:

- Make every migration **idempotent** (safe to run twice) and give it a working `down`.
- Take an Atlas snapshot or `mongodump` before running against production.
- Indexes are not managed here: `npm run db:indexes` syncs them from the Mongoose models.

There are no migrations yet. The project started on the doc 05 schema, so the old → new
migrations listed in doc 05 §14 (from the July 2026 prototype) have nothing to convert.
