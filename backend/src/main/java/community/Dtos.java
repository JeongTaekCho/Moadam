package community;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import io.swagger.v3.oas.annotations.media.Schema;
import java.time.Instant;
import java.util.*;

public final class Dtos {
  public record PublicProfile(@Schema(requiredMode=Schema.RequiredMode.REQUIRED) UUID id, @Schema(requiredMode=Schema.RequiredMode.REQUIRED) String display_name, @Schema(requiredMode=Schema.RequiredMode.REQUIRED, types={"string","null"}) String avatar_url) {}
  public record MyProfile(@Schema(requiredMode=Schema.RequiredMode.REQUIRED) UUID id,@Schema(requiredMode=Schema.RequiredMode.REQUIRED) String email,@Schema(requiredMode=Schema.RequiredMode.REQUIRED) String display_name,@Schema(requiredMode=Schema.RequiredMode.REQUIRED,types={"string","null"}) String avatar_url,@Schema(requiredMode=Schema.RequiredMode.REQUIRED) Instant created_at,@Schema(requiredMode=Schema.RequiredMode.REQUIRED) Instant updated_at) {}
  public record MyActivity(@Schema(requiredMode=Schema.RequiredMode.REQUIRED) UUID id,@Schema(requiredMode=Schema.RequiredMode.REQUIRED) UUID group_id,@Schema(requiredMode=Schema.RequiredMode.REQUIRED) String group_name,@Schema(requiredMode=Schema.RequiredMode.REQUIRED) String title,@Schema(requiredMode=Schema.RequiredMode.REQUIRED) String kind,@Schema(requiredMode=Schema.RequiredMode.REQUIRED) Instant created_at) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record Group(
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String name,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String timezone,
      @Schema(
              requiredMode = Schema.RequiredMode.REQUIRED,
              allowableValues = {"owner", "admin", "member"})
          String role,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant created_at,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant updated_at) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record Post(
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID group_id,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID author_id,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) PublicProfile author,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String title,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String body,
      @Schema(
              requiredMode = Schema.RequiredMode.REQUIRED,
              allowableValues = {"general", "question", "notice"})
          String kind,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant created_at,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant updated_at) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record Comment(
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID group_id,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID post_id,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID author_id,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) PublicProfile author,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String body,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant created_at,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant updated_at) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record Event(
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID group_id,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID author_id,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) PublicProfile author,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String title,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String description,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String location,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant starts_at,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant ends_at,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant created_at,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant updated_at) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record Member(
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID group_id,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID user_id,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) PublicProfile profile,
      @Schema(
              requiredMode = Schema.RequiredMode.REQUIRED,
              allowableValues = {"owner", "admin", "member"})
          String role,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant created_at) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record Invite(
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID group_id,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant expires_at,
      @Schema(
              requiredMode = Schema.RequiredMode.REQUIRED,
              types = {"string", "null"})
          Instant used_at,
      @Schema(
              requiredMode = Schema.RequiredMode.REQUIRED,
              types = {"string", "null"})
          Instant revoked_at,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant created_at) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record Document(
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID group_id,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID author_id,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) PublicProfile author,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String title,
      @Schema(
              requiredMode = Schema.RequiredMode.REQUIRED,
              allowableValues = {"pdf", "memo"})
          String kind,
      @Schema(
              requiredMode = Schema.RequiredMode.REQUIRED,
              types = {"string", "null"})
          String text_content,
      @Schema(
              requiredMode = Schema.RequiredMode.REQUIRED,
              allowableValues = {"pending", "processing", "ready", "failed"})
          String status,
      @Schema(
              requiredMode = Schema.RequiredMode.REQUIRED,
              types = {"string", "null"})
          String error_code,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int version,
      @Schema(
              requiredMode = Schema.RequiredMode.REQUIRED,
              types = {"integer", "null"})
          Long size_bytes,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant created_at,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant updated_at) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record Session(
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID group_id,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID user_id,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String title,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant created_at) {}

  public record Citation(
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID document_id,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String title,
      @Schema(
              requiredMode = Schema.RequiredMode.REQUIRED,
              types = {"integer", "null"})
          Integer page,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID chunk_id) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record Message(
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID id,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID group_id,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID session_id,
      @Schema(
              requiredMode = Schema.RequiredMode.REQUIRED,
              allowableValues = {"user", "assistant"})
          String role,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String content,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<Citation> citations,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean grounded,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Instant created_at) {}

  @JsonIgnoreProperties(ignoreUnknown = true)
  public record Answer(
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String answer,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) List<Citation> citations,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) boolean grounded,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) double confidence,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String provider,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Map<String, Object> retrieval,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) UUID request_id) {}

  public record Upload(
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) Document document,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) String upload_url,
      @Schema(requiredMode = Schema.RequiredMode.REQUIRED) int expires_in) {}
}
