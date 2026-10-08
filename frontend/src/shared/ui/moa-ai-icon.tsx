import Image from "next/image";

/** Brand mascot without the wordmark. Accompany with visible text or an accessible label. */
export function MoaAiIcon({
  size = 24,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <Image
      src="/images/moa-ai-icon.png"
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      sizes={`${size}px`}
      draggable={false}
      className={`moa-ai-icon ${className}`.trim()}
    />
  );
}
