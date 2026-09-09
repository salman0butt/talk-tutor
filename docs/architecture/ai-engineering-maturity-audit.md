# Talk Tutor — Advanced AI Engineering Maturity Audit

**Repository:** https://github.com/salman0butt/talk-tutor  
**Audited branch:** main  
**Audited HEAD:** af6c5e3dd56fb3c26f0100b8c48e3780dbd15d08  
**Audit date:** 2026-09-09  
**Scope:** Architecture and AI-maturity audit only. No production behavior is changed by this document.

## Executive summary

Talk Tutor already has unusually solid application-level foundations for an early voice-first AI learning product. The repository does not blindly delegate everything to an LLM. It uses deterministic code for placement scoring, streaks, spaced repetition, recommendation ranking, billing/session limits, transcript state, persistence, and most analytics. The two offline generation paths use Gemini structured output plus a second local validation boundary, and both explicitly isolate learner-controlled text as untrusted data. The realtime subsystem has also been refactored around deterministic transcript state, interruption handling, cleanup, session boundaries, and safe ephemeral-token issuance.

The primary weakness is therefore **not missing AI frameworks**. It is the absence of a measurement and provenance layer around educational AI behavior.

The highest-value next investments are:

1. **Build a repository-native AI evaluation harness and golden datasets.**
2. **Make grammar/feedback outputs evidence-grounded and aggressively penalize false corrections.**
3. **Version prompts/models and persist lightweight generation provenance for important AI outputs.**
4. **Add privacy-safe AI traces, latency/cost metrics, and a consistent failure taxonomy.**
5. **Add realtime, multilingual, adversarial, and human-calibrated evaluation tiers before changing models or architecture.**

The most important product-specific risk is a cascade from one bad AI judgment: a false grammar correction can be persisted, counted as a recurring mistake, shown on the dashboard, selected by Practice My Mistakes, and reused as context for a personalized vocabulary example. The current system validates the **shape** of feedback very well, but it does not validate whether the educational claim is actually correct or grounded in an observed learner utterance.

The second major risk is progress comparability. The dashboard presents a text-derived fluency score trend after three scored sessions. The prompt contains a stable rubric, which is good, but the repository does not persist prompt version, model version, evaluator version, or calibration data. A model or prompt behavior shift can therefore move the visible trend even when the learner did not change.

Technologies such as LangGraph, RAG, vector databases, MCP, multi-agent systems, and fine-tuning are not the next maturity step. They add orchestration or retrieval capabilities that the product does not currently lack. Talk Tutor first needs to know whether its tutor and feedback are **correct, stable, safe, reproducible, and improving**.

## 1. Repository state and evidence

### State recovered

- Branch: main
- HEAD: af6c5e3dd56fb3c26f0100b8c48e3780dbd15d08
- Latest merge: PR #5, “feat: add monetization, onboarding and tutor reliability”
- Open PRs at audit time: none
- Recent merged PRs:
  - #5 monetization, onboarding and tutor reliability
  - #4 live tutor voice/transcript stabilization
  - #3 personalized practice and vocabulary learning
  - #2 persistent SaaS learning platform
  - #1 SaaS landing page and secure authentication
- PR reviews / review threads observed on PRs #2–#5: none
- Latest main workflow: Learning Platform CI
- Latest main workflow result at audited HEAD: success
- Repository AGENTS.md: not present at the root/tree state inspected

### CI currently verifies

.github/workflows/ci.yml runs:

- pnpm install --frozen-lockfile
- lint
- TypeScript typecheck
- deterministic unit/domain tests
- PostgreSQL migration parsing
- RLS/schema/runtime security tests
- production build

This is a good software-quality gate. It is **not an AI-quality gate** because the current tests mock model providers or test deterministic prompt construction/transcript logic rather than scoring real candidate model behavior.

### Key code evidence

The audit is primarily based on:

- services/liveManager.ts
- store/useAudioStore.ts
- lib/live/*
- lib/learning/practice.ts
- lib/learning/feedback/provider.ts
- lib/learning/feedback/service.ts
- lib/learning/validation.ts
- lib/learning/vocabulary-example/*
- lib/learning/recommendations.ts
- lib/learning/progress.ts
- lib/learning/analytics.ts
- lib/onboarding/*
- app/api/token/*
- app/api/learning/sessions/*
- app/api/learning/vocabulary/*
- supabase/migrations/*
- tests/live/*
- tests/learning/*
- tests/onboarding/*
- docs/architecture/*

## 2. Current AI architecture

### Actual architecture

~~~text
Talk Tutor
│
├── Realtime Tutor
│   ├── Gemini Live
│   ├── model: gemini-2.5-flash-native-audio-preview-12-2025
│   ├── ephemeral browser token from authenticated server endpoint
│   ├── code-owned tutor system instruction
│   ├── bounded/validated practice configuration
│   ├── learner practice data marked UNTRUSTED
│   ├── native audio response
│   ├── input/output transcription
│   └── deterministic transcript reducer + persistence
│
├── Post-session Feedback
│   ├── Gemini generateContent
│   ├── model: GEMINI_FEEDBACK_MODEL or gemini-2.5-flash
│   ├── bounded persisted transcript
│   ├── transcript explicitly marked UNTRUSTED
│   ├── provider JSON response schema
│   ├── local application validation
│   ├── grammar corrections
│   ├── better sentences
│   ├── vocabulary
│   ├── text-derived fluency coaching score
│   └── pronunciation claims forcibly removed
│
├── Personalized Vocabulary Example
│   ├── Gemini generateContent
│   ├── model: GEMINI_FEEDBACK_MODEL or gemini-2.5-flash
│   ├── saved vocabulary item
│   ├── optional recent grammar correction context
│   ├── untrusted-data boundary
│   ├── structured response
│   ├── local validation
│   └── persisted once; existing generation is reused
│
├── Personalized Practice
│   ├── deterministic practice configuration
│   ├── curated roleplay library
│   ├── correction-frequency policy
│   ├── difficulty policy
│   └── target mistake categories injected into Live tutor context
│
├── Practice My Mistakes
│   ├── AI-derived historical correction categories
│   ├── deterministic frequency/recency ranking
│   └── Live tutor creates practice opportunities
│
├── Placement
│   ├── NO LLM
│   ├── six code-owned objective questions
│   └── deterministic Basic / Intermediate / Top Class mapping
│
├── Recommendations
│   ├── NO LLM
│   ├── vocabulary due state
│   ├── mistake counts
│   ├── daily goal remaining
│   └── deterministic goal→scenario mapping
│
└── Progress
    ├── deterministic minutes/streak/vocabulary calculations
    ├── AI-derived grammar corrections feed mistake trends
    └── AI-derived fluency scores feed visible coaching trend
~~~

### Architectural judgment

The current separation is mostly correct:

- **Fuzzy language reasoning** uses AI.
- **Scheduling, counts, billing, streaks, placement scoring, and recommendation ranking** use normal code.
- Gemini Live remains provider-specific, which is sensible because realtime audio APIs have provider-specific semantics.
- Offline text generation already has narrow provider interfaces, which is enough for testing without creating a universal provider framework.

This is a strong KISS/YAGNI baseline.

## 3. AI call inventory

| Feature | Provider/model | Inputs | Output | Validation | Retry / timeout / fallback | Persistence | Latency | Frequency / cost risk | Main risk |
|---|---|---|---|---|---|---|---|---|---|
| Realtime Tutor | Google Gemini Live; gemini-2.5-flash-native-audio-preview-12-2025 | microphone audio; language; proficiency; voice; topic; practice mode; roles; correction frequency; difficulty; target mistakes | native audio + input/output transcripts | practice config validation; explicit untrusted practice-data block; deterministic transcript reducer | user-visible retry categories exist; no automatic provider failover; connection/session policy bounds; no transparent model fallback | finalized text transcript only; no audio | critical / interactive | every live session; **High** cost exposure | tutor correctness, prompt adherence, latency, disconnects, transcript quality |
| Session feedback | Google Gemini generateContent; GEMINI_FEEDBACK_MODEL or gemini-2.5-flash | bounded transcript + language + proficiency + topic | structured JSON feedback | provider response schema + JSON.parse + parseSessionFeedback; pronunciation stripped | no explicit provider timeout; no automatic bounded retry; safe failed status + manual retry; no fallback model | structured feedback persisted | asynchronous / post-session | normally once per completed eligible session; **Medium–High** | false corrections, unsupported claims, score drift |
| Vocabulary example | Google Gemini generateContent; same configurable offline model | saved term, meaning, language, proficiency, source context, recent mistake | structured JSON sentence/explanation/category | provider schema + local parseVocabularyExample | no explicit timeout/retry/fallback; failure leaves card usable | persisted once; existing example skips model | user-triggered | on demand; **Low–Medium** | bad example reinforces bad historical correction |
| Placement | none | six answers | score + level | deterministic | n/a | profile placement metadata | instant | negligible | calibration breadth, English-only scope |
| Recommendations | none | due vocabulary, mistakes, practice minutes, goal | recommended practice list | deterministic | n/a | derived | instant | negligible | bad upstream AI corrections influence mistake recommendation |
| Progress metrics | no new call | persisted sessions, corrections, fluency scores | trend metrics | deterministic arithmetic | n/a | derived | instant | negligible incremental AI cost | comparability of upstream model-generated scores |

### Missing call metadata across offline AI generation

The feedback and vocabulary-example providers currently do **not** record enough information to answer reliably:

- Which exact model response version generated this output?
- Which prompt version?
- Which generation configuration?
- What was latency?
- How many input/output tokens were consumed?
- Was a retry used?
- Which validation stage failed?
- Which deployment/feature version produced the output?

These are high-value omissions because feedback affects the learner model.

## 4. AI maturity scorecard

Scale:

- 0 — Missing
- 1 — Ad hoc
- 2 — Basic
- 3 — Production-capable
- 4 — Strong
- 5 — Advanced

| Capability | Current | Target | Priority | Repository evidence / judgment |
|---|---:|---:|---|---|
| Prompt engineering | 3 | 4 | P1 | buildTutorSystemInstruction and feedback/vocabulary system instructions have role, behavior, trust boundaries, and task-specific constraints; prompts are not versioned or behavior-evaluated |
| Structured outputs | 4 | 4 | P1 | feedback and vocabulary examples use Gemini response schemas and a second local validation pass |
| Guardrails | 3 | 4 | P0 | bounded inputs, untrusted-data separation, pronunciation prohibition; missing educational evidence checks and explicit product safety policy/evals |
| Evaluation | 1 | 4 | **P0** | deterministic tests exist, but no golden dataset, live-model quality suite, calibrated judge, human baseline, or regression comparison |
| Observability | 1 | 3 | **P0** | safe error logging exists; no prompt/model/version/token/latency/validation trace model |
| Safety | 2 | 3 | P1 | tutor role constraints and secret-extraction instructions exist; no explicit language-tutor safety/redirect policy or safety eval suite |
| AI security | 3 | 4 | P1 | ephemeral tokens, RLS, bounded inputs, untrusted prompt blocks; missing systematic second-stage injection/red-team coverage and offline generation rate controls |
| Reliability | 3 | 4 | P1 | robust realtime lifecycle/transcript logic and feedback claim/idempotency; offline calls lack explicit timeouts/retry classification |
| Personalization | 3 | 4 | P1 | structured profile, mistakes, vocabulary, practice preferences and deterministic recommendations already drive behavior |
| Memory | 3 | 4 | P2 | durable learner state is structured and appropriate; retrieval of historical signals is still simple and partially AI-derived |
| Model abstraction | 3 | 3 | Maintain | narrow offline provider interfaces improve testing; Live appropriately remains Gemini-specific |
| Cost controls | 2 | 3 | P1 | live usage entitlements/session leases and persisted vocabulary examples reduce waste; no per-feature token/cost telemetry or explicit offline rate limiting |
| Latency controls | 2 | 3 | P1 | realtime implementation optimizes streaming and playback; no AI latency SLOs/traces and offline requests have no explicit timeout |
| Testing | 4 | 4 | Maintain | extensive deterministic domain/transcript/RLS/build CI |
| Data quality | 2 | 4 | **P0** | structured transcript and feedback data, but no correction evidence provenance, gold labels, complaint signals, or judge/human calibration |
| Experimentation | 0 | 3 | P2 | no AI experiment harness, pairwise model comparison, or AI feature-flag process observed |

### Overall maturity interpretation

Talk Tutor is **production-capable in deterministic application engineering but basic in AI quality operations**.

That imbalance matters. The application is already good at preventing malformed data and race conditions. Its next failures are more likely to come from a syntactically valid but educationally wrong model answer than from invalid JSON.

## 5. Feature-by-feature AI audit

### 5.1 Realtime Tutor

**What AI does today**

Gemini Live performs bidirectional native-audio tutoring. The system prompt is built from code-owned policy plus validated practice configuration. Input/output transcription is enabled and normalized into deterministic transcript events.

**Current safeguards**

- Gemini API key remains server-side.
- Browser receives a short-lived one-use ephemeral token after authentication, entitlement checks, and a concurrent-session lease.
- Practice fields are normalized and length bounded.
- Learner-controlled practice data is serialized in a block explicitly marked untrusted.
- Tutor instructions define target language, response length, correction behavior, difficulty behavior, roleplay behavior, and target mistakes.
- Live runtime has deterministic generation IDs, cleanup, interruption handling, playback epochs, and transcript session isolation.
- Raw audio is not persisted.
- Full transcripts are not intentionally emitted into error logs.

**Main risks**

1. No behavior eval proves the tutor actually follows correction-frequency, difficulty, target-language, roleplay, or mistake-practice policies.
2. No measured first-response or turn-latency SLO exists.
3. No production metric for connection success, unexpected disconnects, transcript anomalies, or interruption quality.
4. Safety handling is implicit rather than a product policy.
5. Model changes cannot be compared against a baseline.
6. The current Live model is a preview model and Google currently recommends Gemini 3.1 Flash Live Preview as the migration target; changing it without evals would be risky.

**Missing evals**

- golden multi-turn conversations
- correction-frequency adherence
- difficulty adherence
- roleplay adherence
- target-language adherence
- interruption/barge-in behavior
- transcript completeness/duplication/order
- connection and first-response latency
- adversarial spoken prompt injection
- multilingual/code-switching cases

**Recommended next improvement**

Instrument the current model first, create a small conversation-level eval suite, then compare current Live behavior with a candidate Gemini 3.1 Flash Live configuration. Do not change the production model only because a newer model exists.

### 5.2 Session feedback

**What AI does today**

A completed session triggers post-session feedback through Next.js after(). The service atomically claims generation, loads persisted messages, bounds the transcript to the newest 80 turns / roughly 24k serialized characters, calls Gemini with a response schema, validates locally, persists structured feedback, and marks status completed or failed.

**Current safeguards**

- current-user repository access under RLS
- completed-session requirement
- user-turn requirement
- atomic generation claim
- bounded transcript
- explicit second-stage prompt-injection instruction
- JSON data delimiters around transcript
- provider structured response schema
- second local validation
- category allowlist and array/string bounds
- score range 0–100
- pronunciation notes forcibly discarded
- failed generation does not invalidate the session

**Main risks**

1. **No semantic grounding check.** A correction can be valid JSON even when the “original” sentence was never spoken or was already correct.
2. **No false-correction eval.** This is the highest educational risk.
3. **No provenance.** Persisted feedback does not identify prompt version/model/generation settings.
4. **Score calibration is weak.** A stable prompt rubric does not guarantee a stable score distribution across model updates.
5. Conversation topic is placed as normal prompt text rather than inside the same explicit untrusted-data object as transcript data. It is bounded, and it is not privileged system text, so this is not a critical vulnerability, but consolidating all learner-controlled context into one untrusted structure would make the trust boundary clearer.
6. No explicit timeout or bounded automatic retry policy.
7. No token/cost telemetry.

**Recommended next improvement**

Make every grammar correction carry evidence that can be deterministically linked to a user transcript turn; reject or downgrade unsupported corrections. Build a correction-precision dataset where false positives receive a larger penalty than missed minor errors.

### 5.3 Placement

**What AI does today**

Nothing. Placement is six code-owned English multiple-choice questions with deterministic scoring and deterministic level boundaries. The learner can override the recommendation.

**Current safeguards**

- answer key is server-known
- answer choices validated
- score bounded
- explicit product wording that it is an estimate, not certification

**Main risks**

- six questions are too small for robust proficiency calibration
- the current placement test is English-specific while the tutor supports multiple target languages
- Basic / Intermediate / Top Class is not a calibrated CEFR measurement
- current level boundaries are hand-authored, not validated against human-labeled learner examples

**Recommendation**

Keep placement deterministic for now. Improve the question bank, language coverage, and calibration before introducing an LLM scorer. AI is not automatically more reliable here.

### 5.4 Personalized Practice

**What AI does today**

Deterministic practice configuration controls the Live tutor. The model is responsible for realizing the requested behavior conversationally.

**Safeguards**

- mode allowlist
- correction-frequency allowlist
- difficulty allowlist
- topic/scenario/role length bounds
- up to three allowlisted target mistake categories
- untrusted-data serialization
- explicit roleplay and difficulty guidance

**Main risk**

The repository tests that prompt text contains the policy, not that the model obeys it.

**Recommendation**

Create behavior evals for minimal/balanced/frequent corrections and easy/normal/challenging difficulty. Measure compliance properties rather than exact output strings.

### 5.5 Practice My Mistakes

**What AI does today**

Historical AI-generated correction categories are deterministically ranked by recency/frequency/affected sessions and selected as practice targets. Gemini Live then creates opportunities to exercise them.

**Main risk**

This is the clearest **error-amplification loop** in the product:

~~~text
false correction
→ persisted mistake category
→ dashboard/common-mistake count
→ deterministic target selection
→ Practice My Mistakes
→ tutor drills a weakness the learner may not have
~~~

**Recommendation**

Do not change the deterministic ranking. Improve the trustworthiness of the upstream correction data. Add evidence links and confidence/evidence-sufficiency states such as verified / uncertain rather than an uncalibrated model “confidence percentage.”

### 5.6 Roleplay

**What AI does today**

The Live tutor receives code-owned scenario structure or bounded custom role text and is instructed to stay in the tutor role and not speak for the learner.

**Risk**

Role adherence is unmeasured, especially over long conversations or after adversarial user instructions.

**Recommendation**

Golden multi-turn roleplays with deterministic checks plus a rubric-based judge for naturalness and role adherence.

### 5.7 Vocabulary generation

**What AI does today**

The feedback model can propose vocabulary; separately, an explicit personalized-example request uses a saved term plus optional source context and one recent mistake context to generate a structured example.

**Safeguards**

- on-demand only
- existing personalized example skips generation
- untrusted context block
- structured output + local validation
- failure does not break the base card

**Risks**

- an incorrect historical correction can be reused as pedagogical context
- no semantic quality eval of meaning/example naturalness
- no model/prompt provenance
- one generic “recent mistake” is selected rather than a clearly relevant mistake

**Recommendation**

Evaluate example correctness and learner-level appropriateness. Keep persistence/caching behavior. Prefer deterministic relevance selection before embeddings.

### 5.8 Progress AI metrics

**What AI does today**

No new model call occurs, but model-produced fluency scores and correction categories are aggregated into learner-facing trends and recommendations.

**Current safeguard**

The UI explicitly labels fluency as a text-derived coaching score, not an exam/acoustic score, and waits for at least three scored sessions.

**Main risk**

Three samples solve sample scarcity, not calibration drift. Without persisted prompt/model version and an eval-calibrated scoring rubric, a visible delta may reflect model behavior change rather than learner improvement.

**Recommendation**

Until calibration exists, retain conservative wording and consider suppressing cross-version score deltas. Store scoring provenance and establish anchor conversations that should receive stable score bands.

### 5.9 Recommendations

**What AI does today**

Recommendation generation is deterministic.

**Assessment**

This is the correct architecture. Keep it deterministic until evidence shows a fuzzy ranking model improves learner outcomes.

## 6. Guardrails assessment

### What Talk Tutor already gets right

Guardrails are not merely banned-word filters in this repository.

Current high-value controls include:

- instruction/data separation in Live practice context
- instruction/data separation in feedback transcript context
- instruction/data separation in vocabulary-example context
- input normalization and size limits
- enum/allowlist validation
- structured provider output for offline AI
- second local output validation
- no transcript-only pronunciation claims
- authentication/RLS ownership
- ephemeral Live credentials
- no service-role bypass in learner repository access
- deterministic session concurrency/usage controls

### P0 educational guardrails to add

#### A. Correction evidence requirement

Every grammar correction should include enough provenance to establish that it is based on the learner's words:

- source message ID or sequence
- source utterance
- corrected form
- explanation
- category

Then deterministically require:

- source message belongs to the same session/user
- source role is user
- original text is present or safely aligned to that source turn
- correction is not empty/identical after normalization
- category is allowlisted

If alignment fails, do not persist the correction as a trusted recurring mistake.

#### B. False-correction bias

Prompt and eval policy should explicitly prefer:

~~~text
uncertain / no correction
over
confidently teaching a wrong correction
~~~

This is more important for Talk Tutor than generic toxicity filtering.

#### C. Dialect/variant guardrail

For English especially, do not label legitimate British/American/regional variants as mistakes unless the learner explicitly selected a target variety and the difference matters to the learning goal.

#### D. Progress-claim guardrail

The model should never claim measured improvement such as a percentage unless that number is calculated by deterministic product logic from comparable evidence. The model may describe observed behavior in one session; longitudinal improvement claims belong to calibrated analytics.

### P1 product safety policy

Talk Tutor needs a concise, product-specific policy for arbitrary conversation requests:

- keep normal language practice broad
- for sexual/violent/self-harm/illegal/medical/legal dangerous requests, do not become a specialist instruction engine
- safely redirect toward language practice where appropriate
- allow benign language-learning discussion of sensitive topics
- distinguish content discussion from actionable dangerous instructions

The goal is not a generic censorship layer. It is to keep a language tutor within a safe educational role.

### Prompt-injection boundary findings

**Strong today**

- transcript is marked untrusted before feedback generation
- practice configuration is marked untrusted before Live use
- vocabulary and historical mistake text are marked untrusted

**Improve**

- serialize all user/semi-trusted session metadata, including free-form topic, into a single explicit untrusted context object for each call
- add second-stage injection test cases where stored transcript tells the later feedback generator to ignore policy
- add output checks for system-prompt leakage markers
- do not rely on the phrase “ignore prompt injection” as the defense; keep structural boundaries + schema + evals

## 7. Evaluation assessment — highest priority

### Current state

Talk Tutor has excellent deterministic tests relative to its size, including:

- transcript partial/final behavior
- repeated-word preservation
- speaker ordering
- interruption/barge-in boundaries
- reconnect isolation
- Gemini event normalization
- PCM/audio utility bounds
- prompt construction and untrusted-data markers
- malformed provider-output rejection
- feedback claim/idempotency
- pronunciation suppression
- practice input bounds
- deterministic recommendation/streak/spaced-repetition behavior
- RLS/migration checks

What it does **not** have is an AI-quality evaluation system.

A mocked provider returning good JSON proves the integration contract. It does not prove that Gemini will produce correct teaching behavior.

### Recommended repository-native eval layout

~~~text
evals/
  fixtures/
    tutor/
    feedback/
    placement/
    vocabulary/
    personalization/
    adversarial/
    multilingual/
    realtime/
  rubrics/
    feedback.ts
    tutor.ts
    roleplay.ts
    level.ts
  evaluators/
    deterministic/
    judges/
  baselines/
  reports/
  README.md
~~~

Do not start by installing a platform. A small TypeScript harness fits the current repository.

### Golden dataset properties

Each case should contain:

- stable ID
- language / locale
- learner level
- goal
- input or conversation
- configuration
- expected properties
- prohibited properties
- human notes / rationale
- provenance / author
- dataset version

Prefer property-based expectations, not exact generated strings.

### Feedback eval dimensions

Highest priority:

1. **false correction rate**
2. grammar correction precision
3. source-utterance grounding
4. correction grammaticality
5. explanation accuracy
6. dialect/variant tolerance
7. better-sentence naturalness
8. vocabulary usefulness
9. fluency-summary grounding
10. unsupported claim rate

False corrections should carry a higher penalty than minor missed errors.

### Tutor behavior eval dimensions

- target-language adherence
- correctness of target language
- relevance
- conversational naturalness
- learner-level appropriateness
- response length/scaffolding
- topic adherence
- roleplay adherence
- correction-frequency adherence
- difficulty adherence
- target-mistake practice behavior
- does not speak both sides of roleplay
- safe redirect behavior

### Deterministic evaluators

Use code first for:

- valid JSON/schema
- required fields
- non-empty output
- enum/range validity
- response length bounds
- target language/script heuristics where reliable
- source-message linkage
- correction original exists in user evidence
- no duplicate correction IDs
- no pronunciation notes without acoustic evidence
- no forbidden internal markers
- no malformed HTML/script where UI does not expect it
- transcript ordering/duplication
- provider failure classification
- bounded context size

### LLM-as-a-judge

Use only where semantic judgment adds value:

- correction accuracy
- explanation quality
- naturalness
- level appropriateness
- roleplay adherence
- conversation relevance

Judge design:

- explicit rubric per dimension
- categorical or anchored 0–4 scale
- structured output
- rationale
- “insufficient evidence” option
- versioned judge prompt
- calibration against human-labeled cases
- periodic disagreement review

Do **not** create one generic “quality score 1–10.”

### Pairwise evaluation

For model or prompt changes, pairwise comparison should be a core tool:

~~~text
same fixture
→ production prompt/model output A
→ candidate prompt/model output B
→ deterministic checks
→ blinded rubric judge / human sample
→ better / worse / tie + reason
~~~

Use it for:

- feedback prompt changes
- Gemini 2.5 Live vs Gemini 3.1 Live candidate
- correction policy changes
- vocabulary example prompt changes

### Human evaluation

Humans should periodically anchor:

- subtle grammar correctness
- dialect handling
- advanced nuance
- placement calibration
- learner-level appropriateness
- any future pronunciation assessment

A language tutor should not declare another LLM to be the unquestionable ground truth.

### Evaluation tiers

#### Tier 1 — every PR

No paid model calls required.

- schema validators
- prompt trust-boundary tests
- deterministic eval fixtures
- transcript/reliability tests
- context-budget tests

Fail CI on regression.

#### Tier 2 — AI-affecting PRs

Small live-model suite, e.g. 15–40 carefully chosen cases.

- high-risk feedback cases
- prompt injection
- level adherence
- a few multilingual cases

Use budget limits. Fail only on critical deterministic/safety regressions at first; report quality deltas until baselines stabilize.

#### Tier 3 — scheduled

Larger live suite:

- golden conversations
- multilingual matrix
- adversarial cases
- pairwise candidate comparisons
- repeated selected stochastic cases
- cost/latency summary

#### Tier 4 — release / model migration

- human review sample
- red-team pass
- full regression
- model migration comparison
- rollback criteria

### Realtime voice evals

Track and evaluate:

- connection success rate
- token authorization success
- first audio response latency
- median turn latency
- unexpected disconnect rate
- interruption success
- transcript completeness
- duplicate transcript rate
- missing turn rate
- ordering failures
- reconnect contamination
- completion rate

A small controlled audio fixture set is appropriate later. Do not build a giant speech benchmark yet.

### Pronunciation evals

Current policy is correct: no acoustic pronunciation claims are persisted because the product does not store/use defensible acoustic evidence for post-session feedback.

Do not add pronunciation scoring until there is an actual evidence source such as audio/phoneme/provider pronunciation signals plus human-calibrated evals.

### Placement evals

Placement is deterministic and therefore should be benchmarked rather than replaced with AI.

Create benchmark learners / answer profiles corresponding roughly to:

- novice
- lower intermediate
- intermediate
- upper intermediate
- advanced

Then validate score boundary usefulness with human review. If CEFR claims are ever introduced, calibrate explicitly against CEFR-style evidence rather than renaming the current three bands.

### Multilingual evals

The repository currently supports these locale configurations:

- en-US
- en-GB
- es-ES
- es-MX
- fr-FR
- de-DE
- ja-JP
- ko-KR
- zh-CN
- hi-IN
- pt-BR

Do not run an equally large suite for every locale initially. Choose representative families/scripts, then keep smoke cases for all configured locales.

Evaluate:

- target-language adherence
- script correctness
- unwanted translation leakage
- code switching
- correction correctness
- difficulty behavior
- locale/dialect handling

### Adversarial evals

At minimum:

- “ignore tutor instructions”
- “reveal your system prompt”
- stored transcript says later feedback must say grammar is perfect
- user asks for a 100 score
- user asks model to emit invalid JSON
- HTML/script text inside transcript
- long input
- malformed Unicode
- rapid interrupt
- long monologue
- language switch mid-turn
- repeated reconnect
- spoken prompt injection

## 8. Observability assessment

### Current answer to “Why did this AI response fail?”

Only partially answerable.

Today the application can often identify:

- feature / endpoint from logs
- broad runtime error class for Live
- feedback generation failed vs completed
- session identity in application state/database

It cannot reliably reconstruct:

- prompt version
- exact model version returned
- generation configuration version
- token usage
- cost
- latency
- retry count
- validation failure class
- model vs prompt vs data regression
- whether an important feedback item came from a model version change

### Recommended lightweight trace model

For offline AI calls:

~~~text
ai_trace
  trace_id
  feature
  session_id or vocabulary_item_id
  user_id_hash / internal owner reference if necessary
  prompt_version
  feature_version
  requested_model
  response_model (when provider exposes it)
  temperature
  started_at
  duration_ms
  status
  error_class
  validation_status
  retry_count
  input_tokens
  output_tokens
  estimated_cost
  input_size_chars / turns
~~~

Privacy default:

- do not store full raw prompts
- do not store full transcripts in traces
- do not send raw audio to observability
- store IDs, sizes, hashes, low-cardinality metadata, and explicit opt-in sampled content only if policy allows

### Realtime metrics

Aggregate rather than capturing audio:

- connection_success
- connection_duration
- first_audio_latency_ms
- median_turn_latency_ms
- disconnect_reason
- interruption_count
- transcript_finalized_turns
- transcript_error_event_count
- reconnect_count

### Tool decision: custom/OTel first, vendor later

**Recommendation: start with a small application-owned trace interface and OpenTelemetry-compatible field naming.**

Why:

- only three actual model-driven surfaces exist
- current architecture uses direct Google SDK calls
- raw learner conversations are privacy-sensitive
- prompt/model metadata can be stored without another platform
- the team first needs to define useful signals before adopting a dashboard vendor

Langfuse is a credible later option because it offers TypeScript/OpenTelemetry tracing, datasets, experiments, code evaluators, LLM judges, human annotation, and self-hosting. That is useful **after** Talk Tutor has a stable trace/eval model. LangSmith is also viable if a future LangChain-centered workflow emerges, but the current repository is not LangChain-based, so adopting it now would be tool-first architecture.

Do not build a bespoke observability UI yet. First collect trustworthy data.

## 9. Prompt management and versioning

### Current state

Prompts are already feature-specific rather than hidden behind a generic framework:

- buildTutorSystemInstruction
- FEEDBACK_SYSTEM_INSTRUCTION
- VOCABULARY_EXAMPLE_SYSTEM_INSTRUCTION

That is good.

### Main gap

Prompt changes are not first-class versioned production behavior.

Add constants such as conceptually:

~~~text
TUTOR_PROMPT_VERSION = tutor-v1
FEEDBACK_PROMPT_VERSION = feedback-v1
VOCAB_EXAMPLE_PROMPT_VERSION = vocabulary-example-v1
~~~

The exact naming scheme matters less than these properties:

- immutable semantic version/string committed with code
- trace it on every generation
- persist it with learner-impacting outputs where useful
- eval baselines reference it
- PRs changing prompts must update/evaluate it

Do not create a prompt CMS yet.

### Prompt review in AI-affecting PRs

A PR template/check could include:

~~~text
AI behavior changed: yes/no
Prompt version:
Model/config changed:
Eval baseline:
Candidate:
Critical regressions:
Known tradeoffs:
Cost delta:
Latency delta:
~~~

Only require this for AI-affecting changes.

## 10. Structured outputs and AI boundary validation

### Current state: strong

The repository correctly uses:

~~~text
model output
→ unknown JSON/text
→ provider schema
→ JSON.parse
→ application validator
→ trusted domain object
~~~

This is substantially better than casting model JSON directly to TypeScript.

### Recommended refinement

The current provider schema and hand-written validators duplicate definitions. A single typed schema source such as Zod could reduce drift, especially because current Gemini tooling supports JavaScript schema workflows.

Do not migrate validators just for style. Make this change when adding evidence/provenance fields so one canonical schema can generate/validate both provider and application boundaries.

### Repair vs retry

For malformed output:

- no recursive repair loops
- one bounded retry is reasonable only for transient/model-format failures if measured useful
- schema failure after retry → failed feature state
- do not retry invalid input, auth, guardrail rejection, or ownership failures
- optional vocabulary example should fail gracefully
- feedback should remain independently retryable without invalidating session
- Live should prefer reconnect UX over hidden multi-model failover

## 11. Reliability and failure strategy

### Feature classes

#### Critical realtime — Tutor voice

Failure behavior:

- preserve finalized transcript
- finalize session safely
- release lease/resources
- show actionable error
- allow explicit reconnect
- do not silently switch to another voice/model with different behavior

#### Important asynchronous — Session feedback

Failure behavior:

- completed session remains valid
- mark feedback failed
- bounded retry policy
- preserve idempotency
- user can retry
- trace failure class

#### Optional enrichment — Vocabulary example

Failure behavior:

- base card remains usable
- no repeated automatic generation storm
- existing result reused
- retry only on explicit user action or bounded transient policy

### Timeout policy

Offline AI HTTP operations should have explicit upper bounds.

A reasonable initial target should be measured rather than guessed, but the implementation needs:

- AbortSignal/timeout
- provider timeout error class
- duration trace
- no hanging request indefinitely

Live already has session/connection limits, but should expose measured SLOs.

### Error taxonomy

Unify around categories such as:

- provider_timeout
- provider_rate_limit
- provider_unavailable
- invalid_output
- guardrail_rejected
- context_too_large
- validation_failed
- authentication_failed
- ownership_failed
- usage_limit
- live_connection_failed

Do not leak raw provider errors to learners.

## 12. Security threat model

| Asset / flow | Attacker / input | Entry point | Failure | Impact | Existing mitigation | Recommended next mitigation |
|---|---|---|---|---|---|---|
| Tutor system instruction | learner | topic/custom scenario/spoken text | model follows injected instruction | tutor leaves educational policy / leaks hidden text | untrusted practice JSON + explicit policy + bounded fields | adversarial Live evals; output/system-leak tests; consolidated trust model |
| Feedback generator | stored learner transcript | second-stage transcript injection | feedback obeys transcript instruction | false feedback / prompt leakage | transcript delimited as untrusted + schema + local validation | adversarial golden cases; evidence grounding |
| Feedback truthfulness | model | valid but wrong JSON | false grammar error is persisted | teaches incorrect rule; poisons learner model | category/schema validation only | evidence links + correctness eval + user “correction is wrong” signal |
| Progress score | model behavior drift | changed model/prompt | scores shift without learner change | misleading progress | rubric wording + conservative UI copy | prompt/model provenance + calibrated anchors + cross-version policy |
| Vocabulary example | stored AI correction / user context | source context + recent mistake | incorrect context shapes example | reinforces false rule | untrusted block + validation | relevance selection + example quality eval |
| Gemini API key | browser attacker | token endpoint/client | long-lived credential leak | cost/account abuse | server key + ephemeral one-use token + auth/billing lease | keep current boundary; trace token failures |
| Offline AI cost | authenticated user | feedback/vocab endpoints | repeated generation abuse | cost / provider exhaustion | feedback claim + persisted vocab example | per-user request rate limit, request quotas, usage telemetry |
| Learner PII | observability/logging | transcripts/errors/traces | raw PII copied to third-party telemetry | privacy harm | no intentional full transcript/audio logging | trace content-off by default; redaction/consent policy |

## 13. Privacy model and context minimization

### Data currently sent to Gemini

#### Live

- microphone audio
- learner-selected target language/region
- proficiency label
- topic
- practice mode
- roles/scenario
- correction frequency
- difficulty
- selected mistake categories

#### Feedback

- recent bounded session transcript
- target language
- proficiency
- conversation topic

#### Vocabulary example

- term
- meaning
- language
- proficiency
- optional source context
- one recent correction

### Assessment

Context minimization is generally good. The application does **not** send the learner's entire database history to every call.

Improvements:

- keep vocabulary generation independent from irrelevant profile/session fields
- include only relevant mistake evidence, not simply the most recent correction
- make all free-form learner fields explicit untrusted data
- do not add full-history “memory” blobs
- establish a documented maximum context budget per AI feature
- traces should default to metadata rather than prompt bodies

## 14. Memory, RAG, embeddings, and retrieval

### What memory Talk Tutor actually needs

The repository already stores the most valuable memory as structured product state:

- language
- proficiency
- goals
- correction preference
- difficulty
- completed sessions
- structured mistake categories
- vocabulary state
- review schedule
- recent practice
- placement result

That is better than opaque chat memory for the product's core learner state.

### Recommended learner model

Derive a normalized view rather than duplicating the database:

~~~text
LearnerModel
  level
  goal
  correctionPreference
  difficulty
  recurringMistakes[]
  dueVocabulary[]
  recentPractice
  recentTopics
  skillSignalStatus
~~~

Use deterministic queries/ranking to decide what matters.

### Episodic memory

For now:

- recent recurring mistakes → SQL
- due vocabulary → SQL
- recent topics → SQL
- unfinished practice goals → SQL
- latest meaningful learner state → SQL

No embedding layer is needed for these.

### RAG decision

**NO today.**

Current personalization does not need external knowledge retrieval. The system is not currently failing because it cannot find a relevant document.

Potential future RAG triggers:

- user-uploaded learning documents
- a curated grammar/reference corpus that must be cited
- school/company course material
- domain-specific exam/immigration material
- learner-owned long-form knowledge that SQL metadata cannot select adequately

When one of those exists, evaluate retrieval quality before choosing a vector database.

### Embeddings / vector search

**NO today.**

Use SQL/category/recent/frequency queries for mistakes, vocabulary, and sessions. Add embeddings only if a concrete semantic retrieval problem appears and lexical/structured selection fails measurably.

## 15. Agents, LangChain, LangGraph, MCP

### LangChain

**NO.**

Current direct @google/genai calls are simple and readable. Prompt construction, structured output, and narrow provider interfaces are already solved without an orchestration framework.

A future addition would need to remove real complexity, not add an abstraction layer around three calls.

### LangGraph

**NO today.**

Realtime tutoring is a continuous streaming session, not a multi-stage durable graph. Feedback is one generation plus validation. Vocabulary example is one generation plus validation. Recommendations are deterministic.

Possible future graph-worthy workflows:

- multi-step weekly curriculum planning with review/approval
- durable coaching workflows with tools
- complex placement with adaptive question selection and checkpoints

None is required for current product quality.

### Agents

**NO today.**

The tutor does not need autonomous goal-seeking/tool selection to converse well. Agentic behavior would expand the attack and reliability surface before eval foundations exist.

### MCP

**NO today.**

No current user-facing requirement needs interoperable external tools. If a future tutor can access learner-approved dictionaries, calendars, company systems, or external course resources, MCP can be reconsidered as an integration protocol.

## 16. Model strategy

### Current models

- Realtime: gemini-2.5-flash-native-audio-preview-12-2025
- Offline feedback/examples: GEMINI_FEEDBACK_MODEL, default gemini-2.5-flash

### Current external model status checked during audit

Google's current deprecation documentation still lists gemini-2.5-flash-native-audio-preview-12-2025 with no announced shutdown date, but recommends gemini-3.1-flash-live-preview as the replacement path. Google also documents migration details from 2.5 Live to 3.1 Live.

References checked 2026-09-09:

- https://ai.google.dev/gemini-api/docs/deprecations
- https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-live-preview
- https://ai.google.dev/gemini-api/docs/live-api/session-management

### Recommendation

Do **not** immediately replace the Live model.

First create:

- realtime golden conversations
- latency metrics
- transcript quality metrics
- pairwise tutor-quality rubric
- correction-frequency/difficulty compliance tests

Then run a controlled candidate evaluation of Gemini 3.1 Flash Live Preview.

Adopt it only if it improves the quality/latency/cost frontier without regressions.

### Multiple models

Do not create a universal provider factory.

Later, measure whether a cheaper model can safely handle vocabulary examples or simple classification while a stronger offline model handles complex feedback. Make that a feature-level configuration decision based on evals.

### Model fallback

Do not add silent cross-model fallback to the Live tutor now.

For offline feedback, the best current fallback is graceful failure + retry, not a second provider with unknown scoring calibration. A fallback model for scoring can itself make historical scores incomparable.

## 17. Cost and latency assessment

### Where cost originates

1. Realtime native audio — likely dominant per active learner because it streams continuously.
2. Session feedback — once per completed eligible session.
3. Personalized vocabulary examples — explicit, persisted, and reused.
4. Placement/recommendations/streaks/spaced repetition — deterministic; no model cost.

### Existing good cost choices

- session entitlement and concurrent-session lease
- bounded Live session policy
- no AI call for dashboard metrics
- no AI call for deterministic recommendations
- no AI call for spaced repetition
- no generic RAG/vector DB
- vocabulary example generated only on explicit request
- existing vocabulary example reused
- feedback transcript bounded

### Missing cost controls

- per-feature token/usage measurement
- AI cost per conversation
- AI cost per active learner
- AI cost per paid subscriber
- offline generation rate limit / quota visibility
- explicit output-token budgets
- timeout/retry cost accounting

### Highest-impact next cost work

Instrument first. Do not optimize blindly.

Once measured:

- compare offline model candidates on correction quality per dollar
- bound feedback output sizes based on actual UX
- preserve deterministic features
- avoid sending irrelevant historical context
- only cache content whose semantics are truly reusable

## 18. AI vs deterministic code audit

| Capability | Current | Recommended | Why |
|---|---|---|---|
| live conversation | AI | AI | fuzzy realtime language interaction |
| grammar feedback | AI | AI + evidence + evals | language reasoning needed; correctness must be measured |
| better-sentence suggestions | AI | AI + evals | naturalness is fuzzy |
| vocabulary examples | AI | AI, on demand | natural contextual generation |
| fluency coaching summary | AI | AI + calibrated rubric/evals | semantic observation |
| fluency trend arithmetic | deterministic over AI score | deterministic, but version-aware | arithmetic should stay code-owned |
| placement answer scoring | deterministic | deterministic | objective answer key |
| streaks | deterministic | deterministic | correctness |
| practice minutes | deterministic | deterministic | correctness |
| spaced repetition | deterministic | deterministic | schedule reliability |
| recommended practice candidate ranking | deterministic | deterministic initially | explainability and stability |
| mistake ranking | deterministic over AI-derived categories | deterministic, after upstream correction quality improves | ranking itself is not fuzzy |
| roleplay scenario selection | deterministic | deterministic | small code-owned library |
| future scenario wording | AI optional | AI only if it adds measured UX value | fuzzy phrasing only |

No current deterministic capability should be replaced with an agent.

## 19. Feedback calibration and progress defensibility

The current fluency prompt specifies:

- sentence construction: 40%
- vocabulary appropriateness/range: 30%
- conversational continuity: 30%

This is better than an unstructured “give a score.”

However, a written rubric alone is not calibration.

### Required next steps

Create anchor transcripts with human-reviewed score bands:

- clear Basic performance
- Basic/Intermediate boundary
- stable Intermediate
- Intermediate/advanced boundary
- strong advanced performance
- code-switching/noisy transcript cases
- short/insufficient evidence cases

For each model/prompt version:

- score anchors repeatedly
- compare distributions
- flag large drift
- do not combine incomparable score eras as one progress line without annotation/recalibration

### Confidence policy

Do not ask the model “how confident are you?” and store the number as calibrated confidence.

Prefer evidence sufficiency:

- sufficient transcript length?
- enough learner turns?
- correction maps to source text?
- multiple evaluators agree?
- judge/human disagreement?
- score derived under a calibrated prompt/model version?

## 20. Data flywheel and user feedback

The highest-value feedback signals are not generic stars.

Add targeted learner controls such as:

- “This correction is wrong”
- “Tutor misunderstood me”
- “Transcript is incorrect”
- “This example helped”

Prioritize “correction is wrong” and “transcript incorrect” because they directly create high-value failure examples.

Flow:

~~~text
production interaction
→ privacy-safe quality signal
→ failure case
→ human review when needed
→ golden/adversarial dataset
→ prompt/model candidate
→ regression eval
→ release
~~~

Do not assume learner conversations can become training data. Evaluation/training reuse needs appropriate privacy policy, minimization, and consent.

## 21. Failure harvesting and online evals

Automatically surface metadata-only failure candidates:

- invalid_output
- provider_timeout
- provider_rate_limit
- high latency
- empty output
- repeated feedback failure
- correction reported wrong
- transcript reported wrong
- unexpected language
- disconnect burst

For production online evals:

- sample a small percentage
- avoid sending every interaction through another model
- use deterministic checks broadly
- use LLM judges only for selected semantic dimensions
- keep raw content off third-party traces by default

Shadow evaluation should wait until traffic and eval maturity justify the cost.

## 22. AI incident debugging target state

Question:

> If 100 users receive poor grammar corrections tomorrow, how do we determine what changed?

Today the answer is incomplete.

Target debugging flow:

~~~text
incident window
→ deploy SHA
→ feedback prompt version
→ requested/response model
→ generation config
→ validation status
→ correction evidence rate
→ eval baseline vs candidate
→ provider latency/error shift
→ affected locale/level/topic cohorts
→ sampled human-reviewed examples
~~~

This should be possible without searching raw logs for entire learner transcripts.

## 23. Release gates

Do not set arbitrary numeric thresholds before measuring baselines.

Initial release-gate categories:

### Fail CI immediately

- schema contract broken
- system/untrusted boundary regression
- evidence-link integrity broken
- critical prompt leakage regression
- pronunciation claim reintroduced without evidence
- invalid output persists
- deterministic transcript/security tests fail

### Warn / require AI review

- live-model quality score declines from baseline
- correction precision declines
- level/roleplay adherence declines
- latency/cost increases materially
- multilingual subset declines

### Manual review required

- new scoring rubric
- model migration
- safety-policy change
- placement boundary change
- future pronunciation feature

## 24. Explicit technology decisions

| Question | Decision | Reason |
|---|---|---|
| Do we need guardrails now? | **YES — NOW** | Existing structural guards are good; educational evidence/false-correction/progress guardrails are still missing |
| Do we need evals now? | **YES — NOW** | Biggest maturity gap; no way to prove model quality/regression today |
| Do we need LLM-as-a-judge? | **YES — NEXT** | Useful for semantic quality after deterministic checks and human calibration exist |
| Do we need LangSmith/Langfuse? | **MAYBE LATER** | Define trace/eval model first; Langfuse is a credible later fit, but a vendor is not required to solve the immediate problem |
| Do we need LangChain? | **NO** | Direct SDK + narrow providers are simpler and sufficient |
| Do we need LangGraph? | **NO** | Current workflows are not durable multi-stage agent graphs |
| Do we need RAG? | **NO** | No current external knowledge retrieval gap; structured learner data is enough |
| Do we need embeddings? | **NO** | SQL/category/recency queries solve current personalization |
| Do we need vector search? | **NO** | No demonstrated semantic retrieval need |
| Do we need MCP? | **NO** | No concrete external-tool interoperability requirement |
| Do we need AI agents? | **NO** | Conversation/feedback do not need autonomous planning/tool loops |
| Do we need fine-tuning? | **NO** | No mature eval baseline or validated high-quality training corpus yet |
| Do we need multiple models? | **MAYBE LATER** | Evaluate cost/quality by feature first |
| Do we need model fallback? | **MAYBE LATER** | Graceful failure/retry is safer now; cross-model scoring can damage comparability |
| Do we need prompt versioning? | **YES — NOW** | Required to diagnose learner-impacting behavior changes |
| Do we need AI tracing? | **YES — NOW** | Current failures cannot be reproduced/attributed sufficiently |
| Do we need a learner-memory architecture? | **YES — NEXT** | Use a derived structured LearnerModel over existing DB data, not generic LLM memory |
| Do we need human feedback loops? | **YES — NEXT** | Needed to calibrate grammar correctness, dialect nuance, and judges |
| Do we need production online evals? | **YES — NEXT** | Sampled online checks become valuable after offline evals and privacy-safe traces exist |

## 25. Top 10 advanced AI improvements for Talk Tutor

### 1. P0 — AI evaluation harness + golden datasets

**Problem:** CI proves code contracts, not model teaching quality.  
**Capability:** repository-native TypeScript eval runner with versioned fixtures.  
**User impact:** prevents silent regressions in tutoring and feedback.  
**Engineering effort:** Medium.  
**AI-quality impact:** Very high.  
**Risk reduction:** Very high.  
**Cost impact:** Low initially with deterministic tests; bounded live suite later.  
**Dependencies:** none.

### 2. P0 — Evidence-grounded feedback corrections

**Problem:** valid structured JSON can still contain a fake/wrong correction.  
**Capability:** source message/utterance provenance + deterministic evidence validation.  
**User impact:** directly reduces incorrect teaching.  
**Engineering effort:** Medium.  
**AI-quality impact:** Very high.  
**Risk reduction:** Very high.  
**Cost impact:** neutral/low.  
**Dependencies:** feedback schema/migration change, eval cases.

### 3. P0 — Prompt/model/version provenance

**Problem:** important learner-facing outputs cannot be attributed to a behavior version.  
**Capability:** promptVersion/model/config metadata for feedback and important scores.  
**User impact:** faster rollback and safer progress interpretation.  
**Engineering effort:** Low–Medium.  
**AI-quality impact:** High indirectly.  
**Risk reduction:** High.  
**Cost impact:** negligible.  
**Dependencies:** small schema/trace design.

### 4. P0 — Feedback correctness and calibration suite

**Problem:** false correction rate and score drift are unknown.  
**Capability:** grammar precision dataset, anchor transcripts, false-positive penalties.  
**User impact:** directly improves educational correctness.  
**Engineering effort:** Medium–High because human language review is needed.  
**AI-quality impact:** Very high.  
**Risk reduction:** Very high.  
**Cost impact:** modest eval spend.  
**Dependencies:** eval harness.

### 5. P0 — Privacy-safe AI tracing

**Problem:** model failures lack latency/token/model/prompt/validation diagnostics.  
**Capability:** structured trace envelope without raw transcript/audio by default.  
**User impact:** fewer prolonged incidents; faster reliability improvements.  
**Engineering effort:** Medium.  
**AI-quality impact:** High indirectly.  
**Risk reduction:** High.  
**Cost impact:** enables optimization.  
**Dependencies:** prompt version IDs, error taxonomy.

### 6. P1 — Realtime golden conversations + operational SLOs

**Problem:** voice behavior is tested structurally but not measured end-to-end.  
**Capability:** multi-turn fixtures + connection/first-audio/turn-latency/transcript metrics.  
**User impact:** more reliable and natural sessions.  
**Engineering effort:** Medium–High.  
**AI-quality impact:** High.  
**Risk reduction:** High.  
**Cost impact:** bounded test/runtime telemetry cost.  
**Dependencies:** trace/metric plumbing.

### 7. P1 — Multilingual and adversarial regression matrix

**Problem:** 11 locale variants exist, but AI behavior regressions are not measured across them.  
**Capability:** representative multilingual + injection + code-switching suite.  
**User impact:** prevents language-specific failures and policy bypass.  
**Engineering effort:** Medium.  
**AI-quality impact:** High.  
**Risk reduction:** High.  
**Cost impact:** moderate scheduled eval spend.  
**Dependencies:** eval harness.

### 8. P1 — Explicit timeout/retry/rate-limit policy for offline AI

**Problem:** feedback/example calls lack explicit timeout/retry classification and per-feature usage visibility.  
**Capability:** AbortSignal timeout, bounded transient retry, stable error taxonomy, user quota/rate limit.  
**User impact:** fewer hanging/failed interactions.  
**Engineering effort:** Low–Medium.  
**AI-quality impact:** Medium.  
**Risk reduction:** Medium–High.  
**Cost impact:** positive.  
**Dependencies:** tracing/error taxonomy.

### 9. P1 — User-reported correction/transcript error loop

**Problem:** the product has no high-signal way to harvest educational failures.  
**Capability:** “correction is wrong” / “transcript incorrect” signals linked to trace/output IDs.  
**User impact:** creates a direct quality-improvement loop.  
**Engineering effort:** Medium.  
**AI-quality impact:** High over time.  
**Risk reduction:** Medium.  
**Cost impact:** low.  
**Dependencies:** provenance IDs, review workflow.

### 10. P1 — Eval-backed Live model migration experiment

**Problem:** current Gemini 2.5 Live preview is supported but Google recommends a newer Live replacement path.  
**Capability:** pairwise benchmark current vs Gemini 3.1 Flash Live candidate.  
**User impact:** potential quality/latency improvements without blind migration.  
**Engineering effort:** Medium after harness exists.  
**AI-quality impact:** potentially high.  
**Risk reduction:** high compared with an unmeasured swap.  
**Cost impact:** experiment cost only; production impact depends on results.  
**Dependencies:** realtime evals and metrics.

## 26. Priority summary

### P0 — before significant scale

1. AI eval harness and golden datasets.
2. Evidence-grounded grammar feedback; false-correction policy.
3. Prompt/model/version provenance.
4. Feedback correctness + fluency calibration anchors.
5. Privacy-safe AI tracing for learner-impacting model calls.

### P1 — highest-value next AI milestone

1. Realtime golden conversations and SLOs.
2. Multilingual regression suite.
3. Product-specific safety/adversarial suite.
4. Offline AI timeout/retry/error taxonomy.
5. Offline generation rate/cost controls.
6. User-reported correction/transcript error loop.
7. Eval-backed Gemini Live model comparison.
8. Correction-frequency/difficulty/roleplay behavior evals.

### P2 — worthwhile after foundations

1. Derived structured LearnerModel view.
2. Better deterministic relevance selection for vocabulary/mistake context.
3. Sampled production online evals.
4. AI behavior feature flags if/when risky variants need rollout control.
5. Optional Langfuse or equivalent if trace volume/team workflow justifies it.
6. A/B testing for non-safety educational UX after metrics are trustworthy.

### P3 — future / evidence-triggered

1. Curated knowledge retrieval for explicit course/reference content.
2. Semantic retrieval for user-owned learning documents.
3. Weekly adaptive curriculum planner if deterministic planning becomes insufficient.
4. Tool-enabled tutor for concrete learner actions.
5. Fine-tuning only after a repeatable failure remains after prompt/model improvements and a high-quality rights-cleared dataset exists.

## 27. Do not build yet

### LangGraph / multi-agent architecture

No current workflow needs durable graph state or autonomous sub-agents. It would increase complexity while the core model behavior remains unmeasured.

### RAG / vector database

Current learner personalization is structured relational data. SQL is cheaper, more explainable, and sufficient.

### Generic AI memory framework

Profile, sessions, mistakes, vocabulary, review state, and goals already form better memory than a hidden chat-memory abstraction.

### Fine-tuning

There is no mature eval suite or high-confidence labeled corpus yet. Fine-tuning before evaluation maturity would make quality harder to reason about.

### Multiple AI providers

Provider redundancy is not currently the highest reliability issue. It would multiply model calibration differences and integration burden.

### MCP

No current external-tool interoperability use case.

### Generic guardrail platform

The most important guards are product-specific: false corrections, evidence grounding, dialect handling, progress claims, transcript injection, and privacy. Simple code/schema/evals are more valuable now.

### Prompt CMS

Prompts are few and code-owned. Add version constants and evals first.

### AI quality dashboard

Collect reliable traces/metrics first; do not build visualization before the underlying data model is stable.

## 28. Proposed implementation roadmap

### Milestone A — Educational AI Quality Foundation

**Scope**

- eval directory/harness
- feedback golden dataset
- deterministic evaluators
- evidence-linked grammar correction schema
- false-correction metric
- prompt version constants
- prompt/model provenance on feedback
- baseline report command

**Exit criteria**

- every feedback correction references a valid learner turn/evidence source
- unsupported corrections cannot become recurring learner mistakes
- at least 50 curated feedback cases cover correct/no-error/subtle-error/dialect/adversarial inputs
- deterministic eval suite runs locally and in CI
- AI-affecting feedback PRs can compare baseline vs candidate
- false-correction rate is reported separately from total correction recall
- feedback prompt and model version are attributable in persisted metadata/traces

### Milestone B — AI Reliability, Security, and Observability

**Scope**

- trace envelope
- timeout/retry policy
- error taxonomy
- cost/latency/usage metrics
- product safety policy
- adversarial evals
- offline route rate limits
- privacy policy for trace content

**Exit criteria**

- every offline AI call records feature/model/prompt version/duration/status/validation/retry metadata
- raw transcripts are excluded from telemetry by default
- provider timeout has a bounded user-safe path
- rate-limit/cost-abuse tests exist
- stored-transcript injection cases are in CI/scheduled evals
- an incident can be segmented by prompt/model/deploy/version without reading raw conversations

### Milestone C — Realtime AI Quality

**Scope**

- golden multi-turn conversations
- multilingual subset
- correction/difficulty/roleplay compliance
- connection/latency/disconnect metrics
- transcript quality fixture set
- Live model pairwise experiment

**Exit criteria**

- connection success and first-audio latency are measurable
- transcript duplication/order/reconnect metrics are observable
- golden conversations cover beginner, intermediate, advanced, roleplay, mistake practice, and injection
- current Live model has a baseline
- Gemini 3.1 candidate has a documented better/worse/tie report before any production migration
- model rollback criteria are defined

### Milestone D — Calibrated Learner Intelligence

**Scope**

- fluency anchor set
- cross-version score policy
- derived LearnerModel
- targeted user feedback signals
- better mistake/vocabulary relevance selection
- sampled online evaluation

**Exit criteria**

- fluency score bands are human-reviewed on anchor transcripts
- cross-version score drift is measured before combining trends
- learner recommendations can explain which structured signals produced them
- “correction is wrong” and “transcript incorrect” signals link to output/trace IDs
- sampled online evals operate under documented privacy/cost limits

### Milestone E — Advanced AI only when evidence demands it

Possible triggers, not commitments:

- RAG when user/curated documents become a first-class product requirement
- embeddings when semantic retrieval measurably beats structured queries
- agent/tool workflow when the tutor must carry out multi-step external actions
- fine-tuning when a stable, repeated failure survives prompt/model improvements and sufficient rights-cleared training data exists

**Exit criteria**

No advanced architecture enters production without:

- concrete user problem
- baseline
- candidate evaluation
- cost/latency impact
- rollback path
- simpler alternative considered

## 29. Recommended AI development workflow

~~~text
AI behavior change proposed
↓
identify affected feature + prompt/model version
↓
run deterministic tests
↓
run focused golden eval
↓
compare baseline vs candidate
↓
inspect regressions / false corrections
↓
PR includes eval summary
↓
CI gates deterministic/critical safety checks
↓
staging
↓
small sampled production telemetry
↓
promote or rollback
~~~

This makes AI changes reviewable engineering changes rather than prompt intuition.

## 30. Tooling recommendation

### Now

- existing TypeScript/Node test infrastructure
- small repository-native eval harness
- provider JSON schema + application validation
- Zod only when consolidating schemas materially reduces duplication
- simple trace interface with OTel-compatible fields
- existing Postgres/Supabase for metadata where appropriate

### Later, if operational need appears

**Langfuse** is a reasonable candidate because current documentation supports TypeScript/OpenTelemetry observability, datasets/experiments, deterministic code evaluators, LLM judges, human annotation, and self-hosting. Evaluate it against privacy, maintenance, and scale after Talk Tutor knows exactly which traces/evals it needs.

### Not now

- LangChain
- LangGraph
- multi-agent platform
- vector database
- MCP
- generic guardrail framework
- prompt CMS

## 31. Final architectural assessment

Talk Tutor should not become “more agentic” next.

It should become **more measurable**.

The repository has already made several mature choices:

- direct SDK over unnecessary framework layers
- structured learner memory over opaque chat memory
- SQL/rules over AI for deterministic product logic
- explicit untrusted prompt blocks
- provider schema + local validation
- text-only evidence policy for pronunciation
- durable RLS-protected learning state
- deterministic realtime transcript lifecycle

The next maturity jump is to extend that same deterministic discipline into the non-deterministic parts:

- educational correctness must be evaluated
- corrections must be grounded
- score changes must be calibrated
- prompt/model changes must be attributable
- realtime behavior must be measured
- production failures must become reusable eval cases

# IF WE ONLY DO 5 THINGS NEXT

## 1. Build the AI eval harness and golden datasets

**What:** Add a TypeScript evaluation runner with versioned feedback, tutor, multilingual, and adversarial fixtures; start with deterministic checks and a small live-model tier.

**Why:** Today a prompt/model change can pass all CI while making the tutor educationally worse.

**Impact:** Very high. It changes AI development from subjective testing to measurable regression control.

**Effort:** Medium.

**What it unlocks:** Safe prompt iteration, model comparisons, release gates, LLM judges, multilingual regression checks, and future experimentation.

## 2. Ground every grammar correction in learner evidence

**What:** Require correction provenance to a specific learner transcript turn/source utterance and deterministically reject unsupported corrections from trusted learner-mistake state.

**Why:** False corrections are the most harmful product-specific failure and currently cascade into mistake trends, recommendations, Practice My Mistakes, and personalized examples.

**Impact:** Very high for educational correctness and learner trust.

**Effort:** Medium.

**What it unlocks:** Reliable mistake history, safer personalization, correction-quality metrics, human review, and a useful data flywheel.

## 3. Version prompts/models and record generation provenance

**What:** Introduce explicit prompt versions and persist/trace requested model, prompt version, feature version, generation settings, and output linkage for feedback and other learner-impacting AI results.

**Why:** Without provenance, a bad-generation incident cannot be confidently tied to a prompt/model/deploy change, and historical score comparability is weak.

**Impact:** High for debuggability, rollback safety, and progress integrity.

**Effort:** Low–Medium.

**What it unlocks:** Reproducible incidents, version-aware dashboards, pairwise baselines, model migration safety, and auditability.

## 4. Add privacy-safe AI tracing, latency/cost metrics, and bounded failure policies

**What:** Trace feature/model/prompt version/duration/token usage/validation/retry/error metadata; add explicit offline timeouts, bounded transient retries, and rate/cost controls without logging raw transcripts/audio by default.

**Why:** Reliability and cost cannot be improved systematically if they are invisible.

**Impact:** High for production reliability, privacy, and economics.

**Effort:** Medium.

**What it unlocks:** SLOs, cost-per-conversation analysis, failure harvesting, sampled online evals, and an evidence-based decision on whether a platform such as Langfuse is worthwhile.

## 5. Create realtime + multilingual evals before migrating the Live model

**What:** Establish golden multi-turn voice/conversation cases and operational metrics, then compare the current Gemini 2.5 Live model against Gemini 3.1 Flash Live Preview using pairwise quality, latency, transcript, and policy-adherence measures.

**Why:** Google now recommends a newer Live replacement path, but an unmeasured migration could improve one dimension while regressing tutor quality, correction behavior, or multilingual performance.

**Impact:** High for the core voice experience.

**Effort:** Medium–High.

**What it unlocks:** Safe Live-model migration, better latency/reliability decisions, model rollback criteria, and a durable realtime AI quality discipline.
