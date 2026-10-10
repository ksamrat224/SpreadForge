import Link from "next/link";
import { IconArrowRight } from "@tabler/icons-react";

export function FinalCta() {
  return (
    <section className="landing-final">
      <div className="landing-container">
        <p className="landing-eyebrow">YOUR NEXT TICK STARTS HERE</p>
        <h2 className="landing-h2">
          Ready to make
          <span>the market?</span>
        </h2>
        <p className="landing-final-lede">
          No sign-up. No real funds. Just better decisions.
        </p>
        <Link
          href="/app"
          className="landing-btn landing-btn-primary landing-btn-lg"
        >
          Launch SpreadForge
          <IconArrowRight size={18} />
        </Link>
      </div>
    </section>
  );
}
