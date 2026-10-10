import Link from "next/link";
import { IconArrowRight, IconPlayerPlay } from "@tabler/icons-react";
import { HeroScene } from "./hero-scene";

const rise = (step: number) => ({ "--rise": step }) as React.CSSProperties;

export function Hero() {
  return (
    <section id="top" className="landing-hero">
      <HeroScene />
      <div className="landing-container landing-hero-body">
        <p className="landing-hero-kicker mono landing-rise" style={rise(0)}>
          <i className="landing-dot" aria-hidden="true" />
          THE SOLANA MARKET-MAKING LABORATORY
          <span>/ 001</span>
        </p>
        <h1 className="landing-hero-title landing-rise" style={rise(1)}>
          Spread<span>Forge.</span>
        </h1>
        <p className="landing-hero-lede landing-rise" style={rise(2)}>
          Market making is a craft. Learn the mechanics, stress-test your
          strategy, and commit every run as a hashed result on Solana.
        </p>
        <div
          className="landing-rise mt-9 flex flex-wrap items-center gap-3"
          style={rise(3)}
        >
          <Link href="/app" className="landing-btn landing-btn-primary">
            Enter the lab
            <IconArrowRight size={17} />
          </Link>
          <a href="#experience" className="landing-btn landing-btn-secondary">
            Watch it work
            <IconPlayerPlay size={16} />
          </a>
        </div>
      </div>
      <div className="landing-container">
        <ol className="landing-hero-rail mono">
          <li>01 / LEARN</li>
          <li>02 / SIMULATE</li>
          <li>03 / COMPETE</li>
        </ol>
      </div>
    </section>
  );
}
