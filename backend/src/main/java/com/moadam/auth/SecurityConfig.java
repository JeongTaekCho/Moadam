package com.moadam.auth;

import java.util.Arrays;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
public class SecurityConfig {
  @Bean
  JwtDecoder decoder(
      @Value("${app.issuer}") String issuer,
      @Value("${app.audience}") String audience,
      @Value("${app.jwt-secret:}") String secret) {
    NimbusJwtDecoder d;
    if (!secret.isBlank()) {
      d =
          NimbusJwtDecoder.withSecretKey(
                  new javax.crypto.spec.SecretKeySpec(
                      secret.getBytes(java.nio.charset.StandardCharsets.UTF_8), "HmacSHA256"))
              .macAlgorithm(org.springframework.security.oauth2.jose.jws.MacAlgorithm.HS256)
              .build();
    } else {
      d =
          NimbusJwtDecoder.withJwkSetUri(issuer + "/.well-known/jwks.json")
              .jwsAlgorithm(org.springframework.security.oauth2.jose.jws.SignatureAlgorithm.ES256)
              .jwsAlgorithm(org.springframework.security.oauth2.jose.jws.SignatureAlgorithm.RS256)
              .build();
    }
    d.setJwtValidator(
        new DelegatingOAuth2TokenValidator<>(
            JwtValidators.createDefaultWithIssuer(issuer),
            jwt ->
                jwt.getAudience().contains(audience)
                    ? OAuth2TokenValidatorResult.success()
                    : OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token"))));
    return d;
  }

  @Bean
  SecurityFilterChain filter(HttpSecurity h, @Value("${app.cors}") String origins)
      throws Exception {
    var c = new CorsConfiguration();
    c.setAllowedOrigins(Arrays.asList(origins.split(",")));
    c.setAllowedMethods(List.of("GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"));
    c.setAllowedHeaders(List.of("Authorization", "Content-Type", "X-Request-ID"));
    var source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/**", c);
    return h.csrf(x -> x.disable())
        .cors(x -> x.configurationSource(source))
        .sessionManagement(
            x ->
                x.sessionCreationPolicy(
                    org.springframework.security.config.http.SessionCreationPolicy.STATELESS))
        .authorizeHttpRequests(
            x ->
                x.dispatcherTypeMatchers(jakarta.servlet.DispatcherType.ASYNC)
                    .permitAll()
                    .requestMatchers("/v3/api-docs/**", "/swagger-ui/**", "/swagger-ui.html")
                    .permitAll()
                    .anyRequest()
                    .authenticated())
        .oauth2ResourceServer(
            x ->
                x.jwt(j -> {})
                    .authenticationEntryPoint(
                        (r, s, e) -> {
                          s.setStatus(401);
                          s.setContentType("application/json");
                          s.getWriter()
                              .write(
                                  "{\"code\":\"UNAUTHENTICATED\",\"message\":\"로그인이"
                                      + " 필요합니다\",\"requestId\":\""
                                      + Objects.toString(
                                          r.getAttribute("requestId"), UUID.randomUUID().toString())
                                      + "\"}");
                        }))
        .build();
  }
}
