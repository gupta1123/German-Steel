import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const headingVariants = cva(
  "font-semibold tracking-tight text-foreground",
  {
    variants: {
      size: {
        xs: "text-xs",
        sm: "text-sm",
        md: "text-base",
        lg: "text-lg",
        xl: "text-xl",
        "2xl": "text-2xl",
        "3xl": "text-3xl",
        "4xl": "text-4xl",
      },
      weight: {
        normal: "font-normal",
        medium: "font-medium",
        semibold: "font-semibold",
        bold: "font-bold",
      },
    },
    defaultVariants: {
      size: "lg",
      weight: "semibold",
    },
  }
);

const textVariants = cva("text-foreground", {
  variants: {
    size: {
      xs: "text-xs",
      sm: "text-sm",
      md: "text-base",
      lg: "text-lg",
    },
    tone: {
      default: "text-foreground",
      muted: "text-muted-foreground",
      subtle: "text-muted-foreground/80",
    },
    weight: {
      normal: "font-normal",
      medium: "font-medium",
      semibold: "font-semibold",
    },
    tracking: {
      tight: "tracking-tight",
      normal: "tracking-normal",
      wide: "tracking-wide",
    },
  },
  defaultVariants: {
    size: "md",
    tone: "default",
    weight: "normal",
    tracking: "normal",
  },
});

type HeadingProps = React.HTMLAttributes<HTMLHeadingElement> &
  VariantProps<typeof headingVariants> & {
    as?: keyof Pick<
      React.JSX.IntrinsicElements,
      "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "div" | "span" | "p"
    >;
  };

const Heading = React.forwardRef<HTMLHeadingElement, HeadingProps>(
  ({ className, size, weight, as: Component = "h2", ...props }, ref) => {
    return (
      <Component
        ref={ref}
        className={cn(headingVariants({ size, weight }), className)}
        {...props}
      />
    );
  }
);
Heading.displayName = "Heading";

type TextProps = React.HTMLAttributes<HTMLParagraphElement> &
  VariantProps<typeof textVariants> & {
    as?: keyof Pick<React.JSX.IntrinsicElements, "p" | "span" | "div">;
  };

const Text = React.forwardRef<HTMLParagraphElement, TextProps>(
  (
    {
      className,
      size,
      tone,
      weight,
      tracking,
      as: Component = "p",
      ...props
    },
    ref
  ) => {
    return (
      <Component
        ref={ref as never}
        className={cn(textVariants({ size, tone, weight, tracking }), className)}
        {...props}
      />
    );
  }
);
Text.displayName = "Text";

export { Heading, Text, headingVariants, textVariants };
