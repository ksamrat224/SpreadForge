"use client";
import Link from "next/link";
import { IconArrowRight } from "@tabler/icons-react";
import StarBorder from "../reactbits/StarBorder";
import Magnet from "../reactbits/Magnet";
import SplitText from "../reactbits/SplitText";
import AnimatedContent from "../reactbits/AnimatedContent";
import ShinyText from "../reactbits/ShinyText";

export function FinalCta() {
  return (
    <section className="landing-section pb-28">
      <div className="landing-container">
        <div className="landing-final">
          <div className="landing-final-glow" aria-hidden="true" />
          <ShinyText
            text="LEARN · SIMULATE · COMPETE"
            color="#2de2b0"
            shineColor="#ffffff"
            speed={3}
            className="mono text-[12px] tracking-[0.3em]"
          />
          <SplitText
            tag="h2"
            text="Your edge starts with practice."
            splitType="chars"
            delay={24}
            duration={0.8}
            from={{ opacity: 0, y: 30 }}
            to={{ opacity: 1, y: 0 }}
            className="mt-5 text-[clamp(2.2rem,5.5vw,4.2rem)] leading-[1.02] font-extrabold tracking-[-0.04em] text-foreground"
          />
          <p className="mx-auto mt-5 max-w-xl text-[16px] leading-relaxed text-muted-foreground">
            Open the lab in your browser. No sign-up and no wallet are needed to
            start, and no real funds are ever at risk.
          </p>
          <AnimatedContent distance={24} delay={0.2} threshold={0.1}>
            <div className="mt-10 flex justify-center">
              <Magnet padding={70} magnetStrength={4}>
                <StarBorder
                  as={Link}
                  href="/app"
                  color="#5ff5c4"
                  backgroundColor="var(--primary)"
                  textColor="var(--primary-foreground)"
                  borderColor="color-mix(in oklab, var(--primary) 60%, white)"
                  radius={12}
                  stars={3}
                  glow={1}
                  sparkle
                  className="landing-cta-primary landing-cta-lg"
                >
                  Launch the app
                  <IconArrowRight size={18} />
                </StarBorder>
              </Magnet>
            </div>
          </AnimatedContent>
        </div>
      </div>
    </section>
  );
}
