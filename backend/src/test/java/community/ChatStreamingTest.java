package community;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import java.io.*;
import java.util.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.PlatformTransactionManager;

class ChatStreamingTest {
  @Test void declaresStreamMediaTypeAndDoesNotSaveInterruptedAnswers() throws Exception {
    var db=mock(JdbcTemplate.class);var api=mock(Api.class);var jwt=mock(Jwt.class);
    var integration=spy(new Integrations(new ObjectMapper(),db,"http://localhost","test","http://localhost","test"));
    UUID g=UUID.randomUUID(),u=UUID.randomUUID(),s=UUID.randomUUID();when(jwt.getSubject()).thenReturn(u.toString());
    doAnswer(invocation -> {
      Integrations.StreamConsumer consumer=invocation.getArgument(4);
      consumer.accept(Map.of("type","delta","text","한글 부분 답변"));
      throw new IOException("Interrupted provider");
    }).when(integration).queryStream(eq(g),eq(u),eq(s),eq("질문"),any());
    var controller=new ChatStreaming(api,integration,mock(PlatformTransactionManager.class),db);
    var response=controller.ask(jwt,g,s,new Api.QuestionInput("질문"));
    assertEquals("application/x-ndjson",response.getHeaders().getContentType().toString());
    var bytes=new ByteArrayOutputStream();response.getBody().writeTo(bytes);
    assertTrue(bytes.toString(java.nio.charset.StandardCharsets.UTF_8).contains("\"type\":\"delta\""));
    assertTrue(bytes.toString(java.nio.charset.StandardCharsets.UTF_8).contains("\"type\":\"error\""));
    verifyNoInteractions(db);verify(api).session(jwt,g,s);integration.shutdown();
  }
}
