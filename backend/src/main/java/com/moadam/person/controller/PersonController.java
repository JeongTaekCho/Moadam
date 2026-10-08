package com.moadam.person.controller;

import com.moadam.common.dto.Page;
import com.moadam.person.dto.PersonActivityResponse;
import com.moadam.person.dto.PersonCreateRequest;
import com.moadam.person.dto.PersonResponse;
import com.moadam.person.service.PersonService;
import jakarta.validation.Valid;
import java.util.UUID;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/v1")
public class PersonController {
  private final PersonService service;

  public PersonController(PersonService service) {
    this.service = service;
  }

  @GetMapping("/me")
  public PersonResponse me(@AuthenticationPrincipal Jwt jwt) {
    return service.me(jwt);
  }

  @PatchMapping("/me")
  public PersonResponse update(
      @AuthenticationPrincipal Jwt jwt, @Valid @RequestBody PersonCreateRequest input) {
    return service.update(jwt, input);
  }

  @GetMapping("/me/activity")
  public Page<PersonActivityResponse> activity(
      @AuthenticationPrincipal Jwt jwt,
      @RequestParam(defaultValue = "posts") String type,
      @RequestParam(defaultValue = "0") int page,
      @RequestParam(defaultValue = "20") int size) {
    return service.activity(jwt, type, page, size);
  }

  @PostMapping(value = "/me/avatar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
  public PersonResponse upload(
      @AuthenticationPrincipal Jwt jwt, @RequestPart("file") MultipartFile file) {
    return service.upload(jwt, file);
  }

  @DeleteMapping("/me/avatar")
  public PersonResponse clearAvatar(@AuthenticationPrincipal Jwt jwt) {
    return service.clearAvatar(jwt);
  }

  @GetMapping("/profiles/{id}/avatar")
  public ResponseEntity<byte[]> avatar(@AuthenticationPrincipal Jwt jwt, @PathVariable UUID id) {
    return service.avatar(jwt, id);
  }
}
