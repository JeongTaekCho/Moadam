package com.moadam.post.repository;

import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class PostRepository {
  private final JdbcTemplate db;

  public PostRepository(JdbcTemplate db) {
    this.db = db;
  }

  public int deletePost(UUID group, UUID id) {
    return db.update("delete from posts where group_id=? and id=?", group, id);
  }

  public int updatePost(String title, String body, String kind, UUID group, UUID id) {
    return db.update(
        "update posts set title=?,body=?,kind=? where group_id=? and id=?",
        title,
        body,
        kind,
        group,
        id);
  }

  public int insertPost(UUID id, UUID group, UUID author, String title, String body, String kind) {
    return db.update(
        "insert into posts(id,group_id,author_id,title,body,kind) values(?,?,?,?,?,?)",
        id,
        group,
        author,
        title,
        body,
        kind);
  }
}
