package com.moadam.auth;

import static org.junit.jupiter.api.Assertions.*;

import com.nimbusds.jose.*;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.*;
import com.nimbusds.jwt.*;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.security.*;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtException;

class SecurityTest {
  HttpServer server;
  RSAKey key;
  JwtDecoder decoder;
  String issuer;

  @BeforeEach
  void setup() throws Exception {
    var generator = KeyPairGenerator.getInstance("RSA");
    generator.initialize(2048);
    var pair = generator.generateKeyPair();
    key =
        new RSAKey.Builder((RSAPublicKey) pair.getPublic())
            .privateKey((RSAPrivateKey) pair.getPrivate())
            .keyID("test")
            .build();
    server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    issuer = "http://127.0.0.1:" + server.getAddress().getPort() + "/auth/v1";
    server.createContext(
        "/auth/v1/.well-known/jwks.json",
        exchange -> {
          var body = new JWKSet(key.toPublicJWK()).toString().getBytes();
          exchange.getResponseHeaders().add("Content-Type", "application/json");
          exchange.sendResponseHeaders(200, body.length);
          exchange.getResponseBody().write(body);
          exchange.close();
        });
    server.start();
    decoder = new SecurityConfig().decoder(issuer, "authenticated", "");
  }

  @AfterEach
  void stop() {
    server.stop(0);
  }

  String token(String iss, String audience, Instant expiration, RSAKey signingKey)
      throws Exception {
    var jwt =
        new SignedJWT(
            new JWSHeader.Builder(JWSAlgorithm.RS256).keyID("test").build(),
            new JWTClaimsSet.Builder()
                .subject(UUID.randomUUID().toString())
                .issuer(iss)
                .audience(audience)
                .issueTime(Date.from(Instant.now().minusSeconds(300)))
                .expirationTime(Date.from(expiration))
                .build());
    jwt.sign(new RSASSASigner(signingKey));
    return jwt.serialize();
  }

  @Test
  void validSignatureIssuerAudienceAndLifetime() throws Exception {
    assertNotNull(
        decoder.decode(token(issuer, "authenticated", Instant.now().plusSeconds(300), key)));
  }

  @Test
  void wrongIssuerRejected() {
    assertThrows(
        JwtException.class,
        () ->
            decoder.decode(
                token(
                    "https://other.example",
                    "authenticated",
                    Instant.now().plusSeconds(300),
                    key)));
  }

  @Test
  void wrongAudienceRejected() {
    assertThrows(
        JwtException.class,
        () -> decoder.decode(token(issuer, "other", Instant.now().plusSeconds(300), key)));
  }

  @Test
  void expiredRejected() {
    assertThrows(
        JwtException.class,
        () -> decoder.decode(token(issuer, "authenticated", Instant.now().minusSeconds(120), key)));
  }

  @Test
  void forgedSignatureRejected() throws Exception {
    var gen = KeyPairGenerator.getInstance("RSA");
    gen.initialize(2048);
    var pair = gen.generateKeyPair();
    var forged =
        new RSAKey.Builder((RSAPublicKey) pair.getPublic())
            .privateKey((RSAPrivateKey) pair.getPrivate())
            .build();
    assertThrows(
        JwtException.class,
        () ->
            decoder.decode(token(issuer, "authenticated", Instant.now().plusSeconds(300), forged)));
  }

  @Test
  void localHs256RequiresExplicitCorrectSecret() throws Exception {
    String secret = "a-local-test-secret-with-at-least-32-characters";
    var jwt =
        new SignedJWT(
            new JWSHeader(JWSAlgorithm.HS256),
            new JWTClaimsSet.Builder()
                .subject(UUID.randomUUID().toString())
                .issuer(issuer)
                .audience("authenticated")
                .expirationTime(Date.from(Instant.now().plusSeconds(300)))
                .build());
    jwt.sign(new com.nimbusds.jose.crypto.MACSigner(secret));
    assertNotNull(
        new SecurityConfig().decoder(issuer, "authenticated", secret).decode(jwt.serialize()));
    assertThrows(
        JwtException.class,
        () ->
            new SecurityConfig()
                .decoder(
                    issuer, "authenticated", "a-different-test-secret-with-at-least-32-characters")
                .decode(jwt.serialize()));
  }
}
