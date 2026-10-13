package com.moadam.common.exception;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

class GlobalExceptionHandlerTest {
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
