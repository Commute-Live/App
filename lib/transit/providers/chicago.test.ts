// @ts-nocheck
import { describe, expect, test } from "bun:test";
import {
  deserializeChicagoDirection,
  getChicagoDirectionLabel,
  serializeChicagoDirection,
} from "./chicago";

describe("Chicago transit provider helpers", () => {
  test("serializes and deserializes CTA train directions with neutral UI keys", () => {
    expect(serializeChicagoDirection("train", "dir0")).toBe("1");
    expect(serializeChicagoDirection("train", "dir1")).toBe("5");
    expect(deserializeChicagoDirection("train", "1")).toBe("dir0");
    expect(deserializeChicagoDirection("train", "5")).toBe("dir1");
    expect(deserializeChicagoDirection("train", "N")).toBe("dir0");
    expect(deserializeChicagoDirection("train", "S")).toBe("dir1");
  });

  test("keeps CTA bus direction internal and exposes terminal-bound train copy", () => {
    expect(serializeChicagoDirection("bus", "dir0")).toBe("");
    expect(deserializeChicagoDirection("bus", null)).toBe("dir0");
    expect(getChicagoDirectionLabel("train", "dir0", "BLUE", "bound")).toBe("O'Hare-bound");
    expect(getChicagoDirectionLabel("train", "dir1", "RED", "toggle")).toBe("95th");
  });
});
