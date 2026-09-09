# AI Quality Foundation — Simplified Implementation

This document explains the AI-quality changes in PR #7, why they exist, and why
the implementation was deliberately simplified after reviewing the full Talk
Tutor codebase.

## Review conclusion

Talk Tutor already has a clear architectural style:

- realtime voice behavior stays in the Live subsystem;
- learning-domain rules stay in `lib/learning`;
- deterministic product logic stays deterministic;
- Supabase/Postgres is used when durable shared state or atomic ownership logic
  actually requires database behavior;
- normal unit/domain tests are the default verification mechanism.

The first version of PR #7 did not follow that style closely enough. It added a
general AI telemetry layer, a new trace table, provenance columns, extra RPCs,
a separate eval command, and a new migration for a correctness problem that
can be solved inside the existing feedback boundary.

The PR was therefore simplified.

## Full-codebase review

| Area | Review finding | Change in this PR |
| --- | --- | --- |
| Authentication / RLS | Existing ownership boundary is strong and unrelated to this problem. | None |
| Billing / entitlements | Deterministic and isolated from feedback correctness. | None |
| Onboarding / placement | Deterministic placement is appropriate. | None |
| Live voice / transcript | Existing transcript reducer and persistence lifecycle already produce finalized user turns with sequence numbers. | Reuse those sequence numbers; no Live refactor |
| Learning session persistence | Existing `session_feedback.grammar_corrections` is JSONB, so adding `sourceSequence` does not require a database schema change. | No migration |
| Dashboard / recommendations | They already consume persisted grammar categories. The safest current fix is to prevent new unsupported corrections from being persisted. | No new dashboard/RPC layer |
| Feedback AI | This is the real correctness boundary. A valid JSON response could still contain an invented correction. | Ground every new correction to actual learner evidence |
| Vocabulary AI | Current implementation is already isolated and optional. | No new infrastructure |
| CI / tests | Existing Node tests are the normal project verification path. | Run AI golden/adversarial evals through the existing test runner |
| Guardrails | Prompt isolation and schema validation existed, but the feedback boundary needed explicit post-generation policy. | Add feature-local deterministic guardrails |
| Observability | Useful later, but there is not yet enough scale or operational need to justify a new persistent AI tracing subsystem. | Deferred |

## What is implemented

### 1. Correction evidence

Every new grammar correction returned by Gemini must contain:

```ts
sourceSequence: number
```

That value identifies the finalized learner transcript turn that supposedly
contains the mistake.

The model response schema requires it, and the local validator checks that it
is a valid transcript sequence.

### 2. Deterministic grounding before persistence

After structured-output validation, Talk Tutor verifies each correction again:

1. the cited sequence exists;
2. that transcript turn belongs to the learner, not the tutor;
3. the proposed `original` text actually occurs in that learner turn after
   conservative Unicode/case/whitespace normalization;
4. `original` and `corrected` are not the same text.

If any condition fails, that correction is removed before feedback is saved.

This protects downstream Common Mistakes and Practice My Mistakes from **new**
invented corrections without changing their architecture.

### 3. Safer prompt boundary

Previously the transcript itself was explicitly delimited as untrusted data,
while language, proficiency and topic were interpolated as normal prompt text.

The feedback request now serializes all session context together:

```text
--- BEGIN UNTRUSTED SESSION DATA JSON ---
{ ... }
--- END UNTRUSTED SESSION DATA JSON ---
```

The system instruction also tells the model:

- never use assistant wording as learner evidence;
- omit uncertain corrections instead of inventing them;
- do not treat a legitimate dialect/regional variant as an error merely
  because another variant is more common.

### 4. Bounded provider request

The feedback Gemini call now has:

- a 30-second request timeout;
- a maximum output-token budget;
- the existing structured response schema;
- the existing local validation layer.

These are local provider concerns, so they remain in the feedback provider
rather than introducing a general AI framework.

## What was removed from the earlier PR version

The following were intentionally removed:

- `lib/ai/telemetry.ts`;
- generic AI provenance interfaces;
- prompt/model provenance database columns;
- `ai_generation_traces` table;
- AI trace RLS policies and trace RPC;
- extra grounded-mistake SQL RPCs;
- vocabulary-generation provenance plumbing;
- `evals/` deterministic runner and fixtures;
- `pnpm eval:ai`;
- extra CI eval stage;
- `20260909170000_ai_quality_foundation.sql` migration and its SQL tests.

## Why there is no migration now

`grammar_corrections` is already stored as JSONB in `session_feedback`.

Adding one additional JSON property:

```json
{
  "sourceSequence": 4
}
```

does not require an ALTER TABLE or a new Supabase migration.

That is the key simplification.

## Why telemetry/provenance is deferred

Prompt/model provenance and AI tracing are useful once one of these becomes
true:

- multiple production model/prompt versions are running simultaneously;
- model changes happen frequently enough that incident attribution is hard;
- meaningful production traffic makes per-feature latency/cost analysis
  necessary;
- the team needs a real online/offline AI evaluation workflow.

Until then, a persistent trace table plus RLS/RPC/schema surface is extra
maintenance and security responsibility without enough immediate product value.

When that need appears, tracing should be designed once around the actual
operational questions rather than pre-building a generic subsystem.

## Guardrails and evals

The correctness checks now have explicit AI-engineering surfaces rather than
being hidden inside the feedback service:

- `lib/learning/feedback/guardrails.ts` contains deterministic post-generation guardrails;
- `evals/feedback-grounding.json` contains versioned golden, adversarial, and multilingual cases;
- `tests/learning/ai-evals.test.mjs` executes those cases through the existing `pnpm test` path;
- `evals/README.md` defines the eval tiers and the boundary between deterministic checks and semantic model-quality evaluation;
- `docs/architecture/ai-guardrails-evals.md` documents the complete guardrail/eval architecture and advanced AI practices.

This deliberately avoids a second CI framework. The evals are real and
versioned, but deterministic Tier-1 evals use the same repository-native test
runner as the rest of Talk Tutor.

Semantic live-model evaluation, pairwise model/prompt comparison,
LLM-as-a-judge, and human calibration remain the next tier because they require
paid model calls and quality baselines rather than software-only assertions.

## Compatibility note

Historical feedback generated before this change may not contain
`sourceSequence`. The TypeScript field is therefore optional when reading
existing persisted feedback, while the validator requires it for all **new**
model-generated feedback.

This PR does not rewrite or delete historical feedback.

If strict cleanup of old production corrections becomes necessary, that should
be a separate, explicit data-migration decision after inspecting real
production data rather than silently changing history in this feature PR.

## Final architecture

```text
Persisted finalized transcript
        ↓
Bound transcript
        ↓
Gemini structured feedback
        ↓
Local schema validation
        ↓
Correction-to-user-turn grounding
        ↓
Discard unsupported corrections
        ↓
Persist normal session_feedback
        ↓
Existing dashboard / recommendations / Practice My Mistakes
```

No new database subsystem is required.

## Verification

The implementation is covered by the existing test suite for:

- valid structured feedback;
- required `sourceSequence`;
- invented correction rejection;
- assistant-text rejection;
- malformed provider output;
- empty transcript behavior;
- concurrency claim behavior;
- pronunciation suppression;
- untrusted prompt boundaries;
- transcript size/order bounds.

The normal project checks remain the source of truth:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Decision summary

**Keep now**

- evidence-linked grammar corrections;
- feature-local deterministic guardrails;
- safer untrusted-data prompt boundary;
- bounded Gemini feedback request;
- code-level prompt versioning;
- versioned golden/adversarial/multilingual eval fixtures;
- deterministic AI evals in the existing test suite.

**Do later when justified**

- prompt/model provenance persistence;
- AI trace database;
- live semantic model evals;
- pairwise model/prompt comparisons;
- calibrated LLM-as-a-judge;
- production AI dashboards.

**Do not add for this problem**

- LangChain;
- LangGraph;
- RAG;
- vector database;
- agents;
- MCP;
- generic guardrail frameworks.

The simplified implementation follows the existing Talk Tutor architecture:
solve the correctness problem at the narrowest reliable boundary and add new
infrastructure only when a concrete product or operational need requires it.
