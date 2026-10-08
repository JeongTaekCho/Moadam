package community;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.time.*;
import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/v1")
public class Api {
  final JdbcTemplate db;
  final Policy policy;
  final Integrations integration;

  public Api(JdbcTemplate db, Policy policy, Integrations integration) {
    this.db = db;
    this.policy = policy;
    this.integration = integration;
  }

  UUID user(Jwt j) {
    return UUID.fromString(j.getSubject());
  }

  public record Page<T>(List<T> items, int page, int size, long total) {}

  <T> T dto(Class<T> type, Map<String, Object> row) {
    row=new LinkedHashMap<>(row);
    if(List.of(Dtos.Post.class,Dtos.Comment.class,Dtos.Document.class,Dtos.Event.class).contains(type) && !row.containsKey("author")) ProfileSupport.enrich(db,List.of(row),"author_id","author");
    if(type==Dtos.Member.class && !row.containsKey("profile")) ProfileSupport.enrich(db,List.of(row),"user_id","profile");
    return integration.json.convertValue(row, type);
  }

  <T> Page<T> typed(Page<Map<String, Object>> page, Class<T> type) {
    if(List.of(Dtos.Post.class,Dtos.Comment.class,Dtos.Document.class,Dtos.Event.class).contains(type)) ProfileSupport.enrich(db,page.items(),"author_id","author");
    if(type==Dtos.Member.class) ProfileSupport.enrich(db,page.items(),"user_id","profile");
    return new Page<>(
        page.items().stream().map(r -> dto(type, r)).toList(),
        page.page(),
        page.size(),
        page.total());
  }

  public record GroupInput(@NotBlank @Size(max = 100) String name, @NotBlank String timezone) {}

  public record PostInput(
      @NotBlank @Size(max = 200) String title,
      @NotBlank @Size(max = 20000) String body,
      @Pattern(regexp = "general|question|notice") @NotNull String kind) {}

  public record CommentInput(@NotBlank @Size(max = 5000) String body) {}

  public record EventInput(
      @NotBlank @Size(max = 200) String title,
      @Size(max = 10000) String description,
      @Size(max = 500) String location,
      @NotNull Instant starts_at,
      @NotNull Instant ends_at) {}

  public record AttendanceInput(
      @NotNull @Pattern(regexp = "going|not_going|maybe") String status) {}

  public record RoleInput(@NotNull @Pattern(regexp = "admin|member") String role) {}

  public record JoinInput(@NotBlank @Size(max = 100) String token) {}

  public record MemoInput(
      @NotBlank @Size(max = 200) String title,
      @NotNull @Pattern(regexp = "memo") String kind,
      @NotBlank @Size(max = 100000) String text) {}

  public record DocumentInput(
      @NotBlank @Size(max = 200) String title, @Size(max = 100000) String text) {}

  public record UploadInput(
      @NotBlank @Size(max = 200) String title,
      @NotBlank @Size(max = 200) String filename,
      @NotNull @Pattern(regexp = "application/pdf") String mime,
      @Min(1) @Max(20971520) long size) {}

  public record QuestionInput(@NotBlank @Size(max = 4000) String question) {}

  public record SessionInput(@NotBlank @Size(max = 100) String title) {}

  Map<String, Object> one(String table, UUID g, UUID id) {
    var rows = db.queryForList("select * from " + table + " where group_id=? and id=?", g, id);
    if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    return rows.getFirst();
  }

  Page<Map<String, Object>> page(
      String table, UUID g, int page, int size, String condition, Object... extra) {
    if (page < 0 || size < 1 || size > 100) throw new IllegalArgumentException();
    var args = new ArrayList<Object>();
    args.add(g);
    args.addAll(Arrays.asList(extra));
    Long total =
        db.queryForObject(
            "select count(*) from " + table + " where group_id=? " + condition,
            Long.class,
            args.toArray());
    args.add(size);
    args.add((long) page * size);
    return new Page<>(
        db.queryForList(
            "select * from "
                + table
                + " where group_id=? "
                + condition
                + " order by "
                + (table.equals("posts")
                    ? "(kind='notice') desc, created_at desc"
                    : table.equals("events")
                        ? "starts_at asc"
                        : table.equals("chat_messages")
                            ? "sequence asc"
                            : List.of("documents", "chat_sessions", "group_invites").contains(table)
                                ? "created_at desc"
                                : "created_at asc")
                + " limit ? offset ?",
            args.toArray()),
        page,
        size,
        total);
  }

  void audit(UUID g, UUID u, String action, UUID id) {
    db.update(
        "insert into audit_logs(group_id,actor_id,action,resource_id) values(?,?,?,?)",
        g,
        u,
        action,
        id);
  }

  void edit(String table, UUID g, UUID id, UUID u) {
    policy.member(g, u);
    var row = one(table, g, id);
    policy.author(g, u, row.get("author_id"));
    if (table.equals("posts") && row.get("kind").equals("notice")) policy.admin(g, u);
  }

  @GetMapping("/groups")
  public Page<Dtos.Group> groups(
      @AuthenticationPrincipal Jwt j,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    if (page < 0 || size < 1 || size > 100) throw new IllegalArgumentException();
    return typed(
        new Page<>(
            db.queryForList(
                "select g.*,m.role from groups g join group_members m on m.group_id=g.id where"
                    + " m.user_id=? order by g.created_at limit ? offset ?",
                user(j),
                size,
                (long) page * size),
            page,
            size,
            db.queryForObject(
                "select count(*) from group_members where user_id=?", Long.class, user(j))),
        Dtos.Group.class);
  }

  @PostMapping("/groups")
  @Transactional
  public Dtos.Group createGroup(@AuthenticationPrincipal Jwt j, @Valid @RequestBody GroupInput b) {
    if (!ZoneId.getAvailableZoneIds().contains(b.timezone())) throw new IllegalArgumentException();
    UUID g = UUID.randomUUID();
    db.update("insert into groups(id,name,timezone) values(?,?,?)", g, b.name(), b.timezone());
    db.update("insert into group_members values(?,?, 'owner',now())", g, user(j));
    audit(g, user(j), "group.create", g);
    return group(j, g);
  }

  @GetMapping("/groups/{g}")
  public Dtos.Group group(@AuthenticationPrincipal Jwt j, @PathVariable UUID g) {
    String role = policy.member(g, user(j));
    var row = db.queryForMap("select * from groups where id=?", g);
    row.put("role", role);
    return dto(Dtos.Group.class, row);
  }

  @PatchMapping("/groups/{g}")
  @Transactional
  public Dtos.Group updateGroup(
      @AuthenticationPrincipal Jwt j, @PathVariable UUID g, @Valid @RequestBody GroupInput b) {
    policy.owner(g, user(j));
    if (!ZoneId.getAvailableZoneIds().contains(b.timezone())) throw new IllegalArgumentException();
    db.update("update groups set name=?,timezone=? where id=?", b.name(), b.timezone(), g);
    audit(g, user(j), "group.update", g);
    return group(j, g);
  }

  @DeleteMapping("/groups/{g}")
  @Transactional
  public Map<String, Boolean> deleteGroup(@AuthenticationPrincipal Jwt j, @PathVariable UUID g) {
    policy.owner(g, user(j));
    for (var d :
        db.queryForList("select storage_path from documents where group_id=? and kind='pdf'", g))
      integration.deleteFile(d.get("storage_path").toString());
    audit(g, user(j), "group.delete", g);
    db.update("delete from groups where id=?", g);
    return Map.of("deleted", true);
  }

  @GetMapping("/groups/{g}/members")
  public Page<Dtos.Member> members(
      @AuthenticationPrincipal Jwt j,
      @PathVariable UUID g,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    policy.member(g, user(j));
    return typed(page("group_members", g, page, size, ""), Dtos.Member.class);
  }

  @PatchMapping("/groups/{g}/members/{id}")
  @Transactional
  public Map<String, Boolean> role(
      @AuthenticationPrincipal Jwt j,
      @PathVariable UUID g,
      @PathVariable UUID id,
      @Valid @RequestBody RoleInput b) {
    policy.owner(g, user(j));
    if (policy.member(g, id).equals("owner"))
      throw new ResponseStatusException(HttpStatus.FORBIDDEN);
    db.update("update group_members set role=? where group_id=? and user_id=?", b.role(), g, id);
    audit(g, user(j), "member.role", id);
    return Map.of("updated", true);
  }

  @DeleteMapping("/groups/{g}/members/{id}")
  @Transactional
  public Map<String, Boolean> remove(
      @AuthenticationPrincipal Jwt j, @PathVariable UUID g, @PathVariable UUID id) {
    String actor = policy.member(g, user(j));
    String target = policy.member(g, id);
    if (target.equals("owner")
        || actor.equals("member")
        || actor.equals("admin") && !target.equals("member"))
      throw new ResponseStatusException(HttpStatus.FORBIDDEN);
    db.update("delete from group_members where group_id=? and user_id=?", g, id);
    audit(g, user(j), "member.remove", id);
    return Map.of("deleted", true);
  }

  @DeleteMapping("/groups/{g}/membership")
  @Transactional
  public Map<String, Boolean> leave(@AuthenticationPrincipal Jwt j, @PathVariable UUID g) {
    if (policy.member(g, user(j)).equals("owner"))
      throw new ResponseStatusException(HttpStatus.FORBIDDEN);
    audit(g, user(j), "member.leave", user(j));
    db.update("delete from group_members where group_id=? and user_id=?", g, user(j));
    return Map.of("deleted", true);
  }

  static String hash(String token) {
    try {
      return HexFormat.of()
          .formatHex(
              MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8)));
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  @GetMapping("/groups/{g}/invites")
  public Page<Dtos.Invite> invites(
      @AuthenticationPrincipal Jwt j,
      @PathVariable UUID g,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    policy.admin(g, user(j));
    var result = page("group_invites", g, page, size, "");
    result.items().forEach(r -> r.remove("token_hash"));
    return typed(result, Dtos.Invite.class);
  }

  @PostMapping("/groups/{g}/invites")
  @Transactional
  public Map<String, Object> invite(@AuthenticationPrincipal Jwt j, @PathVariable UUID g) {
    policy.admin(g, user(j));
    byte[] random = new byte[32];
    new SecureRandom().nextBytes(random);
    String token = Base64.getUrlEncoder().withoutPadding().encodeToString(random);
    UUID id = UUID.randomUUID();
    db.update(
        "insert into group_invites(id,group_id,token_hash,created_by,expires_at)"
            + " values(?,?,?,?,now()+interval '7 days')",
        id,
        g,
        hash(token),
        user(j));
    audit(g, user(j), "invite.create", id);
    return Map.of("id", id, "token", token, "expires_at", Instant.now().plusSeconds(604800));
  }

  @DeleteMapping("/groups/{g}/invites/{id}")
  @Transactional
  public Map<String, Boolean> revoke(
      @AuthenticationPrincipal Jwt j, @PathVariable UUID g, @PathVariable UUID id) {
    policy.admin(g, user(j));
    one("group_invites", g, id);
    db.update("update group_invites set revoked_at=now() where group_id=? and id=?", g, id);
    audit(g, user(j), "invite.revoke", id);
    return Map.of("deleted", true);
  }

  @PostMapping("/invites/join")
  @Transactional
  public Dtos.Group join(@AuthenticationPrincipal Jwt j, @Valid @RequestBody JoinInput b) {
    var rows =
        db.queryForList(
            "select * from group_invites where token_hash=? and expires_at>now() and used_at is"
                + " null and revoked_at is null for update",
            hash(b.token()));
    if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    UUID g = (UUID) rows.getFirst().get("group_id");
    db.update(
        "insert into group_members(group_id,user_id,role) values(?,?,'member') on conflict do"
            + " nothing",
        g,
        user(j));
    db.update("update group_invites set used_at=now() where id=?", rows.getFirst().get("id"));
    audit(g, user(j), "invite.join", user(j));
    return group(j, g);
  }

  @GetMapping("/groups/{g}/posts")
  public Page<Dtos.Post> posts(
      @AuthenticationPrincipal Jwt j,
      @PathVariable UUID g,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    policy.member(g, user(j));
    return typed(page("posts", g, page, size, ""), Dtos.Post.class);
  }

  @GetMapping("/groups/{g}/posts/{id}")
  public Dtos.Post post(
      @AuthenticationPrincipal Jwt j, @PathVariable UUID g, @PathVariable UUID id) {
    policy.member(g, user(j));
    return dto(Dtos.Post.class, one("posts", g, id));
  }

  @PostMapping("/groups/{g}/posts")
  @Transactional
  public Dtos.Post createPost(
      @AuthenticationPrincipal Jwt j, @PathVariable UUID g, @Valid @RequestBody PostInput b) {
    policy.member(g, user(j));
    if (b.kind().equals("notice")) policy.admin(g, user(j));
    UUID id = UUID.randomUUID();
    db.update(
        "insert into posts(id,group_id,author_id,title,body,kind) values(?,?,?,?,?,?)",
        id,
        g,
        user(j),
        b.title(),
        b.body(),
        b.kind());
    audit(g, user(j), "post.create", id);
    return dto(Dtos.Post.class, one("posts", g, id));
  }

  @PatchMapping("/groups/{g}/posts/{id}")
  @Transactional
  public Dtos.Post updatePost(
      @AuthenticationPrincipal Jwt j,
      @PathVariable UUID g,
      @PathVariable UUID id,
      @Valid @RequestBody PostInput b) {
    edit("posts", g, id, user(j));
    if (b.kind().equals("notice")) policy.admin(g, user(j));
    db.update(
        "update posts set title=?,body=?,kind=? where group_id=? and id=?",
        b.title(),
        b.body(),
        b.kind(),
        g,
        id);
    audit(g, user(j), "post.update", id);
    return dto(Dtos.Post.class, one("posts", g, id));
  }

  @DeleteMapping("/groups/{g}/posts/{id}")
  @Transactional
  public Map<String, Boolean> deletePost(
      @AuthenticationPrincipal Jwt j, @PathVariable UUID g, @PathVariable UUID id) {
    edit("posts", g, id, user(j));
    db.update("delete from posts where group_id=? and id=?", g, id);
    audit(g, user(j), "post.delete", id);
    return Map.of("deleted", true);
  }

  @GetMapping("/groups/{g}/posts/{p}/comments")
  public Page<Dtos.Comment> comments(
      @AuthenticationPrincipal Jwt j,
      @PathVariable UUID g,
      @PathVariable UUID p,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    policy.member(g, user(j));
    one("posts", g, p);
    return typed(page("comments", g, page, size, "and post_id=?", p), Dtos.Comment.class);
  }

  @PostMapping("/groups/{g}/posts/{p}/comments")
  @Transactional
  public Dtos.Comment comment(
      @AuthenticationPrincipal Jwt j,
      @PathVariable UUID g,
      @PathVariable UUID p,
      @Valid @RequestBody CommentInput b) {
    policy.member(g, user(j));
    one("posts", g, p);
    UUID id = UUID.randomUUID();
    db.update(
        "insert into comments(id,group_id,post_id,author_id,body) values(?,?,?,?,?)",
        id,
        g,
        p,
        user(j),
        b.body());
    return dto(Dtos.Comment.class, one("comments", g, id));
  }

  @PatchMapping("/groups/{g}/posts/{p}/comments/{id}")
  @Transactional
  public Dtos.Comment updateComment(
      @AuthenticationPrincipal Jwt j,
      @PathVariable UUID g,
      @PathVariable UUID p,
      @PathVariable UUID id,
      @Valid @RequestBody CommentInput b) {
    edit("comments", g, id, user(j));
    if (!one("comments", g, id).get("post_id").equals(p))
      throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    db.update(
        "update comments set body=? where group_id=? and post_id=? and id=?", b.body(), g, p, id);
    return dto(Dtos.Comment.class, one("comments", g, id));
  }

  @DeleteMapping("/groups/{g}/posts/{p}/comments/{id}")
  @Transactional
  public Map<String, Boolean> deleteComment(
      @AuthenticationPrincipal Jwt j,
      @PathVariable UUID g,
      @PathVariable UUID p,
      @PathVariable UUID id) {
    edit("comments", g, id, user(j));
    if (!one("comments", g, id).get("post_id").equals(p))
      throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    db.update("delete from comments where group_id=? and post_id=? and id=?", g, p, id);
    audit(g, user(j), "comment.delete", id);
    return Map.of("deleted", true);
  }

  @GetMapping("/groups/{g}/events")
  public Page<Dtos.Event> events(
      @AuthenticationPrincipal Jwt j,
      @PathVariable UUID g,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size,
      @RequestParam(required = false) Instant from) {
    policy.member(g, user(j));
    return typed(
        from == null
            ? page("events", g, page, size, "")
            : page("events", g, page, size, "and ends_at>=?", java.sql.Timestamp.from(from)),
        Dtos.Event.class);
  }

  @GetMapping("/groups/{g}/events/{id}")
  public Dtos.Event event(
      @AuthenticationPrincipal Jwt j, @PathVariable UUID g, @PathVariable UUID id) {
    policy.member(g, user(j));
    return dto(Dtos.Event.class, one("events", g, id));
  }

  void validateEvent(EventInput b) {
    if (!b.ends_at().isAfter(b.starts_at())) throw new IllegalArgumentException();
  }

  @PostMapping("/groups/{g}/events")
  @Transactional
  public Dtos.Event createEvent(
      @AuthenticationPrincipal Jwt j, @PathVariable UUID g, @Valid @RequestBody EventInput b) {
    policy.member(g, user(j));
    validateEvent(b);
    UUID id = UUID.randomUUID();
    db.update(
        "insert into events(id,group_id,author_id,title,description,location,starts_at,ends_at)"
            + " values(?,?,?,?,?,?,?,?)",
        id,
        g,
        user(j),
        b.title(),
        Objects.toString(b.description(), ""),
        Objects.toString(b.location(), ""),
        java.sql.Timestamp.from(b.starts_at()),
        java.sql.Timestamp.from(b.ends_at()));
    audit(g, user(j), "event.create", id);
    return dto(Dtos.Event.class, one("events", g, id));
  }

  @PatchMapping("/groups/{g}/events/{id}")
  @Transactional
  public Dtos.Event updateEvent(
      @AuthenticationPrincipal Jwt j,
      @PathVariable UUID g,
      @PathVariable UUID id,
      @Valid @RequestBody EventInput b) {
    edit("events", g, id, user(j));
    validateEvent(b);
    db.update(
        "update events set title=?,description=?,location=?,starts_at=?,ends_at=? where group_id=?"
            + " and id=?",
        b.title(),
        Objects.toString(b.description(), ""),
        Objects.toString(b.location(), ""),
        java.sql.Timestamp.from(b.starts_at()),
        java.sql.Timestamp.from(b.ends_at()),
        g,
        id);
    audit(g, user(j), "event.update", id);
    return dto(Dtos.Event.class, one("events", g, id));
  }

  @DeleteMapping("/groups/{g}/events/{id}")
  @Transactional
  public Map<String, Boolean> deleteEvent(
      @AuthenticationPrincipal Jwt j, @PathVariable UUID g, @PathVariable UUID id) {
    edit("events", g, id, user(j));
    db.update("delete from events where group_id=? and id=?", g, id);
    audit(g, user(j), "event.delete", id);
    return Map.of("deleted", true);
  }

  @GetMapping("/groups/{g}/events/{id}/attendance")
  public List<Map<String, Object>> attendance(
      @AuthenticationPrincipal Jwt j, @PathVariable UUID g, @PathVariable UUID id) {
    policy.member(g, user(j));
    one("events", g, id);
    return db.queryForList(
        "select user_id,status from event_attendees where group_id=? and event_id=?", g, id);
  }

  @PutMapping("/groups/{g}/events/{id}/attendance")
  public Map<String, Boolean> attend(
      @AuthenticationPrincipal Jwt j,
      @PathVariable UUID g,
      @PathVariable UUID id,
      @Valid @RequestBody AttendanceInput b) {
    policy.member(g, user(j));
    one("events", g, id);
    db.update(
        "insert into event_attendees(group_id,event_id,user_id,status) values(?,?,?,?) on"
            + " conflict(group_id,event_id,user_id) do update set status=excluded.status",
        g,
        id,
        user(j),
        b.status());
    return Map.of("updated", true);
  }

  @GetMapping("/groups/{g}/documents")
  public Page<Dtos.Document> documents(
      @AuthenticationPrincipal Jwt j,
      @PathVariable UUID g,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    policy.member(g, user(j));
    var result = page("documents", g, page, size, "");
    result
        .items()
        .forEach(
            r -> {
              r.remove("storage_path");
              r.remove("text_content");
            });
    return typed(result, Dtos.Document.class);
  }

  @GetMapping("/groups/{g}/documents/{id}")
  public Dtos.Document document(
      @AuthenticationPrincipal Jwt j, @PathVariable UUID g, @PathVariable UUID id) {
    policy.member(g, user(j));
    var row = one("documents", g, id);
    row.remove("storage_path");
    return dto(Dtos.Document.class, row);
  }

  @PostMapping("/groups/{g}/documents")
  @Transactional
  public Dtos.Document memo(
      @AuthenticationPrincipal Jwt j, @PathVariable UUID g, @Valid @RequestBody MemoInput b) {
    policy.admin(g, user(j));
    UUID id = UUID.randomUUID();
    db.update(
        "insert into documents(id,group_id,author_id,title,kind,text_content)"
            + " values(?,?,?,?,'memo',?)",
        id,
        g,
        user(j),
        b.title(),
        b.text());
    audit(g, user(j), "document.create", id);
    return document(j, g, id);
  }

  @PatchMapping("/groups/{g}/documents/{id}")
  @Transactional
  public Dtos.Document updateDocument(
      @AuthenticationPrincipal Jwt j,
      @PathVariable UUID g,
      @PathVariable UUID id,
      @Valid @RequestBody DocumentInput b) {
    policy.admin(g, user(j));
    var d = one("documents", g, id);
    if (d.get("kind").equals("memo")) {
      if (b.text() == null || b.text().isBlank()) throw new IllegalArgumentException();
      db.update(
          "update documents set"
              + " title=?,text_content=?,version=version+1,status='pending',error_code=null where"
              + " group_id=? and id=?",
          b.title(),
          b.text(),
          g,
          id);
    } else {
      db.update("update documents set title=? where group_id=? and id=?", b.title(), g, id);
    }
    audit(g, user(j), "document.update", id);
    return document(j, g, id);
  }

  @PostMapping("/groups/{g}/documents/uploads")
  @Transactional
  public Dtos.Upload upload(
      @AuthenticationPrincipal Jwt j, @PathVariable UUID g, @Valid @RequestBody UploadInput b) {
    policy.admin(g, user(j));
    if (!b.filename().toLowerCase(Locale.ROOT).endsWith(".pdf")
        || b.filename().contains("/")
        || b.filename().contains("\\")
        || b.filename().contains("..")) throw new IllegalArgumentException();
    UUID id = UUID.randomUUID();
    String path = g + "/" + id + ".pdf";
    String url = integration.uploadUrl(path);
    db.update(
        "insert into documents(id,group_id,author_id,title,kind,storage_path,size_bytes)"
            + " values(?,?,?,?,'pdf',?,?)",
        id,
        g,
        user(j),
        b.title(),
        path,
        b.size());
    audit(g, user(j), "document.upload", id);
    return new Dtos.Upload(document(j, g, id), url, 7200);
  }

  @PostMapping({"/groups/{g}/documents/{id}/index", "/groups/{g}/documents/{id}/complete"})
  public Dtos.Document index(
      @AuthenticationPrincipal Jwt j, @PathVariable UUID g, @PathVariable UUID id) {
    policy.admin(g, user(j));
    var d = one("documents", g, id);
    integration.index(g, user(j), d);
    audit(g, user(j), "document.index", id);
    return document(j, g, id);
  }

  @GetMapping("/groups/{g}/documents/{id}/download")
  public Map<String, String> download(
      @AuthenticationPrincipal Jwt j, @PathVariable UUID g, @PathVariable UUID id) {
    policy.member(g, user(j));
    var d = one("documents", g, id);
    if (!d.get("kind").equals("pdf")) throw new IllegalArgumentException();
    return Map.of("url", integration.downloadUrl(d.get("storage_path").toString()));
  }

  @DeleteMapping("/groups/{g}/documents/{id}")
  @Transactional
  public Map<String, Boolean> deleteDocument(
      @AuthenticationPrincipal Jwt j, @PathVariable UUID g, @PathVariable UUID id) {
    policy.admin(g, user(j));
    var d = one("documents", g, id);
    if (d.get("kind").equals("pdf")) integration.deleteFile(d.get("storage_path").toString());
    db.update("delete from documents where group_id=? and id=?", g, id);
    audit(g, user(j), "document.delete", id);
    return Map.of("deleted", true);
  }

  @GetMapping("/groups/{g}/chat/sessions")
  public Page<Dtos.Session> sessions(
      @AuthenticationPrincipal Jwt j,
      @PathVariable UUID g,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    policy.member(g, user(j));
    return typed(
        page("chat_sessions", g, page, size, "and user_id=?", user(j)), Dtos.Session.class);
  }

  @PostMapping("/groups/{g}/chat/sessions")
  public Dtos.Session createSession(
      @AuthenticationPrincipal Jwt j, @PathVariable UUID g, @Valid @RequestBody SessionInput b) {
    policy.member(g, user(j));
    UUID id = UUID.randomUUID();
    db.update(
        "insert into chat_sessions(id,group_id,user_id,title) values(?,?,?,?)",
        id,
        g,
        user(j),
        b.title());
    return session(j, g, id);
  }

  @GetMapping("/groups/{g}/chat/sessions/{id}")
  public Dtos.Session session(
      @AuthenticationPrincipal Jwt j, @PathVariable UUID g, @PathVariable UUID id) {
    policy.member(g, user(j));
    var rows =
        db.queryForList(
            "select * from chat_sessions where group_id=? and id=? and user_id=?", g, id, user(j));
    if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    return dto(Dtos.Session.class, rows.getFirst());
  }

  @DeleteMapping("/groups/{g}/chat/sessions/{id}")
  public Map<String, Boolean> deleteSession(
      @AuthenticationPrincipal Jwt j, @PathVariable UUID g, @PathVariable UUID id) {
    session(j, g, id);
    db.update("delete from chat_sessions where group_id=? and id=? and user_id=?", g, id, user(j));
    return Map.of("deleted", true);
  }

  @GetMapping("/groups/{g}/chat/sessions/{id}/messages")
  public Page<Dtos.Message> messages(
      @AuthenticationPrincipal Jwt j,
      @PathVariable UUID g,
      @PathVariable UUID id,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    session(j, g, id);
    var result = page("chat_messages", g, page, size, "and session_id=?", id);
    result
        .items()
        .forEach(
            r -> {
              try {
                r.put(
                    "citations",
                    integration.json.readValue(r.get("citations").toString(), List.class));
              } catch (Exception e) {
                r.put("citations", List.of());
              }
            });
    return typed(result, Dtos.Message.class);
  }

  @PostMapping("/groups/{g}/chat/sessions/{id}/messages")
  @Transactional
  public Dtos.Answer ask(
      @AuthenticationPrincipal Jwt j,
      @PathVariable UUID g,
      @PathVariable UUID id,
      @Valid @RequestBody QuestionInput b) {
    session(j, g, id);
    var result = integration.query(g, user(j), id, b.question());
    session(j, g, id);
    db.update(
        "insert into chat_messages(group_id,session_id,role,content) values(?,?,'user',?)",
        g,
        id,
        b.question());
    String citations;
    try {
      citations = integration.json.writeValueAsString(result.getOrDefault("citations", List.of()));
    } catch (Exception e) {
      throw new IllegalStateException();
    }
    db.update(
        "insert into chat_messages(group_id,session_id,role,content,citations,grounded)"
            + " values(?,?,'assistant',?,?::jsonb,?)",
        g,
        id,
        result.get("answer"),
        citations,
        result.get("grounded"));
    return dto(Dtos.Answer.class, result);
  }
}
