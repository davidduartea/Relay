import { execSync } from "node:child_process";

/**
 * Mata lo que esté escuchando en un puerto.
 *
 * `nest start --watch` lanza un proceso hijo que sobrevive si se cierra la
 * terminal en vez de usar Ctrl+C. Ese huérfano sigue ocupando el 4000 y, en
 * Windows, mantiene cargado el motor de Prisma — con lo que `prisma generate`
 * empieza a fallar con EPERM por culpa de un servidor que uno creía muerto.
 *
 *   pnpm free-port        libera el 4000
 *   pnpm free-port 3000   libera el que se le diga
 */
const port = process.argv[2] ?? "4000";
const isWindows = process.platform === "win32";

const find = isWindows
  ? `netstat -ano | findstr :${port} | findstr LISTENING`
  : `lsof -ti tcp:${port}`;

let output = "";

try {
  output = execSync(find, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
} catch {
  // findstr y lsof salen con código 1 cuando no encuentran nada, que aquí es
  // el caso bueno y no un error.
  console.log(`Puerto ${port} libre.`);
  process.exit(0);
}

const pids = [
  ...new Set(
    output
      .split("\n")
      .map((line) => (isWindows ? line.trim().split(/\s+/).pop() : line.trim()))
      .filter((pid) => pid && /^\d+$/.test(pid) && pid !== "0"),
  ),
];

if (pids.length === 0) {
  console.log(`Puerto ${port} libre.`);
  process.exit(0);
}

for (const pid of pids) {
  execSync(isWindows ? `taskkill /PID ${pid} /F` : `kill -9 ${pid}`, { stdio: "ignore" });
  console.log(`Terminado el proceso ${pid} que ocupaba el puerto ${port}.`);
}
