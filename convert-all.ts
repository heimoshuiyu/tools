const dir = Deno.args[0];

if (!dir) {
  console.error("Please provide a directory");
  Deno.exit(1);
}

import { walk } from "https://deno.land/std@0.207.0/fs/walk.ts";

const targetType = ["mp4", "avi", "mov"];

const skip_paths = ["Cosplay Kizoku"];

const kv = await Deno.openKv();

for await (const entry of walk(dir)) {
  if (!entry.isFile) continue;
  if (!targetType.includes(entry.name.toLowerCase().split(".").pop()!))
    continue;

  if (skip_paths.some((path) => entry.path.includes(path))) continue;
  console.log(entry.path);
  const outputFilename = entry.path + ".mkv";

  const status = await kv.get(["converts", entry.path]);
  if (status.value === "done") {
    console.log("Already converted");

    // remove
    if (Deno.args.includes("--remove")) {
      console.log(`Removing ${entry.path}`);
      await Deno.remove(entry.path);
    }

    continue;
  }

  await kv.set(["converts", entry.path], "converting");

  const ffmpeg = new Deno.Command("ffmpeg", {
    args: [
      "-y",
      "-vsync",
      "0",
      "-hwaccel",
      "cuda",
      "-hwaccel_output_format",
      "cuda",
      "-i",
      entry.path,
      "-c:a",
      "libopus",
      "-b:a",
      "64k",
      "-c:v",
      "av1_nvenc",
      "-aq-strength",
      "15",
      "-temporal_aq",
      "15",
      "-preset",
      "p6",
      "-cq:v",
      "39",
      "-vf",
      "scale_cuda=1280:-1",
      outputFilename,
    ],
  });

  const output = await ffmpeg.output();

  const originalSzie = Deno.statSync(entry.path).size;
  const outputSize = Deno.statSync(outputFilename).size;

  console.log(
    `Original: ${prettySize(originalSzie)} - Output: ${prettySize(
      outputSize
    )} - Saved: ${prettySize(originalSzie - outputSize)} (${(
      (outputSize / originalSzie) *
      100
    ).toFixed(2)}%)`
  );

  await kv.set(["converts", entry.path], "done");
}

function prettySize(size: number) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let unitIndex = 0;
  while (size > 1024) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(2)} ${units[unitIndex]}`;
}
