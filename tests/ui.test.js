import { test } from "node:test";
import assert from "node:assert/strict";
import { formatarAno, formatarNota } from "../js/ui.js";

test("formatarAno", () => {
  assert.equal(formatarAno("2024-05-01"), "2024");
  assert.equal(formatarAno(""), "—");
  assert.equal(formatarAno(undefined), "—");
});

test("formatarNota", () => {
  assert.equal(formatarNota(7.834), "7.8");
  assert.equal(formatarNota(8), "8.0");
  assert.equal(formatarNota(0), "—");
  assert.equal(formatarNota(undefined), "—");
});
