import "next-auth";
import type { Role } from "@/db/schema";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      displayName: string;
      role: Role;
    };
  }
  interface User {
    role?: Role;
    displayName?: string;
  }
}
