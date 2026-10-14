import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const source = await readFile(
  new URL("../src/shared/ui/markdown.tsx", import.meta.url),
  "utf8",
);
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX,
  },
}).outputText;
const loaded = { exports: {} };
new Function("require", "module", "exports", compiled)(
  createRequire(import.meta.url),
  loaded,
  loaded.exports,
);
const render = (text) =>
  renderToStaticMarkup(createElement(loaded.exports.Markdown, { text }));
const escaped = String.raw`**핵심** 안내입니다.\n\n1. 첫 항목\n2. 두 번째 항목\n\n다음 설명입니다.`;
const expected = escaped.replaceAll(String.raw`\n`, "\n");
assert.equal(render(escaped), render(expected));
assert.equal((render(escaped).match(/<li>/g) ?? []).length, 2);
assert.equal((render(escaped).match(/<p>/g) ?? []).length, 2);
assert.equal(
  render(String.raw`설명\n## 제목\n- 항목\n> 인용`),
  render("설명\n## 제목\n- 항목\n> 인용"),
);
for (const literal of [
  String.raw`C:\new\notes.txt`,
  String.raw`문자 \n 은 이스케이프입니다.`,
  String.raw`\n\n`,
  String.raw`\\n\\n`,
]) {
  assert(render("`" + literal + "`").includes(literal));
  const code = "```python\nprint('" + literal + "')\n\n```";
  assert(render(code).includes(literal));
}
assert(
  render(String.raw`파일 경로 C:\new\notes.txt`).includes(
    String.raw`C:\new\notes.txt`,
  ),
);
assert(
  render(String.raw`문자 \n 은 이스케이프입니다.`).includes(String.raw`\n`),
);
assert(render(String.raw`이스케이프 \\n\\n`).includes(String.raw`\\n\\n`));
assert(
  render("``내용 `와 " + String.raw`\n\n` + "``").includes(String.raw`\n\n`),
);
const openCode = "안내\n\n```text\n" + String.raw`\n\n1. 코드`;
assert(render(openCode).includes(String.raw`\n\n1. 코드`));
const tildeCode = "~~~text\n```text\n" + String.raw`\n\n1. 코드` + "\n~~~";
assert(render(tildeCode).includes(String.raw`\n\n1. 코드`));
const partialList = render(String.raw`요약입니다.\n\n1. 확인한 내용\n2. `);
assert(partialList.includes("<p>요약입니다.</p>"));
assert(partialList.includes('<ol start="1"><li>확인한 내용</li>'));
const partialInline = render("요약\\n\\n`" + String.raw`\n\n1. 예시`);
assert(partialInline.includes(String.raw`\n\n1. 예시`));
assert(!render("<script>alert(1)</script>").includes("<script>"));
console.log(
  "PASS: escaped prose paragraphs/lists, Korean, preserved code/paths/literals, unfinished fences and safe HTML rendering",
);
