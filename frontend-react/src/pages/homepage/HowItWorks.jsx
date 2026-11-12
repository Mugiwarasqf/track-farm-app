const FEATURES = [
  {
    title: "Vaccination Reminders",
    description:
      "Get reminded before a vaccination is due, and keep a record of every dose so you never have to guess when the last one happened.",
    image: "/supportImage/athieno-joy-IVUOhqjII2o-unsplash.webp",
    alt: "Poultry birds in a farm yard receiving care",
  },
  {
    title: "Batch Management",
    description:
      "Set up your flock in seconds. Keep bird type, breed, arrival date, flock size, and pen for every batch in one place.",
    image: "/supportImage/dextar-studio-l-924IyJ0_g-unsplash.webp",
    alt: "Young healthy chicks inside a clean poultry pen",
  },
  {
    title: "Daily Farm Records",
    description:
      "Record feed, mortality, and egg collection straight from your phone while you walk through the pens.",
    image: "/supportImage/erol-ahmed-leOh1CzRZVQ-unsplash.webp",
    alt: "Freshly collected farm eggs in an egg crate",
  },
  {
    title: "Bird Weight Tracking",
    description:
      "Weigh a few birds from time to time and see how each batch is growing, without working it out in a notebook.",
    image: "/supportImage/vidar-nordli-mathisen-dC-z4r8tr6U-unsplash.webp",
    alt: "A full-grown rooster standing on a paved farm yard",
  },
  {
    title: "Feed Conversion",
    description:
      "See how much feed it takes to grow each kilo of bird. TrackFarm works out your Feed Conversion Ratio from the records you enter.",
    image: "/supportImage/zoe-richardson-XOGg38VufZs-unsplash.webp",
    alt: "Vibrant healthy chickens feeding on an organized farm",
  },
  {
    title: "Batch Profit Tracking",
    description:
      "Record your costs and sales for each batch, and see how much profit it made when the batch is complete.",
    image: "/supportImage/creab-thepolymath-rY56zxvWnKs-unsplash.webp",
    alt: "A hand picking a brown egg from stacked egg trays",
  },
];

export function HowItWorks() {
  return (
    <section id="features" className="scroll-mt-16 bg-[#f5f8f5] py-12 sm:py-22">
      <div className="mx-auto max-w-6xl px-6">
        {/* Section Header */}
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="mt-4 font-heading text-3xl font-bold tracking-tight text-[#174b35] sm:text-4xl lg:text-[42px] lg:leading-[1.18]">
            Simple Farm Management for Modern Poultry Keepers
          </h2>
          <p className="mt-3.5 text-sm leading-relaxed text-stone-600 sm:text-base">
            From arrival day to market sale, TrackFarm keeps every part of your poultry farm in one place.
          </p>
        </div>

        {/* Six tiles: one per row below lg, three per row on large screens */}
        <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-5">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="group flex flex-col-reverse overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-sm transition-all duration-300 hover:border-[#174b35]/30 hover:shadow-md sm:flex-row sm:items-stretch"
            >
              {/* Text Content (Left side on desktop/tablet) */}
              <div className="flex flex-1 flex-col p-3 sm:p-6 lg:p-4">
                <h3 className="font-heading text-lg font-bold text-[#174b35] sm:text-xl lg:text-base">
                  {feature.title}
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-stone-600 sm:text-[13px] lg:text-xs">
                  {feature.description}
                </p>
              </div>

              {/* Image (Right side on desktop/tablet) */}
              <div className="relative h-38 w-full overflow-hidden sm:h-auto sm:w-[46%] sm:min-w-[190px] lg:w-[40%] lg:min-w-0">
                <img
                  src={feature.image}
                  alt={feature.alt}
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
