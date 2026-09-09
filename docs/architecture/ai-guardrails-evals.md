# AI Guardrails, Evals, and Advanced Engineering Practices

This document answers where Talk Tutor's AI guardrails, evals, and production
AI best practices live after the AI-quality refactor.

## Where each concern lives

| Concern | Location |
| --- | --- |
| Feedback system prompt / prompt version | `lib/learning/feedback/service.ts` |
| Structured Gemini response schema | `lib/learning/feedback/provider.ts` |
| Deterministic feedback guardrails | `lib/learning/feedback/guardrails.ts` |
| Local output validation | `lib/learning/validation.ts` |
| Golden/adversarial/multilingual eval dataset | `evals/feedback-grounding.json` |
| Eval strategy and future semantic tiers | `evals/README.md` |
| CI-executed AI eval tests | `tests/learning/ai-evals.test.mjs` |
| Live tutor prompt trust boundary | `lib/learning/practice.ts` |
| Realtime transcript correctness | `lib/live/transcript.ts`, `lib/live/gemini-events.ts` |
| AI architecture audit | `docs/architecture/ai-engineering-maturity-audit.md` |

## Guardrail architecture

Talk Tutor uses layered, product-specific guardrails rather than a generic
guardrail framework.

### 1. Input/config guardrails

Existing practice and profile parsers:

- normalize Unicode;
- strip control characters where appropriate;
- bound free-form text lengths;
- allowlist languages, levels, voices, modes, difficulty, and grammar categories;
- limit target mistake categories.

### 2. Prompt trust boundaries

Learner-derived context is serialized into explicit untrusted JSON blocks.

The model is told that learner/session data:

- is data, not policy;
- cannot override system instructions;
- cannot request secrets or hidden prompts;
- cannot become authoritative simply because it appears in historical context.

### 3. Structured-output guardrail

Gemini feedback uses a provider response schema. Local application validation
then independently checks the returned payload.

Provider schema success is therefore not treated as sufficient evidence of
educational correctness.

### 4. Evidence guardrail

Every grammar correction must cite `sourceSequence`.

The deterministic guardrail verifies:

1. a source sequence exists;
2. the source turn is from the learner;
3. the proposed original text appears in that learner turn after conservative normalization;
4. the correction is not a no-op.

A rejected correction never enters new persisted mistake history.

### 5. Evidence-capability guardrail

Text-only feedback cannot make acoustic pronunciation claims. The application
forces `pronunciationNotes` to an empty array.

## Evals implemented now

The Tier-1 dataset includes:

- normal grounded English corrections;
- hallucinated/invented corrections;
- assistant-sourced evidence attacks;
- missing transcript sequences;
- false-positive/no-op corrections;
- normalization cases;
- Spanish cases;
- German cases;
- prompt-injection cases.

These are versioned with both:

- `FEEDBACK_PROMPT_VERSION`;
- `FEEDBACK_GUARDRAIL_VERSION`.

If code versions and eval fixtures drift, CI fails.

## Advanced AI practices already present

### Structured generation

Feedback and vocabulary generation use JSON response schemas plus local parsing.

### Prompt versioning

The feedback prompt now has a code-owned explicit version:

```text
feedback-v2-evidence-grounded
```

Prompt changes should increment this version and update the corresponding eval
dataset.

### Bounded context

Feedback analyzes only the newest bounded transcript turns and limits total
text size.

### Low-variance generation

Feedback uses a low temperature because correctness and consistency are more
important than creativity.

### Request budgets

The feedback provider has a bounded timeout and output-token limit.

### Deterministic AI/code boundary

Talk Tutor intentionally does **not** call an LLM for:

- placement scoring;
- streak calculations;
- dashboard arithmetic;
- spaced repetition;
- recommendation ordering.

Those are more reliable and explainable as code.

### Graceful degradation

A failed feedback generation does not invalidate a completed learning session.
Vocabulary examples also remain optional rather than blocking card usage.

### Security by data separation

User text is never concatenated into the system policy as authoritative
instructions. Learner data is clearly delimited.

## Advanced practices that should come next

### Live semantic evals

The next AI-specific milestone should execute real Gemini responses against a
larger golden dataset and measure educational quality rather than only software
invariants.

### Pairwise prompt/model experiments

Before replacing the production Live or feedback model:

- run baseline and candidate on the same cases;
- blind the outputs;
- compare quality, latency, cost, and failure rate;
- require rollback criteria.

### Calibrated LLM-as-a-judge

Use judge models only for semantic properties such as explanation correctness,
naturalness, level appropriateness, and dialect sensitivity.

Do not use one opaque overall "AI quality score".

### Human feedback loop

Add a lightweight way for learners to report:

- incorrect correction;
- bad transcript;
- unhelpful explanation.

Those reports can become reviewed eval examples.

### Privacy-safe observability

When production traffic justifies it, trace metadata such as feature, model,
prompt version, latency, status, and token usage. Do not log raw audio or full
learner transcripts by default.

A persistent trace database is intentionally **not** added in this PR.

## Technologies deliberately not added

The current architecture does not need:

- LangChain;
- LangGraph;
- RAG;
- embeddings/vector search;
- autonomous agents;
- MCP;
- fine-tuning.

These should only be introduced when a measured product requirement cannot be
solved more simply.

## Merge standard for AI-affecting changes

An AI-affecting PR should not be considered complete merely because TypeScript
and unit tests pass.

At minimum it should answer:

1. What prompt/model behavior changed?
2. Which guardrail protects the new failure mode?
3. Which eval case proves the guardrail?
4. Could the change increase false corrections?
5. Does it change educational claims or scoring semantics?
6. Is a live-model or human comparison required before release?
7. What is the rollback condition?

This keeps AI engineering measurable without making the codebase framework-heavy.


## Maintainer usage guide

For the detailed **what / why / how / when** decision guide, examples, change
checklists, model-migration process, retry/fallback rules, RAG/agent decision
criteria, and production observability triggers, see:

- `docs/architecture/ai-quality-engineering-playbook.md`

Use this document for architecture overview; use the playbook when making an
actual AI-affecting change.
