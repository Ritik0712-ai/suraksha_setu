import { Box, Typography } from "@mui/material";

/** Big number inside a shrinking ring (docs/03 S-06). The number is announced assertively. */
export function CountdownRing({ n, total = 5, size = 200, label }) {
  const r = size / 2 - 10;
  const c = 2 * Math.PI * r;
  return (
    <Box sx={{ position: "relative", width: size, height: size }}>
      <svg width={size} height={size} aria-hidden style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="rgba(255,255,255,0.25)"
          strokeWidth="10"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#fff"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - n / total)}
          style={{ transition: "stroke-dashoffset 1s linear" }}
        />
      </svg>
      <Typography
        role="timer"
        aria-live="assertive"
        aria-label={label}
        sx={{
          position: "absolute",
          inset: 0,
          display: "grid",
          placeItems: "center",
          fontSize: 96,
          fontWeight: 700,
          lineHeight: 1,
          color: "#fff",
        }}
      >
        {n}
      </Typography>
    </Box>
  );
}
