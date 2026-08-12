"use client";

import { ReactNode } from "react";

interface PageWrapperProps {
  children: ReactNode;
  heading?: string;
  subheading?: string;
}

export default function PageWrapper({ 
  children, 
  heading, 
  subheading 
}: PageWrapperProps) {
  return (
    <div className="flex flex-col gap-4">
      {(heading || subheading) && (
        <div className="flex flex-col gap-2">
          {heading && <h1 className="text-2xl font-bold tracking-tight">{heading}</h1>}
          {subheading && <p className="text-muted-foreground">{subheading}</p>}
        </div>
      )}
      {children}
    </div>
  );
}