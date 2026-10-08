package com.moadam.common.dto;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.moadam.event.dto.EventResponse;
import com.moadam.group.dto.MemberResponse;
import com.moadam.note.dto.NoteResponse;
import com.moadam.person.repository.PersonRepository;
import com.moadam.post.dto.CommentResponse;
import com.moadam.post.dto.PostResponse;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class DtoMapper {
  private final ObjectMapper json;
  private final PersonRepository people;

  public DtoMapper(ObjectMapper json, PersonRepository people) {
    this.json = json;
    this.people = people;
  }

  public <T> T dto(Class<T> type, Map<String, Object> source) {
    var row = new LinkedHashMap<>(source);
    if (List.of(PostResponse.class, CommentResponse.class, NoteResponse.class, EventResponse.class)
            .contains(type)
        && !row.containsKey("author")) people.enrich(List.of(row), "author_id", "author");
    if (type == MemberResponse.class && !row.containsKey("profile"))
      people.enrich(List.of(row), "user_id", "profile");
    return json.convertValue(row, type);
  }

  public <T> Page<T> typed(Page<Map<String, Object>> page, Class<T> type) {
    if (List.of(PostResponse.class, CommentResponse.class, NoteResponse.class, EventResponse.class)
        .contains(type)) people.enrich(page.items(), "author_id", "author");
    if (type == MemberResponse.class) people.enrich(page.items(), "user_id", "profile");
    return new Page<>(
        page.items().stream().map(row -> dto(type, row)).toList(),
        page.page(),
        page.size(),
        page.total());
  }
}
