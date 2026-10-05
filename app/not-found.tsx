import { Button } from "@/components/Button";

export default function NotFound() {
  return (
    <section className="mx-auto flex max-w-2xl flex-col items-center px-5 py-28 text-center sm:px-8">
      <p className="text-sm font-medium text-blue">404</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-navy sm:text-4xl">
        Looks like this page took a wrong turn.
      </h1>
      <p className="mt-4 text-lg text-slate">
        The page you&apos;re looking for doesn&apos;t exist, or has moved.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button href="/">Home</Button>
        <Button href="/services" variant="secondary">
          Explore services
        </Button>
      </div>
    </section>
  );
}
