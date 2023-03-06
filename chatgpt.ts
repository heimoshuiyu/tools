interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

class Chat {
  OPENAI_API_KEY: string;
  messages: Message[];
  sysMessageContent: string;
  total_tokens: number;
  max_tokens: number;
  tokens_margin: number;

  constructor(
    OPENAI_API_KEY: string | undefined,
    {
      systemMessage = "你是一个有用的人工智能助理",
      max_tokens = 4096,
      tokens_margin = 1024,
    } = {}
  ) {
    if (OPENAI_API_KEY === undefined) {
      throw "OPENAI_API_KEY is undefined";
    }
    this.OPENAI_API_KEY = OPENAI_API_KEY;
    this.messages = [];
    this.total_tokens = 0;
    this.max_tokens = max_tokens;
    this.tokens_margin = tokens_margin;
    this.sysMessageContent = systemMessage;
  }

  async fetch(): Promise<{
    id: string;
    object: string;
    created: number;
    model: string;
    usage: {
      prompt_tokens: number;
      completion_tokens: number;
      total_tokens: number;
    };
    choices: {
      message: Message;
      finish_reason: "stop" | "length";
      index: number;
    }[];
  }> {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: this.messages,
      }),
    }).then((resp) => resp.json());
    return resp;
  }

  async say(content: string): Promise<string> {
    this.messages.push({ role: "user", content });
    await this.complete();
    return this.messages.slice(-1)[0].content;
  }

  async complete(): Promise<string> {
    const resp = await this.fetch();
    this.total_tokens = resp.usage.total_tokens;
    this.messages.push(resp.choices[0].message);

    if (resp.choices[0].finish_reason === "length") {
      this.forceForgetSomeMessages();
    } else {
      this.forgetSomeMessages();
    }

    return resp.choices[0].message.content;
  }

  // https://help.openai.com/en/articles/4936856-what-are-tokens-and-how-to-count-them
  calculate_token_length(content: string): number {
    const totalCount = content.length;
    const chineseCount = content.match(/[\u00ff-\uffff]|\S+/g)?.length ?? 0;
    const englishCount = totalCount - chineseCount;
    const tokenLength = englishCount / 4 + (chineseCount * 4) / 3;
    return ~~tokenLength;
  }

  user(...messages: string[]) {
    for (const msg of messages) {
      this.messages.push({ role: "user", content: msg });
      this.total_tokens += this.calculate_token_length(msg);
      this.forgetSomeMessages();
    }
  }

  assistant(...messages: string[]) {
    for (const msg of messages) {
      this.messages.push({ role: "assistant", content: msg });
      this.total_tokens += this.calculate_token_length(msg);
      this.forgetSomeMessages();
    }
  }

  forgetSomeMessages() {
    // forget occur condition
    if (this.total_tokens + this.tokens_margin >= this.max_tokens) {
      this.forceForgetSomeMessages();
    }
  }

  forceForgetSomeMessages() {
    this.messages = [
      {
        role: "system",
        content: this.sysMessageContent,
      },
      ...this.messages.slice(Math.max(~~(this.messages.length / 4), 2)),
    ];
  }

  forgetAllMessage() {
    this.messages = [
      {
        role: "system",
        content: this.sysMessageContent,
      },
    ];
  }

  stats(): string {
    return (
      `total_tokens: ${this.total_tokens}` +
      "\n" +
      `max_tokens: ${this.max_tokens}` +
      "\n" +
      `tokens_margin: ${this.tokens_margin}` +
      "\n" +
      `messages.length: ${this.messages.length}`
    );
  }
}

export default Chat;
