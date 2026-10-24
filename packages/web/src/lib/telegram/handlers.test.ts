import { describe, it, expect } from "vitest";
import { parseCommand } from "./handlers";

describe("parseCommand", () => {
  it("extracts simple /commands", () => {
    expect(parseCommand("/start")).toBe("/start");
    expect(parseCommand("/status")).toBe("/status");
    expect(parseCommand("/help")).toBe("/help");
  });

  it("ignores @botname suffixes", () => {
    expect(parseCommand("/start@GripShotBot")).toBe("/start");
    expect(parseCommand("/status@GripShotBot")).toBe("/status");
  });

  it("extracts command from text with trailing arguments", () => {
    expect(parseCommand("/start some argument")).toBe("/start");
  });

  it("normalises command to lowercase", () => {
    expect(parseCommand("/START")).toBe("/start");
    expect(parseCommand("/Help")).toBe("/help");
  });

  it("returns null for non-command text", () => {
    expect(parseCommand("hello")).toBeNull();
    expect(parseCommand("")).toBeNull();
    expect(parseCommand("some text /start")).toBeNull();
  });

  it("handles commands with underscores", () => {
    expect(parseCommand("/my_command")).toBe("/my_command");
  });

  it("parses new resource commands", () => {
    expect(parseCommand("/newmodel")).toBe("/newmodel");
    expect(parseCommand("/newbackground")).toBe("/newbackground");
    expect(parseCommand("/newproduct")).toBe("/newproduct");
    expect(parseCommand("/NewModel@GripShotBot")).toBe("/newmodel");
  });

  it("parses utility commands", () => {
    expect(parseCommand("/dashboard")).toBe("/dashboard");
    expect(parseCommand("/settings")).toBe("/settings");
    expect(parseCommand("/workflows")).toBe("/workflows");
    expect(parseCommand("/cancel")).toBe("/cancel");
  });

  it("parses new list and workflow commands", () => {
    expect(parseCommand("/products")).toBe("/products");
    expect(parseCommand("/models")).toBe("/models");
    expect(parseCommand("/backgrounds")).toBe("/backgrounds");
    expect(parseCommand("/newworkflow")).toBe("/newworkflow");
    expect(parseCommand("/Products@GripShotBot")).toBe("/products");
  });
});
