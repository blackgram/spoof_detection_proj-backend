export default function AccessLogo({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 120 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Access Bank"
    >
      {/* Orange triangle/arrow mark */}
      <polygon points="0,28 10,8 20,28" fill="#E8761A" />
      {/* "access" wordmark */}
      <text
        x="26"
        y="27"
        fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
        fontWeight="700"
        fontSize="22"
        fill="#E8761A"
        letterSpacing="-0.5"
      >
        access
      </text>
    </svg>
  );
}
