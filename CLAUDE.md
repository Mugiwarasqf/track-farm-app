# TrackFarm

## What this is

A record-keeping app for Nigerian poultry farmers: mortality, feed, egg
production, and vaccination tracking, replacing the paper notebook most
farmers currently use. Validation drove the original scope; there's now a
real, working full-stack build (backend plus a React frontend built by
Dolapo, the co-founder) that's grown somewhat beyond that original scope,
flagged below where that happened. The founder has direct personal connections in the
poultry industry (heavily Lagos/Ikorodu-based so far) that sourced the
real survey responses and follow-up interviews the scope is built on.

The product is called **TrackFarm**, bought as the domain `trackfarm.cc`.
It was called "FarmBook" through most of the build; that name still
appears as a historical label on the original design mockups, but every
current user-facing surface uses "TrackFarm."

This is an independent project, unrelated to any other project elsewhere
in this Documents\Cloud directory.

## Current status

- 27 survey responses collected (`docs/02-survey-responses.csv`), gathered
  via a Google Form built from `docs/01-validation-questionnaire.md`.
- 6 respondents identified for deeper follow-up
  (`docs/03-followup-interview-guide.md`). 4 completed: Elizabeth
  (`docs/05-interview-elizabeth.txt`), Juliana (`docs/06-interview-juliana.txt`),
  Toluwase (`docs/09-interview-toluwase.txt`), Ruth
  (`docs/08-interview-ruth.txt`). The remaining 2 are closed out, not just
  paused: Banjo (`docs/07-interview-banjo.txt`) stopped replying after his
  pricing question; Lateef's number isn't on WhatsApp at all. The
  interview phase is done, 4 of 6 completed, 2 unreachable.
- Product scope (`docs/04-v1-feature-scope.md`) is the living, canonical
  spec. Update it directly rather than leaving refinements only in chat.
- Build plan (`docs/10-build-plan.md`): the locked feature scope and AWS
  direction, turned into a concrete data model, API shape, and build
  sequence.
- Backend and infra are real and code-complete. `infra/` is a modular
  Terraform stack covering Cognito (email+password auth), API Gateway, 24
  Lambda functions, 16 DynamoDB tables, S3, SES, Web Push phone
  notifications, and daily EventBridge notification schedules. `backend/` is the TypeScript Lambda source.
  Deploy state varies since this has been applied, torn down, and
  reapplied multiple times during testing; check `terraform plan` before
  assuming current state. See "Infrastructure" below for module detail.
- Frontend is real, in `frontend-react/`, built by Dolapo, the co-founder
  (ownership settled 31/08/2026): a genuinely substantial React app
  (Vite), batches, logging, schedule, inventory, settings, offline queue.
  Its own API client code has repeatedly surfaced real backend gaps
  (`GET`/`PATCH /farms/{id}`, `/feed-stock`, `/batches/{id}/weight`, an
  IDOR bug in the summary endpoint), all now fixed. The original design
  mockups
  (https://claude.ai/code/artifact/f771d22f-4184-4d2e-8ae8-f60f578d2858)
  remain as historical reference for the simple, minimalistic,
  farm-oriented direction that shaped it. The static `frontend/` test
  console this project started with has been retired and removed.
- `trackfarm.cc` is live: the bare apex serves the frontend (CloudFront),
  `api.trackfarm.cc` serves the backend (API Gateway custom domain). Both
  ACM certificates and DNS validated via Namecheap (DNS is kept there, not
  migrated to Route 53).
- Several real platform obstacles have shaped recent decisions, see
  `docs/11-platform-obstacles.md`: the original SMS auth plan hit an AWS
  account gap, the fallback email channel then hit both an SES
  production-access denial and an Apple/iCloud delivery rejection, and the
  original SMS gap has since turned out to be resolved. Net result so
  far: login moved to email+password (no message per login), and
  reminders now also go out as phone push, which avoids email entirely.

## Key validated findings

- **Paper record-keeping is universal.** Near-zero existing digital
  adoption across all 27 respondents.
- **The original insurance/compliance hypothesis was wrong.** 0-1 of 27
  respondents carry poultry insurance, and disease reporting to
  authorities is rare. This was the original planned hook and didn't
  survive contact with real data; don't rebuild it into the pitch without
  new evidence.
- **Vaccination record failures are the strongest validated pain point.**
  Four independent, unprompted respondents described real or
  near-catastrophic loss tied to missed or unconfirmed vaccination dates
  (originally five, revised down after Ruth's follow-up traced her pox
  outbreak to a dirty environment after relocating, not a missed
  vaccination). Still the headline feature.
- **Credit access is aspirational, not active.** Frequently named as a
  top-3 challenge, but most respondents haven't applied for a loan, and
  where one was rejected, records weren't cited as the reason. Don't build
  loan-documentation features on this alone.
- **A real low-digital-literacy segment exists.** Banjo didn't recognize
  "book keeping app" as a concept; Ruth said "I don't know cloud" when
  asked about cloud/phone backup. Avoid jargon like "cloud sync," and
  don't assume cloud backup is a selling point; it needs to work invisibly
  if included at all.
- **Modal price point: ₦2,000 to 5,000/month.** A real "high interest,
  won't pay anything" segment exists (Juliana and Mathew). Juliana's
  follow-up pointed toward this being about wanting a free trial first,
  not outright price rejection. Decided working model: free trial for
  initial users, converting to a paid subscription afterward. Still open:
  the actual post-trial price point, trial length, and whether Mathew's
  segment converts the same way.
- Sample is geographically skewed toward Lagos/Ikorodu and farm-size
  skewed toward 50 to 500 birds; treat conclusions about very large
  (10,000+) farms or other regions as thin until more data comes in.

## Locked v1 feature scope

See `docs/04-v1-feature-scope.md` for full detail and reasoning. Summary:

1. **Mortality logging**, batch/cohort tagging required (a respondent
   running concurrent batches described mixing up expenses between them).
2. **Feed tracking**, same batch-tagging requirement.
3. **Egg production tracking**, same batch-tagging requirement.
4. **Vaccination reminders**: both a forward-looking alert (missed a
   scheduled date) and a backward-looking log (couldn't confirm when the
   last one happened); both failure modes showed up independently.
5. **Weekly/monthly profit and expense summary**: running totals (not
   month-end batch math), category-level breakdown (feed cost, drug cost,
   egg revenue, not one net number), weekly cadence rolling into monthly.

Cross-cutting: reuse the same notification mechanism for vaccination
reminders and a "you haven't logged anything today/this week" nudge,
since Elizabeth's calculations broke because of missing entries, not bad
math.

Out of scope until a second batch of interviews independently repeats one
of these: insurance/compliance export, loan/credit documentation,
voice-based data entry, buyer-facing traceability, vet-connection
features, market/sales access.

## Infrastructure

`infra/` (Terraform) and `backend/` (TypeScript Lambda source) are both
real and pass their checks (`terraform validate`/`terraform plan`, `tsc
--noEmit`, `npm run build`).

**Module structure** (`infra/main.tf` wires these together): `dynamodb`,
`s3`, `ses`, and `cognito` have no dependencies; `api_lambdas` depends on
`dynamodb`, `cognito`, and `ses`; `api_gateway`, `notifications`, and
`frontend` each depend on `api_lambdas`/`cognito`/`api_gateway` outputs.
All 24 Lambdas live in `api_lambdas`. The old `auth_triggers` module was
deleted with the move to password auth, since Cognito no longer has
Lambda triggers. See `infra/main.tf`'s header comment for the diagram.

- **Cognito** (`infra/modules/cognito/`): email+password auth (switched
  from passwordless email OTP on 08/10/2026, because OTP needed an email
  delivered on every login and SES couldn't do that reliably, see
  `docs/11-platform-obstacles.md`). `USER_PASSWORD_AUTH` flow, no Lambda
  triggers. Loose password policy on purpose (8+ characters, a lowercase
  letter and a number, no symbols or capitals) for a low-literacy
  audience. `backend/src/handlers/auth/`: `signup` creates and
  auto-confirms the Cognito user (no verification-code step), provisions
  the Farm and User rows, and sends a best-effort welcome email so a
  mistyped address shows up as a bounce (`Farm.emailBounced`). `login`
  fronts InitiateAuth. `forgotPassword`/`confirmForgotPassword` use
  Cognito's own built-in email, not SES, so reset works even with SES in
  sandbox.
- **API Gateway (HTTP API) plus Lambda**: one Lambda per resource
  (`backend/src/handlers/*`), routes wired in `infra/modules/api_gateway/`,
  protected by a Cognito JWT authorizer. `farmId` is always read from the
  authenticated token's `custom:farmId` claim, never trusted from the
  request (`backend/src/lib/http.ts`).
- **DynamoDB** (`infra/modules/dynamodb/`): 15 tables, one per entity
  (including `supplements`, vitamins/dewormers per batch, moved off the
  phone 24/11/2026, `sales`, birds or eggs sold, and `medicine_purchases`,
  vaccines and vitamins bought into the farm's store, both farm-keyed) plus `suppressed_emails` for bounce/complaint handling
  and `push_subscriptions` for phone notifications. GSIs beyond the core
  data model: a batchId-only index on `batches` and a status+dueDate index
  on `vaccination_schedules` (both for the notification Lambdas), and a
  subscriptionId index on `push_subscriptions` (moves a shared phone to
  whichever farm last signed in on it).
- **Offline resilience**: `POST /sync/batch` (`backend/src/handlers/sync/`)
  accepts the on-device JSON Lines queue and applies each line
  idempotently (client-generated `entryId`, conditional put). Reads still
  require a live connection.
- **S3** (`infra/modules/s3/`): attachments and reports buckets, both
  private with SSE. No Lambda writes to them yet.
- **SES** (`infra/modules/ses/`): sends from a verified domain identity
  (`trackfarm.cc`, DKIM enabled), separate from a set of individually
  verified test-recipient identities used for sandbox testing. Automated
  bounce/complaint handling: an SNS topic, a dedicated Lambda
  (`backend/src/handlers/sesEvents/`), and a DynamoDB suppression table
  checked before every send. Account remains in the SES sandbox; see
  `docs/11-platform-obstacles.md`.
- **Notifications**: three daily 7am (Africa/Lagos) EventBridge Schedules
  (`infra/modules/notifications/`), each a Lambda in
  `backend/src/handlers/scheduled/`: `vaccinationReminders` (3-day
  window) and `entryNudges` (nothing logged for 2 days) send phone push
  plus email; `farmAlerts` (feed stock low/out, withdrawal period over)
  sends push only. Each respects its own `Farm.notificationPrefs` switch,
  and `emailAlerts` only turns off the email side.
- **Phone push (Web Push)**: built by Dolapo 24/11/2026. Phones register
  via `POST /push/subscriptions` (`backend/src/handlers/push/`); sending
  is `backend/src/lib/push.ts`, which deletes subscriptions the push
  service reports gone. It doesn't go through SES, so it reaches farmers
  the SES sandbox and Apple rejection block. VAPID keys: the public key is
  the `vapid_public_key` Terraform var (GitHub variable
  `VAPID_PUBLIC_KEY` for CI/CD); the private key lives only in SSM at
  `/<project_name>/<environment>/vapid-private-key` (made per account by
  hand with `infra/scripts/create-vapid-keys.sh`, never in Terraform
  state). With no keys, push switches itself off and email carries on.
  On iPhone, push only works once the app is added to the home screen.
- **Logging**: a small shared structured logger (`backend/src/lib/logger.ts`)
  covers the points that were previously silent, suppression skips,
  scheduled-job summary counts, auth failures and provisioning, rather
  than blanket logging everywhere (Lambda already logs uncaught
  exceptions on its own).
- **Frontend hosting**: a private S3 bucket that only its CloudFront
  distribution can read (origin access control); app routes fall back to
  `index.html` via CloudFront's 403/404 handling.
- **Custom domain**: `trackfarm.cc` (apex) serves the frontend via
  CloudFront, `api.trackfarm.cc` serves the backend via an API Gateway
  regional custom domain. Both ACM certificates use DNS validation; DNS
  itself is kept on Namecheap, not migrated to Route 53, so validation
  records are added by hand (see `infra/acm.tf`'s header comment for the
  two-step apply this requires).
- **Two AWS accounts, one codebase**: beta (543613943899) for manual
  pre-merge testing, prod (685108783257, current `trackfarm.cc` DNS
  owner) for the CI/CD pipeline. `infra/variables.tf`'s
  `deploy_custom_domain` keeps only one environment claiming the domain at
  a time: `true` in `infra/prod.tfvars` and in the `DEPLOY_CUSTOM_DOMAIN`
  GitHub variable that `ci.yml`/`cd.yml` read, `false` in beta's tfvars.
  Never run prod with it false: on 25/11/2026 a CD run did, removing the
  CloudFront alias and API custom domain and taking the site down until
  re-applied with `true` and the `api` CNAME in Namecheap updated. Each account's Terraform vars live in a named file
  (`infra/terraform.tfvars` for beta, `infra/prod.tfvars` for prod, both
  gitignored) and backend config (`infra/backend-configs/{beta,prod}.hcl`,
  pointing at that account's own `trackfarm-tfstate-<account-id>` S3
  bucket and `trackfarm-tfstate-lock` DynamoDB table — both created in
  both accounts; beta's state moved there 09/11/2026).
- **`infra/bootstrap/`**: a separate Terraform root, applied once per
  account, for the GitHub Actions OIDC provider and two IAM roles:
  `trackfarm-github-actions` (AdministratorAccess, for `cd.yml`) trusts
  only jobs running `main`'s code with no `environment:` set, and
  `trackfarm-github-actions-plan` (ReadOnlyAccess) is all a pull request
  can assume, so editing a workflow in a PR can't reach admin. GitHub vars
  `AWS_ROLE_ARN` and `AWS_PLAN_ROLE_ARN` point at them.
- **CI/CD** (`.github/workflows/`): `ci.yml` runs on every PR — typecheck,
  test (`backend/`: `npm test`, Node's built-in runner on the pure logic)
  and build both `backend/` and `frontend-react/`, then
  `terraform validate`/`plan -lock=false` against prod with the read-only
  role. `cd.yml` is manually triggered
  (`workflow_dispatch`) after a merge to `main` and runs `terraform
  apply` against prod — manual trigger is the approval gate, since
  GitHub's native required-reviewers environment protection needs a paid
  plan this repo doesn't have. Beta is never touched by either workflow;
  it's deployed by hand for pre-merge testing.
- **Local `terraform apply` only ever targets beta, by policy** — prod's
  `infra/` stack is deployed exclusively through `cd.yml`, never by hand,
  so there's no path for a local machine to apply the wrong environment
  into the wrong account. `infra/deploy-beta.sh` is the normal day-to-day
  tool. `infra/deploy-prod.sh` exists only for the one-time initial prod
  stand-up and genuine break-glass emergencies — reach for it rarely and
  deliberately, not as a routine alternative to CI/CD. The one necessary
  exception is `infra/bootstrap/` (the OIDC provider and IAM role CI/CD
  itself assumes): it has to be applied locally against prod, since CI/CD
  can't bootstrap the very credentials it depends on.
- If the no-smartphone/USSD segment ever becomes real: AWS doesn't
  provide USSD directly, would need a Nigerian telco or aggregator (e.g.
  Africa's Talking) alongside AWS. Still unvalidated (0/27 respondents
  selected "no smartphone, basic phone only").

## Working preferences for this project

- Keep respondent outreach minimal. Only add someone to the interview
  list if they map to a locked feature or an unresolved question, not
  just because they gave an interesting one-off answer.
- Follow-ups are conducted as async WhatsApp text, not calls. One question
  at a time, wait for a reply rather than dropping the whole list at once.
- Ground every recommendation in the actual data, not generic startup
  advice. This project already had one hypothesis (insurance/compliance)
  disproven by real responses.
- Treat `docs/04-v1-feature-scope.md` as the single source of truth for
  scope; update it immediately when a new interview changes the picture.

## File index

| File | Purpose |
|---|---|
| `docs/01-validation-questionnaire.md` / `.csv` | Original survey design and Google Form intro copy |
| `docs/02-survey-responses.csv` | All collected responses, append new ones here |
| `docs/03-followup-interview-guide.md` | The 6-person shortlist, WhatsApp intros, and questions |
| `docs/04-v1-feature-scope.md` | Canonical, living product spec |
| `docs/05` to `docs/09` | Raw interview transcripts, one file each |
| `docs/10-build-plan.md` | Living beta build plan: data model, API shape, build sequence, open decisions |
| `docs/11-platform-obstacles.md` | Real AWS/Apple platform walls hit during this build and their current status |
| `infra/` | Terraform, modular (`infra/main.tf` plus `infra/modules/*`); `infra/bootstrap/` is the separate one-time-per-account OIDC/IAM setup |
| `.github/workflows/` | CI (`ci.yml`, every PR) and CD (`cd.yml`, manually triggered after merge) |
| `backend/` | TypeScript Lambda source, one handler per API resource |
| `frontend-react/` | The real product frontend (Vite plus React), built by Dolapo, the co-founder |
| `README.md` | Shorter orientation doc, same information at a glance |
| `docs/` | Folder holding all numbered research/planning files above |

## Next steps

1. Keep `frontend-react`'s API client code as the source of truth for what
   the backend needs to support; every real backend gap found so far was
   discovered by reading their code, not by re-deriving requirements from
   the docs.
2. Confirm current deployment state before assuming anything; this infra
   has been applied, destroyed, and reapplied multiple times during
   testing. Run `terraform plan` to see drift before deploying blind.
3. Phone/SMS auth is worth reconsidering now that the original AWS
   blocker appears resolved (`docs/11-platform-obstacles.md`). Less urgent
   since the move to password auth, as login no longer depends on email
   delivery. Switching to phone means destroying and recreating the
   Cognito user pool again, since the username attribute can't change.
4. Pricing structure is decided (free trial, then paid); use a placeholder
   trial length/price for the beta. The real numbers come from a second,
   dedicated payment survey once the trial phase has real traction.
5. Banjo and Lateef are both unreachable; the interview phase is closed.
   Remaining pricing/segment questions get answered by the later payment
   survey instead.
6. Feed inventory and Feed Conversion Ratio (`docs/04-v1-feature-scope.md`
   §6) were added to match a frontend that already assumed them, not from
   farmer research; worth a real question in the next farmer conversation
   about whether either is actually wanted.
7. SES production access was denied with no specific reason given
   (`docs/11-platform-obstacles.md`); the account stays in sandbox for
   now. Phone push now carries reminders without SES, so the remaining
   options are: push as the main reminder channel with email as fallback,
   a third-party email provider, staying in sandbox with manual recipient
   verification, or SMS.
8. Done 25/11/2026: `infra/bootstrap/` re-applied against prod (read-only
   plan role created, admin role trust narrowed to `main`) and the
   `AWS_PLAN_ROLE_ARN` GitHub variable set. Until the PR carrying the new
   `cd.yml` (no `environment:`) is merged, a prod deploy from the old
   `cd.yml` would be refused by the narrowed trust.
9. Turn phone push on: run `infra/scripts/create-vapid-keys.sh`, store the
   private key in SSM in each account, and set `vapid_public_key` (beta
   tfvars) and the `VAPID_PUBLIC_KEY` GitHub variable (prod). Then test
   on a real Android phone and an iPhone added to the home screen.
10. The Income & Expenses page (`/money`) is the locked weekly/monthly summary
    (§5). Income comes from sales recorded with "Add sale" (birds by type
    and batch, eggs by size, crates or pieces), separate from daily egg
    collection. Expenses count when money is spent: store purchases (feed,
    vaccines, vitamins) on the day bought, and a record that took from the
    store adds nothing more (`backend/src/lib/expenses.ts`); a batch's own
    profit still uses what that batch used. Birds alive everywhere = placed − deaths − birds sold,
    computed by `GET /batches`. Worth checking with a farmer whether the
    egg sizes (small/medium/large/jumbo) match how they sell.
