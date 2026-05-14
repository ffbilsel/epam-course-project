import { describe, expect, it } from "vitest";
import { diffIdeaVersions } from "@/server/diff-service";

const base = {
  versionNo: 1,
  title: "Hello",
  description: "alpha beta gamma",
  categoryAnswers: [{ fieldKey: "impact", value: "low" }],
  attachmentIds: ["a", "b"],
};

describe("diffIdeaVersions", () => {
  it("returns changed=false for identical inputs", () => {
    const d = diffIdeaVersions(base, { ...base, versionNo: 2 });
    expect(d.fields.find((f) => f.kind === "prose" && f.field === "title")).toMatchObject({
      changed: false,
    });
    expect(d.fields.find((f) => f.kind === "attachments")).toMatchObject({
      changed: false,
      added: [],
      removed: [],
    });
  });

  it("produces word-level segments for prose changes", () => {
    const d = diffIdeaVersions(base, {
      ...base,
      versionNo: 2,
      description: "alpha BETA gamma",
    });
    const desc = d.fields.find((f) => f.kind === "prose" && f.field === "description")!;
    expect(desc.changed).toBe(true);
    if (desc.kind === "prose") {
      const removed = desc.segments.filter((s) => s.removed).map((s) => s.value.trim());
      const added = desc.segments.filter((s) => s.added).map((s) => s.value.trim());
      expect(removed).toContain("beta");
      expect(added).toContain("BETA");
    }
  });

  it("detects added/removed/reordered attachments", () => {
    const added = diffIdeaVersions(base, {
      ...base,
      versionNo: 2,
      attachmentIds: ["a", "b", "c"],
    }).fields.find((f) => f.kind === "attachments");
    expect(added).toMatchObject({ added: ["c"], removed: [], reordered: false });

    const removed = diffIdeaVersions(base, {
      ...base,
      versionNo: 2,
      attachmentIds: ["a"],
    }).fields.find((f) => f.kind === "attachments");
    expect(removed).toMatchObject({ added: [], removed: ["b"], reordered: false });

    const reordered = diffIdeaVersions(base, {
      ...base,
      versionNo: 2,
      attachmentIds: ["b", "a"],
    }).fields.find((f) => f.kind === "attachments");
    expect(reordered).toMatchObject({ reordered: true, added: [], removed: [] });
  });

  it("emits opaque before/after for structured fields", () => {
    const d = diffIdeaVersions(base, {
      ...base,
      versionNo: 2,
      categoryAnswers: [{ fieldKey: "impact", value: "high" }],
    });
    const s = d.fields.find((f) => f.kind === "structured" && f.field === "impact")!;
    expect(s.changed).toBe(true);
    if (s.kind === "structured") {
      expect(s.from).toBe("low");
      expect(s.to).toBe("high");
    }
  });

  it("flags truncated when prose exceeds 200 KB", () => {
    const huge = "x".repeat(300 * 1024);
    const d = diffIdeaVersions(
      { ...base, description: huge },
      { ...base, versionNo: 2, description: huge + " more" },
    );
    const desc = d.fields.find((f) => f.kind === "prose" && f.field === "description");
    expect(desc).toMatchObject({ truncated: true });
  });
});
