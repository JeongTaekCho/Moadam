package com.moadam.common.exception;

import java.util.*;
import org.springframework.http.*;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestControllerAdvice
public class GlobalExceptionHandler {
  @ExceptionHandler(Exception.class)
  ResponseEntity<Map<String, String>> handle(
      Exception e, jakarta.servlet.http.HttpServletRequest request) {
    int status =
        e instanceof ResponseStatusException r
            ? r.getStatusCode().value()
            : e instanceof MethodArgumentNotValidException
                    || e instanceof java.time.DateTimeException
                    || e
                        instanceof
                        org.springframework.web.method.annotation
                            .MethodArgumentTypeMismatchException
                    || e
                        instanceof
                        org.springframework.web.bind.MissingServletRequestParameterException
                    || e instanceof IllegalArgumentException
                    || e
                        instanceof
                        org.springframework.http.converter.HttpMessageNotReadableException
                ? 400
                : 500;
    String message =
        status == 403
            ? "이 작업을 수행할 권한이 없습니다"
            : status == 404
                ? "요청한 항목을 찾을 수 없습니다"
                : status == 400
                    ? "입력 값을 확인해 주세요"
                    : status == 503 ? "서비스를 사용할 수 없습니다. 잠시 후 다시 시도해 주세요" : "요청을 처리하지 못했습니다";
    return ResponseEntity.status(status)
        .body(
            Map.of(
                "code",
                "HTTP_" + status,
                "message",
                message,
                "requestId",
                Objects.toString(request.getAttribute("requestId"), UUID.randomUUID().toString())));
  }
}
