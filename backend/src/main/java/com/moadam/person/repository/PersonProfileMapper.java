package com.moadam.person.repository;

import com.moadam.person.dto.PublicProfile;
import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;

public final class PersonProfileMapper {
  public static PublicProfile publicProfile(UUID id, Map<String, Object> row) {
    String name = Objects.toString(row.get("display_name"), "").strip();
    if (name.isBlank()) name = "멤버 " + id.toString().substring(0, 8);
    String path = Objects.toString(row.get("avatar_path"), "");
    String avatar =
        path.isBlank()
            ? null
            : "/api/proxy/profiles/"
                + id
                + "/avatar?v="
                + path.substring(path.lastIndexOf('/') + 1);
    return new PublicProfile(id, name, avatar);
  }

  public static void enrich(
      JdbcTemplate db, List<Map<String, Object>> rows, String idKey, String resultKey) {
    var ids =
        rows.stream().map(r -> (UUID) r.get(idKey)).filter(Objects::nonNull).distinct().toList();
    if (ids.isEmpty()) return;
    var profiles = new HashMap<UUID, Map<String, Object>>();
    for (var row :
        db.queryForList(
            "select id,display_name,avatar_path from profiles where id in ("
                + String.join(",", Collections.nCopies(ids.size(), "?"))
                + ")",
            ids.toArray())) profiles.put((UUID) row.get("id"), row);
    for (var row : rows) {
      UUID id = (UUID) row.get(idKey);
      if (id != null) row.put(resultKey, publicProfile(id, profiles.getOrDefault(id, Map.of())));
    }
  }
}
