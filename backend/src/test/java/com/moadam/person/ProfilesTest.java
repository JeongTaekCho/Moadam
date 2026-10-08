package com.moadam.person;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import com.moadam.common.storage.SupabaseStorageClient;
import com.moadam.person.repository.PersonRepository;
import com.moadam.person.service.*;
import java.awt.image.BufferedImage;
import java.io.*;
import java.util.UUID;
import javax.imageio.ImageIO;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.server.ResponseStatusException;

class ProfilesTest {
  @Test
  void avatarsAreDecodedCroppedAndReencoded() throws Exception {
    var bytes = new ByteArrayOutputStream();
    ImageIO.write(new BufferedImage(80, 40, BufferedImage.TYPE_INT_RGB), "jpeg", bytes);
    var result =
        ImageIO.read(
            new ByteArrayInputStream(AvatarNormalizer.normalizeAvatar(bytes.toByteArray())));
    assertEquals(512, result.getWidth());
    assertEquals(512, result.getHeight());
  }

  @Test
  void forgedAndOversizedImagesAreRejected() throws Exception {
    assertThrows(
        IllegalArgumentException.class,
        () -> AvatarNormalizer.normalizeAvatar("not-an-image".getBytes()));
    var bytes = new ByteArrayOutputStream();
    ImageIO.write(new BufferedImage(4097, 1, BufferedImage.TYPE_INT_RGB), "png", bytes);
    assertThrows(
        IllegalArgumentException.class,
        () -> AvatarNormalizer.normalizeAvatar(bytes.toByteArray()));
    assertThrows(
        IllegalArgumentException.class, () -> AvatarNormalizer.normalizeAvatar(new byte[2097153]));
  }

  @Test
  void privateAvatarRejectsAnUnrelatedViewerBeforeStorageAccess() {
    var db = mock(JdbcTemplate.class);
    var integrations = mock(SupabaseStorageClient.class);
    var jwt = mock(Jwt.class);
    UUID viewer = UUID.randomUUID();
    when(jwt.getSubject()).thenReturn(viewer.toString());
    when(db.queryForObject(anyString(), eq(Boolean.class), any(Object[].class))).thenReturn(false);
    var error =
        assertThrows(
            ResponseStatusException.class,
            () ->
                new PersonService(new PersonRepository(db), integrations, null, null, null, null)
                    .avatar(jwt, UUID.randomUUID()));
    assertEquals(403, error.getStatusCode().value());
    verifyNoInteractions(integrations);
  }
}
