import { toast } from "sonner";

export const notify = {
  success(message: string, options?: { description?: string }): void {
    toast.success(message, options);
  },
  error(error: any): void {
    const msg = error?.message || (typeof error === "string" ? error : "An error occurred");
    toast.error(msg);
  },
  info(message: string): void {
    toast.info(message);
  },
};
