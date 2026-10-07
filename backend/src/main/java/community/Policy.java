package community;

import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
public class Policy {
  final JdbcTemplate db;

  public Policy(JdbcTemplate db) {
    this.db = db;
  }

  public String member(UUID g, UUID u) {
    var rows =
        db.queryForList("select role from group_members where group_id=? and user_id=?", g, u);
    if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    return rows.getFirst().get("role").toString();
  }

  public void admin(UUID g, UUID u) {
    if (member(g, u).equals("member")) throw new ResponseStatusException(HttpStatus.FORBIDDEN);
  }

  public void owner(UUID g, UUID u) {
    if (!member(g, u).equals("owner")) throw new ResponseStatusException(HttpStatus.FORBIDDEN);
  }

  public void author(UUID g, UUID u, Object author) {
    if (member(g, u).equals("member") && !u.toString().equals(author.toString()))
      throw new ResponseStatusException(HttpStatus.FORBIDDEN);
  }
}
