
export const cases = [
  [
    "TC-028-01",
    "Monthly pay, previous month settled",
    "Equivalence",
    "Previous calendar month",
    "Passed",
  ],
  [
    "TC-028-02",
    "Incapacity starts on the 1st of a month",
    "Boundary",
    "Previous calendar month",
    "Passed",
  ],
  [
    "TC-028-03",
    "Weekly pay, four weeks settled",
    "Equivalence",
    "Last four settled weeks",
    "Passed",
  ],
  [
    "TC-028-04",
    "Last month not yet settled when incapacity begins",
    "Boundary",
    "Month before the unsettled one",
    "Failed",
  ],
  [
    "TC-028-05",
    "One-time payment inside the period",
    "Combination · R-052",
    "Previous month, one-time payment separate",
    "Not run",
  ],
  [
    "TC-028-06",
    "Employment started mid-month",
    "Boundary",
    "[Expected value from rule engine]",
    "Not run",
  ],
];
