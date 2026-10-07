package community;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.server.ResponseStatusException;

class PolicyTest {
  JdbcTemplate db;
  Policy policy;
  UUID g = UUID.randomUUID(), u = UUID.randomUUID();

  @BeforeEach
  void setup() {
    db = mock(JdbcTemplate.class);
    policy = new Policy(db);
  }

  void role(String role) {
    when(db.queryForList("select role from group_members where group_id=? and user_id=?", g, u))
        .thenReturn(List.of(new HashMap<>(Map.of("role", role))));
  }

  @Test
  void nonMemberHidden() {
    assertEquals(
        404,
        assertThrows(ResponseStatusException.class, () -> policy.member(g, u))
            .getStatusCode()
            .value());
    verify(db).queryForList("select role from group_members where group_id=? and user_id=?", g, u);
  }

  @Test
  void memberCannotManage() {
    role("member");
    assertThrows(ResponseStatusException.class, () -> policy.admin(g, u));
    assertThrows(ResponseStatusException.class, () -> policy.owner(g, u));
  }

  @Test
  void authorCanEditOwnOnly() {
    role("member");
    assertDoesNotThrow(() -> policy.author(g, u, u));
    assertThrows(ResponseStatusException.class, () -> policy.author(g, u, UUID.randomUUID()));
  }

  @Test
  void adminCanManageButCannotOwn() {
    role("admin");
    assertDoesNotThrow(() -> policy.author(g, u, UUID.randomUUID()));
    assertThrows(ResponseStatusException.class, () -> policy.owner(g, u));
  }

  @Test
  void differentGroupDenied() {
    role("owner");
    assertThrows(ResponseStatusException.class, () -> policy.member(UUID.randomUUID(), u));
  }
}
