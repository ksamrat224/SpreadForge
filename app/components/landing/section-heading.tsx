"use client";
import SplitText from "../reactbits/SplitText";
import BlurText from "../reactbits/BlurText";

export function SectionHeading({
  eyebrow,
  title,
  description,
  size = "md",
}: {
  eyebrow: string;
  title: string;
  description?: string;
  /** "lg" is for full-width section openers; "md" fits a half-width column. */
  size?: "md" | "lg";
}) {
  return (
    <div className="max-w-4xl">
      <p className="landing-eyebrow">{eyebrow}</p>
      <SplitText
        tag="h2"
        text={title}
        splitType="words"
        delay={60}
        duration={0.9}
        from={{ opacity: 0, y: 36 }}
        to={{ opacity: 1, y: 0 }}
        textAlign="left"
        className={`landing-h2 mt-5 ${
          size === "lg"
            ? "text-[clamp(2.3rem,5.2vw,4.9rem)]"
            : "text-[clamp(1.9rem,3.3vw,3rem)]"
        }`}
      />
      {description && (
        <BlurText
          text={description}
          delay={28}
          stepDuration={0.28}
          direction="bottom"
          className="mt-6 max-w-xl text-[16px] leading-relaxed text-muted-foreground"
        />
      )}
    </div>
  );
}
