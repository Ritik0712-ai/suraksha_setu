import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { useTestDb } from "../helpers/db.js";
import { makeApp } from "../helpers/app.js";
import { seedJurisdictionTree } from "../../src/scripts/seedJurisdictions.js";
import { seedAdmins } from "../../src/scripts/seedAdmins.js";
import { Jurisdiction } from "../../src/models/Jurisdiction.js";
import { User } from "../../src/models/User.js";

useTestDb();

const loadTree = async () =>
  JSON.parse(await readFile(new URL("../../seed/jurisdictions.json", import.meta.url), "utf8"))
    .tree;

describe("seed scripts (docs/06 task 1.9)", () => {
  it("seeds the pilot jurisdiction tree idempotently", async () => {
    const tree = await loadTree();
    await seedJurisdictionTree(tree);
    await seedJurisdictionTree(tree);
    expect(await Jurisdiction.countDocuments()).toBe(5);
    const village = await Jurisdiction.findOne({ type: "village" });
    expect(village.name.en).toBe("Mahodiya");
    expect(village.ancestors).toHaveLength(4);
  });

  it("creates admins who must change their temporary password, and skips existing ones", async () => {
    await seedJurisdictionTree(await loadTree());
    const members = [{ name: "Ritik Agarwal", phone: "9000000001", email: "R@Example.com" }];
    const [first] = await seedAdmins(members, { bcryptCost: 4 });
    expect(first.status).toBe("created");
    const [second] = await seedAdmins(members, { bcryptCost: 4 });
    expect(second.status).toBe("exists");

    const admin = await User.findOne({ phone: "+919000000001" }).lean();
    expect(admin).toMatchObject({
      role: "admin",
      mustChangePassword: true,
      email: "r@example.com",
    });

    // The temporary password works, and the profile tells the UI to force a change (docs/03 A-14).
    const { api } = makeApp();
    const res = await api()
      .post("/api/v1/auth/login")
      .send({ phone: "9000000001", password: first.tempPassword });
    expect(res.status).toBe(200);
    expect(res.body.data.user.mustChangePassword).toBe(true);
  });
});
