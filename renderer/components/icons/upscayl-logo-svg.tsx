import { publicSrc } from "@/lib/platform";

// LMS Studio logo (renderer/public/logo-lms.png).
const UpscaylSVGLogo = ({ className, ...rest }: { className?: string; [key: string]: any }) => {
  return (
    <img
      src={publicSrc("logo-lms.png?v=1")}
      alt="LMS Studio"
      draggable={false}
      className={className}
      style={{ objectFit: "contain" }}
      {...rest}
    />
  );
};

export default UpscaylSVGLogo;
