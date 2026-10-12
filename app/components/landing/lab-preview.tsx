"use client";
import { useEffect, useRef } from "react";
import Image from "next/image";
import { createTimeline, onScroll } from "animejs";
import { MARKET_ASSETS } from "../../lib/market-assets";
import { SCENARIOS } from "../../lib/simulation/scenarios";
import { SCORE_MAX } from "../../lib/simulation/score";
import labDark from "./screens/strategy-lab-dark.webp";
import labLight from "./screens/strategy-lab-light.webp";
import { useMediaQuery } from "./use-reduced-motion";

// Full-page captures of the /app Strategy Lab showing a finished Whale Sell
// run, one per theme.
const screens = [
  { theme: "dark", src: labDark },
  { theme: "light", src: labLight },
];
// The laptop screen is 16:10, so only the top of the capture fits. This is
// how far the capture has to travel to bring its last row into view.
const PAGE_TRAVEL = (1 - (labDark.width * 10) / 16 / labDark.height) * 100;
const stats = [
  [Object.keys(SCENARIOS).length, "SEEDED CHALLENGES"],
  [Object.keys(MARKET_ASSETS).length, "LIVE PAPER MARKETS"],
  [SCORE_MAX, "POINT SCORE SCALE"],
] as const;

/**
 * A laptop that opens as the section scrolls into place, then scrolls the
 * Strategy Lab inside its screen while the stage stays pinned.
 */
export function LabPreview() {
  const track = useRef<HTMLElement>(null);
  // Reduced motion, or a viewport too short to pin the laptop and its caption.
  const still = useMediaQuery(
    "(prefers-reduced-motion: reduce), (max-height: 560px)"
  );

  useEffect(() => {
    const el = track.current;
    if (!el || still) return;
    const part = (name: string) =>
      el.querySelector<HTMLElement>(`.landing-laptop-${name}`)!;
    const timeline = createTimeline({
      defaults: { ease: "linear" },
      autoplay: onScroll({
        target: el,
        // Start once the closed laptop is on screen, finish as the pin lets go.
        enter: { target: "top", container: "25%" },
        leave: { target: "bottom", container: "bottom" },
        sync: 0.25,
      }),
    })
      // The screen stays dark until the lid is most of the way up.
      .set(part("page"), { opacity: 0.12 }, 0)
      .add(
        part("lid"),
        { rotateX: [-90, 0], duration: 450, ease: "inOutQuad" },
        0
      )
      .add(part("page"), { opacity: 1, duration: 200 }, 250)
      .add(
        part("page"),
        { translateY: ["0%", `-${PAGE_TRAVEL}%`], duration: 480 },
        520
      );
    return () => {
      timeline.revert();
    };
  }, [still]);

  return (
    <section
      ref={track}
      id="preview"
      className={`landing-laptop-track ${still ? "is-static" : ""}`}
    >
      <div className="landing-laptop-stage">
        <div className="landing-container landing-laptop-layout">
          <div className="landing-laptop">
            <div className="landing-laptop-scene">
              <div className="landing-laptop-deck" aria-hidden="true" />
              <div className="landing-laptop-lid">
                <div className="landing-laptop-shell" aria-hidden="true" />
                <div className="landing-laptop-screen">
                  <div className="landing-laptop-viewport">
                    <div className="landing-laptop-page">
                      {screens.map(({ theme, src }) => (
                        <Image
                          key={theme}
                          src={src}
                          alt="The SpreadForge Strategy Lab after a finished Whale Sell run: quote and risk controls, the SOL / USDC price chart, the settled strategy score, live quotes and execution activity."
                          sizes="(min-width: 1280px) 1040px, 82vw"
                          className={`is-${theme}`}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="landing-laptop-caption">
            <p className="landing-eyebrow">INSIDE THE LAB / STRATEGY LAB</p>
            <h2 className="landing-h2">Open the lab.</h2>
            <dl className="landing-laptop-stats">
              {stats.map(([value, label]) => (
                <div key={label}>
                  <dt>{value.toLocaleString("en-US")}</dt>
                  <dd>{label}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}
