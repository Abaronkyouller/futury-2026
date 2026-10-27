import { useCallback } from "react";
import { generateTestCases } from "../ai/generate";
import type { GenerationRun } from "../ai/generate";
import { AI_MODEL } from "../config/ai";
import type { Req } from "../types/requirement";
import type { GeneratedTestCase, GenerationSettings, OriginKind } from "../types/review";
import { useReviewStore } from "./reviewContext";
import { activeNotes, selectGenerationFeedback } from "../feedback/collect";

/**
 * One generation run for a requirement, shared by the generator page and the
 * batch run on the documents page: commits the settings (logged), feeds the
 * examiner's feedback on reviewed cases into the run, stores the result.
 */
export function useGeneration() {
  const { cases, requirements, feedbackNotes, feedbackExcluded, updateSettings, addRun } = useReviewStore();

  return useCallback(
    async (req: Req, settings: GenerationSettings, kind: OriginKind, feedbackCase?: GeneratedTestCase): Promise<GenerationRun> => {
      const effective = { ...settings, model: AI_MODEL };
      updateSettings(effective);
      const feedbackCases = feedbackCase
        ? cases.map((item) => item.id === feedbackCase.id ? feedbackCase : item)
        : cases;
      // Feedback database: most relevant active reviews plus maintainer notes.
      const reviewed = selectGenerationFeedback(feedbackCases, req, requirements, feedbackExcluded);
      const notes = activeNotes(feedbackNotes, feedbackExcluded, "Generierung");
      const result = await generateTestCases(req, effective, reviewed, kind, notes);
      addRun(req.id, result.runId, result.cases, feedbackCase?.id);
      return result;
    },
    [cases, requirements, feedbackNotes, feedbackExcluded, updateSettings, addRun],
  );
}
