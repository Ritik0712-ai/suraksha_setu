import {
  AddRoadRounded,
  DeleteRounded,
  FenceRounded,
  LightbulbRounded,
  MoreHorizRounded,
  WaterRounded,
} from "@mui/icons-material";
import { HandpumpIcon } from "../../components/icons/index.jsx";

// docs/04 §7: one icon per category; the custom handpump for water supply.
const CATEGORY_ICONS = {
  road_damage: AddRoadRounded,
  garbage: DeleteRounded,
  streetlight: LightbulbRounded,
  waterlogging: WaterRounded,
  water_supply: HandpumpIcon,
  encroachment: FenceRounded,
  other: MoreHorizRounded,
};

export function CategoryIcon({ category, ...props }) {
  const Icon = CATEGORY_ICONS[category] ?? MoreHorizRounded;
  return <Icon {...props} />;
}
