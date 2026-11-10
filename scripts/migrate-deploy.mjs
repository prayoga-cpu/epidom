// `prisma migrate deploy` with retries. The Neon dev/preview compute suspends when idle, and the
// first connection of a build can land while it is still waking up (P1001). Retrying lets it finish.
import { spawnSync } from "node:child_process";

const attempts = 4;
for (let i = 1; i <= attempts; i++) {
  const r = spawnSync("prisma", ["migrate", "deploy"], { stdio: ["inherit", "pipe", "pipe"], encoding: "utf8", shell: true });
  process.stdout.write(r.stdout ?? "");
  process.stderr.write(r.stderr ?? "");
  if (r.status === 0) process.exit(0);
  const unreachable = /P1001|P1002|Can't reach database server|timed out/i.test(`${r.stdout}${r.stderr}`);
  if (!unreachable || i === attempts) process.exit(r.status ?? 1);
  console.log(`migrate deploy: database not reachable yet (attempt ${i}/${attempts}), retrying in ${i * 5}s…`);
  await new Promise((res) => setTimeout(res, i * 5000));
}
