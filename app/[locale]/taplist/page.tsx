import { DownloadIcon, TerminalSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import CopyableCodeBlock from "@/components/CodeBlock";
import Image from "next/image";
import { Separator } from "@/components/ui/separator";

export default function TaplistOsAnnouncement() {
  return (
    <div className="w-full flex justify-center items-center sm:py-24 py-[6rem] relative">
      <div className="flex flex-col md:p-12 p-8 rounded-xl bg-background gap-4 w-11/12 max-w-[1200px]">
        <h1 className="text-2xl font-bold">MeadTools Taplist OS v1.0</h1>

        <p className="text-sm text-muted-foreground">
          Taplist OS is a pre-configured Raspberry Pi image that launches
          directly into the MeadTools Taplist Display System. It’s the fastest
          way to get a fullscreen taplist on your HDMI display — with no
          internet required and local editing over Wi-Fi.
        </p>

        <ul className="list-disc list-inside text-sm text-foreground space-y-1">
          <li>Runs a local Flask server to serve the taplist</li>
          <li>Boots into Chromium kiosk mode automatically</li>
          <li>Creates a local Wi-Fi access point with admin panel</li>
          <li>Captive portal for easy editing from any device</li>
        </ul>

        <div className="w-full rounded-md overflow-hidden border border-muted shadow-sm">
          <Image
            src="/assets/sample-taplist.png"
            alt="Sample Taplist Display"
            width={1000}
            height={600}
            className="w-full h-auto"
            priority
          />
          <p className="text-xs text-muted-foreground mt-2 text-center">
            Sample display showing multiple tap categories with default artwork.
          </p>
        </div>

        <div className="space-y-2">
          <h2 className="text-base font-semibold">Watch the Taplist OS Demo</h2>
          <div
            style={{ position: "relative", paddingBottom: "56.25%", height: 0 }}
          >
            <iframe
              src="https://www.youtube.com/embed/KC8lwyN_S3w"
              title="MeadTools Taplist OS Demo"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: "100%",
                border: 0
              }}
            ></iframe>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <Link
            href="https://github.com/ljreaux/meadtools-taplist/releases/tag/pi-v1.0"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button className="w-full sm:w-auto">
              <DownloadIcon />
              Download Taplist OS v1.0
            </Button>
          </Link>
          <p className="text-xs text-muted-foreground sm:text-right">
            Flash with{" "}
            <a target="_blank" href="https://etcher.io" className="underline">
              Balena Etcher
            </a>{" "}
            or{" "}
            <a
              target="_blank"
              href="https://www.raspberrypi.com/software/"
              className="underline"
            >
              Raspberry Pi Imager
            </a>
          </p>
        </div>
        <Separator className="my-4" />
        <div className="space-y-2 text-md">
          <p className="font-medium text-foreground">
            Prefer manual setup instead?
          </p>
          <p className="text-muted-foreground">
            You can also install the taplist server and admin interface onto
            your own Raspberry Pi OS (Bookworm recommended) using a one-line
            setup command.
          </p>

          <CopyableCodeBlock
            text={`bash <(curl -s https://raw.githubusercontent.com/ljreaux/meadtools-taplist/main/pi/remote-setup.sh)`}
            language="bash"
          />

          <ul className="list-disc list-inside text-sm text-foreground space-y-1">
            <li>Downloads only the setup files</li>
            <li>Installs dependencies and Flask server</li>
            <li>Enables kiosk mode on boot</li>
            <li>Sets up Wi-Fi AP and captive portal</li>
          </ul>
          <Separator className="my-4" />
          <div className="text-sm">
            <h3 className="font-semibold mb-1">Hardware Recommendations</h3>
            <ul className="list-disc list-inside space-y-1 text-foreground">
              <li>
                Recommended: Raspberry Pi 3B+ or 4, 16 GB+ microSD, HDMI display
              </li>
              <li>Minimum: Raspberry Pi Zero 2 W (with swap + kiosk tweaks)</li>
              <li>Not supported: Pi Zero W (original)</li>
            </ul>
          </div>

          <div className="flex justify-start">
            <Link
              href="https://github.com/ljreaux/meadtools-taplist#meadtools-taplist-setup-raspberry-pi"
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="secondary" className="mt-2">
                <TerminalSquare />
                View Full Setup Instructions
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
