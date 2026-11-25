# Poultry Farm Record App — Beta Build Plan

Living document, started 30/08/2026 when the project moved from validation
into build planning. Turns the locked scope in `04-v1-feature-scope.md` and
the proposed AWS direction in `CLAUDE.md` into something buildable. Update
this as decisions get made — same rule as the other living docs in this
project.

Validation is closed as of 31/08/2026: 4 of 6 planned follow-ups completed
(Elizabeth, Juliana, Toluwase, Ruth). Banjo and Lateef are both
unreachable — Banjo stopped replying, Lateef's number isn't on WhatsApp —
so their open questions (his pricing answer, the vaccination-reminder
pattern from his angle) stay unresolved rather than pending; see
`04-v1-feature-scope.md`'s pricing section for what that leaves open.

---

## 1. Scope for the beta

The 5 locked features from `04-v1-feature-scope.md`, plus the
infrastructure needed to actually run them for real users:

1. Mortality logging (batch-tagged)
2. Feed tracking (batch-tagged)
3. Egg production tracking (batch-tagged)
4. Vaccination reminders (forward-looking alert + backward-looking history)
5. Weekly/monthly profit & expense summary (running totals, category
   breakdown, weekly rolling into monthly)

Plus, not a "feature" on that list but required to ship any of them:
email+password auth (see §4 for how it got there), the
notification mechanism #4 depends on, and the free trial → paid gate
agreed as the pricing model.

Out of scope is unchanged from `04-v1-feature-scope.md`: insurance/
compliance export, loan/credit documentation, voice-based data entry,
buyer-facing traceability, vet-connection features, market/sales access.

---

## 2. Data model

Every log entry needs a batch identifier per the Mathew Sunnyshine
finding (concurrent batches, mixed-up expenses) — this is the central
design constraint, not an add-on.

- **Farm** — one per account. `farmId`, owner email, name, location.
- **Batch** — a cohort of birds. `batchId`, `farmId`, start date, bird
  count, type (layer/broiler/etc), status (active/closed).
- **MortalityLog** — `batchId`, date, count, optional note.
- **FeedLog** — `batchId`, date, feed type/amount, cost.
- **EggLog** — `batchId`, date, crates/count.
- **VaccinationRecord** — `batchId`, vaccine/drug name, date administered.
  This is the backward-looking history (Jongbo, Toluwase's "when did we
  last vaccinate" gap).
- **VaccinationSchedule** — `batchId`, vaccine name, due date, status
  (upcoming/done/missed). Drives the forward-looking reminder (Toluwase,
  Lateef, Juliana's stories).
- **ExpenseEntry** — `batchId`, category (feed/drugs/other), amount, date.
  Feed and vaccination costs can derive from FeedLog/VaccinationRecord
  rather than being re-entered — avoid double entry.
- **User** — email (Cognito identity), farmId, trial/subscription status.

**Added after this doc was written, once `frontend-react` (§8) turned up
already expecting them — not interview-validated, added to match a real,
already-built frontend rather than invented speculatively:**

- **FeedPurchase** — `farmId` (not batchId — farm-level, feed is bought
  for the whole farm's store), feed type/brand/bag size, bags,
  price/bag, supplier, best-before, date. The "received" side of feed
  stock; FeedLog stays the "consumed" side, and stock-on-hand is derived
  client-side from both (`frontend-react/src/lib/feeds.js`), not stored.
- **WeightLog** — `batchId`, date, average bird weight (kg), optional
  sample size. Exists solely to make Feed Conversion Ratio (feed
  consumed ÷ weight gained) computable — `frontend-react`'s login page
  advertised FCR and two screens had a UI slot for it, but neither the
  calculation nor the weight data it needs existed until this was added.
  FCR itself is derived client-side
  (`frontend-react/src/lib/batch.js`'s `computeFCR`), not stored,
  same principle as feed stock and the profit summary.
- **SickBayCase** — `batchId`, birds isolated, symptoms, outcome
  (recovered/died). Deaths are mirrored into MortalityLog by the app.
- **Supplement** — `batchId`, vitamin/dewormer given, dose, course length,
  withdrawal days, cost. On the phone only until 24/11/2026; moved to the
  server so the daily job can push "withdrawal period over".
- **Sale** — `farmId`, date, birds (type, batch, count) or eggs (size,
  crates/pieces, optional batch), price per unit, amount, buyer. The only
  source of income; egg collection (EggLog) no longer carries money.
- **PushSubscription** — `farmId`, one row per phone that turned on
  notifications (Web Push endpoint + keys).
- **Farm** gained an optional `farmerName` field (the person, distinct
  from the farm's own name) — `frontend-react`'s onboarding/account
  settings collect it separately and were sending it before the field
  existed to receive it.

Weekly/monthly summaries (#5) are computed from MortalityLog, FeedLog,
EggLog, ExpenseEntry, and VaccinationRecord rather than stored separately —
Elizabeth specifically asked for cumulative running totals, not a
month-end batch calculation, so summary values should update as each entry
comes in.

---

## 3. API shape (API Gateway HTTP API + Lambda)

Grouped by resource, REST-ish. Every route needs a Cognito ID token
except the four auth routes. `infra/modules/api_gateway/main.tf` is the
authoritative list.

- `POST /auth/signup`, `/auth/login`, `/auth/forgot-password`,
  `/auth/confirm-forgot-password` — email+password (see §4).
- `GET /batches`, `POST /batches`, `PATCH /batches/{id}` (edit, complete,
  reopen), `DELETE /batches/{id}` (also deletes every record in it).
- `GET /farms/{id}`, `PATCH /farms/{id}` — farm profile, pens, custom
  bird types, notification preferences. farmId always comes from the
  caller's token, never the `{id}` path segment (kept only for URL shape).
- `GET`/`POST /batches/{id}/mortality`, `/feed`, `/eggs`, `/weight`,
  `/vaccinations`, `/supplements` — append-only logs.
- `GET`/`POST /batches/{id}/vaccination-schedule`, `PATCH
  /batches/{id}/vaccination-schedule/{scheduleId}` (mark done/missed).
- `GET`/`POST /batches/{id}/sick-bay`, `PATCH
  /batches/{id}/sick-bay/{caseId}` (close a case).
- `GET`/`POST /feed-stock` — farm-level feed purchases.
- `GET`/`POST /medicine-stock` — vaccines and vitamins bought into the
  farm's store; batch vaccination/vitamin records take from it
  (`stockKey`, `vialsUsed`/`packsUsed`).
- `GET`/`POST /sales`, `DELETE /sales/{entryId}` — birds or eggs sold;
  a bird sale lowers its batch's birds alive.
- `GET /farms/{id}/summary?period=week|month` — money in/out by category,
  computed on read, month split into weeks.
- `POST /sync/batch` — the offline queue (§6), applied idempotently.
- `POST /push/subscriptions`, `/push/subscriptions/remove` — phone
  notifications on/off for one phone.

---

## 4. Auth & onboarding

**Email+password (since 08/10/2026).** The plan was phone + SMS code,
which fits this audience best; SMS failed account-wide (31/08/2026), the
fallback email code then hit the SES sandbox and Apple's rejection, so
login moved to a password, which needs no message per login. Password
reset uses Cognito's own email. See `docs/11-platform-obstacles.md`. A
password is real friction for this audience, so the policy is loose (8+
characters, a lowercase letter and a number).

Given the confirmed low-digital-literacy segment (Banjo not recognizing
"book keeping app", Ruth not knowing what "cloud" means), onboarding needs
to:

- Avoid technical vocabulary in any UI copy — no "sync," "cloud," "cache."
- Get a farmer to their first logged entry in as few screens as possible;
  don't front-load account setup before they see value.
- Assume the free trial starts automatically at signup — no separate
  "activate trial" step, since that's exactly the kind of friction this
  segment won't push through.

---

## 5. Notifications

One mechanism, several triggers, per the cross-cutting note in
`04-v1-feature-scope.md`. Three daily 7am (Lagos) jobs:

- **Vaccination reminder** — schedule items due in the next 3 days, so a
  heads-up plus a same-day reminder (Toluwase's cadence). Push + email.
- **Entry-completeness nudge** — nothing logged for 2 days (Elizabeth's
  missing-entries finding). Push + email.
- **Farm alerts** — feed stock low/out, withdrawal period over. Push only.
  Not interview-validated (scope doc §8).

Phone push (Web Push) is the main channel: it's what Toluwase confirmed
("a phone notification") and it isn't affected by the SES problems.
Email is the fallback. SMS still matters if a no-smartphone segment
shows up (0/27 so far).

---

## 6. Offline resilience

Per the already-decided direction in `CLAUDE.md`: not full offline-first.
New records queue on-device as JSON Lines (append-only) during brief
connectivity gaps and flush to `POST /sync/batch` once back online. Reads
require a live connection — no local read/query layer needed.

---

## 7. Pricing / trial gate

Free trial for all new signups, converting to paid subscription
afterward — decided direction, see `CLAUDE.md`. For the beta specifically:

- Trial starts automatically at signup (see §4).
- Exact trial length and post-trial price are still open — the plan is a
  second payment survey once the trial has real traction (time-in-trial
  threshold or registered-to-active-user ratio, per prior discussion), not
  before. **For the beta, pick a placeholder trial length (e.g. 30 days)
  and a placeholder price, both clearly changeable** — don't let engineering
  convenience quietly lock in a number that was never validated.
- `User.trialStatus` / `subscriptionStatus` should be modeled so the gate
  can be adjusted without a schema change once real numbers come in.

---

## 8. Explicit open decisions

Don't let these block starting the backend/data-model work, but they need
answers before the beta can actually ship to a farmer's hands:

- **Frontend framework** — decided: a React (Vite) installable web app,
  `frontend-react/`, built by Dolapo, the co-founder.
- **Design direction for the friend's build**: simple, minimalistic,
  farm-oriented — explicitly framed as an interim v1 "face" for the app,
  expected to get replaced by a more polished design later once there's
  real usage to design around. This matches the FarmBook mockups
  (https://claude.ai/code/artifact/f771d22f-4184-4d2e-8ae8-f60f578d2858)
  already produced from the same brief (large touch targets, plain
  language, no tech jargon, warm/friendly palette — driven by the
  low-digital-literacy findings in `CLAUDE.md`) — hand those to the friend
  as the starting visual reference rather than having them design from
  scratch. `infra/modules/api_gateway/main.tf` has the real route list
  their build needs to call.
- **Trial length and post-trial price** — placeholders only until the
  second payment survey (§7).
- **Web/admin dashboard** — CloudFront + S3 only if wanted beyond the
  mobile app; no signal yet that it's needed for beta.
- **Banjo's and Lateef's outstanding interview answers** — both closed out
  unreachable (31/08/2026), not paused; treat as permanently unresolved.

---

## 9. Suggested build sequence

1. Auth (Cognito) + Farm/Batch creation — nothing else works
   without this.
2. Mortality, feed, and egg logging (batch-tagged CRUD) — the three
   universal, simplest features first.
3. Vaccination schedule + history (both directions) — the headline
   feature, but depends on batch scaffolding from step 2 being solid.
4. SES reminder + nudge notifications — depends on step 3's schedule data
   existing.
5. Profit/expense summary view — depends on steps 2-3's data existing to
   summarize.
6. Trial/subscription gating — can be built in parallel with 2-5 once
   Farm/User exists, but should be the last thing turned "on" so beta
   testers aren't paywalled before there's anything worth paying for.

---

## 10. How to view/test this after `terraform apply`

- **The app**: `terraform output frontend_url` (beta), or trackfarm.cc
  for whichever environment owns the domain.
- **`terraform output`** also prints `api_endpoint`,
  `cognito_user_pool_id`, `cognito_client_id`, and the S3 bucket names.
- **Calling the API directly** (curl, Postman):
  1. `POST {api_endpoint}/auth/signup` or `/auth/login` with
     `{"email", "password"}` — returns `idToken`.
  2. Send `Authorization: Bearer <idToken>` on every other route.
- **Email in sandbox**: only addresses in `ses_test_recipient_emails`
  receive the welcome and reminder emails. Password-reset codes come from
  Cognito itself and reach any address.
- **Scheduled jobs**: run one by hand from the Lambda console (Test, any
  event) instead of waiting for 7am; its CloudWatch log ends with a
  `*_run_complete` line counting what it found and sent.
- **AWS Console**: DynamoDB → "Explore table items" to see rows land;
  Lambda → Monitor / CloudWatch Logs (`/aws/lambda/<function-name>`) to
  debug a failure; Cognito → User pools for accounts.
