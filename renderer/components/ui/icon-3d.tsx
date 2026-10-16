import React from "react";
import { cn } from "@/lib/utils";

const SIZES = {
  xl: { box: 96, icon: 46, depth: 11, radius: 28 },
  lg: { box: 76, icon: 36, depth: 9, radius: 22 },
  md: { box: 46, icon: 22, depth: 4, radius: 14 },
  sm: { box: 32, icon: 16, depth: 3, radius: 10 },
};

/**
 * A glossy extruded tile with a lucide icon: gradient face, thick darker edge,
 * a floor shadow and a coloured glow. Pure CSS, so it stays sharp at any size.
 */
export default function Icon3D({
  icon: Icon,
  image,
  colors,
  size = "lg",
  tilt = true,
  podium,
  className,
}: {
  icon: React.ElementType;
  /** A rendered 3D object (PNG) shown in front of a glass tile instead of the flat icon */
  image?: string;
  /** [light, main, deep] */
  colors: [string, string, string];
  size?: keyof typeof SIZES;
  /** Slight isometric tilt that straightens on hover of a `group` parent */
  tilt?: boolean;
  /** Draws a glossy base plate under the tile (defaults on for lg / xl) */
  podium?: boolean;
  className?: string;
}) {
  const [light, main, deep] = colors;
  const s = SIZES[size];
  const withPodium = podium ?? (!image && (size === "lg" || size === "xl"));
  const base = withPodium ? Math.round(s.box * 0.32) : 0;

  return (
    <span
      className={cn("relative inline-flex shrink-0", className)}
      style={{ width: s.box, height: s.box + s.depth + base * 0.55, perspective: 400 }}
    >
      {/* Base plate the tile stands on */}
      {withPodium && (
        <span
          className="pointer-events-none absolute left-1/2 -translate-x-1/2"
          style={{
            bottom: -base * 0.15,
            width: s.box * 1.12,
            height: base,
            borderRadius: "50%",
            background: `radial-gradient(ellipse at 50% 35%, ${light}cc 0%, ${main} 38%, ${deep} 75%)`,
            boxShadow: `0 ${Math.round(base * 0.22)}px 0 ${deep}, 0 ${Math.round(base * 0.5)}px 18px rgba(0,0,0,0.55), inset 0 2px 2px rgba(255,255,255,0.5)`,
          }}
        />
      )}
      {/* Coloured glow and floor shadow */}
      <span
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-full opacity-70 blur-xl transition-opacity duration-300 group-hover:opacity-100"
        style={{ width: s.box * 0.95, height: s.box * 0.6, bottom: -s.depth, background: main }}
      />
      <span
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-[50%] bg-black/50 blur-md"
        style={{ width: s.box * 0.85, height: s.box * 0.18, bottom: -s.depth * 1.5 }}
      />
      <span
        className={cn(
          "relative block transition-transform duration-300 ease-out",
          tilt && !image && "[transform:rotateX(14deg)_rotateY(-14deg)] group-hover:[transform:rotateX(0deg)_rotateY(0deg)_translateY(-3px)]",
        )}
        style={{ width: s.box, height: s.box, transformStyle: "preserve-3d" }}
      >
        {image ? (
          <img
            src={image}
            alt=""
            draggable={false}
            className="absolute left-1/2 top-1/2 max-w-none -translate-x-1/2 -translate-y-1/2 transition-transform duration-300 ease-out group-hover:-translate-y-[56%] group-hover:scale-105"
            style={{
              width: s.box * 1.12,
              height: s.box * 1.12,
              filter: `drop-shadow(0 ${Math.round(s.box * 0.08)}px ${Math.round(s.box * 0.1)}px rgba(0,0,0,0.55))`,
            }}
          />
        ) : (
        /* Face with a thick darker edge underneath (the extrusion) */
        <span
          className="absolute inset-0 flex items-center justify-center overflow-hidden"
          style={{
            borderRadius: s.radius,
            background: `linear-gradient(145deg, ${light} 0%, ${main} 48%, ${deep} 100%)`,
            boxShadow: [
              `0 ${s.depth}px 0 ${deep}`,
              `0 ${s.depth + 2}px 0 rgba(0,0,0,0.35)`,
              `inset 0 2px 1px rgba(255,255,255,0.55)`,
              `inset 0 -${Math.max(2, s.depth / 2)}px ${s.depth}px rgba(0,0,0,0.25)`,
            ].join(", "),
          }}
        >
          {/* Gloss */}
          <span
            className="pointer-events-none absolute inset-x-0 top-0 h-1/2"
            style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.45), rgba(255,255,255,0))", borderRadius: `${s.radius}px ${s.radius}px 40% 40%` }}
          />
          <Icon
            className="relative text-white"
            style={{ width: s.icon, height: s.icon, filter: `drop-shadow(0 2px 2px ${deep})` }}
            strokeWidth={2.3}
          />
        </span>
        )}
      </span>
    </span>
  );
}
