import { describe, expect, it } from "bun:test";

describe("entrypoints", () => {
  it.each(["../index.js", "../vo/index.js", "../vo/br/index.js", "../testing/index.js"])(
    "%s é importável",
    async (path) => {
      expect(await import(path)).toBeDefined();
    },
  );
});
