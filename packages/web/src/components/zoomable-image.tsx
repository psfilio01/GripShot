"use client";

import Zoom from "react-medium-image-zoom";
import "react-medium-image-zoom/dist/styles.css";

interface ZoomableImageProps {
  src: string;
  alt: string;
  className?: string;
}

export function ZoomableImage({ src, alt, className }: ZoomableImageProps) {
  return (
    <Zoom>
      <img src={src} alt={alt} className={className} />
    </Zoom>
  );
}
