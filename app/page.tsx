import Link from "next/link";
import { Button } from "@/components/Button";
import { SectionHeader } from "@/components/SectionHeader";
import { PillarCard } from "@/components/PillarCard";
import { careJourney, featureStatus, pillars, principles } from "@/lib/config";

function DeviceMark() {
  return (
    <svg
      viewBox="0 0 360 360"
      className="h-full w-full"
      aria-hidden
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle cx="180" cy="180" r="179" stroke="#DDE5EE" strokeWidth="1" fill="none" />
      <circle cx="180" cy="180" r="132" stroke="#DDE5EE" strokeWidth="1" fill="none" />
      <g stroke="#147DFF" strokeWidth="1.5">
        <line x1="180" y1="1" x2="180" y2="48" />
        <line x1="180" y1="312" x2="180" y2="359" />
        <line x1="1" y1="180" x2="48" y2="180" />
        <line x1="312" y1="180" x2="359" y2="180" />
      </g>
      <rect x="132" y="90" width="96" height="180" rx="16" fill="#102A43" />
      <rect x="144" y="106" width="72" height="140" rx="4" fill="#F4F8FC" />
      <circle cx="180" cy="258" r="6" fill="#22C7D6" />
      <circle cx="180" cy="60" r="5" fill="#22C7D6" />
      <circle cx="60" cy="180" r="5" fill="#147DFF" />
      <circle cx="300" cy="180" r="5" fill="#147DFF" />
    </svg>
  );
}

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="border-b border-border bg-white">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[1.1fr_0.9fr] lg:gap-8">
          <div className="animate-fade-up">
            <p className="text-sm font-medium text-blue">
              Launching in Entebbe, Uganda — <span className="text-slate">November 2026</span>
            </p>
            <h1 className="mt-4 text-5xl font-semibold tracking-tight text-navy sm:text-6xl">
              Technology.
              <br />
              Simplified.
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-slate">
              SWD brings devices, repairs, and connectivity together in one
              place — so getting the technology you need, and keeping it
              working, doesn&apos;t have to be complicated.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button href="/services">Explore SWD</Button>
              <Button href="/contact" variant="secondary">
                Contact SWD
              </Button>
            </div>
          </div>
          <div
            className="mx-auto w-full max-w-sm animate-fade-up lg:max-w-none"
            style={{ animationDelay: "120ms" }}
          >
            <DeviceMark />
          </div>
        </div>
      </section>

      {/* What SWD does */}
      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <SectionHeader
          title="What SWD does"
          description="Four ways SWD makes technology more accessible — starting with the three available at launch."
        />
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {pillars.map((p, i) => (
            <PillarCard
              key={p.key}
              name={p.name}
              short={p.short}
              description={p.description}
              href={p.href}
              status={featureStatus[p.key]}
              featured={i === 0}
            />
          ))}
        </div>
      </section>

      {/* Why SWD */}
      <section className="border-y border-border bg-white">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
          <SectionHeader
            title="Why SWD"
            description="Five principles that shape every product we carry and every repair we take on."
          />
          <div className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-5">
            {principles.map((p) => (
              <div key={p.name}>
                <p className="text-lg font-semibold text-navy">{p.name}</p>
                <p className="mt-1.5 text-[15px] leading-relaxed text-slate">
                  {p.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured products / services */}
      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHeader
            title="Featured"
            description="A first look at what SWD Access will carry. Full catalogue coming at launch."
          />
          <Link
            href="/products"
            className="text-sm font-medium text-blue underline underline-offset-4"
          >
            View all products
          </Link>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {["Devices & phones", "Accessories", "Connectivity add-ons"].map(
            (label) => (
              <div
                key={label}
                className="flex flex-col justify-between rounded-xl border border-dashed border-border-strong p-6"
              >
                <div>
                  <p className="text-lg font-semibold text-navy">{label}</p>
                  <p className="mt-2 text-[15px] text-slate">
                    Catalogue being finalized ahead of launch.
                  </p>
                </div>
                <span className="mt-6 inline-block w-fit rounded-full border border-border-strong px-3 py-1 text-xs text-slate">
                  Coming soon
                </span>
              </div>
            ),
          )}
        </div>
      </section>

      {/* SWD Care journey */}
      <section className="border-y border-border bg-white">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
          <SectionHeader
            title="SWD Care, from drop-off to done"
            description="A straightforward repair process, with no surprises along the way."
          />
          <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {careJourney.map((step, i) => (
              <li key={step.step}>
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy text-sm font-medium text-white">
                    {i + 1}
                  </span>
                  <p className="text-lg font-semibold text-navy">
                    {step.step}
                  </p>
                </div>
                <p className="mt-3 text-[15px] leading-relaxed text-slate">
                  {step.description}
                </p>
              </li>
            ))}
          </ol>
          <div className="mt-10">
            <Button href="/care" variant="secondary">
              More about SWD Care
            </Button>
          </div>
        </div>
      </section>

      {/* Connect intro */}
      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <div className="grid gap-10 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-sm font-medium text-cyan">SWD Connect</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight text-navy sm:text-4xl">
              Staying connected shouldn&apos;t be the hard part.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-slate">
              Data, connectivity, and the digital-convenience services that
              keep your devices — and your day — running.
            </p>
            <div className="mt-6">
              <Button href="/connect" variant="secondary">
                Explore SWD Connect
              </Button>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-white p-8">
            <div className="flex items-center gap-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-cyan/15 text-cyan">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path
                    d="M4 9a13 13 0 0 1 16 0M7 13a8.5 8.5 0 0 1 10 0M10.5 17a4 4 0 0 1 3 0"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                  <circle cx="12" cy="20" r="1.2" fill="currentColor" />
                </svg>
              </span>
              <div>
                <p className="font-semibold text-navy">Built for everyday use</p>
                <p className="text-sm text-slate">Not just for launch day</p>
              </div>
            </div>
            <p className="mt-5 text-[15px] leading-relaxed text-slate">
              SWD Connect is designed to grow alongside SWD Access and SWD
              Care, so the device you buy and the connection you rely on come
              from the same place.
            </p>
          </div>
        </div>
      </section>

      {/* Future vision */}
      <section className="border-y border-border bg-navy text-white">
        <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-cyan">Looking ahead</p>
            <h2 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">
              Starting in Entebbe. Built to grow across East Africa.
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-white/75">
              SWD is starting with one location and a clear focus. Over time,
              that same approach — reliable products, honest repairs, and
              straightforward connectivity — is what we want to bring to more
              places.
            </p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-5 py-20 text-center sm:px-8">
        <h2 className="text-3xl font-semibold tracking-tight text-navy sm:text-4xl">
          Technology shouldn&apos;t be complicated.
          <br />
          Let&apos;s simplify it.
        </h2>
        <div className="mt-8 flex justify-center">
          <Button href="/contact">Talk to SWD</Button>
        </div>
      </section>
    </>
  );
}
