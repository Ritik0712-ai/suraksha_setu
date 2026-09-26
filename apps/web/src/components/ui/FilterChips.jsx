import { Chip, Stack } from "@mui/material";
import { CheckRounded } from "@mui/icons-material";

/**
 * Single-select filter chips (docs/04 §6.3): 40 px, selected = navy fill + white text + check.
 * Scrolls horizontally instead of wrapping when `scroll` is set.
 */
export function FilterChips({ options, value, onChange, label, scroll = false }) {
  return (
    <Stack
      role="radiogroup"
      aria-label={label}
      direction="row"
      spacing={1}
      useFlexGap
      flexWrap={scroll ? "nowrap" : "wrap"}
      sx={scroll ? { overflowX: "auto", pb: 0.5 } : undefined}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Chip
            key={o.value}
            role="radio"
            aria-checked={selected}
            label={o.label}
            icon={selected ? <CheckRounded sx={{ color: "#fff !important" }} /> : o.icon}
            onClick={() => onChange(o.value)}
            variant={selected ? "filled" : "outlined"}
            color={selected ? "primary" : "default"}
            sx={{
              flexShrink: 0,
              borderColor: selected ? undefined : "#7A8699",
              fontWeight: 500,
            }}
          />
        );
      })}
    </Stack>
  );
}
