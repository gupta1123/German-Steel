"use client";

import NextLink from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";
import { useNavigationGuard } from "@/components/unsaved-changes-provider";

type GuardedLinkProps = ComponentProps<typeof NextLink>;

export default function GuardedLink({ onNavigate, ...props }: GuardedLinkProps) {
  const router = useRouter();
  const { requestNavigation, hasUnsavedChanges } = useNavigationGuard();

  return (
    <NextLink
      {...props}
      onNavigate={(event) => {
        onNavigate?.(event);
        if (!hasUnsavedChanges) return;
        event.preventDefault();
        const href = typeof props.href === "string" ? props.href : props.href.pathname || "/";
        requestNavigation(() => router.push(href));
      }}
    />
  );
}
