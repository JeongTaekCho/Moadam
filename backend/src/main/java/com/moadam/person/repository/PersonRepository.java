package com.moadam.person.repository;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class PersonRepository {
  private final JdbcTemplate db;

  public PersonRepository(JdbcTemplate db) {
    this.db = db;
  }

  public Boolean canViewAvatar(UUID viewer, UUID author) {
    return db.queryForObject(
        "select exists(select 1 from group_members viewer where viewer.user_id=? and (exists(select"
            + " 1 from group_members author where author.group_id=viewer.group_id and"
            + " author.user_id=?) or exists(select 1 from posts where group_id=viewer.group_id and"
            + " author_id=?) or exists(select 1 from documents where group_id=viewer.group_id and"
            + " author_id=?) or exists(select 1 from comments where group_id=viewer.group_id and"
            + " author_id=?) or exists(select 1 from events where group_id=viewer.group_id and"
            + " author_id=?)))",
        Boolean.class,
        viewer,
        author,
        author,
        author,
        author,
        author);
  }

  public List<Map<String, Object>> findAvatarPaths(UUID id) {
    return db.queryForList("select avatar_path from profiles where id=?", id);
  }

  public List<Map<String, Object>> clearAvatarPath(UUID user) {
    return db.queryForList(
        "with old as (select avatar_path from profiles where id=? for update), changed as (update"
            + " profiles set avatar_path=null,updated_at=now() where id=? returning id) select"
            + " old.avatar_path from old,changed",
        user,
        user);
  }

  public Map<String, Object> findAvatarPath(UUID id) {
    return db.queryForMap("select avatar_path from profiles where id=?", id);
  }

  public int updateAvatarPath(String path, UUID id) {
    return db.update("update profiles set avatar_path=?,updated_at=now() where id=?", path, id);
  }

  public int updateDisplayName(String name, UUID id) {
    return db.update("update profiles set display_name=?,updated_at=now() where id=?", name, id);
  }

  public int ensurePerson(UUID id, String name) {
    return db.update(
        "insert into profiles(id,display_name) values(?,?) on conflict(id) do nothing", id, name);
  }

  public Map<String, Object> findPerson(UUID id) {
    return db.queryForMap(
        "select p.*,u.created_at as account_created_at from profiles p join auth.users u on"
            + " u.id=p.id where p.id=?",
        id);
  }

  public void enrich(List<Map<String, Object>> rows, String idKey, String resultKey) {
    PersonProfileMapper.enrich(db, rows, idKey, resultKey);
  }

  public com.moadam.common.dto.Page<Map<String, Object>> activity(
      UUID user, String type, int page, int size) {
    if (!List.of("posts", "documents").contains(type) || page < 0 || size < 1 || size > 100)
      throw new IllegalArgumentException();
    String where =
        " from "
            + type
            + " r join groups g on g.id=r.group_id join group_members m on m.group_id=r.group_id"
            + " and m.user_id=? where r.author_id=?";
    long total = db.queryForObject("select count(*)" + where, Long.class, user, user);
    var rows =
        db.queryForList(
            "select r.id,r.group_id,g.name as group_name,r.title,r.kind,r.created_at"
                + where
                + " order by r.created_at desc,r.id desc limit ? offset ?",
            user,
            user,
            size,
            (long) page * size);
    return new com.moadam.common.dto.Page<>(rows, page, size, total);
  }
}
