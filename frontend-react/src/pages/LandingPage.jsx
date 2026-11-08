

import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,

  ArrowUpRight,
 
  Egg,
  Menu,
  ScrollText,
  ShieldCheck,
  Syringe,
  TrendingUp,
  X,Layers3,ArrowRight, CalendarCheck, Check,
} from "lucide-react";
import Footer from "./homepage/Footer";
import { FaqSection } from "./homepage/Faq";
import { HowItWorks } from "./homepage/HowItWorks";

const dashboardPreview = "/supportImage/zoe-richardson-frDyQOsjQZI-unsplash.jpg";
const dashboardPreview2 = "/supportImage/muhammed-minhaj-vp-8YZOdT7CsGk-unsplash.jpg";
const NAV_LINKS = [
  { label: "About", href: "#about" },
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
];

// function Logo() {
//   return (
//     <a href="#" className="flex items-center shrink-0">
//       <img
//         src="/images/track-farm-logo-no-est-transparent.png"
//         alt="Track Farm"
//         width={809}
//         height={440}
//         className="h-18 w-auto"
//       />
//     </a>
//   );
// }
export function Logo() {
  return (
    <a href="#" className="flex items-center shrink-0">
      <img
        src="/images/track-farm-logo-horizontal.jpg"
        
        alt="Track Farm"
        width={470}
        height={96}
        className="h-10 w-auto"
      />
    </a>
  );
}
function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="relative z-50 w-full">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Logo />

        <nav className="hidden items-center gap-9 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-[15px] font-medium text-[#174b35] transition-colors hover:text-neutral-950"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <a
            href="/login"
            className="text-[15px] font-medium text-[#174b35] hover:text-neutral-950"
          >
            Log in
          </a>
          <a
            href="/signup"
            className="rounded-full bg-[#d9ed69] px-5 py-2.5 text-[14px] font-semibold text-[#244b2e] transition-colors hover:bg-[#094229] hover:text-white"
          >
            Get started
          </a>
        </div>

        <button
          className="flex items-center justify-center rounded-full p-2 text-neutral-900 md:hidden"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {/* Blurred backdrop — sits behind the menu, over the page */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm md:hidden"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Floating dropdown panel */}
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mx-4 mt-1 rounded-2xl bg-white px-6 py-5 shadow-xl md:hidden">
          <nav className="flex flex-col gap-4">
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-[15px] font-medium text-neutral-700"
                onClick={() => setOpen(false)}
              >
                {link.label}
              </a>
            ))}
            <div className="mt-2 flex flex-col gap-3 border-t border-stone-100 pt-4">
              <a href="/login" className="text-[15px] font-medium text-neutral-700">
                Log in
              </a>
              <a
                href="/signup"
                className="rounded-full bg-[#d9ed69] px-5 py-2.5 text-center text-[14px] font-semibold text-[#244b2e]  hover:bg-[#094229] hover:text-white"
              >
                Get started
              </a>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}

function Hero() {
  return (
    <section className="relative isolate overflow-hidden min-[1700px]:min-h-[42vw]">
      <div
        className="absolute inset-0 -z-10 bg-neutral-100 bg-center min-[1700px]:bg-bottom"
        style={{
          backgroundImage: "url('/images/Gemini_Generated_Image_6mz3jr6mz3jr6mz3.jpg')",
          backgroundSize: "cover",
        }}
      />
      {/* Soft fade so the white nav/content stay readable over any photo */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-white via-white/10 to-white/10" />

      <div className="mx-auto flex max-w-4xl flex-col items-center px-6 pb-48 pt-28 text-center md:pb-40 md:pt-16">
        <h1 className="text-[42px] font-bold leading-[1.08] tracking-tight text-neutral-950 sm:text-[56px] md:text-[68px]">
          <span className="block overflow-hidden">
            <span className="hero-line hero-line-1 block text-[#174b35]">Every Batch, Every</span>
          </span>
          <span className="block overflow-hidden">
            <span className="hero-line hero-line-2 block text-[#174b35]">Bird, Tracked</span>
          </span>
        </h1>

        <p className="hero-subhead mt-10 max-w-[520px] text-[16px] leading-relaxed text-gray-600 md:text-[17px]">
          TrackFarm helps Nigerian poultry farmers replace paper records with
          simple digital tracking feed, mortality, eggs, vaccinations, and
          profit, all in one place.
        </p>

        <a
          href="/signup"
          className="hero-cta mt-12 inline-flex items-center gap-2 rounded-full bg-[#d9ed69] py-3.5 pl-6 pr-3 text-[15px] font-semibold text-[#244b2e] transition-colors hover:bg-coal-500  hover:bg-[#094229] hover:text-white"
        >
          Get started free
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-neutral-950">
            <ArrowUpRight size={16} strokeWidth={2.5} />
          </span>
        </a>
      </div>
    </section>
  );
}



const features = [
  {
    icon: ScrollText,
    title: "Batch & Mortality Tracking",
    text: "Track flock size, bird age, and daily losses by batch so you can monitor changes in your flock and identify unusual mortality patterns early.",
  },
  {
    icon: Egg,
    title: "Daily Feed & Egg Production",
    text: "Record feed consumption and eggs collected each day. TrackFarm automatically calculates feed conversion and laying rates based on the data you enter.",
  },
  {
    icon: Syringe,
    title: "Vaccination & Medication Schedules",
    text: "Keep track of vaccination schedules with due-date reminders to help you stay organized and avoid missing scheduled doses.",
  },
];


function FeatureItem({ icon: Icon, title, text }) {
  return (
    <li className="flex gap-4">
      <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-stone-100 text-stone-900">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <div>
        <h3 className="font-display text-base font-semibold text-neutral-900">
          {title}
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-neutral-600">
          {text}
        </p>
      </div>
    </li>
  );
}

function DashboardFeatureSection() {
  return (
    <section
      id="about"
      className="relative overflow-hidden border-t border-stone-200/70 bg-[#f5f8f5] py-20 sm:py-24 lg:py-28"
    >
      <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 px-6 lg:grid-cols-2 lg:gap-16">
 
        {/* LEFT: Overlapping images */}
        <div className="order-2 lg:order-1">
          <div className="relative mx-auto aspect-[1/1.08] w-full max-w-[520px]">

            {/* Back image (top-left, portrait card) */}
            <div className="absolute left-0 top-0 z-0 h-[78%] w-[64%] overflow-hidden rounded-[10px] border border-stone-200/70 bg-white shadow-lg">
              <img
                src={dashboardPreview}
                alt="TrackFarm dashboard showing farm batches and mortality records"
                className="h-full w-full object-cover object-top"
                loading="lazy"
              />
            </div>

          

            {/* Front image (bottom-right, portrait card overlapping back image) */}
            <div className="absolute bottom-0 right-0 z-20 h-[74%] w-[64%] overflow-hidden rounded-[10px] border-4 border-white bg-white shadow-2xl">
              <img
                src={dashboardPreview2}
                alt="TrackFarm daily records showing feed consumption and egg production"
                className="h-full w-full object-cover object-top object-fit"
                loading="lazy"
              />
            </div>
          </div>
        </div>
 
        {/* RIGHT: Content */}
        <div className="order-1 lg:order-2">
 
          {/* Section label */}
          <span className="inline-flex items-center rounded-full border border-[#cbdacf] bg-[#e9f0e9] px-3 py-1 text-xl font-medium text-[#35664a]">
            About TrackFarm
          </span>
 
          {/* Heading */}
          <h2 className="mt-4 max-w-xl font-heading text-3xl font-bold leading-[1.15] tracking-tight text-[#174b35] sm:text-4xl lg:text-[40px]">
            Everything on Your Farm, at a Single Glance.
          </h2>
 
          {/* Stat card + feature highlights */}
          <div className="mt-8 grid grid-cols-[minmax(130px,0.85fr)_minmax(0,1.15fr)] items-center gap-5">
 
            <div className="flex min-h-[150px] flex-col items-center justify-center rounded-md bg-white px-3 py-5 text-center shadow-md">
              <span className="text-4xl font-bold tracking-tight text-[#205d3e] sm:text-5xl">
                1
              </span>
              <span className="mt-1 text-sm font-medium text-stone-600">
                Place for all
              </span>
              <span className="text-sm text-stone-500">Your farm records</span>
            </div>
 
            <div className="flex flex-col justify-center gap-4">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#8cae42] bg-[#d9ed69] text-[#244b2e]">
                  <Layers3 size={17} />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-[#24563b]">
                    Manage every batch
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-stone-500">
                    Keep flock records and daily activities organized by batch.
                  </p>
                </div>
              </div>
 
              <div className="border-t border-stone-200/80" />
 
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#c7d9c9] bg-[#e8f0e8] text-[#286341]">
                  <CalendarCheck size={17} />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-[#24563b]">
                    Stay on schedule
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-stone-500">
                    Keep up with vaccination dates and farm activities.
                  </p>
                </div>
              </div>
            </div>
          </div>
 
          {/* Description */}
          <p className="mt-7 text-sm leading-[1.85] text-stone-600 sm:text-[15px]">
            No more messy paper logs or guessing your flock's health.
            TrackFarm brings your batches, daily records, feed consumption,
            egg production, and essential farm metrics together in one
            simple dashboard. Everything you need to understand how your
            farm is performing, all in one place.
          </p>
 
          {/* Benefits (left) + CTA (right) on one row */}
          <div className="mt-6 flex flex-col gap-6 sm:flex-row sm:items-center">
            <ul className="space-y-3">
              <li className="flex items-center gap-2.5 text-sm text-stone-600">
                <Check size={17} className="shrink-0 text-[#477d58]" />
                Keep your farm records organized.
              </li>
              <li className="flex items-center gap-2.5 text-sm text-stone-600">
                <Check size={17} className="shrink-0 text-[#477d58]" />
                Make better decisions with accurate farm data.
              </li>
            </ul>
 
            <div className="hidden h-11 w-[1.5px] bg-stone-300 sm:block" />
 
            <Link
              to="/signup"
              className="inline-flex w-fit shrink-0 items-center gap-2 rounded-full border-[1.5px] border-[#174b35] bg-[#d9ed69] px-6 py-2.5 sm:py-3 text-sm font-bold text-[#174b35] shadow-[2px_3.5px_0px_#174b35] transition-all duration-150 hover:bg-[#cde15f] hover:shadow-[2px_4.5px_0px_#174b35] active:translate-x-[1.5px] active:translate-y-[2px] active:shadow-[0.5px_1px_0px_#174b35] "
            >
              Try the Dashboard Free
              <ArrowRight size={16} strokeWidth={2.5} />
            </Link>
          </div>
 
        </div>
      </div>
    </section>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <Hero />
      <DashboardFeatureSection />
      <HowItWorks />
      <FaqSection/>
      <Footer />
    </div>
  );
}

export default LandingPage;