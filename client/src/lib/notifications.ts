export interface MockNotification {
  id: string;
  kind: string;
  to: string;
  subject: string;
  body: string;
  createdAt: string;
}

const STORAGE_KEY = "mock_notifications";

export function listMockNotifications(): MockNotification[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Failed to read mock notifications", e);
    return [];
  }
}

export function clearMockNotifications(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    window.dispatchEvent(new Event("mock-notifications-updated"));
  } catch (e) {
    console.error("Failed to clear mock notifications", e);
  }
}

export function sendMockNotification(
  kind: string,
  to: string,
  subject: string,
  body: string
): void {
  if (typeof window === "undefined") return;
  try {
    const items = listMockNotifications();
    const newItem: MockNotification = {
      id: crypto.randomUUID?.() || Math.random().toString(36).substring(2),
      kind,
      to,
      subject,
      body,
      createdAt: new Date().toISOString(),
    };
    items.unshift(newItem); // Newest first
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new Event("mock-notifications-updated"));
  } catch (e) {
    console.error("Failed to send mock notification", e);
  }
}
