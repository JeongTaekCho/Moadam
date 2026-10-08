package com.moadam.auth;

import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
public class MembershipPolicy {
  final MembershipRepository repository;

  public MembershipPolicy(MembershipRepository repository) {
    this.repository = repository;
  }

  public String member(UUID g, UUID u) {
    var rows = repository.findRole(g, u);
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
