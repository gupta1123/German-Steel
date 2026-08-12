import Image from "next/image";
import germanSteelLogo from "@/German Steel Logo.png";

interface BrandLogoProps {
  className?: string;
  priority?: boolean;
}

export default function BrandLogo({ className, priority = false }: BrandLogoProps) {
  return (
    <Image
      src={germanSteelLogo}
      alt="German TMT"
      className={className}
      priority={priority}
      sizes="(min-width: 768px) 220px, 180px"
    />
  );
}
