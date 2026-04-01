import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { asFormAction } from "@/lib/server-action-form";

type AuthFormProps = {
  title: string;
  action: (formData: FormData) => Promise<{ error?: string } | void>;
  submitLabel: string;
  includeName?: boolean;
};

export function AuthForm({ title, action, submitLabel, includeName = false }: AuthFormProps) {
  return (
    <div className="mx-auto mt-24 w-full max-w-md border border-border bg-panelAlt/95 p-8 shadow-soft">
      <p className="type-eyebrow mb-2">Runfolio</p>
      <h1 className="mb-6 text-2xl font-bold uppercase tracking-[0.06em]">{title}</h1>
      <form action={asFormAction(action)} className="space-y-4">
        {includeName ? <Input name="name" placeholder="Name" required /> : null}
        <Input name="email" type="email" placeholder="Email" required />
        <Input name="password" type="password" placeholder="Password" required />
        <Button className="w-full" type="submit">
          {submitLabel}
        </Button>
      </form>
    </div>
  );
}
