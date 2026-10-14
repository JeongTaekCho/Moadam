import unittest
from unittest.mock import Mock

from token_usage import TokenBudgetExceeded, TokenMeter, chat_input_tokens, count_tokens


class TokenUsageTests(unittest.TestCase):
    def payload(self):
        return {
            "model": "gpt-4.1-mini",
            "messages": [{"role": "user", "content": "한글 질문 😀"}],
            "max_tokens": 1200,
        }

    def test_provider_total_overrides_estimate_and_completion_is_idempotent(self):
        persist = Mock()
        meter = TokenMeter(20000, persist)
        operation = meter.chat(self.payload())
        operation.finish({"total_tokens": 321}, "본문")
        operation.finish({"total_tokens": 321}, "본문")
        self.assertEqual(meter.total, 321)
        persist.assert_called_once_with(321, False)

    def test_embedding_rewrite_and_answer_totals_share_one_budget(self):
        meter = TokenMeter(20000)
        meter.embedding(["회의 안내"], "text-embedding-3-small").finish({"total_tokens": 18})
        meter.chat(self.payload()).finish({"total_tokens": 130})
        meter.chat(self.payload()).finish({"total_tokens": 1500})
        self.assertEqual(meter.total, 1648)
        self.assertFalse(meter.estimated)

    def test_interrupted_stream_counts_input_and_generated_json_once(self):
        meter = TokenMeter(20000)
        payload = self.payload()
        output = '{"answer":"**핵심** 설명\\n\\n추가 문단'
        operation = meter.chat(payload)
        operation.finish(output=output)
        operation.finish(output=output)
        self.assertEqual(
            meter.total, chat_input_tokens(payload) + count_tokens(output, payload["model"])
        )
        self.assertTrue(meter.estimated)

    def test_small_balance_limits_output_and_denies_unaffordable_input(self):
        payload = self.payload()
        meter = TokenMeter(chat_input_tokens(payload) + 164)
        meter.chat(payload)
        self.assertEqual(payload["max_tokens"], 100)
        with self.assertRaises(TokenBudgetExceeded):
            TokenMeter(1).chat(self.payload())
        with self.assertRaises(TokenBudgetExceeded):
            TokenMeter(1).embedding(["회의 일정"], "text-embedding-3-small")

    def test_known_rejection_or_connect_failure_charges_nothing(self):
        meter = TokenMeter(20000)
        meter.chat(self.payload()).finish(accepted=False)
        self.assertEqual(meter.total, 0)
        self.assertFalse(meter.estimated)

    def test_failed_persistence_can_retry_without_double_counting(self):
        persist = Mock(side_effect=[RuntimeError("fixture persistence failure"), None])
        meter = TokenMeter(20000, persist)
        operation = meter.chat(self.payload())
        with self.assertRaises(RuntimeError):
            operation.finish({"total_tokens": 120})
        self.assertEqual(meter.total, 0)
        operation.finish({"total_tokens": 120})
        self.assertEqual(meter.total, 120)
        self.assertEqual(persist.call_args_list[0], persist.call_args_list[1])
