package com.moadam.person.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.moadam.auth.MembershipPolicy;
import com.moadam.common.dto.DtoMapper;
import com.moadam.common.dto.Page;
import com.moadam.common.repository.ResourceRepository;
import com.moadam.common.service.DomainService;
import com.moadam.common.storage.SupabaseStorageClient;
import com.moadam.person.dto.PersonActivityResponse;
import com.moadam.person.dto.PersonCreateRequest;
import com.moadam.person.dto.PersonResponse;
import com.moadam.person.entity.Person;
import com.moadam.person.repository.*;
import jakarta.validation.constraints.*;
import java.io.IOException;
import java.security.*;
import java.time.*;
import java.util.*;
import org.springframework.http.*;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Service;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@Service
public class PersonService extends DomainService {
  private final PersonRepository repository;
  private final SupabaseStorageClient storage;

  public PersonService(
      PersonRepository repository,
      SupabaseStorageClient storage,
      ResourceRepository resources,
      DtoMapper mapper,
      MembershipPolicy policy,
      ObjectMapper json) {
    super(resources, mapper, policy, json);
    this.repository = repository;
    this.storage = storage;
  }

  public PersonResponse profile(Jwt jwt) {
    UUID id = user(jwt);
    String name = "멤버 " + id.toString().substring(0, 8);
    Map<String, Object> metadata = jwt.getClaimAsMap("user_metadata");
    if (metadata != null) {
      String proposed =
          Objects.toString(metadata.getOrDefault("full_name", metadata.get("name")), "").strip();
      if (!proposed.isBlank())
        name =
            proposed.substring(0, Math.min(30, proposed.length())).replaceAll("[\\p{Cntrl}]", "");
    }
    repository.ensurePerson(id, name);
    var row = repository.findPerson(id);
    var person = Person.fromRow(row);
    var publicProfile = PersonProfileMapper.publicProfile(person.id(), row);
    return new PersonResponse(
        id,
        Objects.toString(jwt.getClaimAsString("email"), ""),
        publicProfile.display_name(),
        publicProfile.avatar_url(),
        person.accountCreatedAt(),
        person.updatedAt());
  }

  public PersonResponse me(Jwt jwt) {
    return profile(jwt);
  }

  public PersonResponse update(Jwt jwt, PersonCreateRequest input) {
    String name = input.display_name().strip();
    if (name.isBlank() || name.codePoints().anyMatch(Character::isISOControl))
      throw new IllegalArgumentException();
    profile(jwt);
    repository.updateDisplayName(name, user(jwt));
    return profile(jwt);
  }

  public Page<PersonActivityResponse> activity(Jwt jwt, String type, int page, int size) {
    if (!List.of("posts", "documents").contains(type) || page < 0 || size < 1 || size > 100)
      throw new IllegalArgumentException();
    UUID id = user(jwt);
    return mapper.typed(repository.activity(id, type, page, size), PersonActivityResponse.class);
  }

  public PersonResponse upload(Jwt jwt, MultipartFile file) {
    if (file.getSize() > 2097152) throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE);
    byte[] png;
    try {
      png = AvatarNormalizer.normalizeAvatar(file.getBytes());
    } catch (IOException | IllegalArgumentException e) {
      throw new IllegalArgumentException("PNG/JPEG 이미지를 확인해 주세요");
    }
    profile(jwt);
    UUID id = user(jwt);
    String old = Objects.toString(repository.findAvatarPath(id).get("avatar_path"), "");
    String path = id + "/" + UUID.randomUUID() + ".png";
    storage.putAvatar(path, png);
    try {
      repository.updateAvatarPath(path, id);
    } catch (RuntimeException e) {
      storage.deleteAvatarQuietly(path);
      throw e;
    }
    if (!old.isBlank()) storage.deleteAvatarQuietly(old);
    return profile(jwt);
  }

  public PersonResponse clearAvatar(Jwt jwt) {
    profile(jwt);
    var rows = repository.clearAvatarPath(user(jwt));
    if (!rows.isEmpty() && rows.getFirst().get("avatar_path") != null)
      storage.deleteAvatarQuietly(rows.getFirst().get("avatar_path").toString());
    return profile(jwt);
  }

  public ResponseEntity<byte[]> avatar(Jwt jwt, UUID id) {
    UUID viewer = user(jwt);
    if (!viewer.equals(id)) {
      Boolean allowed = repository.canViewAvatar(viewer, id);
      if (!Boolean.TRUE.equals(allowed)) throw new ResponseStatusException(HttpStatus.FORBIDDEN);
    }
    var rows = repository.findAvatarPaths(id);
    if (rows.isEmpty() || rows.getFirst().get("avatar_path") == null)
      throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    return ResponseEntity.ok()
        .contentType(MediaType.IMAGE_PNG)
        .header("Cache-Control", "private, no-store")
        .body(storage.getAvatar(rows.getFirst().get("avatar_path").toString()));
  }
}
