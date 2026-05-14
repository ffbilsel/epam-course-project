import { listAllUsers } from "@/server/user-service";
import { UsersTable } from "@/components/admin/users-table";

/**
 * Admin → Users page.
 */
export default async function AdminUsersPage(): Promise<JSX.Element> {
  const users = await listAllUsers();
  return (
    <main className="mx-auto w-full max-w-screen-2xl px-4 py-6 sm:px-6 lg:px-10">
      <h1 className="mb-4 text-2xl font-semibold">Users</h1>
      <UsersTable
        users={users.map((u) => ({
          id: u.id,
          email: u.email,
          displayName: u.displayName,
          role: u.role,
        }))}
      />
    </main>
  );
}
