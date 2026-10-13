package com.moadam.ai.client;

import java.io.IOException;

/** Safe transport categories; never expose upstream URLs, credentials or response bodies. */
public class RagUnavailableException extends IOException {
  private final String code;

  public RagUnavailableException(String code, String message, Throwable cause) {
    super(message, cause);
    this.code = code;
  }

  public String code() {
    return code;
  }

  public static RagUnavailableException status(int status) {
    if (status == 401 || status == 403)
      return new RagUnavailableException(
          "AI_AUTH_FAILED", "AI 서비스 연결 설정을 확인해 주세요. 관리자에게 문의해 주세요.", null);
    if (status == 404)
      return new RagUnavailableException(
          "AI_ENDPOINT_MISSING", "AI 서비스 연결 주소를 확인해 주세요. 관리자에게 문의해 주세요.", null);
    if (status == 429)
      return new RagUnavailableException("AI_CAPACITY", "AI 요청이 많아요. 잠시 후 다시 시도해 주세요.", null);
    return new RagUnavailableException(
        "AI_UPSTREAM_UNAVAILABLE", "AI 서비스가 아직 준비되지 않았어요. 잠시 후 다시 시도해 주세요.", null);
  }
}
