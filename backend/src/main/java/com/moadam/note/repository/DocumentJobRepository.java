package com.moadam.note.repository;

import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class DocumentJobRepository {
  private static final org.slf4j.Logger log =
      org.slf4j.LoggerFactory.getLogger(DocumentJobRepository.class);
  private final JdbcTemplate db;

  public DocumentJobRepository(JdbcTemplate db) {
    this.db = db;
  }

  public void lockGroup(UUID group) {
    if (db.queryForList("select id from groups where id=? for update", group).isEmpty())
      throw new org.springframework.web.server.ResponseStatusException(
          org.springframework.http.HttpStatus.NOT_FOUND);
  }

  public Map<String, Object> capacity(UUID group) {
    return db.queryForMap(
        "select (select count(*) from documents where group_id=?)+(select count(*) from document_jobs where group_id=? and kind='delete' and status<>'done') as count, coalesce((select sum(case when kind='pdf' then 20971520 else octet_length(text_content) end) from documents where group_id=?),0)+20971520*(select count(*) from document_jobs where group_id=? and kind='delete' and status<>'done') as bytes",
        group,
        group,
        group,
        group);
  }

  public boolean budget(UUID user, boolean upload, int limit) {
    String column = upload ? "uploaded" : "indexed";
    var rows =
        db.queryForList(
            "insert into document_daily_usage(user_id,usage_date,"
                + column
                + ") values(?,(current_timestamp at time zone 'Asia/Seoul')::date,1) on conflict(user_id,usage_date) do update set "
                + column
                + "=document_daily_usage."
                + column
                + "+1 where document_daily_usage."
                + column
                + "<? returning "
                + column
                + " as used",
            user,
            limit);
    if (rows.isEmpty()) {
      log.warn("Document daily limit reached: kind={} limit={}", column, limit);
      return false;
    }
    int used = ((Number) rows.getFirst().get("used")).intValue();
    if (used >= Math.ceil(limit * 0.8))
      log.warn("Document daily usage near limit: kind={} used={} limit={}", column, used, limit);
    return true;
  }

  public Map<String, Object> lockDocument(UUID group, UUID id) {
    var rows =
        db.queryForList("select * from documents where group_id=? and id=? for update", group, id);
    return rows.isEmpty() ? null : rows.getFirst();
  }

  public java.util.Set<UUID> activeDocuments(UUID group) {
    return new java.util.HashSet<>(
        db.queryForList(
            "select distinct j.document_id from document_jobs j join documents d on d.group_id=j.group_id and d.id=j.document_id and d.version=j.version where j.group_id=? and j.kind='index' and j.status in ('queued','running')",
            UUID.class,
            group));
  }

  public boolean active(UUID id, int version) {
    return Boolean.TRUE.equals(
        db.queryForObject(
            "select exists(select 1 from document_jobs where document_id=? and version=? and kind='index' and status in ('queued','running'))",
            Boolean.class,
            id,
            version));
  }

  public void enqueue(UUID group, UUID id, UUID user, int version) {
    db.update(
        "update document_jobs set status='done',lease_token=null,updated_at=now() where document_id=? and kind='index' and version<>? and status in ('queued','running')",
        id,
        version);
    db.update(
        "insert into document_jobs(kind,group_id,document_id,user_id,version) values('index',?,?,?,?) on conflict(kind,document_id,version) do update set status='queued',attempts=0,run_after=now(),lease_token=null,lease_until=null,error_code=null,updated_at=now()",
        group,
        id,
        user,
        version);
    db.update(
        "update documents set status='pending',error_code=null where group_id=? and id=? and version=?",
        group,
        id,
        version);
  }

  public void completeUpload(UUID group, UUID id) {
    db.update("update documents set upload_completed=true where group_id=? and id=?", group, id);
  }

  public void uploadedSize(UUID group, UUID id, long bytes) {
    db.update(
        "update documents set size_bytes=?,upload_completed=true where group_id=? and id=?",
        bytes,
        group,
        id);
  }

  public void reopenUpload(UUID group, UUID id) {
    db.update(
        "update documents set upload_completed=false,upload_expires_at=now()+interval '2 hours',status='pending',error_code='UPLOAD_INCOMPLETE',version=version+case when upload_completed then 1 else 0 end where group_id=? and id=?",
        group,
        id);
    db.update(
        "update document_jobs set status='done',lease_token=null where group_id=? and document_id=? and kind='index' and status in ('queued','running')",
        group,
        id);
  }

  public void beginUpload(UUID id) {
    db.update(
        "update documents set upload_completed=false,upload_expires_at=now()+interval '2 hours' where id=?",
        id);
  }

  public void renewUpload(UUID id) {
    db.update(
        "update documents set upload_expires_at=now()+interval '2 hours' where id=? and not upload_completed",
        id);
  }

  static Object sqlTime(Object value) {
    return value instanceof java.time.Instant instant ? java.sql.Timestamp.from(instant) : value;
  }

  public void cleanupFile(Map<String, Object> document) {
    if (document.get("storage_path") == null) return;
    db.update(
        "insert into document_jobs(kind,group_id,document_id,version,storage_path,run_after) values('delete',?,?,0,?,greatest(now(),coalesce(?::timestamptz,?::timestamptz+interval '2 hours'))+interval '5 minutes') on conflict(kind,document_id,version) do nothing",
        document.get("group_id"),
        document.get("id"),
        document.get("storage_path"),
        sqlTime(document.get("upload_expires_at")),
        sqlTime(document.get("created_at")));
  }

  public List<Map<String, Object>> groupFiles(UUID group) {
    return db.queryForList("select * from documents where group_id=? and kind='pdf'", group);
  }

  public List<Map<String, Object>> expiredUploads() {
    return db.queryForList(
        "select * from documents where not upload_completed and upload_expires_at<now() order by upload_expires_at limit 25 for update skip locked");
  }

  public void removeDocument(UUID group, UUID id) {
    db.update("delete from documents where group_id=? and id=?", group, id);
    db.update(
        "update document_jobs set status='done',lease_token=null where document_id=? and kind='index'",
        id);
  }

  public List<Map<String, Object>> claim(UUID token) {
    return db.queryForList(
        "with candidate as (select id from document_jobs where run_after<=now() and (status='queued' or (status='running' and lease_until<now())) order by run_after for update skip locked limit 1) update document_jobs j set status='running',lease_token=?,lease_until=now()+interval '10 minutes',attempts=attempts+1,updated_at=now() from candidate c where j.id=c.id returning j.*",
        token);
  }

  public void finish(UUID id, UUID token) {
    db.update(
        "update document_jobs set status='done',lease_token=null,lease_until=null,error_code=null,updated_at=now() where id=? and lease_token=?",
        id,
        token);
  }

  public void fail(UUID id, UUID token, String code, boolean retry, int delay) {
    db.update(
        "update document_jobs set status=?,run_after=now()+?*interval '1 second',lease_token=null,lease_until=null,error_code=?,updated_at=now() where id=? and lease_token=?",
        retry ? "queued" : "failed",
        delay,
        code,
        id,
        token);
  }

  public Map<String, Object> currentDocument(UUID group, UUID id) {
    var rows = db.queryForList("select * from documents where group_id=? and id=?", group, id);
    return rows.isEmpty() ? null : rows.getFirst();
  }

  public void failedDocument(UUID group, UUID id, int version, String code) {
    db.update(
        "update documents set status='failed',error_code=? where group_id=? and id=? and version=? and status<>'ready'",
        code,
        group,
        id,
        version);
  }

  public void retryDocument(UUID group, UUID id, int version, String code) {
    db.update(
        "update documents set status='pending',error_code=? where group_id=? and id=? and version=? and status<>'ready'",
        code,
        group,
        id,
        version);
  }

  public void registerOrphanFiles() {
    db.update(
        "insert into document_jobs(kind,group_id,document_id,version,storage_path,run_after) select 'delete',split_part(o.name,'/',1)::uuid,substring(split_part(o.name,'/',2) from 1 for 36)::uuid,0,o.name,now()+interval '3 hours' from storage.objects o where o.bucket_id='group-documents' and o.name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.pdf$' and o.created_at<now()-interval '24 hours' and not exists(select 1 from documents d where d.storage_path=o.name) and not exists(select 1 from document_jobs j where j.storage_path=o.name and j.kind='delete') order by o.created_at limit 25 on conflict(kind,document_id,version) do nothing");
  }

  public void trimHistory() {
    db.update(
        "delete from document_jobs where status='done' and updated_at<now()-interval '30 days'");
    db.update(
        "delete from document_daily_usage where usage_date<(current_timestamp at time zone 'Asia/Seoul')::date-30");
  }
}
