# Talk Tutor AI Evaluations

Talk Tutor uses a tiered evaluation strategy so AI quality work stays rigorous
without turning normal pull requests into expensive model experiments.

## Tier 1 — deterministic guardrail evals (implemented now)

Source of truth:

- `evals/feedback-grounding.json`
- `tests/learning/ai-evals.test.mjs`

These run automatically through the existing:

```bash
pnpm test
```

They cover:

- learner-evidence grounding;
- assistant/user role boundaries;
- invented correction rejection;
- no-op / false-positive rejection;
- prompt-injection cases;
- Unicode/case/whitespace normalization;
- multilingual grounding cases;
- prompt/guardrail version drift.

Tier 1 contains no paid model calls. It verifies deterministic properties that
must always hold regardless of model quality.

## Tier 2 — live-model quality evals (next)

Before changing the feedback prompt or production model, run a curated dataset
against both the current baseline and candidate.

Measure at minimum:

1. false correction rate;
2. correction precision;
3. source-utterance grounding;
4. grammatical correctness;
5. explanation correctness;
6. dialect/variant tolerance;
7. level appropriateness;
8. unsupported-claim rate;
9. latency;
10. token/cost usage.

False corrections must be weighted more heavily than minor missed corrections.

## Tier 3 — LLM-as-a-judge (next, not unquestioned ground truth)

Use a versioned judge rubric only for semantic dimensions that deterministic
code cannot score. The judge should return structured per-dimension scores,
rationale, and `insufficient_evidence` when appropriate.

Calibrate judge results against human-reviewed examples before using them as a
merge gate.

## Tier 4 — human calibration / release evaluation

Human review is required for subtle grammar, dialect/regional variants,
advanced multilingual nuance, learner-level appropriateness, and any future
pronunciation claims.

## CI policy

- deterministic guardrail evals: every PR;
- paid live-model evals: AI-affecting PRs or scheduled runs;
- full multilingual/adversarial regression: model/prompt releases;
- human calibration: before changing educational claims or scoring semantics.

The goal is measurable educational correctness, not a generic AI score.


## When to use each tier

| Change | Minimum eval tier |
| --- | --- |
| Refactor guardrail code without semantic behavior change | Tier 1 |
| Add a deterministic rejection/acceptance rule | Tier 1 + new fixture |
| Change system prompt wording that may affect coaching behavior | Tier 1 + Tier 2 |
| Change feedback model | Tier 1 + Tier 2 + sampled human review |
| Change fluency rubric / educational score meaning | Tier 1 + Tier 2 + Tier 3 + Tier 4 |
| Add a new supported language family/script | Tier 1 multilingual smoke + Tier 2 language quality + sampled human review |
| Add pronunciation scoring | All tiers, including acoustic evidence and human calibration |
| Add RAG/tool/agent capability | Tier 1 security/adversarial + task-specific live evals + human review for high-impact actions |

See `docs/architecture/ai-quality-engineering-playbook.md` for the complete
decision process.
