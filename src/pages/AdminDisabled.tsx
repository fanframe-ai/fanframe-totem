import { ShieldAlert } from "lucide-react";

export default function AdminDisabled() {
  const adminUrl = import.meta.env.VITE_TOTEM_ADMIN_URL;

  return (
    <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-8">
      <section className="max-w-xl text-center">
        <ShieldAlert className="w-16 h-16 mx-auto mb-6 text-muted-foreground" />
        <h1 className="text-4xl font-black uppercase mb-4">Admin desativado</h1>
        <p className="text-lg text-muted-foreground mb-8">
          O painel antigo nao e mais a interface oficial dos totens. Use o novo painel administrativo publicado na Vercel.
        </p>
        {adminUrl && (
          <a className="inline-flex h-12 px-6 items-center justify-center rounded-md bg-primary text-primary-foreground font-bold" href={adminUrl}>
            Abrir novo painel
          </a>
        )}
      </section>
    </main>
  );
}
