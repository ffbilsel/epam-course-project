import { describe, expect, it } from "vitest";
import { escapeAndLinebreak } from "@/lib/format/plain-text";

describe("escapeAndLinebreak", () => {
  it("returns empty string unchanged", () => {
    expect(escapeAndLinebreak("")).toBe("");
  });

  it("returns plain ASCII unchanged", () => {
    expect(escapeAndLinebreak("hello world")).toBe("hello world");
  });

  it("escapes < and >", () => {
    expect(escapeAndLinebreak("a < b > c")).toBe("a &lt; b &gt; c");
  });

  it("escapes & before subsequent special chars", () => {
    expect(escapeAndLinebreak("a & b < c")).toBe("a &amp; b &lt; c");
  });

  it("escapes double quotes and apostrophes", () => {
    expect(escapeAndLinebreak(`"x" 'y'`)).toBe("&quot;x&quot; &#39;y&#39;");
  });

  it("converts LF to <br />", () => {
    expect(escapeAndLinebreak("a\nb")).toBe("a<br />b");
  });

  it("converts CRLF to <br />", () => {
    expect(escapeAndLinebreak("a\r\nb")).toBe("a<br />b");
  });

  it("handles mixed newlines and escapes", () => {
    expect(escapeAndLinebreak("a < b\nc & d")).toBe("a &lt; b<br />c &amp; d");
  });

  it("preserves unicode emoji unchanged", () => {
    expect(escapeAndLinebreak("hi 🎉")).toBe("hi 🎉");
  });

  it("neutralises a script-tag injection attempt", () => {
    expect(escapeAndLinebreak("<script>x</script>")).toBe("&lt;script&gt;x&lt;/script&gt;");
  });
});
