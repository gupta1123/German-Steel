import Image from "next/image";

interface BrandLogoProps {
  className?: string;
  priority?: boolean;
}

export default function BrandLogo({ className, priority = false }: BrandLogoProps) {
  return (
    <Image
      src="/GermanTmtLogo.png"
      alt="German TMT"
      width={1190}
      height={388}
      className={className}
      priority={priority}
      sizes="(min-width: 768px) 220px, 180px"
    />
  );
}
