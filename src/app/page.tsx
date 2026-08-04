import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";

/** Landing route: send people to the view their role belongs in. */
export default async function RootPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  redirect(session.role === "STAFF" ? "/staff" : "/student");
}
