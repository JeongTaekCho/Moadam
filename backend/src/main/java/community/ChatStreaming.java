package community;

import jakarta.validation.Valid;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

@RestController
@RequestMapping("/api/v1")
public class ChatStreaming {
  static final org.slf4j.Logger log=org.slf4j.LoggerFactory.getLogger(ChatStreaming.class);
  final Api api;
  final org.springframework.jdbc.core.JdbcTemplate db;
  final Integrations integration;
  final TransactionTemplate transaction;
  public ChatStreaming(Api api,Integrations integration,PlatformTransactionManager manager,org.springframework.jdbc.core.JdbcTemplate db) {
    this.api=api;this.db=db;this.integration=integration;this.transaction=new TransactionTemplate(manager);
  }
  void event(OutputStream output,Map<String,Object> value) throws IOException {
    output.write((integration.json.writeValueAsString(value)+"\n").getBytes(StandardCharsets.UTF_8));
    output.flush();
  }
  Dtos.Message message(Map<String,Object> row) {
    try { row.put("citations",integration.json.readValue(row.get("citations").toString(),List.class)); }
    catch(Exception e) { throw new IllegalStateException("Invalid citations",e); }
    return integration.json.convertValue(row,Dtos.Message.class);
  }
  Map<String,Object> save(Jwt jwt,UUID group,UUID session,String question,Map<String,Object> answer) {
    return transaction.execute(status -> {
      api.session(jwt,group,session);
      try {
        // The pair is committed atomically only after the complete validated result.
        var user=db.queryForMap("insert into chat_messages(group_id,session_id,role,content) values(?,?,'user',?) returning *",group,session,question);
        var assistant=db.queryForMap("insert into chat_messages(group_id,session_id,role,content,citations,grounded) values(?,?,'assistant',?,?::jsonb,?) returning *",group,session,answer.get("answer"),integration.json.writeValueAsString(answer.getOrDefault("citations",List.of())),answer.get("grounded"));
        return Map.of("type","done","user",message(user),"assistant",message(assistant));
      } catch(IOException e) { throw new IllegalStateException(e); }
    });
  }
  @PostMapping(value="/groups/{g}/chat/sessions/{id}/messages/stream",produces="application/x-ndjson")
  public ResponseEntity<StreamingResponseBody> ask(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID g,@PathVariable UUID id,@Valid @RequestBody Api.QuestionInput body) {
    api.session(jwt,g,id);
    StreamingResponseBody stream=output -> {
      try {
        event(output,Map.of("type","status","stage","retrieving"));
        var result=integration.queryStream(g,UUID.fromString(jwt.getSubject()),id,body.question(),value -> event(output,value));
        // Probe the connection before persisting a completed answer.
        event(output,Map.of("type","status","stage","saving"));
        event(output,save(jwt,g,id,body.question(),result));
      } catch(Exception e) {
        log.warn("Chat stream failed: {} (cause: {})",e.getClass().getSimpleName(),e.getCause()==null ? "none" : e.getCause().getClass().getSimpleName());
        try { event(output,Map.of("type","error","message","답변을 완료하지 못했습니다. 다시 시도해 주세요.")); }
        catch(IOException disconnected) { /* Closing the upstream reader cancels generation. */ }
      }
    };
    return ResponseEntity.ok().contentType(org.springframework.http.MediaType.parseMediaType("application/x-ndjson")).header("Cache-Control","no-store").header("X-Accel-Buffering","no").body(stream);
  }
}
