import { Outlet } from "react-router-dom";
import { Toaster } from "../../components/ui/Toaster.jsx";
import { SessionExpiredDialog } from "../system/SessionExpiredDialog.jsx";

/** Full-screen layout for S-06/S-07: no header, bottom nav or 112 bar (they have their own). */
export default function SosLayout() {
  return (
    <>
      <Outlet />
      <Toaster />
      <SessionExpiredDialog />
    </>
  );
}
