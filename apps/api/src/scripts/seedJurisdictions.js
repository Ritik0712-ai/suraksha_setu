import { Jurisdiction } from "../models/Jurisdiction.js";

/**
 * Upserts a jurisdiction tree. A node is matched by (type, English name, parent), so running it
 * twice changes nothing and edits to names/centroids in the seed file are applied.
 */
export async function seedJurisdictionTree(node, parent = null, log = () => {}) {
  let doc = await Jurisdiction.findOne({
    type: node.type,
    "name.en": node.name.en,
    parentId: parent?._id ?? null,
  });
  const centroid = { type: "Point", coordinates: node.centroid };
  if (doc) {
    doc.name = node.name;
    doc.centroid = centroid;
    await doc.save();
    log(`= ${node.type} ${node.name.en}`);
  } else {
    doc = await Jurisdiction.create({
      name: node.name,
      type: node.type,
      parentId: parent?._id ?? null,
      centroid,
    });
    log(`+ ${node.type} ${node.name.en}`);
  }
  for (const child of node.children ?? []) await seedJurisdictionTree(child, doc, log);
  return doc;
}
