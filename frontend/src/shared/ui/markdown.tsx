import { Fragment, type ReactNode } from "react";
function inline(text: string): ReactNode {
  return text
    .split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
    .map((part, i) =>
      /^\*\*[^*]+\*\*$/.test(part) ? (
        <strong key={i}>{part.slice(2, -2)}</strong>
      ) : /^`[^`]+`$/.test(part) ? (
        <code key={i}>{part.slice(1, -1)}</code>
      ) : (
        <Fragment key={i}>{part}</Fragment>
      ),
    );
}
const fencePattern = /^ {0,3}(`{3,}|~{3,})([^`]*)$/;
const headingPattern = /^ {0,3}(#{1,6})\s+(.+)$/;
const listPattern = /^ {0,3}([-*+]|\d+[.)])\s+(.+)$/;

function startsBlock(line: string) {
  return (
    fencePattern.test(line) ||
    headingPattern.test(line) ||
    listPattern.test(line) ||
    /^>\s?/.test(line)
  );
}

/** Safe Markdown subset; code stays literal and raw HTML is never parsed. */
export function Markdown({ text }: { text: string }) {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const key = index;
    if (!line.trim()) {
      index++;
      continue;
    }
    const fence = line.match(fencePattern);
    if (fence) {
      const code: string[] = [];
      const language = fence[2].trim().split(/\s+/)[0];
      index++;
      // An unfinished fence is valid while the answer is streaming.
      while (index < lines.length) {
        const closing = lines[index].match(/^ {0,3}(`+|~+)\s*$/);
        if (
          closing &&
          closing[1][0] === fence[1][0] &&
          closing[1].length >= fence[1].length
        ) {
          index++;
          break;
        }
        code.push(lines[index++]);
      }
      blocks.push(
        <pre key={key}>
          <code className={language ? `language-${language}` : undefined}>
            {code.join("\n")}
          </code>
        </pre>,
      );
      continue;
    }
    const heading = line.match(headingPattern);
    if (heading) {
      const Heading = `h${heading[1].length}` as
        | "h1"
        | "h2"
        | "h3"
        | "h4"
        | "h5"
        | "h6";
      blocks.push(<Heading key={key}>{inline(heading[2])}</Heading>);
      index++;
      continue;
    }
    const list = line.match(listPattern);
    if (list) {
      const ordered = /^\d/.test(list[1]);
      const items: ReactNode[] = [];
      while (index < lines.length) {
        const item = lines[index].match(listPattern);
        if (!item || /^\d/.test(item[1]) !== ordered) break;
        index++;
        const content = [item[2]];
        while (
          index < lines.length &&
          /^ {2,}\S/.test(lines[index]) &&
          !startsBlock(lines[index])
        ) {
          content.push(lines[index++].trim());
        }
        items.push(<li key={items.length}>{inline(content.join(" "))}</li>);
      }
      blocks.push(
        ordered ? (
          <ol key={key} start={parseInt(list[1], 10)}>
            {items}
          </ol>
        ) : (
          <ul key={key}>{items}</ul>
        ),
      );
      continue;
    }
    if (/^>\s?/.test(line)) {
      const quote: string[] = [];
      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quote.push(lines[index++].replace(/^>\s?/, ""));
      }
      blocks.push(
        <blockquote key={key}>
          <Markdown text={quote.join("\n")} />
        </blockquote>,
      );
      continue;
    }
    const paragraph: string[] = [lines[index++]];
    while (
      index < lines.length &&
      lines[index].trim() &&
      !startsBlock(lines[index])
    ) {
      paragraph.push(lines[index++]);
    }
    blocks.push(
      <p key={key}>
        {paragraph.map((content, i) => (
          <Fragment key={i}>
            {inline(content)}
            {i < paragraph.length - 1 && <br />}
          </Fragment>
        ))}
      </p>,
    );
  }

  return <div className="markdown">{blocks}</div>;
}
