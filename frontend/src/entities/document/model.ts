export type { Document } from "@/shared/api";
export function documentErrorMessage(code: string): string {
  const messages: Record<string, string> = {
    NO_TEXT_OCR_UNSUPPORTED:
      "PDF에서 텍스트를 읽을 수 없어요. 스캔 이미지 대신 텍스트가 포함된 PDF를 등록해 주세요.",
    EMBEDDING_UNAVAILABLE:
      "AI 검색 기능이 비활성화되어 있어요. 관리자에게 서비스 설정 확인을 요청해 주세요.",
    FILE_TOO_LARGE: "파일이 20MB를 초과했어요. 용량을 줄여 다시 등록해 주세요.",
    PDF_LIMIT: "암호화되어 있거나 200쪽을 넘는 PDF는 처리할 수 없어요.",
    TEXT_LIMIT:
      "문서에서 추출한 텍스트가 너무 많아요. 자료를 나누어 등록해 주세요.",
    CHUNK_LIMIT: "자료 분량이 너무 많아요. 문서를 나누어 등록해 주세요.",
    INVALID_PDF:
      "PDF 파일을 읽을 수 없어요. 파일이 손상되지 않았는지 확인해 주세요.",
    INDEX_FAILED:
      "자료 처리 중 문제가 생겼어요. 다시 처리해 보고, 반복되면 관리자에게 문의해 주세요.",
  };
  return (
    messages[code] ||
    "자료를 처리하지 못했어요. 다시 처리하거나 관리자에게 문의해 주세요."
  );
}
