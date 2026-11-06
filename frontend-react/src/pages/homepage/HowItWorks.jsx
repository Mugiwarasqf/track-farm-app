import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const STEPS = [
  {
    tag: "Step 01",
    title: "Create & Organize Batches",
    description:
      "Set up your flock in seconds. Track bird type, breed, arrival date, initial flock size, and pen assignments all in one place.",
    cta: "Explore Batch Setup",
    href: "/signup",
    image: "/supportImage/dextar-studio-l-924IyJ0_g-unsplash.jpg",
    alt: "Young healthy chicks inside a clean poultry pen",
  },
  {
    tag: "Step 02",
    title: "Log Daily Farm Records",
    description:
      "Quickly record feed consumption, daily mortality, and egg production straight from your phone while walking through the pens.",
    cta: "See Daily Logging",
    href: "/signup",
    image: "/supportImage/erol-ahmed-leOh1CzRZVQ-unsplash.jpg",
    alt: "Freshly collected farm eggs in an egg crate",
  },
  {
    tag: "Step 03",
    title: "Automate Health & Schedules",
    description:
      "Stay ahead with timely reminders for vaccinations, medications, and supplements to protect your birds and keep mortality low.",
    cta: "View Vaccination Alerts",
    href: "/signup",
    image: "/supportImage/athieno-joy-IVUOhqjII2o-unsplash.jpg",
    alt: "Poultry birds in a farm yard receiving care",
  },
  {
    tag: "Step 04",
    title: "Monitor Performance & Profit",
    description:
      "Automatic calculations for Feed Conversion Ratio (FCR), laying percentages, and flock trends so you make profitable decisions.",
    cta: "Check Farm Insights",
    href: "/signup",
    image: "/supportImage/zoe-richardson-XOGg38VufZs-unsplash.jpg",
    alt: "Vibrant healthy chickens feeding on an organized farm",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-16 bg-[#f5f8f5] py-12 sm:py-22">
      <div className="mx-auto max-w-6xl px-6">
        {/* Section Header */}
        <div className="mx-auto max-w-4xl text-center">
          
          <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight text-[#174b35] sm:text-4xl lg:text-[42px] lg:leading-[1.18]">
            Simple Farm Management for Modern Poultry Keepers
          </h2>
          <p className="mt-3.5 text-sm leading-relaxed text-stone-600 sm:text-base">
            From arrival day to market sale, TrackFarm streamlines every phase of your poultry operations in four simple steps.
          </p>
        </div>

        {/* 2x2 Grid matching reference design */}
        <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-2 lg:gap-8">
          {STEPS.map((step) => (
            <div
              key={step.tag}
              className="group flex flex-col-reverse overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-sm transition-all duration-300 hover:border-[#174b35]/30 hover:shadow-md sm:flex-row sm:items-stretch"
            >
              {/* Text Content (Left side on desktop/tablet) */}
              <div className="flex flex-1 flex-col justify-between p-3 sm:p-6">
                <div>
                  <span className="inline-block rounded-full bg-[#f0f4f1] px-3 py-1 text-[11px] font-semibold tracking-wider text-[#285e43]">
                    {step.tag}
                  </span>
                  <h3 className="mt-3 font-heading text-lg font-bold text-[#174b35] sm:text-xl">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-stone-600 sm:text-[13px]">
                    {step.description}
                  </p>
                </div>

                <div className="mt-3 pt-2">
                  <Link
                    to={step.href}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#174b35] transition-colors group-hover:text-[#285e43]"
                  >
                    <span>{step.cta}</span>
                    <ArrowRight
                      size={14}
                      className="transition-transform duration-200 group-hover:translate-x-1"
                    />
                  </Link>
                </div>
              </div>

              {/* Image (Right side on desktop/tablet) */}
              <div className="relative h-38 w-full overflow-hidden  sm:h-auto sm:w-[46%] sm:min-w-[190px]">
                <img
                  src={step.image}
                  alt={step.alt}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default HowItWorks;

