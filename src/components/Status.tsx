
export function Status({ value }: { value: string }) {
  return (
    <span
      className={
        "status " +
        (value === "Approved" || value === "Passed" || value === "Done"
          ? "good"
          : value === "Failed"
            ? "bad"
            : value === "Pending" || value === "Needs review"
              ? "warn"
              : "neutral")
      }
    >
      {value}
    </span>
  );
}
