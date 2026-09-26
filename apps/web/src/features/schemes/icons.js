import {
  AccountBalanceRounded,
  AgricultureRounded,
  ElderlyRounded,
  HomeRounded,
  LocalHospitalRounded,
  SchoolRounded,
  ShieldRounded,
  WomanRounded,
  WorkRounded,
} from "@mui/icons-material";

// One icon per scheme category (docs/04 §7).
export const CATEGORY_ICONS = {
  women: WomanRounded,
  farmers: AgricultureRounded,
  health: LocalHospitalRounded,
  housing: HomeRounded,
  education: SchoolRounded,
  pension: ElderlyRounded,
  employment: WorkRounded,
  social_security: ShieldRounded,
  financial_inclusion: AccountBalanceRounded,
};
