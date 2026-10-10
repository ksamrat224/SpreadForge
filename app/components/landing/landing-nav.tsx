import Image from "next/image";
import Link from "next/link";
import { IconArrowUpRight } from "@tabler/icons-react";
import { ThemeToggle } from "../theme-toggle";

const links = [
  { href: "#experience", label: "Experience" },
  { href: "#workflow", label: "Workflow" },
  { href: "#challenges", label: "Challenges" },
  { href: "#scoring", label: "Scoring" },
  { href: "#magicblock", label: "MagicBlock" },
];

export function LandingNav() {
  return (
    <header className="landing-nav">
      <div className="landing-container flex h-16 items-center gap-3">
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
          <span className="landing-lab-chip">LAB</span>
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
        <span className="ml-auto md:ml-2">
          <ThemeToggle />
        </span>
        <Link href="/app" className="landing-nav-cta">
          Launch app
          <IconArrowUpRight size={15} />
        </Link>
      </div>
    </header>
  );
}
