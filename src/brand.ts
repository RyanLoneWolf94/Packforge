/**
 * Studio-level constants sourced from the LoneWolf Digital Inc Master KB (v1.4).
 * Keep this in sync with the KB rather than hardcoding studio details in pages —
 * client-facing copy (portal footer, share links, email signatures) reads from here.
 */

export const STUDIO = {
  name: "LoneWolf Digital Inc",
  shortName: "LoneWolf",
  productName: "Packforge",
  tagline: "Your Brand's Digital Pack",
  altTagline: "Your Den for Digital Dominance",
  website: "lonewolfdigitech.com",
  websiteUrl: "https://lonewolfdigitech.com",
  email: "ryan@lonewolfdigitech.com",
  phone: "+84 813 856 880",
  whatsapp: "84813856880",
  lead: "Ryan",
  locations: "Hanoi / Harare",
} as const;

/** Brand hexes, for the handful of places that need a raw value (SVG, inline gradients). */
export const BRAND_COLORS = {
  orange: "#FF6B00",
  purple: "#5B0FA8",
  red: "#CC1A00",
  gold: "#FFB300",
  night: "#1E1633",
  line: "#E7E4DE",
} as const;

export type TierId = "pup" | "wolf" | "alpha";

export interface ServicePackage {
  id: TierId;
  name: string;
  price: number;
  bestValue?: boolean;
  bestFor: string;
  includes: string[];
}

/** Live branding packages as listed on lonewolfdigitech.com/branding-packages. */
export const BRANDING_PACKAGES: ServicePackage[] = [
  {
    id: "pup",
    name: "The Pup",
    price: 350,
    bestFor: "Businesses needing a complete foundational identity",
    includes: [
      "Responsive Logo Suite (×3 revisions)",
      "Basic Brand DNA / Strategy",
      "Complete Stationery Suite",
      "Brand Patterns",
      "Custom Typography & Colour Palette",
      "Email Signature Design",
      "Social Media Covers",
      "Full Brand Manual Document",
    ],
  },
  {
    id: "wolf",
    name: "The Wolf",
    price: 675,
    bestValue: true,
    bestFor: "Growing brands needing a full brand system + multimedia",
    includes: [
      "Everything in The Pup",
      "Brand Strategy & Brand DNA",
      "Packaging Design System (×5 products)",
      "30-Second Brand Ad (Video)",
      "Logo Animation (Sting)",
      "Social Media Kit & Ad Creatives",
      "Professional Email Setup",
      "Pro Voice Over Included",
    ],
  },
  {
    id: "alpha",
    name: "Alpha Pack",
    price: 2300,
    bestFor: "Established businesses ready for full digital domination",
    includes: [
      "Everything in The Wolf",
      "Advanced Marketing Strategy",
      "Social Media Ads (×20 + Campaign Setup)",
      "Pro Website + 6 Months Hosting",
      "Domain Registration (1 Year)",
      "SEO & Social Integration",
      "Online Booking System",
      "Newsletter & Campaign Automations",
    ],
  },
];

/** Ad design packages — standalone, fast-turnaround creative. */
export const AD_PACKAGES: ServicePackage[] = [
  {
    id: "pup",
    name: "Pup Pack",
    price: 10,
    bestFor: "A quick start or testing a new campaign",
    includes: ["1 + 1 Ad Creative", "Custom Graphics", "JPG, PNG", "1 day turnaround"],
  },
  {
    id: "wolf",
    name: "Wolf Pack",
    price: 25,
    bestValue: true,
    bestFor: "Growing brands running multiple campaigns",
    includes: ["3 + bonus Ad Creatives", "Custom Graphics", "JPG, PNG, PDF", "2 day turnaround"],
  },
  {
    id: "alpha",
    name: "Alpha Pack",
    price: 50,
    bestFor: "A full suite of ad creative",
    includes: ["7 + bonus Ad Creatives", "Custom Graphics", "JPG, PNG, PDF", "4 day turnaround"],
  },
];
