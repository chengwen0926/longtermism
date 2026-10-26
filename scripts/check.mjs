import { readdir } from "node:fs/promises";
import { run } from "./build.mjs";
for (const folder of ["web", "scripts", "tests"]) {
  for (const file of await readdir(folder)) {
    if (/\.(m?js)$/.test(file))
      await run(process.execPath, ["--check", `${folder}/${file}`]);
  }
}
console.log("JavaScript 语法检查通过。");
