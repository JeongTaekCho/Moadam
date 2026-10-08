package com.moadam.note.repository;

import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class NoteRepository {
  private final JdbcTemplate db;

  public NoteRepository(JdbcTemplate db) {
    this.db = db;
  }

  public int deleteNote(UUID group, UUID id) {
    return db.update("delete from documents where group_id=? and id=?", group, id);
  }

  public int insertPdf(UUID id, UUID group, UUID author, String title, String path, long size) {
    return db.update(
        "insert into documents(id,group_id,author_id,title,kind,storage_path,size_bytes)"
            + " values(?,?,?,?,'pdf',?,?)",
        id,
        group,
        author,
        title,
        path,
        size);
  }

  public int updateMemo(String title, String text, UUID group, UUID id) {
    return db.update(
        "update documents set"
            + " title=?,text_content=?,version=version+1,status='pending',error_code=null where"
            + " group_id=? and id=?",
        title,
        text,
        group,
        id);
  }

  public int updatePdfTitle(String title, UUID group, UUID id) {
    return db.update("update documents set title=? where group_id=? and id=?", title, group, id);
  }

  public int insertMemo(UUID id, UUID group, UUID author, String title, String text) {
    return db.update(
        "insert into documents(id,group_id,author_id,title,kind,text_content)"
            + " values(?,?,?,?,'memo',?)",
        id,
        group,
        author,
        title,
        text);
  }

  public List<UUID> readyDocumentIds(UUID group) {
    return db.queryForList(
        "select id from documents where group_id=? and status='ready'", UUID.class, group);
  }

  public void markIndexUnavailable(UUID group, UUID id) {
    db.update(
        "update documents set status='failed',error_code='RAG_UNAVAILABLE' where group_id=? and"
            + " id=? and status<>'ready'",
        group,
        id);
  }

  public com.moadam.note.entity.Note findNote(UUID group, UUID id) {
    var rows = db.queryForList("select * from documents where group_id=? and id=?", group, id);
    if (rows.isEmpty())
      throw new org.springframework.web.server.ResponseStatusException(
          org.springframework.http.HttpStatus.NOT_FOUND);
    return com.moadam.note.entity.Note.fromRow(rows.getFirst());
  }
}
