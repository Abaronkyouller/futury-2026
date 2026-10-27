/** Constants for importing payroll results and comparing them with test cases. */

/** File types accepted as payroll results. */
export const RESULT_FILE_TYPES = ".pdf,.docx,.txt,.md";

/** Characters of the result text sent to each model (the demo logs are about 3,000). */
export const RESULT_CHAR_BUDGET = 10000;

/** Characters of each raw model reply kept with a comparison (localStorage is small). */
export const RAW_REPLY_KEEP_CHARS = 3000;

/** Examiner decisions on earlier comparisons that are fed into a new comparison prompt. */
export const COMPARE_FEEDBACK_MAX = 6;

/** Comparisons are always run deterministically: temperature 0. */
export const COMPARE_TEMPERATURE = 0;

/** Upper bound for completion tokens of one comparison reply. */
export const COMPARE_MAX_TOKENS = 3000;

/** Label of the deterministic reference assessor. */
export const RULE_ASSESSOR_LABEL = "Kontroll-KI";
