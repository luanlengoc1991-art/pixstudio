import React from "react";

// PixStudio logo: gradient tile with a stylised "P" and an AI sparkle
const UpscaylSVGLogo = ({ ...rest }) => {
  return (
    <svg
      viewBox="0 0 256 256"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...rest}
    >
      <defs>
        <linearGradient
          id="pixstudio-bg"
          x1="0"
          y1="0"
          x2="256"
          y2="256"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#7C3AED" />
          <stop offset="1" stopColor="#EC4899" />
        </linearGradient>
      </defs>
      <rect width="256" height="256" rx="58" fill="url(#pixstudio-bg)" />
      <path
        d="M78 196V60h62c30 0 50 19 50 46s-20 46-50 46h-30v44H78Zm32-72h28c12 0 20-7 20-18s-8-18-20-18h-28v36Z"
        fill="#fff"
      />
      <path
        d="M196 150l7 17 17 7-17 7-7 17-7-17-17-7 17-7 7-17Z"
        fill="#FDE68A"
      />
    </svg>
  );
};

export default UpscaylSVGLogo;
