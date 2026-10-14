package com.moadam.ai.client;

import com.moadam.ai.dto.AiTokenReservation;
import java.io.IOException;
import java.util.Map;
import java.util.UUID;
import org.springframework.stereotype.Component;

/**
 * Model-answer facade. OpenAI SDK/keys, embeddings and generation stay in Python RAG. This class
 * deliberately delegates to RAG rather than bypassing retrieval or its security checks.
 */
@Component
public class OpenAiClient {
  private final RagClient rag;

  public OpenAiClient(RagClient rag) {
    this.rag = rag;
  }

  public Map<String, Object> query(
      UUID group, UUID user, UUID session, String question, AiTokenReservation reservation) {
    return rag.query(group, user, session, question, reservation);
  }

  public Map<String, Object> queryStream(
      UUID group,
      UUID user,
      UUID session,
      String question,
      AiTokenReservation reservation,
      RagClient.StreamConsumer consumer)
      throws IOException {
    return rag.queryStream(group, user, session, question, reservation, consumer);
  }
}
