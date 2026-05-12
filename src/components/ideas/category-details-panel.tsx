import type { IdeaStructuredAnswer } from "@/lib/validation/category-fields";

/**
 * Read-only panel that renders the structured answers stored on
 * `ideas.category_answers` (Phase 2 / Story 2 / FR-008).
 *
 * - Hidden entirely when there are no answers (e.g. pre-Phase-2
 *   ideas where the column is still `'[]'`).
 * - Section header uses the category's display name so the heading
 *   travels with the idea even if the schema is later edited.
 * - `SINGLE_CHOICE` answers render their `valueLabelSnapshot` so
 *   that historical answers survive option renames / removals.
 */
export function CategoryDetailsPanel({
  answers,
  categoryName,
}: {
  answers: readonly IdeaStructuredAnswer[];
  categoryName: string;
}): JSX.Element | null {
  if (answers.length === 0) return null;
  return (
    <section
      aria-labelledby="category-details-heading"
      className="rounded-md border border-input p-4"
    >
      <h2 id="category-details-heading" className="mb-3 text-sm font-medium">
        {categoryName} details
      </h2>
      <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-3">
        {answers.map((a) => (
          <div key={a.key} className="sm:col-span-3 sm:grid sm:grid-cols-3 sm:gap-3">
            <dt className="font-medium text-muted-foreground sm:col-span-1">{a.labelSnapshot}</dt>
            <dd className="sm:col-span-2">
              <FormattedAnswer answer={a} />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function FormattedAnswer({ answer }: { answer: IdeaStructuredAnswer }): JSX.Element {
  if (answer.type === "YES_NO") {
    return <span>{answer.value ? "Yes" : "No"}</span>;
  }
  if (answer.type === "NUMBER") {
    return <span>{typeof answer.value === "number" ? answer.value.toString() : ""}</span>;
  }
  if (answer.type === "SINGLE_CHOICE") {
    return <span>{answer.valueLabelSnapshot ?? String(answer.value)}</span>;
  }
  if (answer.type === "LONG_TEXT") {
    return <span className="whitespace-pre-wrap">{String(answer.value)}</span>;
  }
  return <span>{String(answer.value)}</span>;
}
