"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { IconArrowUpRight } from "@tabler/icons-react";

const links = [
  { href: "#features", label: "Features" },
  { href: "#workflow", label: "Workflow" },
  { href: "#challenges", label: "Challenges" },
  { href: "#scoring", label: "Scoring" },
  { href: "#verify", label: "Verification" },
];

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <header className={`landing-nav ${scrolled ? "is-scrolled" : ""}`}>
      <div className="landing-container flex h-16 items-center gap-6">
        <a
          href="#top"
          className="flex items-center gap-2.5"
          aria-label="SpreadForge home"
        >
          <Image
            src="/SpreadForge.png"
            alt=""
            width={30}
            height={30}
            priority
            className="brand-logo"
          />
          <span className="brand-word text-[15px]">
            <b>SPREAD</b>FORGE
          </span>
        </a>
        <nav
          aria-label="Landing sections"
          className="ml-auto hidden items-center gap-1 md:flex"
        >
          {links.map(({ href, label }) => (
            <a key={href} href={href} className="landing-nav-link">
              {label}
            </a>
          ))}
        </nav>
        <Link href="/app" className="landing-nav-cta ml-auto md:ml-2">
          Launch app
          <IconArrowUpRight size={15} />
        </Link>
      </div>
    </header>
  );
}
