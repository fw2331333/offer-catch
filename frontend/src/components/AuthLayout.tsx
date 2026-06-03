import { useGSAP } from "@gsap/react";
import { useRef } from "react";
import { Link } from "react-router-dom";
import { gsap } from "../lib/gsap";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";

type AuthLayoutProps = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer: React.ReactNode;
};

export default function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  const root = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();

  useGSAP(
    () => {
      if (reduced) return;
      const scope = root.current;
      if (!scope) return;

      const items = gsap.utils.toArray<HTMLElement>(scope.querySelectorAll(".auth-animate"));
      if (!items.length) return;

      const card = scope.querySelector(".auth-card");
      if (card) {
        gsap.fromTo(
          card,
          { y: 28 },
          { y: 0, duration: 0.55, ease: "power3.out", clearProps: "transform" }
        );
      }

      gsap.fromTo(
        items,
        { autoAlpha: 0, y: 14 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.4,
          stagger: 0.08,
          delay: 0.12,
          ease: "power2.out",
          clearProps: "opacity,visibility,transform",
          overwrite: "auto",
        }
      );
    },
    { scope: root, dependencies: [reduced] }
  );

  return (
    <div
      ref={root}
      className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-slate-50 via-white to-brand-50/40 px-4 py-10"
    >
      <div
        className="auth-animate pointer-events-none absolute -top-24 -right-24 h-72 w-72 rounded-full bg-brand-200/30 blur-3xl"
        aria-hidden
      />
      <div
        className="auth-animate pointer-events-none absolute -bottom-20 -left-16 h-64 w-64 rounded-full bg-sky-200/25 blur-3xl"
        aria-hidden
      />

      <div className="auth-card relative w-full max-w-md rounded-2xl border border-gray-200/80 bg-white/90 p-8 shadow-lg shadow-gray-200/50 backdrop-blur-sm">
        <div className="auth-animate flex items-center gap-3 mb-8">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-white font-bold text-lg shadow-md shadow-brand-500/25">
            O
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
          </div>
        </div>

        {children}

        <div className="auth-animate mt-6 text-center text-sm text-gray-500">{footer}</div>
      </div>
    </div>
  );
}

export function AuthField({
  label,
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="auth-animate">
      {label && <label className="text-sm text-gray-600">{label}</label>}
      {children}
    </div>
  );
}

export function AuthInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5 transition-shadow focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent ${props.className ?? ""}`}
    />
  );
}

export function AuthSubmit(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <div className="auth-animate pt-1">
      <button
        {...props}
        className={`w-full rounded-xl bg-brand-600 text-white py-2.5 font-medium shadow-sm shadow-brand-600/20 transition-colors hover:bg-brand-700 hover:shadow-md disabled:opacity-50 ${props.className ?? ""}`}
      />
    </div>
  );
}

export function AuthLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="text-brand-600 hover:underline font-medium">
      {children}
    </Link>
  );
}
