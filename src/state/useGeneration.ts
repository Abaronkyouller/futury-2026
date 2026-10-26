import { useCallback } from "react";
import { generateTestCases } from "../ai/generate";
import type { GenerationRun } from "../ai/generate";
import type { Req } from "../types/requirement";
import type { GenerationSettings, OriginKind } from "../types/review";
import { useDocuments } from "./documentContext";
import { useReviewStore } from "./reviewContext";

/**
 * One generation run for a requirement, shared by the generator page and the
 * batch run on the documents page: commits the settings (logged), feeds
 * reviewed cases and "Formatbeispiel" documents into the run, stores the result.
 */
export function useGeneration() {
  const { cases, updateSettings, addRun } = useReviewStore();
  const { generationContext } = useDocuments();

  return useCallback(
    async (req: Req, settings: GenerationSettings, kind: OriginKind): Promise<GenerationRun> => {
      updateSettings(settings);
      const reviewed = cases.filter((c) => c.review.decision !== "Offen");
      const result = await generateTestCases(req, settings, reviewed, kind, generationContext);
      addRun(req.id, result.runId, result.cases);
      return result;
    },
    [cases, updateSettings, addRun, generationContext],
  );
}
