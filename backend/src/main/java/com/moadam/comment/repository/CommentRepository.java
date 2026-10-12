package com.moadam.comment.repository;

import java.util.UUID;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class CommentRepository {
  private final JdbcTemplate db;

  public CommentRepository(JdbcTemplate db) {
    this.db = db;
  }

  public void insert(
      UUID id, UUID group, UUID post, UUID event, UUID author, String body, UUID parent) {
    db.update(
        "insert into comments(id,group_id,post_id,event_id,author_id,body,parent_id) values(?,?,?,?,?,?,?)",
        id,
        group,
        post,
        event,
        author,
        body,
        parent);
  }

  public void update(UUID group, UUID id, String body) {
    db.update(
        "update comments set body=? where group_id=? and id=? and not deleted", body, group, id);
  }

  public void delete(UUID group, UUID id) {
    db.update(
        "update comments set body='삭제된 댓글입니다',deleted=true where group_id=? and id=?", group, id);
  }
}
