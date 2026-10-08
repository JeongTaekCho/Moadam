package com.moadam.group.repository;

import java.util.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class GroupRepository {
  private final JdbcTemplate db;

  public GroupRepository(JdbcTemplate db) {
    this.db = db;
  }

  public List<Map<String, Object>> lockActiveInvite(String hash) {
    return db.queryForList(
        "select * from group_invites where token_hash=? and expires_at>now() and used_at is"
            + " null and revoked_at is null for update",
        hash);
  }

  public int insertMember(UUID group, UUID user) {
    return db.update(
        "insert into group_members(group_id,user_id,role) values(?,?,'member') on conflict do"
            + " nothing",
        group,
        user);
  }

  public int markInviteUsed(UUID id) {
    return db.update("update group_invites set used_at=now() where id=?", id);
  }

  public int revokeInvite(UUID group, UUID id) {
    return db.update(
        "update group_invites set revoked_at=now() where group_id=? and id=?", group, id);
  }

  public int insertInvite(UUID id, UUID group, String hash, UUID creator) {
    return db.update(
        "insert into group_invites(id,group_id,token_hash,created_by,expires_at)"
            + " values(?,?,?,?,now()+interval '7 days')",
        id,
        group,
        hash,
        creator);
  }

  public int deleteMembership(UUID group, UUID user) {
    return db.update("delete from group_members where group_id=? and user_id=?", group, user);
  }

  public int deleteMember(UUID group, UUID user) {
    return db.update("delete from group_members where group_id=? and user_id=?", group, user);
  }

  public int updateRole(String role, UUID group, UUID user) {
    return db.update(
        "update group_members set role=? where group_id=? and user_id=?", role, group, user);
  }

  public List<Map<String, Object>> findPdfPaths(UUID group) {
    return db.queryForList(
        "select storage_path from documents where group_id=? and kind='pdf'", group);
  }

  public int deleteGroup(UUID group) {
    return db.update("delete from groups where id=?", group);
  }

  public int updateGroup(String name, String timezone, UUID id) {
    return db.update("update groups set name=?,timezone=? where id=?", name, timezone, id);
  }

  public Map<String, Object> findGroup(UUID id) {
    return db.queryForMap("select * from groups where id=?", id);
  }

  public int insertGroup(UUID id, String name, String timezone) {
    return db.update("insert into groups(id,name,timezone) values(?,?,?)", id, name, timezone);
  }

  public int insertOwner(UUID group, UUID user) {
    return db.update("insert into group_members values(?,?, 'owner',now())", group, user);
  }

  public List<Map<String, Object>> findMembershipGroups(UUID user, int size, long offset) {
    return db.queryForList(
        "select g.*,m.role from groups g join group_members m on m.group_id=g.id where"
            + " m.user_id=? order by g.created_at limit ? offset ?",
        user,
        size,
        offset);
  }

  public Long countMembershipGroups(UUID user) {
    return db.queryForObject(
        "select count(*) from group_members where user_id=?", Long.class, user);
  }
}
