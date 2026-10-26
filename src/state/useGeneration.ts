import { useCallback } from "react";
import { generateTestCases } from "../ai/generate";
import type { GenerationRun } from "../ai/generate";
import { AI_MODEL } from "../config/ai";
import type { Req } from "../types/requirement";
import type { GeneratedTestCase, GenerationSettings, OriginKind } from "../types/review";
import { useReviewStore } from "./reviewContext";

/**
 * One generation run for a requirement, shared by the generator page and the
 * batch run on the documents page: commits the settings (logged), feeds the
 * examiner's feedback on reviewed cases into the run, stores the result.
 */
export function useGeneration() {
  const { cases, updateSettings, addRun } = useReviewStore();

  return useCallback(
    async (req: Req, settings: GenerationSettings, kind: OriginKind, feedbackCase?: GeneratedTestCase): Promise<GenerationRun> => {
      const effective = { ...settings, model: AI_MODEL };
      updateSettings(effective);
      const feedbackCases = feedbackCase
        ? cases.map((item) => item.id === feedbackCase.id ? feedbackCase : item)
        : cases;
      const reviewed = feedbackCases.filter((c) => c.review.decision !== "Offen");
      const result = await generateTestCases(req, effective, reviewed, kind);
      addRun(req.id, result.runId, result.cases, feedbackCase?.id);
      return result;
    },
    [cases, updateSettings, addRun],
  );
}
