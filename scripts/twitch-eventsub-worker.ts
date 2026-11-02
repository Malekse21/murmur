import { isRecentExtensionMessage, processChatReaction } from "@/lib/chat-reaction";
import { listConnectedTwitchSessions, twitchApiFetch, CHAT_SCOPES } from "@/lib/twitch-server";

const EVENTSUB_URL = "wss://eventsub.wss.twitch.tv/ws";
const RECONCILE_INTERVAL_MS = 15_000;

type TwitchChatEvent = {
  broadcaster_user_id?: string;
  chatter_user_id?: string;
  message_id?: string;
  message_type?: string;
  message?: { text?: string };
};

type EventSubFrame = {
  metadata?: { message_type?: string; message_id?: string };
  payload?: {
    session?: { id?: string; keepalive_timeout_seconds?: number; reconnect_url?: string | null };
    subscription?: { type?: string };
    event?: TwitchChatEvent;
  };
};

type ConnectedAccount = Awaited<ReturnType<typeof listConnectedTwitchSessions>>[number];

type ChannelWorker = {
  stop: () => void;
};

const workers = new Map<string, ChannelWorker>();
let stopping = false;

async function subscribeToChat(account: ConnectedAccount, sessionId: string) {
  if (!CHAT_SCOPES.every((scope) => account.twitchSession.scopes.includes(scope))) {
    console.warn(`Skipping chat subscription for ${account.twitchSession.login}: missing Twitch chat scope.`);
    return;
  }

  const { response } = await twitchApiFetch(account.key, "/eventsub/subscriptions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "channel.chat.message",
      version: "1",
      condition: { broadcaster_user_id: account.twitchSession.userId, user_id: account.twitchSession.userId },
      transport: { method: "websocket", session_id: sessionId },
    }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`EventSub subscription failed (${response.status}): ${detail.slice(0, 240)}`);
  }
}

function startChannelWorker(account: ConnectedAccount): ChannelWorker {
  let stopped = false;
  let currentSocket: WebSocket | null = null;
  let keepaliveTimer: ReturnType<typeof setTimeout> | undefined;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let keepaliveSeconds = 30;
  const sockets = new Set<WebSocket>();

  const resetKeepalive = (socket: WebSocket, seconds: number) => {
    clearTimeout(keepaliveTimer);
    keepaliveTimer = setTimeout(() => socket.close(), (seconds + 5) * 1000);
  };

  const onChatMessage = async (event: TwitchChatEvent) => {
    const messageId = event.message_id;
    const message = event.message?.text?.trim();
    if (!messageId || !message || event.chatter_user_id === account.twitchSession.userId) return;
    if (isRecentExtensionMessage(account.twitchSession.userId, message)) return;

    try {
      await processChatReaction({ key: account.key, messageId, message });
    } catch (error) {
      console.error(`Chat reaction failed for ${account.twitchSession.login}:`, error);
    }
  };

  const open = (url = EVENTSUB_URL, reconnectFrom?: WebSocket) => {
    if (stopped) return;
    const socket = new WebSocket(url);
    sockets.add(socket);
    if (!reconnectFrom) currentSocket = socket;

    socket.onmessage = (raw) => {
      let frame: EventSubFrame;
      try { frame = JSON.parse(String(raw.data)) as EventSubFrame; } catch { return; }
      const type = frame.metadata?.message_type;
      if (type === "session_welcome") {
        const sessionId = frame.payload?.session?.id;
        keepaliveSeconds = frame.payload?.session?.keepalive_timeout_seconds ?? 30;
        resetKeepalive(socket, keepaliveSeconds);
        if (reconnectFrom) {
          currentSocket = socket;
          reconnectFrom.close();
        } else if (sessionId) {
          void subscribeToChat(account, sessionId).catch((error) => {
            console.error(`Could not subscribe ${account.twitchSession.login} to Twitch chat:`, error);
          });
        }
        return;
      }
      if (type === "session_keepalive") {
        resetKeepalive(socket, keepaliveSeconds);
        return;
      }
      if (type === "session_reconnect") {
        const reconnectUrl = frame.payload?.session?.reconnect_url;
        if (reconnectUrl) open(reconnectUrl, socket);
        return;
      }
      if (type === "notification" && frame.payload?.subscription?.type === "channel.chat.message" && frame.payload.event) {
        void onChatMessage(frame.payload.event);
      }
    };

    socket.onclose = () => {
      sockets.delete(socket);
      if (socket !== currentSocket || stopped) return;
      currentSocket = null;
      clearTimeout(keepaliveTimer);
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => open(), 2_000);
    };
    socket.onerror = () => socket.close();
  };

  open();
  return {
    stop() {
      stopped = true;
      clearTimeout(keepaliveTimer);
      clearTimeout(reconnectTimer);
      for (const socket of sockets) socket.close();
      sockets.clear();
    },
  };
}

async function reconcile() {
  if (stopping) return;
  try {
    const connected = await listConnectedTwitchSessions();
    const active = connected.filter((account) => account.appSession.chatbotEnabled);
    const wanted = new Set(active.map((account) => account.key));

    for (const [key, worker] of workers) {
      if (!wanted.has(key)) {
        worker.stop();
        workers.delete(key);
      }
    }
    for (const account of active) {
      if (!workers.has(account.key)) workers.set(account.key, startChannelWorker(account));
    }
  } catch (error) {
    console.error("Could not refresh connected Twitch channels:", error);
  }
}

function stopAll() {
  stopping = true;
  for (const worker of workers.values()) worker.stop();
  workers.clear();
}

process.on("SIGINT", stopAll);
process.on("SIGTERM", stopAll);

console.info("MurMur Twitch EventSub worker started.");
void reconcile();
setInterval(() => void reconcile(), RECONCILE_INTERVAL_MS);
