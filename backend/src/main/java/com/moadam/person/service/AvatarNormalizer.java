package com.moadam.person.service;

import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.*;
import java.util.Locale;
import javax.imageio.ImageIO;

public final class AvatarNormalizer {
  private AvatarNormalizer() {}

  public static byte[] normalizeAvatar(byte[] bytes) throws IOException {
    if (bytes.length == 0 || bytes.length > 2097152) throw new IllegalArgumentException();
    try (var stream = ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
      var readers = ImageIO.getImageReaders(stream);
      if (!readers.hasNext()) throw new IllegalArgumentException();
      var reader = readers.next();
      try {
        reader.setInput(stream, true, true);
        if (!java.util.List.of("png", "jpeg", "jpg")
            .contains(reader.getFormatName().toLowerCase(Locale.ROOT)))
          throw new IllegalArgumentException();
        int w = reader.getWidth(0), h = reader.getHeight(0);
        if (w < 1 || h < 1 || w > 4096 || h > 4096 || (long) w * h > 16777216)
          throw new IllegalArgumentException();
        var original = reader.read(0);
        var avatar = new BufferedImage(512, 512, BufferedImage.TYPE_INT_ARGB);
        var graphics = avatar.createGraphics();
        try {
          graphics.setRenderingHint(
              RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
          int side = Math.min(w, h);
          graphics.drawImage(
              original,
              0,
              0,
              512,
              512,
              (w - side) / 2,
              (h - side) / 2,
              (w + side) / 2,
              (h + side) / 2,
              null);
        } finally {
          graphics.dispose();
        }
        var output = new ByteArrayOutputStream();
        ImageIO.write(avatar, "png", output);
        return output.toByteArray();
      } finally {
        reader.dispose();
      }
    }
  }
}
