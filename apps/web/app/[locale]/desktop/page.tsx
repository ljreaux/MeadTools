"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import Image from "next/image";
import hydroFile from "@/public/chart-images/hydro-file.png";
import pillFile from "@/public/chart-images/pill-file.png";
import { WindowsIcon } from "@/components/osIcons/WindowsIcon";
import { UbuntuIcon } from "@/components/osIcons/UbuntuIcon";
import { AppleIcon } from "@/components/osIcons/AppleIcon";
import Link from "next/link";

const legacyDownloads = [
  {
    os: "Windows",
    href: "https://cdn.crabnebula.app/download/meadtools/meadtools/latest/platform/nsis-x86_64",
    key: "windows",
    logo: <WindowsIcon />
  },
  {
    os: "Ubuntu",
    href: "https://cdn.crabnebula.app/download/meadtools/meadtools/latest/platform/appimage-x86_64",
    key: "linux",
    logo: <UbuntuIcon />
  },
  {
    os: "Mac (intel)",
    href: "https://cdn.crabnebula.app/download/meadtools/meadtools/latest/MeadTools.app.tar.gz",
    key: "macos-intel",
    logo: <AppleIcon />
  },
  {
    os: "Mac (Apple silicon)",
    href: "https://cdn.crabnebula.app/download/meadtools/meadtools/latest/platform/dmg-aarch64",
    key: "macos-arm",
    logo: <AppleIcon />
  }
];

function DesktopDownload() {
  const { t } = useTranslation();
  const [showLegacy, setShowLegacy] = useState(false);

  return (
    <section className="w-full flex justify-center items-center sm:py-24 py-[6rem] relative">
      <div className="flex flex-col md:p-12 p-8 rounded-xl bg-background gap-5 w-11/12 max-w-[1000px]">
        {/* Deprecation banner */}
        <div
          role="alert"
          aria-live="polite"
          className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-destructive"
        >
          <h1 className="sm:text-3xl text-xl font-semibold text-destructive">
            {t("desktopDeprecated.title", "MeadTools Desktop is deprecated")}
          </h1>
          <p className="mt-2 text-foreground">
            {t(
              "desktopDeprecated.body",
              "We’re no longer maintaining the desktop app. Please use the web version going forward. Existing desktop installs may continue to run but will not receive updates or security fixes."
            )}
          </p>
          <p className="mt-1 text-muted-foreground">
            {t("desktopDeprecated.versionNote", "Last released version: 1.0.3")}
          </p>
        </div>

        {/* Primary CTA */}
        <div className="flex flex-wrap gap-2 justify-center">
          <Link href="/" className={cn(buttonVariants({ variant: "default" }))}>
            {t("desktopDeprecated.openWeb", "Open MeadTools Web")}
          </Link>
        </div>

        {/* Optional: legacy downloads (hidden by default) */}
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowLegacy((s) => !s)}
            className={cn(
              buttonVariants({ variant: "ghost" }),
              "mx-auto block"
            )}
          >
            {showLegacy
              ? t("desktopDeprecated.hideLegacy", "Hide old downloads")
              : t(
                  "desktopDeprecated.showLegacy",
                  "Show old downloads (unsupported)"
                )}
          </button>

          {showLegacy && (
            <div className="mt-3 border border-yellow-500/30 bg-yellow-500/10 rounded-lg p-3">
              <p className="text-sm text-yellow-700 dark:text-yellow-300 mb-3">
                {t(
                  "desktopDeprecated.legacyWarning",
                  "These builds are provided as-is without support, updates, or security fixes."
                )}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {legacyDownloads.map((button) => (
                  <a
                    key={button.key}
                    href={button.href}
                    className={cn(
                      buttonVariants({ variant: "outline" }),
                      "text-[rgb(200_215_255)] flex items-center justify-center gap-1"
                    )}
                  >
                    {button.logo} {t("download", "Download")} {button.os}
                  </a>
                ))}
              </div>
              <p className="flex mt-4 items-center gap-2 text-sm text-muted-foreground">
                {t("poweredBy", "Powered by")}
                <a
                  href="https://web.crabnebula.cloud/meadtools/meadtools/releases"
                  className="text-[rgb(200_215_255)] inline-flex items-center gap-1"
                  target="_blank"
                  rel="noreferrer"
                >
                  <CNLogo cn="fill-[rgb(200_215_255)] w-5 h-5" />
                  CrabNebula Cloud
                </a>
              </p>
            </div>
          )}
        </div>

        {/* Optional context content — remove if you want this page super minimal */}
        <div className="mt-6">
          <h2 className="text-xl">
            {t("desktopDeprecated.nextSteps", "What’s next?")}
          </h2>
          <p className="text-foreground">
            {t(
              "desktopDeprecated.nextStepsBody",
              "We’re focusing efforts on the web app so we can ship features faster and keep everything in sync."
            )}
          </p>

          <iframe
            className="w-full my-4 aspect-video"
            src="https://www.youtube.com/embed/I1OSPqiaOfs"
            title={t("desktopDeprecated.videoTitle", "MeadTools overview")}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
          />
          <div className="grid w-full gap-2 my-4 sm:grid-cols-2">
            <Image
              src={pillFile}
              alt={t("desktopDeprecated.pillAlt", "RAPT pill chart")}
            />
            <Image
              src={hydroFile}
              alt={t(
                "desktopDeprecated.hydroAlt",
                "Manual hydrometer data chart"
              )}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

export default DesktopDownload;

const CNLogo = ({ cn }: { cn?: string }) => (
  <svg
    width="332"
    height="332"
    viewBox="0 0 332 332"
    xmlns="http://www.w3.org/2000/svg"
    className={cn}
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M164.923 101.881C131.11 146.401 131.306 203.282 165.36 228.927C174.309 235.667 184.707 239.579 195.787 240.875C164.356 266.368 128.151 274.279 103.705 257.675C70.1784 234.904 71.4639 174.647 106.576 123.088C135.895 80.0339 179.53 56.6586 212.649 63.3761C195.156 71.1026 178.364 84.1831 164.923 101.881ZM209.351 158.739C193.56 173.643 175.512 183.55 160.274 186.845C169.271 218.962 203.857 221.431 203.857 221.431C203.857 221.431 224.44 216.704 239.983 181.83C252.781 153.111 251.666 123.437 238.765 108.335C237.694 122.931 227.161 141.932 209.351 158.739Z"
      fill="rgb(200 215 255)"
    />
  </svg>
);
