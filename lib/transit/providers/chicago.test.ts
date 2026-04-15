// @ts-nocheck
import { describe, expect, test } from "bun:test";
import {
  deserializeChicagoDirection,
  getChicagoDirectionLabel,
  getChicagoLineLabel,
  prepareChicagoRouteEntries,
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

  test("keeps CTA bus direction internal and leaves train copy API-driven", () => {
    expect(serializeChicagoDirection("bus", "dir0")).toBe("");
    expect(deserializeChicagoDirection("bus", null)).toBe("dir0");
    expect(getChicagoDirectionLabel("train", "dir0", "BLUE", "bound")).toBeNull();
    expect(getChicagoDirectionLabel("bus", "dir0", "22", "toggle")).toBe("To destination");
  });

  test("expands CTA L route ids to full line names for the picker", () => {
    expect(getChicagoLineLabel("train", "RED", "RED")).toBe("Red Line");
    expect(getChicagoLineLabel("train", "ORG", "ORG")).toBe("Orange Line");

    const rows = prepareChicagoRouteEntries("train", [
      {id: "P", label: "P", color: "#522398", textColor: "#FFFFFF", sortOrder: null, headsign0: null, headsign1: null, directions: []},
      {id: "PINK", label: "PINK", color: "#E27EA6", textColor: "#FFFFFF", sortOrder: null, headsign0: null, headsign1: null, directions: []},
    ]);

    expect(rows?.map(row => row.label)).toEqual(["Pink Line", "Purple Line"]);
  });
});
