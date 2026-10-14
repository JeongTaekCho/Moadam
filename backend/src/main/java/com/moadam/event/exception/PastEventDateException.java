package com.moadam.event.exception;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

public final class PastEventDateException extends ResponseStatusException {
  public static final String CODE = "EVENT_START_BEFORE_TODAY";
  public static final String MESSAGE = "시작일이 오늘보다 전입니다. 시작일을 오늘 또는 이후 날짜로 수정해 주세요.";

  public PastEventDateException() {
    super(HttpStatus.BAD_REQUEST, MESSAGE);
  }
}
