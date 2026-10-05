"use client";

import { useState, type FormEvent } from "react";

type Status = "idle" | "submitting" | "success" | "error";

export function ContactForm() {
  const [status, setStatus] = useState<Status>("idle");

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setStatus("submitting");

    // No backend is wired up yet — this simulates submission so the UI/UX
    // can be reviewed. Replace with a real endpoint before launch.
    await new Promise((resolve) => setTimeout(resolve, 700));

    const form = e.currentTarget;
    const name = (form.elements.namedItem("name") as HTMLInputElement)?.value;
    const email = (form.elements.namedItem("email") as HTMLInputElement)
      ?.value;

    if (!name || !email) {
      setStatus("error");
      return;
    }

    setStatus("success");
    form.reset();
  }

  if (status === "success") {
    return (
      <div
        role="status"
        className="rounded-xl border border-border bg-white p-6"
      >
        <p className="text-lg font-semibold text-navy">Message sent.</p>
        <p className="mt-2 text-[15px] text-slate">
          Thanks for reaching out — we&apos;ll get back to you as soon as we
          can.
        </p>
        <button
          onClick={() => setStatus("idle")}
          className="mt-4 text-sm font-medium text-blue underline underline-offset-4"
        >
          Send another message
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div>
        <label
          htmlFor="name"
          className="mb-1.5 block text-sm font-medium text-navy"
        >
          Name
        </label>
        <input
          id="name"
          name="name"
          type="text"
          required
          className="w-full rounded-lg border border-border-strong bg-white px-4 py-2.5 text-[15px] text-charcoal placeholder:text-slate/60 focus:border-blue"
          placeholder="Your name"
        />
      </div>

      <div>
        <label
          htmlFor="email"
          className="mb-1.5 block text-sm font-medium text-navy"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="w-full rounded-lg border border-border-strong bg-white px-4 py-2.5 text-[15px] text-charcoal placeholder:text-slate/60 focus:border-blue"
          placeholder="you@example.com"
        />
      </div>

      <div>
        <label
          htmlFor="topic"
          className="mb-1.5 block text-sm font-medium text-navy"
        >
          What&apos;s this about?
        </label>
        <select
          id="topic"
          name="topic"
          className="w-full rounded-lg border border-border-strong bg-white px-4 py-2.5 text-[15px] text-charcoal focus:border-blue"
          defaultValue="general"
        >
          <option value="general">General enquiry</option>
          <option value="product">A product</option>
          <option value="repair">A repair</option>
          <option value="business">SWD Business</option>
        </select>
      </div>

      <div>
        <label
          htmlFor="message"
          className="mb-1.5 block text-sm font-medium text-navy"
        >
          Message
        </label>
        <textarea
          id="message"
          name="message"
          rows={4}
          required
          className="w-full rounded-lg border border-border-strong bg-white px-4 py-2.5 text-[15px] text-charcoal placeholder:text-slate/60 focus:border-blue"
          placeholder="How can we help?"
        />
      </div>

      {status === "error" && (
        <p role="alert" className="text-sm text-red-600">
          Please fill in your name and email before sending.
        </p>
      )}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="inline-flex items-center justify-center rounded-lg bg-blue px-5 py-3 text-[15px] font-medium text-white transition-colors hover:bg-blue-dark disabled:opacity-60"
      >
        {status === "submitting" ? "Sending…" : "Send message"}
      </button>
    </form>
  );
}
