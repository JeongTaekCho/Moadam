package com.moadam.common.storage;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

public class UploadMissingException extends ResponseStatusException {
  public UploadMissingException() {
    super(HttpStatus.CONFLICT, "파일 업로드가 완료되지 않았어요. 같은 자료에서 업로드를 다시 진행해 주세요.");
  }
}
