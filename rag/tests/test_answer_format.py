import unittest

from answer_format import format_answer


class AnswerFormatTests(unittest.TestCase):
    def test_plain_sentences_become_readable_paragraphs(self):
        self.assertEqual(
            format_answer("**광합성**은 빛을 이용합니다. 식물은 산소를 만듭니다."),
            "**광합성**은 빛을 이용합니다.\n\n식물은 산소를 만듭니다.",
        )

    def test_code_inline_decimal_and_existing_lists_remain_unchanged(self):
        text = "가격은 3.14입니다.\n\n- **핵심** 확인\n- `x. y` 실행\n\n```python\nif True:\n    print('a. b')\n\n    # 들여쓰기와 빈 줄 유지\n```"
        self.assertEqual(format_answer(text), text)
        self.assertEqual(
            format_answer("`x. y`가 예시입니다. 다음 설명입니다."),
            "`x. y`가 예시입니다.\n\n다음 설명입니다.",
        )

    def test_tilde_fences_and_nested_markdown_are_not_split(self):
        text = "**중요. 다음** 부분입니다. 설명입니다.\n\n~~~text\nfirst. second\n\n  last\n~~~"
        formatted = (
            "**중요. 다음** 부분입니다.\n\n설명입니다.\n\n~~~text\nfirst. second\n\n  last\n~~~"
        )
        self.assertEqual(format_answer(text), formatted)
        self.assertEqual(format_answer(formatted), formatted)

    def test_missing_emphasis_is_added_to_labels_without_touching_code(self):
        text = "활동을 추천합니다.\n\n1. 아이스브레이킹 게임: 서로 소개합니다.\n2. 함께 산책하기: 편하게 이야기합니다.\n\n```text\n1. 비밀 없는 코드: 이 줄은 변경하지 않음\n```"
        formatted = format_answer(text)
        self.assertIn("1. **아이스브레이킹 게임**:", formatted)
        self.assertIn("2. **함께 산책하기**:", formatted)
        self.assertIn("```text\n1. 비밀 없는 코드: 이 줄은 변경하지 않음\n```", formatted)
        self.assertEqual(format_answer(formatted), formatted)
        self.assertEqual(
            format_answer("광합성은 식물의 과정입니다."), "**광합성**은 식물의 과정입니다."
        )
