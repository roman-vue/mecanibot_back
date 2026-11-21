# MecaniBot API

Vehicle maintenance plans and reminders. Follows the `backend-node` standard.

## Run

```bash
cp .env.example .env   # fill API_KEY and OPENAI_API_KEY
npm install
npm run dev            # http://localhost:4000
npm test               # vitest, in-memory SQLite, OpenAI mocked
npm run build && npm start
```

## Structure

```
src/
  index.ts · app.ts
  config/        env.ts (validated env) · database.ts (SQLite + additive migrations)
  middlewares/   api-key · device · idempotency · rate-limit · logger · error-handler
  shared/        errors.ts (AppError) · http.ts (ok/created)
  integrations/  openai.ts
  modules/
    vehicle/      vehicles, km updates
    reminder/     reminders, completion, custom reminders
    maintenance/  history, off-plan maintenance, expenses
    document/     SOAT / técnico-mecánica
    account/      free / Pro plan and limits
    plan/         AI plan (catalog, cache, date schedule)
tests/
```

## API

Every `/api` request needs `x-api-key` and `x-device-id` headers.
Responses: `{ success: true, data }` or `{ success: false, message, code, errors? }`.

| Method | Route | Notes |
|---|---|---|
| GET | `/health` | public |
| GET | `/api/vehicles` | vehicles of the device |
| POST | `/api/vehicles` | creates vehicle + AI plan. Requires `Idempotency-Key`; max 5/hour per device |
| GET | `/api/vehicles/:plate` | vehicle + reminders |
| PATCH | `/api/vehicles/:plate` | `{ car_plate }` rename (moves its data) |
| DELETE | `/api/vehicles/:plate` | deletes vehicle and its data |
| PATCH | `/api/vehicles/:plate/km` | `{ km }` learns usage and recalculates km-based dates |
| GET | `/api/vehicles/:plate/reminders` | |
| POST | `/api/vehicles/:plate/reminders` | `{ task, date, repeat_months? }` custom reminder (free: 3 pending) |
| POST | `/api/reminders/:id/complete` | `{ km?, cost? }` logs history and schedules the next one (cost: Pro) |
| GET | `/api/vehicles/:plate/history` | free plan: last 6 months |
| POST | `/api/vehicles/:plate/maintenances` | `{ task, date?, km?, cost? }` off-plan maintenance |
| GET | `/api/vehicles/:plate/expenses?year=` | Pro |
| GET | `/api/vehicles/:plate/documents` | |
| PUT | `/api/vehicles/:plate/documents/:kind` | `kind`: `soat` \| `tecnomecanica`, body `{ expires_on }` |
| GET | `/api/account` | plan, limits, usage |
| PUT | `/api/account/plan` | `{ pro }` demo activation, no payment yet |

Error codes: `VALIDATION_ERROR`, `UNAUTHORIZED`, `DEVICE_REQUIRED`, `NOT_FOUND`, `PLATE_EXISTS`,
`PRO_REQUIRED`, `ALREADY_COMPLETED`, `DATE_IN_PAST`, `RATE_LIMITED`, `IDEMPOTENCY_KEY_REQUIRED`, `INTERNAL`.

## AI plan

The AI (OpenAI + web search) only picks task ids from a closed catalog (`plan.catalog.ts`) and returns
intervals; ranges are clamped and dates are computed in code (km or months, whichever comes first).
Results are cached per vehicle type + model (`model_plans`, `PLAN_CACHE_DAYS`). If OpenAI fails, catalog
defaults are used.

## Data

SQLite at `data/mecanibot.db`. The `users` table stores vehicles (name kept to preserve data).
Migrations are additive and run on startup (`config/database.ts`).
