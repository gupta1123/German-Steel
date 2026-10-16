import Image from "next/image";

interface BrandLogoProps {
  className?: string;
  priority?: boolean;
}

export default function BrandLogo({ className, priority = false }: BrandLogoProps) {
  return (
    <Image
      src="/german-tmt-logo.png"
      alt="German TMT"
      width={2095}
      height={638}
      className={className}
      preload={priority}
      sizes="(min-width: 768px) 220px, 180px"
    />
  );
}
