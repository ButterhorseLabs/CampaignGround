"use client";

import { useApp } from "@/lib/store";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { BrandLockup, SidebarFooter, SidebarNav } from "./sidebar";

export function MobileNav() {
  const setOpen = useApp((s) => s.setSidebar);
  const open = useApp((s) => s.sidebarOpen);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent side="left" className="p-0 w-72 gap-0 bg-sidebar border-sidebar-border">
        <SheetHeader className="px-5 h-16 justify-center border-b border-sidebar-border">
          <SheetTitle asChild>
            <div>
              <BrandLockup />
            </div>
          </SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto scroll-area-thin">
          <SidebarNav onNavigate={() => setOpen(false)} />
        </div>
        <SidebarFooter />
      </SheetContent>
    </Sheet>
  );
}
