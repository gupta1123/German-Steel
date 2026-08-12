"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Heading, Text } from "@/components/ui/typography";
import { Button } from "@/components/ui/button";

interface TopbarProps {
  heading?: string;
  subheading?: string;
  backHref?: string;
}

export default function Topbar({ heading, subheading, backHref }: TopbarProps) {
  return (
    <header className="sticky top-0 z-30 flex w-full flex-wrap items-center justify-between gap-4 border-b border-border/60 bg-background/95 pl-4 pr-12 py-3 backdrop-blur supports-[backdrop-filter]:backdrop-blur sm:pl-6 sm:pr-16">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {backHref && (
          <Button asChild variant="ghost" size="icon" className="h-8 w-8 shrink-0">
            <Link href={backHref}>
              <ArrowLeft className="h-4 w-4" />
              <span className="sr-only">Back</span>
            </Link>
          </Button>
        )}
        {(heading || subheading) && (
          <div className="flex flex-col gap-0.5">
          {heading && (
            <Heading as="h1" size="lg" className="truncate leading-tight" weight="semibold">
              {heading}
            </Heading>
          )}
          {subheading && (
              <Text as="p" size="sm" tone="muted" className="truncate leading-tight">
              {subheading}
            </Text>
          )}
        </div>
        )}
      </div>
      
      <div className="flex w-full items-center justify-end gap-2 pr-2 sm:w-auto sm:pr-4">
        <ThemeToggle />
      </div>
    </header>
  );
}
