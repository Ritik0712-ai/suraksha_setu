# Seed data

| File                              | Loaded by                   | Notes                                                                                                                                                      |
| --------------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `jurisdictions.json`              | `npm run db:seed`           | Placeholder names/centroids until field visit 1 (docs/05 §11.1)                                                                                            |
| `departments.json`                | `npm run db:seed`           | Pilot routing (docs/05 §11.2), confirm with the Panchayat                                                                                                  |
| `admins.example.json`             | `npm run db:seed:admins`    | Copy to `admins.local.json` (git-ignored: phone numbers)                                                                                                   |
| `schemes.json`                    | `npm run db:seed:schemes`   | 20 schemes imported as **drafts**. Check every amount, limit and document against the official source, then mark verified and publish in the portal (A-08) |
| `emergency_services.template.csv` | `npm run db:seed:emergency` | Copy to `emergency_services.csv` and add only rows confirmed by phone or a visit (`verified_on`). Same format as the portal's Import CSV (A-10)            |

`phones` holds one or more numbers separated by `;`. `type` is one of `shared/constants.json` `serviceTypes`.
