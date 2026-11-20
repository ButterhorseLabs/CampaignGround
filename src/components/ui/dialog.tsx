"use client"

import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { XIcon } from "lucide-react"

import { cn } from "@/lib/utils"

type AutoFocusHandlers = Pick<
  React.ComponentProps<typeof DialogPrimitive.Content>,
  "onOpenAutoFocus" | "onCloseAutoFocus"
>

/**
 * Radix returns focus only to a DialogTrigger, so a dialog opened from state
 * drops focus on <body> when it closes. Return it to whatever opened it.
 */
export function useReturnFocus({ onOpenAutoFocus, onCloseAutoFocus }: AutoFocusHandlers): AutoFocusHandlers {
  const opener = React.useRef<HTMLElement | null>(null)
  return {
    onOpenAutoFocus: (e) => {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      onOpenAutoFocus?.(e)
    },
    onCloseAutoFocus: (e) => {
      onCloseAutoFocus?.(e)
      const el = opener.current
      if (e.defaultPrevented || !el?.isConnected || el === document.body) return
      e.preventDefault()
      el.focus()
    },
  }
}

function Dialog({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Root>) {
  return <DialogPrimitive.Root data-sc-slot="dialog" {...props} />
}

function DialogTrigger({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Trigger>) {
  return <DialogPrimitive.Trigger data-sc-slot="dialog-trigger" {...props} />
}

function DialogPortal({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Portal>) {
  return <DialogPrimitive.Portal data-sc-slot="dialog-portal" {...props} />
}

function DialogClose({
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Close>) {
  return <DialogPrimitive.Close data-sc-slot="dialog-close" {...props} />
}

function DialogOverlay({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Overlay>) {
  return (
    <DialogPrimitive.Overlay
      data-sc-slot="dialog-overlay"
      className={cn(
        "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50",
        className
      )}
      {...props}
    />
  )
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  onOpenAutoFocus,
  onCloseAutoFocus,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean
}) {
  const focusHandlers = useReturnFocus({ onOpenAutoFocus, onCloseAutoFocus })
  return (
    <DialogPortal data-sc-slot="dialog-portal">
      <DialogOverlay />
      <DialogPrimitive.Content
        data-sc-slot="dialog-content"
        className={cn(
          "bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid max-h-[calc(100dvh-2rem)] w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] grid-cols-1 gap-4 overflow-y-auto rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg",
          className
        )}
        {...props}
        {...focusHandlers}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-sc-slot="dialog-close"
            className="ring-offset-background focus-visible:ring-ring hover:bg-accent text-muted-foreground hover:text-foreground absolute top-2 right-2 grid size-11 place-items-center rounded-md transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-hidden disabled:pointer-events-none sm:top-3 sm:right-3 sm:size-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-sc-slot="dialog-header"
      className={cn("flex flex-col gap-2 text-center sm:text-left", className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-sc-slot="dialog-footer"
      className={cn(
        "bg-background sticky -bottom-6 -mx-6 -mt-3 -mb-6 flex flex-col-reverse gap-2 px-6 pt-3 pb-6 sm:flex-row sm:justify-end",
        className
      )}
      {...props}
    />
  )
}

function DialogTitle({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return (
    <DialogPrimitive.Title
      data-sc-slot="dialog-title"
      className={cn("text-lg leading-none font-semibold", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return (
    <DialogPrimitive.Description
      data-sc-slot="dialog-description"
      className={cn("text-muted-foreground text-sm", className)}
      {...props}
    />
  )
}

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
}
