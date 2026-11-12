import { useState } from "react";
import { ChevronDown } from "lucide-react";
import faqPoultry from "/images/jan-baborak-qKIoSfYSXb8-unsplash.webp";

const faqs = [
  {
    num: "01",
    question: "What is TrackFarm?",
    answer:
      "TrackFarm is a poultry farm management app that helps you organize your farm records in one place. Track batches, monitor bird mortality, log feed consumption, record egg production, and manage vaccination schedules without relying on messy paper records.",
  },
  {
    num: "02",
    question: "Can I manage multiple batches at once?",
    answer:
      "Yes. TrackFarm helps you organize your birds into separate batches, making it easier to monitor flock sizes, bird ages, mortality, and other records for each batch.",
  },
  {
    num: "03",
    question: "Can I track feed consumption and egg production?",
    answer:
      "Yes. Record the feed used and eggs collected to maintain accurate daily records. TrackFarm can automatically calculate feed conversion and laying rates based on the data you enter.",
  },
  {
    num: "04",
    question: "How does TrackFarm help me monitor bird mortality?",
    answer:
      "Record daily bird losses for each batch and keep track of changes in your flock size. These records help you identify unusual mortality patterns and make more informed farm management decisions.",
  },
  {
    num: "05",
    question: "Will TrackFarm remind me about vaccinations?",
    answer:
      "TrackFarm includes vaccination schedules with due-date reminders to help you keep track of upcoming vaccinations and avoid missing scheduled doses.",
  },
  {
    num: "06",
    question: "Do I need to keep paper records alongside TrackFarm?",
    answer:
      "TrackFarm is designed to replace scattered paper records with organized digital farm records. By keeping your batch information, daily logs, feed consumption, and production records in one place, you can access your farm's information more conveniently.",
  },
];

export function FaqSection() {
  // null = every card closed by default
  const [openIndex, setOpenIndex] = useState(null);

  return (
    <section id="faq" className="scroll-mt-16 bg-[#f5f8f5] py-14 sm:py-20">
      <div className="mx-auto max-w-6xl  px-4 sm:px-6">
        {/* Header row: label + heading left, small paragraph right */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <span className="inline-flex items-center rounded-full border border-[#cbdacf] bg-[#e9f0e9] px-3 py-1 text-xl font-semibold tracking-wide text-[#35664a]">
              FAQ
            </span>
            <h2 className="mt-3 max-w-[280px] text-[24px] font-bold leading-[1.15] text-[#174b35] sm:max-w-[400px] sm:text-5xl lg:text-5xl lg:font-bold">
              Quick Answers for Poultry Farmers
            </h2>
          </div>
          <p className="max-w-[240px] text-[13px] leading-relaxed text-[#6b7a70] sm:mt-10 font-bold">
            Everything you need to know about managing your poultry farm with
            TrackFarm.
          </p>
        </div>

        {/* Cards (left) + small image (right) */}
        <div className="mt-8 grid items-stretch gap-10 lg:grid-cols-[1fr_300px]">
          <ul className="mt-8 space-y-3.5">
            {faqs.map((item, index) => {
              const isOpen = openIndex === index;
              return (
                <li
                  key={item.num}
                  className={`border transition-all duration-200 ${
                    isOpen
                      ? "rounded-[28px] border-[#d9ed69] bg-[#d9ed69]"
                      : "rounded-full border-[#174b35]/70 bg-white"
                  }`}
                >
                  <h3>
                    <button
                      type="button"
                      id={`faq-button-${index}`}
                      aria-expanded={isOpen}
                      aria-controls={`faq-panel-${index}`}
                      onClick={() => setOpenIndex(isOpen ? null : index)}
                      className={`flex w-full items-center gap-4 px-6 py-3.5 sm:py-4 text-left transition-colors ${
                        isOpen ? "rounded-[28px]" : "rounded-full"
                      }`}
                    >
                      <span
                        className={`text-base sm:text-[17px] font-bold tracking-wide transition-colors ${
                          isOpen ? "text-[#174b35]" : "text-[#9fb0a4]"
                        }`}
                      >
                        {item.num}
                      </span>
                      <span className="flex-1 text-sm sm:text-[15px] font-bold leading-snug text-[#174b35]">
                        {item.question}
                      </span>
                      <span
                        className={`flex h-6 w-6 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded-full transition-transform duration-200 ${
                          isOpen
                            ? "rotate-180 bg-white text-[#174b35]"
                            : "bg-[#d9ed69] text-[#174b35]"
                        }`}
                      >
                        <ChevronDown className="h-3.5 w-3.5 stroke-[2.5]" aria-hidden="true" />
                      </span>
                    </button>
                  </h3>

                  {/* Answer only exists in the DOM when the card is open */}
                  {isOpen && (
                    <div
                      id={`faq-panel-${index}`}
                      role="region"
                      aria-labelledby={`faq-button-${index}`}
                    >
                      <p className="px-6 pb-4 pl-[3.8rem] sm:pl-[4.25rem] text-xs sm:text-[13px] leading-relaxed text-[#244b2e]">
                        {item.answer}
                      </p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {/* Image fills the full height of the accordion column */}
          <div className="relative hidden lg:block lg:sticky lg:top-24 self-stretch min-h-[300px] overflow-hidden rounded-lg">
            <img
              src={faqPoultry}
              alt="A farmer holding a healthy brown hen inside a bright, modern poultry coop"
              className="h-full w-full object-cover"
              loading="lazy"
              width={500}
              height={725}
            />
            {/* Soft green-tinted overlay to dim and blend with the page */}
            <div className="absolute inset-0 bg-[#f5f8f5]/10 backdrop-blur-[1px]" />
          </div>
        </div>
      </div>
    </section>
  );
}