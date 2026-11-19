"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  CalendarDays,
  ChevronRight,
  LayoutDashboard,
  LogOut,
  Menu,
  Scissors,
  Settings,
  Sparkles,
  Users,
  X,
  Layers3,
} from "lucide-react";
import clsx from "clsx";
import { useAuth } from "@/components/auth-provider";
import { Button, IconButton } from "@/components/ui";

const NAV = [
  { href: "/dashboard", label: "Visão geral", icon: LayoutDashboard },
  { href: "/agenda", label: "Agenda", icon: CalendarDays },
  { href: "/clientes", label: "Clientes", icon: Users },
  { href: "/barbeiros", label: "Barbeiros", icon: Scissors },
  { href: "/servicos", label: "Serviços", icon: Sparkles },
  { href: "/planos", label: "Planos", icon: Layers3 },
  { href: "/configuracoes", label: "Configurações", icon: Settings },
];

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { shop, user, signOut } = useAuth();

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-[72px] items-center gap-3 border-b border-white/[0.06] px-5">
        <div className="flex h-9 w-11 shrink-0 items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logotipo.png" alt="CorteFlow" className="max-h-9 w-11 object-contain" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-bold tracking-tight text-white">CorteFlow</p>
          <p className="truncate text-[10px] uppercase tracking-[0.18em] text-gold-300/70">
            Gestão de barbearia
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-600">
          Menu
        </p>
        {NAV.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={clsx(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                active
                  ? "border border-gold-400/20 bg-gold-400/10 text-gold-200"
                  : "border border-transparent text-slate-400 hover:bg-white/[0.05] hover:text-slate-100"
              )}
            >
              <item.icon size={18} className={active ? "text-gold-300" : "text-slate-500 group-hover:text-slate-300"} />
              <span className="flex-1">{item.label}</span>
              {active && <ChevronRight size={14} className="text-gold-400/60" />}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/[0.06] p-3">
        <div className="mb-2 flex items-center gap-3 rounded-xl px-2 py-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gold-400/30 bg-gold-400/10 text-xs font-bold text-gold-200">
            {(shop?.name || user?.email || "C").slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-slate-200">{shop?.name || "Barbearia"}</p>
            <p className="truncate text-[11px] text-slate-500">{user?.email}</p>
          </div>
        </div>
        <Button variant="ghost" className="w-full justify-start" onClick={() => void signOut()}>
          <LogOut size={16} /> Sair da conta
        </Button>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const current = NAV.find((n) => pathname.startsWith(n.href));

  return (
    <div className="min-h-screen bg-ink-950">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] border-r border-white/[0.06] bg-ink-900 lg:block">
        <SidebarContent />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Fechar menu"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-[270px] border-r border-white/10 bg-ink-900 shadow-2xl">
            <IconButton
              label="Fechar menu"
              className="absolute right-3 top-5 z-10"
              onClick={() => setMobileOpen(false)}
            >
              <X size={18} />
            </IconButton>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-white/[0.06] bg-ink-950/85 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
          <IconButton label="Abrir menu" className="lg:hidden" onClick={() => setMobileOpen(true)}>
            <Menu size={20} />
          </IconButton>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[0.16em] text-slate-600">CorteFlow</p>
            <p className="truncate text-sm font-semibold text-slate-200">{current?.label}</p>
          </div>
          <div className="hidden items-center gap-2 text-xs text-slate-500 sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,.8)]" />
            Sistema operacional
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1500px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
