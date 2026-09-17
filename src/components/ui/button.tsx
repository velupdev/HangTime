import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-fg hover:bg-primary/90",
        secondary: "bg-fg/8 text-fg hover:bg-fg/12 shadow-[var(--shadow-border)]",
        ghost: "text-fg hover:bg-fg/8",
        mark: "bg-primary/15 text-primary hover:bg-primary/25",
      },
      size: {
        md: "h-11 min-h-11 px-4 text-sm",
        sm: "h-10 min-h-10 px-3 text-sm",
        lg: "h-12 min-h-12 px-5 text-base",
        icon: "size-11 min-h-11 min-w-11 p-0",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants> & { asChild?: boolean };

export function Button({ className, variant, size, asChild, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
