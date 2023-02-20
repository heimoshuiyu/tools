import * as cheerio from "https://esm.sh/cheerio@1.0.0-rc.12";
import disposition from "https://esm.sh/content-disposition@0.5.4";
import { join } from "https://deno.land/std@0.177.0/path/mod.ts";
import prettyBytes from "https://esm.sh/pretty-bytes@6.1.0";

// Course page URL. E.g. https://ispace.uic.edu.hk/course/view.php?id=12184
const CourseURL = Deno.env.get("CourseURL") || prompt("CourseURL =");
if (CourseURL === null) {
  console.error("CourseURL can't be empty!");
  Deno.exit(1);
}

const MoodleSession =
  Deno.env.get("MoodleSession") || prompt("(Cookie) MoodleSession =");
if (MoodleSession === null) {
  console.error("(Cookie) MoodleSession can't be empty!");
  Deno.exit(1);
}

// Will be created if not exists
const downloadPath =
  Deno.env.get("DOWNLOADPATH") ||
  prompt("Download path (default current directory):") ||
  ".";

const Cookie = `MoodleSession=${MoodleSession}`;

const sleep = (second: number) =>
  new Promise<void>((resolve) => {
    console.log("\t\tSleep for", second, "seconds");
    setTimeout(() => resolve(), second * 1000);
  });

const exist = async (path: string): Promise<boolean> => {
  try {
    await Deno.stat(path);
    return true;
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return false;
    } else {
      throw error;
    }
  }
};

// download course page
const html = await fetch(CourseURL, {
  headers: { Cookie },
}).then((resp) => resp.text());
const $ = cheerio.load(html);

// loop for each sections in course page
for await (const section of $("li.section.main.clearfix")) {
  const sectionName = $("h3.sectionname a", section).text().trim();
  const sectionPath = join(downloadPath, sectionName);
  console.log("section:", sectionName);

  if (!(await exist(sectionPath))) {
    await Deno.mkdir(sectionPath, { recursive: true });
  }

  // loop for each resource (downloadable file) in section
  for await (const res of $("li.resource", section)) {
    const resName = $(res).text().trim();
    const resURL = $("a.aalink", res).attr("href");
    console.log("\tres:", resName, resURL);
    if (resURL === undefined) continue;
    const resp = await fetch(resURL, {
      headers: { Cookie },
    });
    console.log("\tfetch status:", resp.status);

    // parse downloaded filename
    const disp = resp.headers.get("content-disposition");
    if (disp === null) {
      console.error(`\tUnsupport resource: ${resURL}, skip...`);
      await sleep(1);
      continue;
    }

    const filename =
      disposition.parse(disp).parameters.filename || "untitled file";
    console.log("\tfilename:", filename);

    const filepath = join(downloadPath, sectionName, filename);
    // skip if file exists
    if (await exist(filepath)) {
      console.log("\t...skip");
      await sleep(1);
      continue;
    }

    const body = await resp.blob();
    const { size } = body;
    console.log("\tfilesize:", prettyBytes(size));

    await Deno.writeFile(filepath, new Uint8Array(await body.arrayBuffer()));
    await sleep(2);
  }
}
