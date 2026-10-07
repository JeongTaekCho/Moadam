package community;

import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.io.IOException;
import java.util.UUID;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@Order(-200)
public class RequestIds extends OncePerRequestFilter {
  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    String id = request.getHeader("X-Request-ID");
    try {
      id = UUID.fromString(id).toString();
    } catch (Exception e) {
      id = UUID.randomUUID().toString();
    }
    request.setAttribute("requestId", id);
    response.setHeader("X-Request-ID", id);
    chain.doFilter(request, response);
  }
}
