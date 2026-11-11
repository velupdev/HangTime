import assert from "node:assert/strict";
import test from "node:test";
import { quietPgSslMode } from "./pg-ssl.mjs";

test("rewrites the ssl modes pg already treats as verify-full", () => {
  assert.equal(
    quietPgSslMode("postgres://u:p@host/db?sslmode=require"),
    "postgres://u:p@host/db?sslmode=verify-full",
  );
  assert.equal(
    quietPgSslMode("postgres://u:p@host/db?sslmode=prefer&application_name=hangtime"),
    "postgres://u:p@host/db?sslmode=verify-full&application_name=hangtime",
  );
  assert.equal(
    quietPgSslMode("postgres://u:p@host/db?connect_timeout=5&sslmode=verify-ca"),
    "postgres://u:p@host/db?connect_timeout=5&sslmode=verify-full",
  );
});

test("leaves verify-full, disable, and strings without sslmode alone", () => {
  const full = "postgres://u:p@host/db?sslmode=verify-full";
  assert.equal(quietPgSslMode(full), full);
  const off = "postgres://u:p@host/db?sslmode=disable";
  assert.equal(quietPgSslMode(off), off);
  const plain = "postgres://u:p@host/db";
  assert.equal(quietPgSslMode(plain), plain);
});
