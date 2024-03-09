const I = Deno.env.get("I");
const HOST = Deno.env.get("HOST");
if (!HOST) {
  console.error("HOST is not set. Please set HOST to your misskey host");
  Deno.exit(1);
}
if (!I) {
  console.error("I is not set. Please set I to your misskey token");
  console.error("You can get it in the request body of misskey search request");
  console.error("by using the Browser's developer tools. (F12)");
  Deno.exit(1);
}
import {
  WebSocketClient,
  StandardWebSocketClient,
} from "https://deno.land/x/websocket@v0.1.4/mod.ts";

const main = () => {
  const endpoint = `wss://${HOST}/streaming?_t=` + Date.now();
  const ws: WebSocketClient = new StandardWebSocketClient(endpoint);
  ws.on("open", function () {
    console.log("ws connected!");
    ws.send(
      `{"type":"connect","body":{"channel":"localTimeline","id":"1","params":{"withRenotes":true,"withReplies":false}}}`
    );
  });
  let count = 1;
  ws.on("message", function (message) {
    const data = JSON.parse(message.data);
    Deno.stdout.write(
      new TextEncoder().encode(count++ + " " + new Date().toISOString() + "\r")
    );

    let body = data.body.body;
    if (body.renote) body = body.renote;

    const text: string = body.text;
    if (!text) return;
    if (body.localOnly) return;
    if (!body.files || !body.files.length) return;
    if (
      !text.includes("初音") &&
      !text.includes("ミク") &&
      !text.includes("miku") &&
      !text.includes("hatsune") &&
      !text.includes("vocaloid") &&
      !text.includes("ボカロ")
    ) {
      return;
    }
    fetch("https://miku.social/api/ap/show", {
      credentials: "omit",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (X11; Linux x86_64; rv:123.0) Gecko/20100101 Firefox/123.0",
        Accept: "*/*",
        "Accept-Language": "en-US,en;q=0.5",
        "Content-Type": "application/json",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        Pragma: "no-cache",
        "Cache-Control": "no-cache",
      },
      referrer: "https://miku.social/",
      body: JSON.stringify({
        uri: `https://${HOST}/notes/` + body.id,
        i: I,
      }),
      method: "POST",
      mode: "cors",
    })
      .then((resp) => resp.json())
      .then((data) => {
        if (!data.object) {
          console.log("failed:", data);
          return;
        }
        console.log(
          "saved:",
          data.object?.id,
          data.object?.user?.name,
          data.object?.text
        );
      });
  });
  ws.on("close", function () {
    console.log("ws closed! restarting");
    setTimeout(main, 1000);
  });
};

main();
