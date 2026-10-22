const test = require("node:test");
const assert = require("node:assert/strict");

test("health endpoint returns database status", async () => {
  const response = await fetch("http://localhost:5000/api/health");
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.status, "ok");
  assert.equal(body.database, "connected");
});