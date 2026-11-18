import Image, { type StaticImageData } from "next/image";
import { cn } from "@/lib/utils";

/**
 * A real product screenshot captured in both themes; the one matching the
 * active theme is shown. The hidden copy is display:none, so assistive tech
 * reads the alt text once.
 */
export function ThemedShot({
  light,
  dark,
  alt,
  sizes,
  className,
}: {
  light: StaticImageData;
  dark: StaticImageData;
  alt: string;
  sizes: string;
  className?: string;
}) {
  return (
    <>
      <Image src={light} alt={alt} sizes={sizes} className={cn("dark:hidden", className)} />
      <Image src={dark} alt={alt} sizes={sizes} className={cn("hidden dark:block", className)} />
    </>
  );
}
