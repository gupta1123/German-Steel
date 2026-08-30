"use client";

import Link from "@/components/guarded-link";
import { ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Heading, Text } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";

interface TopbarProps {
  heading?: string;
  subheading?: string;
  backHref?: string;
  onBack?: () => void;
}

export default function Topbar({ heading, subheading, backHref, onBack }: TopbarProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 w-full items-center gap-3 border-b border-border/60 bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:backdrop-blur sm:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        {backHref && (
          <Button asChild variant="ghost" size="icon" className="h-8 w-8 shrink-0">
            <Link href={backHref}>
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
        )}
        {!backHref && onBack && (
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back</span>
          </Button>
        )}
        {(heading || subheading) && (
          <div className="flex min-w-0 flex-col justify-center gap-0.5">
          {heading && (
            <Heading as="h1" size="lg" className="truncate leading-tight" weight="semibold">
              {heading}
            </Heading>
          )}
          {subheading && (
              <Text as="p" size="xs" tone="muted" className="truncate leading-tight">
              {subheading}
            </Text>
          )}
        </div>
        )}
      </div>
      <div className="flex shrink-0 items-center">
        <ThemeToggle />
      </div>
    </header>
  );
}
