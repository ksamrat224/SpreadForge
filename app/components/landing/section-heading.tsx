"use client";
import SplitText from "../reactbits/SplitText";
import BlurText from "../reactbits/BlurText";

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "left",
}: {
  eyebrow: string;
  title: string;
  description?: string;
  align?: "left" | "center";
}) {
  const centered = align === "center";
  return (
    <div className={centered ? "mx-auto max-w-3xl text-center" : "max-w-3xl"}>
      <p
        className={`landing-eyebrow ${centered ? "justify-center" : ""}`.trim()}
      >
        <span aria-hidden="true" />
        {eyebrow}
      </p>
      <SplitText
        tag="h2"
        text={title}
        splitType="words"
        delay={60}
        duration={0.9}
        from={{ opacity: 0, y: 36 }}
        to={{ opacity: 1, y: 0 }}
        textAlign={centered ? "center" : "left"}
        className="mt-4 text-[clamp(2rem,4.4vw,3.4rem)] leading-[1.05] font-bold tracking-[-0.035em] text-foreground"
      />
      {description && (
        <BlurText
          text={description}
          delay={28}
          stepDuration={0.28}
          direction="bottom"
          className={`mt-5 text-[16px] leading-relaxed text-muted-foreground ${centered ? "justify-center" : ""}`}
        />
      )}
    </div>
  );
}
