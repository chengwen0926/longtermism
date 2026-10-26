import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import { webcrypto } from "node:crypto";
const source = await readFile(
  new URL("../web/model.js", import.meta.url),
  "utf8",
);
function model() {
  const context = vm.createContext({ crypto: webcrypto });
  vm.runInContext(source, context);
  return (expression) => vm.runInContext(expression, context);
}

test("trial ranges include both endpoints, including leap years and month ends", () => {
  const run = model();
  assert.equal(run(`end('2026-10-26','14')`), "2026-11-08");
  assert.equal(run(`end('2026-12-29','7')`), "2027-01-04");
  assert.equal(run(`end('2024-02-01','month')`), "2024-02-29");
  assert.equal(run(`end('2026-01-31','month')`), "2026-02-27");
  assert.equal(run(`days('2026-11-08','2026-10-26') + 1`), 14);
});

test("new IDs remain unique after reinitializing a saved-data session", () => {
  const run = model();
  const otherSession = model();
  const first = run(`uid('task')`);
  assert.notEqual(first, otherSession(`uid('task')`));
});

test("reject corrupt/newer data instead of silently resetting records", () => {
  const run = model();
  assert.equal(
    run(`validateState({schemaVersion:1,plans:[],tasks:[]}).schemaVersion`),
    1,
  );
  assert.throws(
    () => run(`validateState({schemaVersion:2,plans:[],tasks:[]})`),
    /schemaVersion/,
  );
  assert.throws(
    () =>
      run(
        `validateState({schemaVersion:1,plans:[],tasks:[{id:'task-1',title:'x',q:'q2',done:false,doneAt:'',due:'',planId:'missing'}]})`,
      ),
    /关联计划/,
  );
  assert.throws(
    () =>
      run(
        `validateState({schemaVersion:1,plans:[],tasks:[{id:'task-1',title:'x',q:'q2',done:true,doneAt:'',due:'',planId:''}]})`,
      ),
    /完成状态/,
  );
  assert.throws(
    () =>
      run(
        `validateState({schemaVersion:1,plans:[],tasks:[{id:'task-1',title:'x',q:'q2',done:false,doneAt:'',due:'2026-02-30',planId:''}]})`,
      ),
    /日期/,
  );
});

test("calendar clips cross-month periods and counts overlap without double-counting days", () => {
  const run = model();
  const summary = JSON.parse(run(`JSON.stringify(calendarSummary([
    {id:'a',name:'A',start:'2026-09-28',end:'2026-10-03'},
    {id:'b',name:'B',start:'2026-10-03',end:'2026-10-04'},
    {id:'c',name:'C',start:'2026-10-31',end:'2026-11-05',closed:true},
    {id:'d',name:'D',start:'2026-11-01',end:'2026-11-07'}
  ], '2026-10'))`));
  assert.equal(summary.rows.length, 3);
  assert.equal(summary.covered, 5);
  assert.equal(summary.peak, 2);
  assert.deepEqual(summary.counts.slice(0, 5), [1, 1, 2, 1, 0]);
  assert.equal(summary.rows[0].before, true);
  assert.equal(summary.rows[0].length, 3);
  assert.equal(summary.rows[0].plan.start, '2026-09-28');
  assert.equal(summary.rows[2].after, true);
  assert.equal(summary.rows[2].offset, 30);
  assert.equal(summary.rows[2].length, 1);
});

test("calendar handles leap February, year navigation, empty and enclosing intervals", () => {
  const run = model();
  assert.equal(run(`calendarMonth('2024-02').length`), 29);
  assert.equal(run(`calendarMonth('2026-12',1).month`), '2027-01');
  assert.equal(run(`calendarMonth('2027-01',-1).month`), '2026-12');
  assert.equal(run(`calendarSummary([], '2026-02').peak`), 0);
  assert.equal(run(`calendarSummary([], '2026-02').covered`), 0);
  assert.equal(run(`calendarSummary([{name:'x',start:'2024-01-31',end:'2024-03-01'}], '2024-02').covered`), 29);
});

test("canvas data round-trips while old plans remain compatible", () => {
  const run = model();
  run(`var saved = {schemaVersion:1, tasks:[], plans:[{id:'p1',name:'trial',question:'',closed:false,start:'2026-10-26',end:'2026-11-08',duration:'14'}]}`);
  assert.equal(run("validateState(saved).plans[0].canvas"), undefined);
  run(`saved.plans[0].canvas = {nodes:[
    {id:'n1',title:'Question',text:'Details',x:24,y:48},
    {id:'n2',title:'Observation',text:'',x:600,y:300}
  ],edges:[]}`);
  assert.equal(run("connectCanvasNodes(saved.plans[0].canvas, 'n1', 'n2')"), true);
  const json = run("JSON.stringify(saved)");
  assert.equal(run("JSON.stringify(validateState(JSON.parse(JSON.stringify(saved))))"), json);
  assert.equal(run("validateState(saved).plans[0].canvas.nodes[1].x"), 600);
});

test("canvas connections reject self links, duplicates and missing endpoints; node removal cleans edges", () => {
  const run = model();
  run("var board = {nodes:[{id:'a'},{id:'b'},{id:'c'}],edges:[]}");
  assert.equal(run("connectCanvasNodes(board, 'a', 'a')"), false);
  assert.equal(run("connectCanvasNodes(board, 'a', 'missing')"), false);
  assert.equal(run("connectCanvasNodes(board, 'a', 'b')"), true);
  assert.equal(run("connectCanvasNodes(board, 'b', 'a')"), false);
  assert.equal(run("connectCanvasNodes(board, 'b', 'c')"), true);
  run("removeCanvasNode(board, 'a')");
  assert.equal(run("board.nodes.length"), 2);
  assert.equal(run("board.edges.length"), 1);
  assert.equal(run("board.edges[0].from"), "b");
});

test("invalid canvas geometry and dangling or cross-project connections cannot load", () => {
  const run = model();
  run(`var saved = {schemaVersion:1,tasks:[],plans:[{id:'p1',name:'trial',question:'',closed:false,start:'2026-10-26',end:'2026-11-08',duration:'14',canvas:{nodes:[{id:'n1',title:'Node',text:'',x:0,y:0}],edges:[]}}]}`);
  for (const value of ["NaN", "Infinity", "-1", "2400", "'20'"]) {
    assert.throws(() => run(`validateState({...saved, plans:[{...saved.plans[0],canvas:{nodes:[{...saved.plans[0].canvas.nodes[0],x:${value}}],edges:[]}}]})`), /画布节点/);
  }
  run("saved.plans[0].canvas.edges.push({id:'e1',from:'n1',to:'other-project-node'})");
  assert.throws(() => run("validateState(saved)"), /画布连线/);
  run("saved.plans[0].canvas.edges[0].to = 'n1'");
  assert.throws(() => run("validateState(saved)"), /画布连线/);
  run("saved.plans[0].canvas = null");
  assert.throws(() => run("validateState(saved)"), /画布字段/);
});
