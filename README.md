# CorteFlow — MVP Web

Painel administrativo para gerenciamento de agendamentos de barbearia. **Apenas MVP web**: não há aplicativo desktop, instalador, financeiro, caixa, pagamentos, vendas ou estoque. Preços são informativos.

## Stack

Next.js (App Router) · React · TypeScript · Tailwind CSS · Supabase (Auth + PostgreSQL) · Lucide Icons.

## Executar localmente

1. Instale as dependências:

```bash
npm install
```

2. Crie um projeto no [Supabase](https://supabase.com) e execute o arquivo `supabase/migrations/0001_init.sql` no **SQL Editor** (uma vez).

3. Copie `.env.example` para `.env.local` e preencha:

```env
NEXT_PUBLIC_SUPABASE_URL=https://SEU_PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=SEU_ANON_KEY
```

4. Inicie:

```bash
npm run dev
```

5. Acesse `http://localhost:3000`, cadastre-se em `/login` e conclua a criação da barbearia em `/onboarding`.

Depois do onboarding, cadastre nesta ordem: **Serviços → Barbeiros → Planos → Configurações**. Sem barbeiros e serviços não há horários disponíveis.

> **Erro `Could not find the function public.create_barbershop_for_current_user ... in the schema cache`:** o banco está correto, mas o PostgREST não recarregou o cache. Execute `supabase/migrations/0002_reload_schema_cache.sql` no SQL Editor (ou use **Settings → API → Reload schema cache** no painel do Supabase) e tente novamente.

## O que está implementado

- **Dashboard**: contadores do dia (total, confirmados, aguardando, chegou, em atendimento, concluídos, cancelamentos) e próximos atendimentos. Sem dados financeiros.
- **Agenda**: visões diária, semanal e mensal; criar, editar, cancelar, remarcar e alterar status; filtro por barbeiro; bloqueio de horários.
- **Clientes**: cadastro, contato/WhatsApp, observações e histórico de agendamentos.
- **Barbeiros**: foto, especialidades, serviços permitidos, jornada semanal, pausas, folgas e status ativo/inativo.
- **Serviços**: nome, descrição, preço informativo, duração, barbeiros habilitados e status.
- **Planos**: pacotes de serviços com duração total calculada automaticamente e preço promocional livre.
- **Configurações**: dados da barbearia, logotipo, endereço, WhatsApp, expediente e preferências de agendamento.
- **Regras de negócio**: conflitos de horário bloqueados no banco (trigger), respeito ao expediente da loja, jornada/pausas/folgas do barbeiro, bloqueios e antecedência mínima. Tudo isolado por `barbershop_id` com RLS.

A lógica de disponibilidade fica em `src/lib/availability.ts`, separada da interface. As regras críticas de escrita também existem no banco (RPC + trigger), para que a API pública não possa ser burlada.

## API pública (integração futura com sites)

Base: `/api/public/v1`. Todas as requisições exigem o cabeçalho `apikey` com a chave anônima do Supabase (pública por design) e o `shopId` da barbearia.

| Método | Endpoint | Descrição |
| --- | --- | --- |
| GET | `/services?shopId=` | Serviços ativos |
| GET | `/plans?shopId=` | Planos ativos |
| GET | `/barbers?shopId=` | Barbeiros ativos |
| GET | `/availability?shopId=&serviceId=&date=AAAA-MM-DD[&barberId=]` | Horários disponíveis |
| POST | `/appointments` | Cria agendamento (valida no servidor) |
| POST | `/appointments/cancel` | Cancela com o `token` retornado na criação |

Exemplo de criação:

```bash
curl -X POST https://SEU_DOMINIO/api/public/v1/appointments \
  -H 'Content-Type: application/json' \
  -H 'apikey: SEU_ANON_KEY' \
  -d '{
    "shopId": "uuid-da-barbearia",
    "clientName": "João Silva",
    "clientPhone": "(11) 99999-9999",
    "barberId": "uuid-do-barbeiro",
    "serviceId": "uuid-do-servico",
    "startAt": "2026-11-20T13:00:00-03:00"
  }'
```

A criação usa `pg_advisory_xact_lock` por barbeiro e um trigger de sobreposição, impedindo reservas duplicadas mesmo com requisições simultâneas. O agendamento é criado como `pending`.

## Deploy na Vercel

1. Importe o repositório na Vercel (framework: Next.js).
2. Configure as variáveis `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` e, opcionalmente, `NEXT_PUBLIC_APP_URL`.
3. Aplique a migração SQL no Supabase de produção.
4. Faça o deploy. Nenhuma variável secreta de servidor é necessária: o painel usa RLS e a API pública usa funções `security definer`.

## Estrutura

```
src/app/(app)/        páginas autenticadas (dashboard, agenda, clientes, ...)
src/app/api/public/   API REST pública
src/components/       shell, formulários e componentes reutilizáveis
src/hooks/            acesso a dados e suporte da agenda
src/lib/              tipos, regras de negócio, datas, Supabase
supabase/migrations/  schema, RLS, RPCs e proteção contra conflitos
```

## Verificação

```bash
npm run typecheck
npm run build
```
