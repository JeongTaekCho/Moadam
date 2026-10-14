package com.moadam.common.exception;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

class GlobalExceptionHandlerTest {
  @Test
  void pastEventDateIdentifiesTheStartFieldInTheApiResponse() {
    var response =
        new GlobalExceptionHandler()
            .handle(
                new com.moadam.event.exception.PastEventDateException(),
                new MockHttpServletRequest());
    assertEquals(400, response.getStatusCode().value());
    assertEquals("EVENT_START_BEFORE_TODAY", response.getBody().get("code"));
    assertEquals("시작일이 오늘보다 전입니다. 시작일을 오늘 또는 이후 날짜로 수정해 주세요.", response.getBody().get("message"));
  }

  @Test
  void groupLimitReturnsMachineReadableCodeAndKoreanMessage() {
    var response =
        new GlobalExceptionHandler()
            .handle(
                new com.moadam.group.exception.GroupLimitException(), new MockHttpServletRequest());
    assertEquals(409, response.getStatusCode().value());
    assertEquals("GROUP_LIMIT_REACHED", response.getBody().get("code"));
    assertTrue(response.getBody().get("message").contains("최대 3개"));
  }

  @Test
  void missingEndpointsReturn404InsteadOf500() {
    var request = new MockHttpServletRequest("GET", "/api/v1/missing");
    request.setAttribute("requestId", "test-request-id");
    var handler = new GlobalExceptionHandler();
    for (var error :
        new Exception[] {
          new NoResourceFoundException(HttpMethod.GET, "api/v1/missing"),
          new NoHandlerFoundException(
              "GET", "/api/v1/missing", new org.springframework.http.HttpHeaders())
        }) {
      var response = handler.handle(error, request);
      assertEquals(404, response.getStatusCode().value());
      assertEquals("HTTP_404", response.getBody().get("code"));
      assertEquals("test-request-id", response.getBody().get("requestId"));
    }
  }
}
