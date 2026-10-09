import { afterEach, describe, expect, it, vi } from "vitest";
import { uid } from "../src/domain/model";

afterEach(() => vi.unstubAllGlobals());
describe("household IDs in Safari LAN HTTP contexts", () => {
  it("uses RFC 4122 version 4 IDs without randomUUID, preserving uniqueness", () => {
    const getRandomValues = crypto.getRandomValues.bind(crypto);
    vi.stubGlobal("crypto", { getRandomValues });
    const identifiers = Array.from({ length: 1000 }, () => uid());
    expect(new Set(identifiers).size).toBe(identifiers.length);
    for (const id of identifiers)
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
  });
  it("keeps native UUID generation where available", () => {
    const id = "faeb78e4-1769-4d34-a668-3a3f626fa54a";
    const randomUUID = vi.fn(() => id);
    vi.stubGlobal("crypto", { randomUUID });
    expect(uid()).toBe(id);
    expect(randomUUID).toHaveBeenCalledOnce();
  });
  it("reports unavailable randomness instead of issuing weak or duplicate IDs", () => {
    vi.stubGlobal("crypto", undefined);
    expect(() => uid()).toThrow(
      "Tvoj prehliadač nedokáže vytvoriť identifikátor",
    );
  });
});
