import Image from "next/image";
import Link from "next/link";
export function BrandLogo({ subtitle = false }: { subtitle?: boolean }) {
  return (
    <Link
      href="/"
      scroll={false}
      className="brand-logo rounded-control focus-visible:outline-brand-600"
      aria-label="모아담 홈으로 이동"
    >
      <span className="brand-image-frame">
        <Image
          src="/images/logo.png"
          alt="모아담"
          width={1920}
          height={832}
          sizes="220px"
          priority
          className="brand-image"
        />
      </span>
      {subtitle && (
        <span className="brand-caption">모임의 정보를 모아 담다</span>
      )}
    </Link>
  );
}
