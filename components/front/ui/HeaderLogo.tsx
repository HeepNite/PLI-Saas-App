"use client"

import Link from "next/link";
import Image from "next/image";
import React from "react";
import { useTheme } from "next-themes";

const HeaderLogo = () => {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const logoSrc = !mounted
    ? "/logo/logo-black.png"
    : resolvedTheme === "dark"
    ? "/logo/logo-white.png"
    : "/logo/logo-black.png";

  return (
    <div className="shrink-0" aria-label="Brand">
      <Link href="/public" aria-label="Home" className="shrink-0">
        <Image src={logoSrc} alt="PLI Logo" width={120} height={120} priority />
      </Link>
    </div>
  );
};

export default HeaderLogo;
