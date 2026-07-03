import Image from "next/image";

type DocImageProps = {
  src: string;
  alt: string;
  width: number;
  height: number;
  caption?: string;
  priority?: boolean;
};

export default function DocImage({
  src,
  alt,
  width,
  height,
  caption,
  priority = false
}: DocImageProps) {
  return (
    <div className="not-prose w-full rounded-md overflow-hidden border border-muted shadow-sm my-6">
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        className="w-full h-auto my-0"
        priority={priority}
      />
      {caption ? (
        <p className="text-xs text-muted-foreground mt-2 text-center px-3 pb-3">
          {caption}
        </p>
      ) : null}
    </div>
  );
}
