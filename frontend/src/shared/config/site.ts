export const siteUrl = "https://moadam.vercel.app";
export const siteName = "모아담";
export const siteTitle = "모아담 | 모임 커뮤니티·자료 관리·일정을 한곳에";
export const siteDescription =
  "모아담은 모임의 이야기, 자료, 일정을 한곳에 모으는 모임 커뮤니티 서비스입니다. 멤버들과 소식을 나누고 자료를 보관하며, 모아AI에게 우리 모임에 대해 질문하세요.";
export const searchIndexable =
  process.env.VERCEL_ENV !== "preview" &&
  process.env.VERCEL_ENV !== "development";

export const siteOpenGraph = {
  type: "website" as const,
  locale: "ko_KR",
  siteName,
  title: siteTitle,
  description: siteDescription,
  images: [
    {
      url: "/opengraph-image",
      width: 1200,
      height: 630,
      alt: "모아담 — 모임의 이야기와 자료, 일정을 한곳에",
    },
  ],
};
