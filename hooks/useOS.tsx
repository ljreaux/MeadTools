import { LinuxIcon } from "@/components/osIcons/LinuxIcon";
import { WindowsIcon } from "@/components/osIcons/WindowsIcon";
import { AppleIcon } from "@/components/osIcons/AppleIcon";
import { useEffect, useState } from "react";
type OSType = "windows" | "linux" | "macos";

export const useOS = () => {
  const [os, setOs] = useState<null | OSType>(null);

  const baseURL =
    "https://github.com/TravisEvashkevich/RaptPill-To-MeadTools/releases/latest/download/MeadToolsPill-";

  const downloadButtons = [
    {
      os: "Windows",
      href: `${baseURL}Windows.exe`,
      key: "windows",
      logo: <WindowsIcon />,
    },
    {
      os: "Linux",
      href: `${baseURL}Linux`,
      key: "linux",
      logo: <LinuxIcon />,
    },
    {
      os: "Mac",
      href: `${baseURL}macOS.zip`,
      key: "macos",
      logo: <AppleIcon />,
    },
  ];

  const currentButton = downloadButtons.find((item) => item.key === os);
  const otherButtons = downloadButtons.filter((item) => item.key !== os);

  useEffect(() => {
    async function getOs() {
      const ua = navigator.userAgent;
      if (ua.includes("Windows")) return setOs("windows");
      if (ua.includes("Linux")) return setOs("linux");
      if (ua.includes("Macintosh")) return setOs("macos");

      return setOs(null);
    }
    getOs();
  }, []);

  return {
    currentButton,
    otherButtons,
    os,
  };
};
