// SWD business configuration
// -----------------------------------------------------------------------------
// Single source of truth for information that changes independently of code:
// contact details, hours, socials, and which pillars/features are live.
// Replace CONFIRM_* placeholders with real values before launch.

export const business = {
  name: "SWD",
  fullName: "Smart Devices & Digital Services",
  tagline: "Technology. Simplified.",
  foundingYear: 2026,
  launchMonth: "November 2026",
  city: "Entebbe",
  country: "Uganda",
} as const;

export const contact = {
  // TODO(confirm): replace before launch
  phone: "CONFIRM_PHONE",
  whatsapp: "CONFIRM_WHATSAPP_NUMBER",
  email: "CONFIRM_EMAIL",
  address: "Entebbe, Uganda", // exact street address not yet finalized
  mapsUrl: "", // fill once a physical address is confirmed
  hours: "CONFIRM_OPENING_HOURS",
} as const;

export const socials = {
  instagram: "", // fill when handle is confirmed
  facebook: "",
  x: "",
  tiktok: "",
  linkedin: "",
} as const;

// Feature flags: controls "coming soon" states without touching page code.
// Per project decision, unavailable pillars render as full pages with a
// coming-soon banner rather than being hidden or reduced to a waitlist form.
export const featureStatus = {
  access: "live",
  care: "live",
  connect: "live",
  business: "comingSoon",
  products: "comingSoon",
  repairs: "comingSoon",
  insights: "comingSoon",
  careers: "comingSoon",
} as const;

export type FeatureKey = keyof typeof featureStatus;

export const pillars = [
  {
    key: "access" as const,
    name: "SWD Access",
    short: "Products & accessories",
    description:
      "Devices, accessories, and everyday technology products — chosen for reliability, not just price.",
    href: "/access",
  },
  {
    key: "care" as const,
    name: "SWD Care",
    short: "Repairs & support",
    description:
      "Diagnosis, repair, and after-sales support for the devices you already own.",
    href: "/care",
  },
  {
    key: "connect" as const,
    name: "SWD Connect",
    short: "Connectivity & digital convenience",
    description:
      "Data, connectivity, and digital-convenience services that keep you online and moving.",
    href: "/connect",
  },
  {
    key: "business" as const,
    name: "SWD Business",
    short: "Coming soon",
    description:
      "Technology support built for small and growing businesses. In development.",
    href: "/business",
  },
];

export const principles = [
  {
    name: "Trust",
    description: "Clear pricing, honest advice, no surprises.",
  },
  {
    name: "Convenience",
    description: "Technology support that fits around your day, not the other way around.",
  },
  {
    name: "Quality",
    description: "Products and repairs we'd trust with our own devices.",
  },
  {
    name: "Transparency",
    description: "You always know what's being done and why.",
  },
  {
    name: "Innovation",
    description: "Practical improvements, not novelty for its own sake.",
  },
];

export const careJourney = [
  { step: "Bring", description: "Bring your device in, or tell us what's wrong." },
  { step: "Diagnose", description: "We identify the issue and explain the options." },
  { step: "Fix", description: "We repair it, using the right parts for the job." },
  { step: "Return", description: "You get your device back, working properly." },
];
