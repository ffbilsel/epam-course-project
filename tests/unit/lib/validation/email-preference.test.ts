import { describe, expect, it } from "vitest";
import { EmailPreferenceUpdateSchema } from "@/lib/validation/email-preference";

describe("EmailPreferenceUpdateSchema", () => {
  it.each([
    [{}, true],
    [{ statusChanges: true }, true],
    [{ commentsOnMyIdeas: false, ratingsOnMyIdeas: true }, true],
    [
      {
        statusChanges: false,
        commentsOnMyIdeas: false,
        ratingsOnMyIdeas: false,
        repliesOnIdeasIReview: false,
      },
      true,
    ],
    [{ statusChanges: "yes" }, false],
    [{ unknownKey: true }, false],
    [{ statusChanges: true, badKey: 1 }, false],
  ])("%j → ok=%s", (input, ok) => {
    expect(EmailPreferenceUpdateSchema.safeParse(input).success).toBe(ok);
  });
});
