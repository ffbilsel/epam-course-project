import { describe, expect, it } from "vitest";
import { canAuthorEdit, canAuthorDelete } from "@/server/idea-state-machine";

const author = { id: "author-1" };
const stranger = { id: "stranger-1" };

const cases = [
  // status, sameAuthor, expected
  ["SUBMITTED", true, true],
  ["SUBMITTED", false, false],
  ["UNDER_REVIEW", true, false],
  ["UNDER_REVIEW", false, false],
  ["APPROVED", true, false],
  ["APPROVED", false, false],
  ["REJECTED", true, false],
  ["IMPLEMENTED", true, false],
] as const;

describe("canAuthorEdit / canAuthorDelete", () => {
  it.each(cases)(
    "status=%s sameAuthor=%s -> %s",
    (status, sameAuthor, expected) => {
      const actor = sameAuthor ? author : stranger;
      const input = {
        idea: { status, authorId: author.id },
        actor,
      };
      expect(canAuthorEdit(input)).toBe(expected);
      expect(canAuthorDelete(input)).toBe(expected);
    },
  );
});
