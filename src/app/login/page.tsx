import { GraduationCap } from "lucide-react";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in · SMS Registry" };

export default async function LoginPage(props: PageProps<"/login">) {
  const { next } = await props.searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <GraduationCap className="size-6" />
          </div>
          <h1 className="text-xl font-semibold">SMS Registry</h1>
          <p className="text-sm text-muted-foreground">
            Student Management System — Registry module
          </p>
        </div>

        <LoginForm next={typeof next === "string" ? next : undefined} />

        <div className="rounded-lg border bg-card p-4 text-xs text-muted-foreground">
          <p className="mb-2 font-medium text-foreground">Demo accounts</p>
          <dl className="space-y-1">
            <div className="flex justify-between gap-3">
              <dt>Registry staff</dt>
              <dd className="font-mono">registry@sms.ac.uk / Registry123!</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Student</dt>
              <dd className="font-mono">amara.okafor@students.sms.ac.uk / Student123!</dd>
            </div>
          </dl>
        </div>
      </div>
    </main>
  );
}
