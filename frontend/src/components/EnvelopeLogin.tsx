import { useGSAP } from "@gsap/react";
import { Mail } from "lucide-react";
import {
  forwardRef,
  useCallback,
  useImperativeHandle,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Link } from "react-router-dom";
import { gsap } from "../lib/gsap";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";

export type EnvelopeLoginFormProps = {
  email: string;
  password: string;
  infoMessage?: string;
  error: string;
  loading: boolean;
  needsVerify?: boolean;
  resendMsg?: string;
  devVerifyUrl?: string;
  resendLoading?: boolean;
  onResendVerification?: () => void;
  onEmailChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  onSubmit: (e: FormEvent) => void;
};

export type EnvelopeLoginHandle = {
  playExit: () => void;
};

type Phase = "intro" | "closed" | "revealed" | "exiting";

/** 信纸藏在信封内时略低于最终中心；启封后回到 0（正中） */
const LETTER_NESTED_Y = 56;
/** 信封下坠距离（营造「信笺上浮、信封坠落」的相对运动） */
const ENVELOPE_DROP_Y = 240;

type Props = EnvelopeLoginFormProps & {
  onOpenComplete: () => void;
};

const EnvelopeLogin = forwardRef<EnvelopeLoginHandle, Props>(function EnvelopeLogin(
  {
    email,
    password,
    infoMessage = "",
    error,
    loading,
    needsVerify = false,
    resendMsg = "",
    devVerifyUrl = "",
    resendLoading = false,
    onResendVerification,
    onEmailChange,
    onPasswordChange,
    onSubmit,
    onOpenComplete,
  },
  ref
) {
  const root = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const envelopeRef = useRef<HTMLDivElement>(null);
  const flapRef = useRef<HTMLDivElement>(null);
  const pocketRef = useRef<HTMLDivElement>(null);
  const letterRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLParagraphElement>(null);

  const reduced = usePrefersReducedMotion();
  const [phase, setPhase] = useState<Phase>(reduced ? "revealed" : "intro");
  const [opening, setOpening] = useState(false);
  const [envelopeHidden, setEnvelopeHidden] = useState(reduced);

  const revealed = phase === "revealed" || phase === "exiting";

  const playReveal = useCallback(() => {
    if (revealed || phase === "exiting") return;

    setPhase("revealed");
    if (reduced) {
      gsap.set(letterRef.current, { y: 0, autoAlpha: 1, clearProps: "transform" });
      setEnvelopeHidden(true);
      return;
    }

    const flap = flapRef.current;
    const pocket = pocketRef.current;
    const letter = letterRef.current;
    const envelope = envelopeRef.current;
    const hint = hintRef.current;
    if (!flap || !pocket || !letter || !envelope) return;

    const fields = letter.querySelectorAll(".letter-field");

    gsap.set(envelope, { xPercent: -50, yPercent: -50, left: "50%", top: "50%" });

    const tl = gsap.timeline({
      onComplete: () => {
        gsap.set(letter, { y: 0 });
        setEnvelopeHidden(true);
      },
    });

    if (hint) tl.to(hint, { autoAlpha: 0, y: -6, duration: 0.25 }, 0);

    tl.to(
      flap,
      { rotateX: 108, duration: 0.5, transformOrigin: "50% 0%", ease: "power2.inOut" },
      0
    )
      .to(
        envelope,
        {
          y: ENVELOPE_DROP_Y,
          rotateX: 22,
          autoAlpha: 0,
          duration: 0.78,
          ease: "power2.in",
          transformOrigin: "50% 20%",
        },
        0.06
      )
      .to(
        pocket,
        { y: 48, autoAlpha: 0, duration: 0.55, ease: "power2.in" },
        0.1
      )
      .to(
        letter,
        {
          y: 0,
          scale: 1,
          autoAlpha: 1,
          duration: 0.82,
          ease: "power3.out",
          boxShadow: "0 22px 48px rgba(15, 23, 42, 0.12)",
        },
        0.14
      )
      .fromTo(
        fields,
        { y: 14, autoAlpha: 0 },
        {
          y: 0,
          autoAlpha: 1,
          duration: 0.38,
          stagger: 0.055,
          ease: "power2.out",
          clearProps: "opacity,visibility,transform",
        },
        0.48
      );
  }, [revealed, phase, reduced]);

  const playExit = useCallback(() => {
    if (reduced) {
      onOpenComplete();
      return;
    }

    setPhase("exiting");
    setOpening(true);

    const letter = letterRef.current;
    const stage = stageRef.current;
    if (!letter || !stage) {
      onOpenComplete();
      return;
    }

    const tl = gsap.timeline({ onComplete: onOpenComplete });

    tl.to(letter, {
      scale: 0.98,
      autoAlpha: 0,
      duration: 0.45,
      ease: "power2.in",
    })
      .to(stage, { autoAlpha: 0, duration: 0.35 }, 0.2)
      .to(bgRef.current, { autoAlpha: 0, duration: 0.3 }, 0.25);
  }, [reduced, onOpenComplete]);

  useImperativeHandle(ref, () => ({ playExit }), [playExit]);

  useGSAP(
    () => {
      if (reduced) return;
      const bg = bgRef.current;
      const stage = stageRef.current;
      const envelope = envelopeRef.current;
      const flap = flapRef.current;
      const letter = letterRef.current;
      const hint = hintRef.current;
      if (!bg || !stage || !envelope || !flap || !letter) return;

      gsap.set(letter, { scale: 0.97, autoAlpha: 0, y: LETTER_NESTED_Y });
      gsap.set(flap, { rotateX: 0, transformOrigin: "50% 0%" });
      gsap.set(pocketRef.current, { y: 0, autoAlpha: 1 });
      gsap.set(envelope, {
        left: "50%",
        top: "50%",
        xPercent: -50,
        yPercent: -50,
        y: 0,
        rotateX: 0,
        autoAlpha: 1,
        scale: 1,
        transformOrigin: "50% 20%",
      });

      const tl = gsap.timeline({ onComplete: () => setPhase("closed") });

      tl.fromTo(bg, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.55, ease: "power1.out" })
        .fromTo(
          stage,
          { y: 36, autoAlpha: 0 },
          { y: 0, autoAlpha: 1, duration: 0.7, ease: "power3.out" },
          0.12
        )
        .fromTo(
          envelope,
          { y: 18, autoAlpha: 0 },
          { y: 0, autoAlpha: 1, duration: 0.55, ease: "power2.out" },
          0.25
        )
        .fromTo(
          hint,
          { autoAlpha: 0, y: 6 },
          { autoAlpha: 1, y: 0, duration: 0.4, ease: "power2.out" },
          0.45
        );
    },
    { scope: root, dependencies: [reduced] }
  );

  const handleEnvelopeActivate = () => {
    if (phase === "closed") playReveal();
  };

  const handleEnvelopeKey = (e: KeyboardEvent) => {
    if (phase === "closed" && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      playReveal();
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!revealed || opening) return;
    onSubmit(e);
  };

  return (
    <div ref={root} className="relative min-h-screen overflow-hidden">
      <div ref={bgRef} className="absolute inset-0 bg-gray-50" aria-hidden />

      <div className="relative min-h-screen flex flex-col items-center justify-center px-4 py-10">
        <p
          ref={hintRef}
          className={`mb-6 text-sm text-gray-500 ${revealed ? "invisible h-0 mb-0" : ""}`}
        >
          轻触信封，取出信笺
        </p>

        <div
          ref={stageRef}
          className="relative flex w-full max-w-[400px] items-center justify-center"
          style={{ perspective: "1200px", minHeight: "min(72vh, 520px)" }}
        >
          {/* 信纸：始终居中，启封前由信封遮住 */}
          <div
            ref={letterRef}
            className={`relative z-10 mx-auto w-full max-w-[380px] rounded-2xl border border-gray-100 bg-white px-5 py-6 shadow-lg shadow-gray-200/50 ${
              !revealed ? "pointer-events-none" : "z-30"
            }`}
            style={{ transformStyle: "preserve-3d" }}
          >
            <header className="letter-field mb-5 border-b border-gray-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center text-white font-bold shadow-md shadow-brand-600/20">
                  O
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-gray-800">Offer 捕手</h1>
                  <p className="text-sm text-gray-500">学生求职匹配智能体</p>
                </div>
              </div>
            </header>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              <LetterField label="邮箱" className="letter-field">
                <LetterInput
                  type="email"
                  value={email}
                  onChange={(e) => onEmailChange(e.target.value)}
                  placeholder="name@school.edu"
                  required
                  autoComplete="email"
                  disabled={!revealed || loading || opening}
                  tabIndex={revealed ? 0 : -1}
                />
              </LetterField>

              <LetterField label="密码" className="letter-field">
                <LetterInput
                  type="password"
                  value={password}
                  onChange={(e) => onPasswordChange(e.target.value)}
                  placeholder="请输入密码"
                  required
                  autoComplete="current-password"
                  disabled={!revealed || loading || opening}
                  tabIndex={revealed ? 0 : -1}
                />
              </LetterField>

              {infoMessage && (
                <p className="letter-field text-sm text-brand-800 bg-brand-50 border border-brand-100 rounded-xl px-3 py-2 transition-opacity duration-500">
                  {infoMessage}
                </p>
              )}

              {error && (
                <p className="letter-field text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                  {error}
                </p>
              )}

              {needsVerify && (
                <div className="letter-field space-y-2">
                  <button
                    type="button"
                    onClick={onResendVerification}
                    disabled={resendLoading || !revealed}
                    className="w-full text-sm py-2 rounded-lg border border-brand-200 text-brand-700 bg-brand-50 hover:bg-brand-100 disabled:opacity-50"
                  >
                    {resendLoading ? "发送中…" : "重发验证邮件"}
                  </button>
                  {resendMsg && (
                    <p className="text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2">{resendMsg}</p>
                  )}
                  {devVerifyUrl && (
                    <a
                      href={devVerifyUrl}
                      className="block text-xs text-brand-600 break-all hover:underline"
                    >
                      开发环境：点击验证链接
                    </a>
                  )}
                </div>
              )}

              <div className="letter-field pt-0.5">
                <button
                  type="submit"
                  disabled={!revealed || loading || opening}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand-600 text-white py-2.5 text-[15px] font-medium shadow-sm shadow-brand-600/25 hover:bg-brand-700 transition-colors disabled:opacity-50"
                  tabIndex={revealed ? 0 : -1}
                >
                  <Mail size={17} strokeWidth={2} />
                  {loading ? "登录中…" : opening ? "进入中…" : "登录"}
                </button>
              </div>
            </form>

            <p className="letter-field mt-4 text-center text-sm text-gray-500">
              <Link to="/forgot-password" className="text-brand-600 font-medium hover:underline">
                忘记密码
              </Link>
            </p>
            <p className="letter-field mt-2 text-center text-sm text-gray-500">
              没有账号？{" "}
              <Link to="/register" className="text-brand-600 font-medium hover:underline">
                注册
              </Link>
            </p>
          </div>

          {/* 信封装饰层：启封后淡出，不再遮挡表单 */}
          {!envelopeHidden && (
            <div
              ref={envelopeRef}
              role="button"
              tabIndex={phase === "closed" ? 0 : -1}
              aria-label="点击打开信封"
              onClick={handleEnvelopeActivate}
              onKeyDown={handleEnvelopeKey}
              className={`absolute z-20 h-[248px] w-full max-w-[400px] rounded-2xl outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-50 ${
                phase === "closed" ? "cursor-pointer" : "pointer-events-none"
              }`}
              style={{ transformStyle: "preserve-3d", left: "50%", top: "50%" }}
            >
              <div
                className="absolute inset-0 rounded-2xl border border-gray-200 bg-white shadow-md shadow-gray-200/60"
                aria-hidden
              />

              <div
                ref={flapRef}
                className="absolute left-0 right-0 top-0 z-30 h-[56%] pointer-events-none"
                style={{ transformStyle: "preserve-3d", transformOrigin: "50% 0%" }}
                aria-hidden
              >
                <div
                  className="w-full h-full"
                  style={{
                    clipPath: "polygon(0 0, 100% 0, 50% 100%)",
                    background: "linear-gradient(180deg, #f9fafb 0%, #e5e7eb 100%)",
                  }}
                />
                <div className="absolute left-1/2 top-[42%] -translate-x-1/2 w-11 h-11 rounded-full bg-brand-600 flex items-center justify-center text-white text-sm font-bold shadow-lg shadow-brand-600/30 ring-4 ring-white">
                  O
                </div>
              </div>

              <div
                ref={pocketRef}
                className="absolute left-0 right-0 bottom-0 z-20 h-[58%] pointer-events-none"
                aria-hidden
              >
                <div
                  className="absolute inset-0 rounded-b-2xl"
                  style={{
                    clipPath: "polygon(0 38%, 50% 5%, 100% 38%, 100% 100%, 0 100%)",
                    background: "linear-gradient(180deg, #f3f4f6 0%, #e5e7eb 100%)",
                  }}
                />
              </div>
            </div>
          )}
        </div>

        
      </div>
    </div>
  );
});

export default EnvelopeLogin;

function LetterField({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-sm text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}

function LetterInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-gray-200 bg-gray-50/80 px-4 py-2.5 text-[15px] text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent focus:bg-white disabled:opacity-60 transition-shadow ${props.className ?? ""}`}
    />
  );
}
