import { Database, KeyRound, Scissors } from "lucide-react";

export default function SetupPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-950 p-5">
      <div className="card w-full max-w-2xl p-7 sm:p-10">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-gold-200 to-gold-500 text-ink-950">
            <Scissors size={21} />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">CorteFlow</h1>
            <p className="text-xs text-slate-500">Configuração inicial</p>
          </div>
        </div>
        <h2 className="text-xl font-semibold text-white">Conecte seu projeto Supabase</h2>
        <p className="mt-2 text-sm leading-relaxed text-slate-400">
          Para usar o sistema com persistência real, crie um projeto no Supabase, execute a migração SQL e configure as variáveis de ambiente.
        </p>
        <ol className="mt-7 space-y-5">
          <li className="flex gap-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold-400/10 text-gold-300"><Database size={16} /></span>
            <div>
              <p className="text-sm font-medium text-slate-200">1. Execute a migração</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                No SQL Editor do Supabase, rode o conteúdo de <code className="rounded bg-white/5 px-1.5 py-0.5 text-gold-200">supabase/migrations/0001_init.sql</code>.
              </p>
            </div>
          </li>
          <li className="flex gap-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold-400/10 text-gold-300"><KeyRound size={16} /></span>
            <div>
              <p className="text-sm font-medium text-slate-200">2. Configure as variáveis</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Copie <code className="rounded bg-white/5 px-1.5 py-0.5 text-gold-200">.env.example</code> para <code className="rounded bg-white/5 px-1.5 py-0.5 text-gold-200">.env.local</code> e preencha a URL e a chave anônima do projeto.
              </p>
            </div>
          </li>
          <li className="flex gap-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold-400/10 text-gold-300"><Scissors size={16} /></span>
            <div>
              <p className="text-sm font-medium text-slate-200">3. Crie sua conta</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                Reinicie o servidor, cadastre-se em <code className="rounded bg-white/5 px-1.5 py-0.5 text-gold-200">/login</code> e conclua a configuração da barbearia.
              </p>
            </div>
          </li>
        </ol>
        <p className="mt-8 border-t border-white/[0.06] pt-5 text-xs text-slate-600">
          Detalhes completos no arquivo README.md.
        </p>
      </div>
    </div>
  );
}
