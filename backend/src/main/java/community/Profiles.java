package community;

import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import java.time.Instant;
import java.io.*;
import java.awt.*;
import java.awt.image.BufferedImage;
import javax.imageio.ImageIO;
import org.springframework.http.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/v1")
public class Profiles {
  final JdbcTemplate db;
  final Integrations integration;
  public Profiles(JdbcTemplate db, Integrations integration) { this.db=db; this.integration=integration; }
  UUID user(Jwt jwt) { return UUID.fromString(jwt.getSubject()); }
  public record ProfileInput(@NotBlank @Size(max=30) String display_name) {}
  public Dtos.MyProfile profile(Jwt jwt) {
    UUID id=user(jwt);
    String name="멤버 " + id.toString().substring(0,8);
    Map<String,Object> metadata=jwt.getClaimAsMap("user_metadata");
    if(metadata!=null) {
      String proposed=Objects.toString(metadata.getOrDefault("full_name",metadata.get("name")),"").strip();
      if(!proposed.isBlank()) name=proposed.substring(0,Math.min(30,proposed.length())).replaceAll("[\\p{Cntrl}]","");
    }
    db.update("insert into profiles(id,display_name) values(?,?) on conflict(id) do nothing",id,name);
    var row=db.queryForMap("select p.*,u.created_at as account_created_at from profiles p join auth.users u on u.id=p.id where p.id=?",id);
    var publicProfile=ProfileSupport.publicProfile(id,row);
    return new Dtos.MyProfile(id,Objects.toString(jwt.getClaimAsString("email"),""),publicProfile.display_name(),publicProfile.avatar_url(),((java.sql.Timestamp)row.get("account_created_at")).toInstant(),((java.sql.Timestamp)row.get("updated_at")).toInstant());
  }
  @GetMapping("/me")
  public Dtos.MyProfile me(@AuthenticationPrincipal Jwt jwt) { return profile(jwt); }
  @PatchMapping("/me")
  public Dtos.MyProfile update(@AuthenticationPrincipal Jwt jwt,@Valid @RequestBody ProfileInput input) {
    String name=input.display_name().strip();
    if(name.isBlank() || name.codePoints().anyMatch(Character::isISOControl)) throw new IllegalArgumentException();
    profile(jwt);
    db.update("update profiles set display_name=?,updated_at=now() where id=?",name,user(jwt));
    return profile(jwt);
  }
  @GetMapping("/me/activity")
  public Api.Page<Dtos.MyActivity> activity(@AuthenticationPrincipal Jwt jwt,@RequestParam(defaultValue="posts") String type,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="20") int size) {
    if(!java.util.List.of("posts","documents").contains(type) || page<0 || size<1 || size>100) throw new IllegalArgumentException();
    String where=" from " + type + " r join groups g on g.id=r.group_id join group_members m on m.group_id=r.group_id and m.user_id=? where r.author_id=?";
    UUID id=user(jwt);
    long total=db.queryForObject("select count(*)"+where,Long.class,id,id);
    var rows=db.queryForList("select r.id,r.group_id,g.name as group_name,r.title,r.kind,r.created_at"+where+" order by r.created_at desc,r.id desc limit ? offset ?",id,id,size,(long)page*size);
    return new Api.Page<>(rows.stream().map(row -> integration.json.convertValue(row,Dtos.MyActivity.class)).toList(),page,size,total);
  }
  static byte[] normalizeAvatar(byte[] bytes) throws IOException {
    if(bytes.length==0 || bytes.length>2097152) throw new IllegalArgumentException();
    try(var stream=ImageIO.createImageInputStream(new ByteArrayInputStream(bytes))) {
      var readers=ImageIO.getImageReaders(stream);
      if(!readers.hasNext()) throw new IllegalArgumentException();
      var reader=readers.next();
      try {
        reader.setInput(stream,true,true);
        if(!java.util.List.of("png","jpeg","jpg").contains(reader.getFormatName().toLowerCase(Locale.ROOT))) throw new IllegalArgumentException();
        int w=reader.getWidth(0),h=reader.getHeight(0);
        if(w<1 || h<1 || w>4096 || h>4096 || (long)w*h>16777216) throw new IllegalArgumentException();
        var original=reader.read(0);
        var avatar=new BufferedImage(512,512,BufferedImage.TYPE_INT_ARGB);
        var graphics=avatar.createGraphics();
        try {
          graphics.setRenderingHint(RenderingHints.KEY_INTERPOLATION,RenderingHints.VALUE_INTERPOLATION_BICUBIC);
          int side=Math.min(w,h);
          graphics.drawImage(original,0,0,512,512,(w-side)/2,(h-side)/2,(w+side)/2,(h+side)/2,null);
        } finally { graphics.dispose(); }
        var output=new ByteArrayOutputStream();ImageIO.write(avatar,"png",output);return output.toByteArray();
      } finally { reader.dispose(); }
    }
  }
  @PostMapping(value="/me/avatar",consumes=MediaType.MULTIPART_FORM_DATA_VALUE)
  public Dtos.MyProfile upload(@AuthenticationPrincipal Jwt jwt,@RequestPart("file") MultipartFile file) {
    if(file.getSize()>2097152) throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE);
    byte[] png;
    try { png=normalizeAvatar(file.getBytes()); } catch(IOException | IllegalArgumentException e) { throw new IllegalArgumentException("PNG/JPEG 이미지를 확인해 주세요"); }
    profile(jwt);
    UUID id=user(jwt);
    String old=Objects.toString(db.queryForMap("select avatar_path from profiles where id=?",id).get("avatar_path"),"");
    String path=id+"/"+UUID.randomUUID()+".png";
    integration.putAvatar(path,png);
    try { db.update("update profiles set avatar_path=?,updated_at=now() where id=?",path,id); }
    catch(RuntimeException e) { integration.deleteAvatarQuietly(path);throw e; }
    if(!old.isBlank()) integration.deleteAvatarQuietly(old);
    return profile(jwt);
  }
  @DeleteMapping("/me/avatar")
  public Dtos.MyProfile clearAvatar(@AuthenticationPrincipal Jwt jwt) {
    profile(jwt);
    var rows=db.queryForList("with old as (select avatar_path from profiles where id=? for update), changed as (update profiles set avatar_path=null,updated_at=now() where id=? returning id) select old.avatar_path from old,changed",user(jwt),user(jwt));
    if(!rows.isEmpty() && rows.getFirst().get("avatar_path")!=null) integration.deleteAvatarQuietly(rows.getFirst().get("avatar_path").toString());
    return profile(jwt);
  }
  @GetMapping("/profiles/{id}/avatar")
  public ResponseEntity<byte[]> avatar(@AuthenticationPrincipal Jwt jwt,@PathVariable UUID id) {
    UUID viewer=user(jwt);
    if(!viewer.equals(id)) {
      Boolean allowed=db.queryForObject("select exists(select 1 from group_members viewer where viewer.user_id=? and (exists(select 1 from group_members author where author.group_id=viewer.group_id and author.user_id=?) or exists(select 1 from posts where group_id=viewer.group_id and author_id=?) or exists(select 1 from documents where group_id=viewer.group_id and author_id=?) or exists(select 1 from comments where group_id=viewer.group_id and author_id=?) or exists(select 1 from events where group_id=viewer.group_id and author_id=?)))",Boolean.class,viewer,id,id,id,id,id);
      if(!Boolean.TRUE.equals(allowed)) throw new ResponseStatusException(HttpStatus.FORBIDDEN);
    }
    var rows=db.queryForList("select avatar_path from profiles where id=?",id);
    if(rows.isEmpty() || rows.getFirst().get("avatar_path")==null) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    return ResponseEntity.ok().contentType(MediaType.IMAGE_PNG).header("Cache-Control","private, no-store").body(integration.getAvatar(rows.getFirst().get("avatar_path").toString()));
  }
}
