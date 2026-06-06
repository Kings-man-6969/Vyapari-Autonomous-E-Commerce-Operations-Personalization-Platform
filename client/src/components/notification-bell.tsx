import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listMockNotifications } from "@/lib/notifications";

export function NotificationBell() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const refresh = () => setCount(listMockNotifications().length);
    refresh();
    window.addEventListener("mock-notifications-updated", refresh);
    return () => window.removeEventListener("mock-notifications-updated", refresh);
  }, []);

  return (
    <Button
      asChild
      variant="ghost"
      size="icon"
      className="relative hidden sm:inline-flex"
    >
      <Link to="/account/notifications" aria-label={`Notifications${count ? ` (${count} unread)` : ""}`}>
        <Bell className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground animate-scale-in">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </Link>
    </Button>
  );
}
