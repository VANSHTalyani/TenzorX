import { ButtonLink } from "@/components/ui/Button";
import Card, { CardHeader } from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import {
  VideoIcon,
  MicIcon,
  GlobeIcon,
  BrainIcon,
  ChartIcon,
  TagIcon,
  ShieldIcon,
  ArrowRightIcon,
} from "@/components/ui/IconSet";

const features = [
  {
    title: "Live video & speech",
    desc: "Secure browser capture with chunked upload for real-time transcription.",
    icon: VideoIcon,
  },
  {
    title: "Speech-to-text",
    desc: "Local Whisper pipeline turns your answers into a searchable transcript.",
    icon: MicIcon,
  },
  {
    title: "Geo & device signals",
    desc: "Location and session metadata feed fraud checks alongside policy rules.",
    icon: GlobeIcon,
  },
  {
    title: "Vision & liveness",
    desc: "Age estimation and basic liveness heuristics support KYC validation.",
    icon: ShieldIcon,
  },
  {
    title: "LLM intelligence",
    desc: "Structured extraction from conversation — never overriding hard rules.",
    icon: BrainIcon,
  },
  {
    title: "Risk & offers",
    desc: "Bureau-style signals, propensity scoring, and EMI-ready personalised offers.",
    icon: ChartIcon,
  },
];

export default function Home() {
  return (
    <div>
      <section className="gradient-hero text-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:py-24 sm:px-6">
          <Badge variant="neutral" className="mb-4 border-0 bg-white/15 text-white">
            Video-first origination
          </Badge>
          <h1 className="max-w-3xl text-balance text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
            Onboard customers in one guided session
          </h1>
          <p className="mt-6 max-w-2xl text-lg text-blue-100/95 leading-relaxed">
            Campaign link → video interview → consent & KYC signals → policy and
            risk → instant offers. Built for auditability and modular backends.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            <ButtonLink
              href="/onboard?campaign=DEMO-2026&channel=link"
              size="lg"
              className="shadow-lg shadow-black/25 gap-2"
            >
              Start onboarding
              <ArrowRightIcon className="w-4 h-4" />
            </ButtonLink>
            <ButtonLink href="/operator" variant="inverse" size="lg">
              Operator console
            </ButtonLink>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
            Everything in the flow diagram, in one stack
          </h2>
          <p className="mt-3 text-slate-600">
            From campaign entry to central audit logging — wired with clear APIs
            and typed contracts.
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <Card key={f.title} hover padding="md" className="animate-fade-in">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <f.icon className="w-5 h-5" />
              </div>
              <h3 className="font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">{f.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      <section className="border-y border-surface-200 bg-surface-50 py-16">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">How the journey flows</h2>
              <ol className="mt-6 space-y-4">
                {[
                  "Customer opens a campaign link (SMS, WhatsApp, email).",
                  "Browser captures video, audio, and geo with explicit consent.",
                  "STT + vision + LLM normalise inputs; policy and risk decide.",
                  "Offers render with EMI, rate, and tenure; audit trail is stored.",
                ].map((t, i) => (
                  <li key={i} className="flex gap-3 text-slate-700">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-xs font-bold text-white">
                      {i + 1}
                    </span>
                    <span className="text-sm leading-relaxed pt-0.5">{t}</span>
                  </li>
                ))}
              </ol>
            </div>
            <Card padding="lg" className="border-brand-100 shadow-glow">
              <CardHeader
                title="Ready to try a session?"
                subtitle="Use the demo campaign or plug in your own API base URL."
              />
              <div className="flex flex-wrap gap-3">
                <ButtonLink
                  href="/onboard?campaign=DEMO-2026&channel=link"
                  className="gap-2"
                >
                  Launch demo
                  <ArrowRightIcon className="w-4 h-4" />
                </ButtonLink>
                <ButtonLink href="/operator" variant="secondary">
                  Review a session ID
                </ButtonLink>
              </div>
              <p className="mt-4 text-xs text-slate-500 flex items-start gap-2">
                <TagIcon className="w-4 h-4 shrink-0 text-accent-500 mt-0.5" />
                Offers are illustrative; integrate bureau and compliance vendors
                before production launch.
              </p>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
