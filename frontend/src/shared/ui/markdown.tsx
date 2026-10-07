import { Fragment, type ReactNode } from "react";
function inline(text: string): ReactNode {
  return text
    .split(/(\*\*[^*]+\*\*|`[^`]+`)/g)
    .map((part, i) =>
      part.startsWith("**") ? (
        <strong key={i}>{part.slice(2, -2)}</strong>
      ) : part.startsWith("`") ? (
        <code key={i}>{part.slice(1, -1)}</code>
      ) : (
        <Fragment key={i}>{part}</Fragment>
      ),
    );
}
/** Safe Markdown subset; never parse raw HTML or executable links. */
export function Markdown({ text }: { text: string }) {
  return (
    <div className="markdown">
      {text.split(/\n\s*\n/).map((block, i) => {
        const lines = block.split("\n");
        if (lines.every((line) => /^\s*(?:[-*]|\d+[.)])\s+/.test(line)))
          return (
            <ul key={i}>
              {lines.map((line, j) => (
                <li key={j}>
                  {inline(line.replace(/^\s*(?:[-*]|\d+[.)])\s+/, ""))}
                </li>
              ))}
            </ul>
          );
        return (
          <p key={i}>
            {lines.map((line, j) => (
              <Fragment key={j}>
                {/^#{1,4}\s/.test(line) ? (
                  <strong>{inline(line.replace(/^#{1,4}\s+/, ""))}</strong>
                ) : (
                  inline(line)
                )}
                {j < lines.length - 1 && <br />}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
