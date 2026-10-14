"""Conservative paragraph cleanup: never split fenced code or inline Markdown."""

import re


def prose_paragraphs(text):
    paragraphs = []
    for block in text.split("\n\n"):
        if "\n" in block.strip("\n") or re.match(
            r"^\s*(?:#{1,6}\s|[-*+]\s|\d+[.)]\s|>| {4})", block
        ):
            paragraphs.append(block)
            continue
        protected = []

        def protect(match):
            protected.append(match.group())
            return f"\ue000{len(protected) - 1}\ue001"

        plain = re.sub(r"\*\*[^*]+\*\*|`+[^`]+`+", protect, block)
        plain = re.sub(r"(?<=[.!?。！？]) +(?=\S)", "\n\n", plain)
        for index, original in enumerate(protected):
            plain = plain.replace(f"\ue000{index}\ue001", original)
        paragraphs.append(plain)
    return "\n\n".join(paragraphs)


def format_answer(text):
    output = []
    code_lines = set()
    prose = []
    fence = None
    for line in text.split("\n"):
        marker = re.match(r"^ {0,3}(`{3,}|~{3,})", line)
        if fence is None and marker:
            if prose:
                output.extend(prose_paragraphs("\n".join(prose)).split("\n"))
                prose = []
            fence = marker[1]
            code_lines.add(len(output))
            output.append(line)
        elif fence is not None:
            code_lines.add(len(output))
            output.append(line)
            if re.fullmatch(
                r" {0,3}" + re.escape(fence[0]) + "{" + str(len(fence)) + r",}\s*", line
            ):
                fence = None
        else:
            prose.append(line)
    if prose:
        output.extend(prose_paragraphs("\n".join(prose)).split("\n"))
    if not any(
        re.search(r"\*\*[^*]+\*\*", line) for i, line in enumerate(output) if i not in code_lines
    ):
        emphasized = 0
        for i, line in enumerate(output):
            if i in code_lines:
                continue
            label = re.match(r"^(\s*(?:[-*+]|\d+[.)])\s+)([^:`*]{2,40}):(\s+.*)$", line)
            if label and emphasized < 3:
                output[i] = f"{label[1]}**{label[2]}**:{label[3]}"
                emphasized += 1
        if not emphasized:
            for i, line in enumerate(output):
                if i in code_lines:
                    continue
                term = re.match(
                    r"^([가-힣A-Za-z][가-힣A-Za-z0-9 ·]{0,23}?)(은|는|이란|란)(?=\s)", line
                )
                if term:
                    output[i] = f"**{term[1]}**{line[len(term[1]) :]}"
                    emphasized = 1
                    break
        if not emphasized:
            for i, line in enumerate(output):
                if i in code_lines:
                    continue
                notice = re.search(
                    r"정보가\s*없습니다|확인하지\s*못했습니다|확인할\s*수\s*없습니다|확인되지\s*않습니다",
                    line,
                )
                if notice:
                    output[i] = line[: notice.start()] + f"**{notice[0]}**" + line[notice.end() :]
                    break
    return "\n".join(output)
