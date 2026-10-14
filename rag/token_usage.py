"""Request-local token budget. Provider totals win over interrupted-stream estimates."""

from functools import lru_cache

import tiktoken


class TokenBudgetExceeded(Exception):
    pass


@lru_cache(maxsize=8)
def encoding(model):
    try:
        return tiktoken.encoding_for_model(model)
    except KeyError:
        return tiktoken.get_encoding("o200k_base")


def count_tokens(text, model):
    return len(encoding(model).encode(text, disallowed_special=()))


def chat_input_tokens(payload):
    # The protocol envelope varies by model; leave extra room before admission.
    return 3 + sum(
        3
        + count_tokens(message["role"], payload["model"])
        + count_tokens(message["content"], payload["model"])
        for message in payload["messages"]
    )


class TokenMeter:
    def __init__(self, budget=None, persist=None):
        self.budget = budget
        self.persist = persist
        self.total = 0
        self.estimated = False

    def require(self, tokens):
        if self.budget is not None and self.total + tokens > self.budget:
            raise TokenBudgetExceeded()

    def chat(self, payload):
        input_tokens = chat_input_tokens(payload)
        output_limit = payload["max_tokens"]
        if self.budget is not None:
            output_limit = min(output_limit, self.budget - self.total - input_tokens - 64)
            if output_limit < 64:
                raise TokenBudgetExceeded()
            payload["max_tokens"] = output_limit
        return TokenOperation(self, input_tokens, payload["model"])

    def embedding(self, texts, model):
        tokens = sum(count_tokens(text, model) for text in texts)
        self.require(tokens + 64)
        return TokenOperation(self, tokens, model)

    def record(self, tokens, estimated):
        total = self.total + tokens
        estimated = self.estimated or estimated
        if self.persist is not None:
            self.persist(total, estimated)
        self.total, self.estimated = total, estimated


class TokenOperation:
    def __init__(self, meter, input_tokens, model):
        self.meter = meter
        self.input_tokens = input_tokens
        self.model = model
        self.recorded = False

    def finish(self, usage=None, output="", accepted=True):
        if self.recorded:
            return
        total = usage.get("total_tokens") if isinstance(usage, dict) else None
        exact = isinstance(total, int) and not isinstance(total, bool) and total >= 0
        tokens = total if exact else self.input_tokens + count_tokens(output, self.model)
        if not accepted:
            tokens, exact = 0, True
        self.meter.record(tokens, not exact)
        self.recorded = True
