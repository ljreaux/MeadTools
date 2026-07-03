import { socialIcons } from "./icons";

export default function BottomBar() {
  return (
    <footer className="fixed bottom-0 left-0 w-screen text-foreground z-[1000]">
      <div className="w-full">
        <span className="sm:flex sm:w-full sm:justify-center">
          <div className="flex items-center justify-center w-full gap-1 text-xl sm:w-fit sm:px-4 sm:my-2 sm:rounded-2xl bg-background sm:border-2 sm:border-foreground">
            {socialIcons.map((social, index) => (
              <a
                href={social.href}
                className="py-2 transition-all hover:text-secondary md:hover:scale-105"
                key={index}
                target="_blank"
                rel="noopener noreferrer"
              >
                {social.logo}
              </a>
            ))}
          </div>
        </span>
      </div>
    </footer>
  );
}
