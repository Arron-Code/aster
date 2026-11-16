const fs = require("fs");
const path = require("path");
const { Prisma, PrismaClient } = require("@prisma/client");

// Exports every table as JSON. Keep the output private: it contains staff password hashes and customer data.
async function main() {
  const prisma = new PrismaClient();
  const outDir = process.env.BACKUP_DIR || path.join(__dirname, "..", "backups");
  fs.mkdirSync(outDir, { recursive: true });

  const data = {};
  for (const model of Prisma.dmmf.datamodel.models) {
    const delegate = prisma[model.name.charAt(0).toLowerCase() + model.name.slice(1)];
    data[model.name] = await delegate.findMany();
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(outDir, `aster-backup-${stamp}.json`);
  fs.writeFileSync(
    file,
    JSON.stringify({ createdAt: new Date().toISOString(), data }, (_key, value) => (typeof value === "bigint" ? value.toString() : value), 2),
  );
  await prisma.$disconnect();

  const counts = Object.entries(data).map(([name, rows]) => `${name}: ${rows.length}`).join(", ");
  console.log(`Backup geschrieben: ${file}\n${counts}`);
}

main().catch((error) => {
  console.error("Backup fehlgeschlagen:", error);
  process.exit(1);
});
