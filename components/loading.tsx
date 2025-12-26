import Image from "next/image";

export default function Loading() {
  const logo = "/assets/full-logo.png";

  return (
    <div className="w-full h-full flex items-center justify-center bg-secondary rounded-md">
      <Image
        src={logo}
        alt="MeadTools logo"
        // "Dummy" intrinsic size; real size comes from CSS
        width={0}
        height={0}
        sizes="100vw"
        className="animate-pulse"
        style={{ width: "auto", height: "auto" }}
        priority
      />
    </div>
  );
}
