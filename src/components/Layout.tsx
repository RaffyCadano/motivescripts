import { Outlet, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";

function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const behavior: ScrollBehavior = reduceMotion ? "auto" : "smooth";

    if (hash) {
      const id = decodeURIComponent(hash.replace("#", ""));
      let frame = 0;
      let timer = 0;

      const scrollToHash = () => {
        const element = document.getElementById(id);
        if (!element) return false;
        element.scrollIntoView({ behavior, block: "start" });
        return true;
      };

      frame = requestAnimationFrame(() => {
        if (scrollToHash()) return;
        timer = window.setTimeout(scrollToHash, 80);
      });

      return () => {
        cancelAnimationFrame(frame);
        window.clearTimeout(timer);
      };
    }

    window.scrollTo({ top: 0, left: 0, behavior });
  }, [pathname, hash]);

  return null;
}

export function Layout() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <ScrollToTop />
      <Navbar />
      <Outlet />
      <Footer />
    </>
  );
}
