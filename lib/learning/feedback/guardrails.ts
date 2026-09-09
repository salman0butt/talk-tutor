import type {
  FinalTranscriptMessage,
  GrammarCorrection,
  SessionFeedback,
} from "../types.ts";

export const FEEDBACK_GUARDRAIL_VERSION = "feedback-guardrails-v1";

export type FeedbackGuardrailCode =
  | "missing_source_sequence"
  | "source_not_found"
  | "source_not_learner"
  | "original_not_in_source"
  | "no_op_correction";

export interface FeedbackGuardrailDecision {
  accepted: boolean;
  code?: FeedbackGuardrailCode;
}

export interface RejectedGrammarCorrection {
  index: number;
  code: FeedbackGuardrailCode;
}

function normalizeEvidenceText(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase();
}

export function evaluateGrammarCorrectionGuardrail(
  correction: GrammarCorrection,
  transcript: FinalTranscriptMessage[],
): FeedbackGuardrailDecision {
  if (!Number.isInteger(correction.sourceSequence)) {
    return { accepted: false, code: "missing_source_sequence" };
  }

  const source = transcript.find(
    (message) => message.sequence === correction.sourceSequence,
  );
  if (!source) {
    return { accepted: false, code: "source_not_found" };
  }
  if (source.role !== "user") {
    return { accepted: false, code: "source_not_learner" };
  }

  const sourceText = normalizeEvidenceText(source.text);
  const original = normalizeEvidenceText(correction.original);
  const corrected = normalizeEvidenceText(correction.corrected);

  if (!original || !sourceText.includes(original)) {
    return { accepted: false, code: "original_not_in_source" };
  }
  if (original === corrected) {
    return { accepted: false, code: "no_op_correction" };
  }

  return { accepted: true };
}

export function applyFeedbackGuardrails(
  feedback: SessionFeedback,
  transcript: FinalTranscriptMessage[],
): {
  feedback: SessionFeedback;
  rejectedCorrections: RejectedGrammarCorrection[];
} {
  const acceptedCorrections: GrammarCorrection[] = [];
  const rejectedCorrections: RejectedGrammarCorrection[] = [];

  feedback.grammarCorrections.forEach((correction, index) => {
    const decision = evaluateGrammarCorrectionGuardrail(
      correction,
      transcript,
    );
    if (decision.accepted) {
      acceptedCorrections.push(correction);
      return;
    }
    rejectedCorrections.push({
      index,
      code: decision.code ?? "original_not_in_source",
    });
  });

  return {
    feedback: {
      ...feedback,
      grammarCorrections: acceptedCorrections,
      // Text transcripts are not sufficient evidence for acoustic claims.
      pronunciationNotes: [],
    },
    rejectedCorrections,
  };
}
