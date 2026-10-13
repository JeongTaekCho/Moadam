package com.moadam.group.exception;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

public class GroupLimitException extends ResponseStatusException {
  public static final String CODE = "GROUP_LIMIT_REACHED";
  public static final String MESSAGE =
      "모임은 만든 모임과 참여한 모임을 합쳐 최대 3개까지 이용할 수 있어요. 더 이상 모임을 만들거나 참여할 수 없습니다. 기존 모임에서 나가거나 소유한 모임을 삭제한 뒤 다시 시도해 주세요.";

  public GroupLimitException() {
    super(HttpStatus.CONFLICT, MESSAGE);
  }
}
