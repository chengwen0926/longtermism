import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
const source = await readFile(
  new URL("../web/storage.js", import.meta.url),
  "utf8",
);
function harness(postMessage, bridgeName = "longtermism") {
  const element = { replaceChildren() {}, append() {} };
  const context = vm.createContext({
    window: {
      webkit: { messageHandlers: { [bridgeName]: { postMessage } } },
      addEventListener() {},
    },
    document: {
      querySelector: () => element,
      createElement: () => ({}),
      createTextNode: (s) => s,
    },
    console: { error() {} },
    setInterval() {},
    data: { plans: [], tasks: [] },
  });
  vm.runInContext(source, context);
  vm.runInContext("storageReady = true", context);
  return { context, run: (expression) => vm.runInContext(expression, context) };
}

test("rapid changes are written in order and flush waits for the newest state", async () => {
  const writes = [];
  let release;
  const firstWrite = new Promise((resolve) => {
    release = resolve;
  });
  const { run } = harness(async ({ value }) => {
    if (writes.length === 0) await firstWrite;
    writes.push(value.tasks.length);
  });
  run(
    'persist(); data.tasks.push({id:"a"}); persist(); data.tasks.push({id:"b"}); persist()',
  );
  const flushing = run("window.longtermismFlush()");
  release();
  assert.equal(await flushing, true);
  assert.deepEqual(writes, [0, 1, 2]);
  run("persist()");
  await run("window.longtermismFlush()");
  assert.equal(writes.length, 3, "navigation does not write identical data");
});

test("a disk error is visible and an unchanged snapshot can be retried", async () => {
  let failing = true;
  let calls = 0;
  const { run } = harness(async () => {
    calls++;
    if (failing) throw new Error("disk full");
  });
  assert.equal(await run("window.longtermismFlush()"), false);
  assert.equal(run("storageError"), "disk full");
  failing = false;
  assert.equal(await run("window.longtermismFlush()"), true);
  assert.equal(run("storageError"), "");
  assert.equal(calls, 2);
});


test("renamed UI can flush through an older native host without losing queued writes", async () => {
  const writes = [];
  const { run } = harness(async ({ value }) => writes.push(value), "field");
  run('data.tasks.push({id:"retained"}); persist()');
  assert.equal(await run("window.fieldFlush()"), true);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].tasks[0].id, "retained");
  assert.equal(run("window.fieldFlush === window.longtermismFlush"), true);
});

test("renamed browser preview reads and writes the existing storage key", async () => {
  const previous = JSON.stringify({schemaVersion:1, plans:[], tasks:[{id:"existing"}]});
  const stored = new Map([["field.preview.v1", previous]]);
  const context = vm.createContext({
    window: { addEventListener() {} }, setInterval() {},
    localStorage: { getItem: (key) => stored.get(key) ?? null,
      setItem: (key, value) => stored.set(key, value) },
  });
  vm.runInContext(source, context);
  const saved = await vm.runInContext('storageCall("load")', context);
  assert.equal(saved.tasks[0].id, "existing");
  await vm.runInContext('storageCall("save", {schemaVersion:1, plans:[], tasks:[{id:"updated"}]})', context);
  assert.equal(stored.size, 1);
  assert.equal(JSON.parse(stored.get("field.preview.v1")).tasks[0].id, "updated");
});
