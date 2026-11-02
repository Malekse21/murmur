# MurMur — A mascot that grows with your chat

## What it does

MurMur gives a Twitch stream a small animated character that can react to chat. A streamer customizes the mascot, connects a Twitch channel, and can show it as a Twitch Video - Fullscreen Extension or a transparent OBS browser source. When chat reactions are enabled, MurMur classifies individual chat messages and changes the mascot's expression. It can also send a short AI-generated reply when the streamer enables replies.

## The problem

Live chat moves quickly, and a creator's on-screen experience can make viewers feel like they're watching from the sidelines. Small creators also have limited time to read every message, respond, and keep the stream visually alive. MurMur adds a recognizable visual presence to chat activity without requiring the streamer to manually animate a character for each moment.

## How MurMur helps

The streamer chooses the mascot's name, shape, color, expression, and motion, then connects the channel. Twitch EventSub delivers channel chat messages to MurMur. TypeSafe Jev classifies each eligible message into one of the mascot's expressions. MurMur updates its session and broadcasts the expression to viewers through Twitch Extension PubSub. When Jev recommends a reply and the cooldown permits one, Groq generates a concise response that MurMur validates before sending to Twitch chat.

The streamer can separately create a Twitch poll from the dashboard. The poll is written and started by the streamer, and Twitch handles voting. The dashboard explains that polls require Affiliate or Partner status.

## Main features

- Customize a named mascot's shape, color, expression, and animation.
- React to individual Twitch chat messages with one of sixteen expressions.
- Optionally generate and send short chat replies through Twitch Extension Chat.
- Show the mascot to Extension viewers with Twitch Extension PubSub expression updates.
- Use a transparent OBS browser source as an alternative overlay.
- Create Twitch polls manually from the dashboard when the channel is eligible.

## How it uses Twitch

MurMur uses the broadcaster's OAuth authorization-code flow and requests `user:read:chat`, `user:write:chat`, and `channel:manage:polls`. Its EventSub worker subscribes to `channel.chat.message` over WebSocket. Twitch Helix endpoints support account lookup and poll creation. The Extension backend verifies Twitch Extension JWTs, sends replies through Extension Chat, and broadcasts mascot expression updates through Extension PubSub. A Helix chat-message path is also implemented as a fallback.

Polls are only available to Twitch Affiliates and Partners. Extension Chat requires the Extension's Chat capability to be enabled. Chat reactions and generated replies require the relevant Twitch, TypeSafe, Groq, and Extension setup.

## Technical implementation

The app uses Next.js App Router, React, and TypeScript. The web server serves onboarding, dashboard, overlay, and API routes. A separate Node worker maintains the EventSub WebSocket connection. TypeSafe's `jev-latest` model classifies a message's tone and whether a reply is suitable; application logic enforces a score threshold, duplicate suppression, and per-channel cooldowns. Groq's Chat Completions API (default model `openai/gpt-oss-20b`) writes optional reply text. Zod validates API data and the generated reply shape.

The current session store is a local JSON file shared by the web app and worker. Twitch tokens are encrypted with AES-256-GCM using a key derived from a server-side session secret. The app does not persist raw chat text, but sends that text to TypeSafe for classification and to Groq when it requests a reply. Chat usernames and viewer IDs are not included in those AI requests.

## How we used OpenAI Codex

Codex collaborated on the project implementation, including the mascot setup and dashboard, Twitch OAuth/EventSub and Extension integration, TypeSafe/Groq chat processing, poll creation, local environment setup, and Extension packaging. The repository history begins with a consolidated initial commit and has no session attribution notes, so the precise split of Codex-generated code and developer modifications cannot be confirmed from the checkout. We will add verified account names, session IDs, and contribution ownership before submission; no session identifiers are inferred here.

## Current scope and limitations

MurMur reacts to messages individually. The current code does not implement aggregate community sentiment or Crowd Pulse, persistent community learning, a vocabulary/glossary editor, an approval inbox, or moderator controls. Enabled AI replies are published automatically; there is no human approval step. The poll flow is manual and uses Twitch's own voting interface. Streamlabs-specific behavior has not been implemented or verified.

## Team

- Primary Codex account/session: **[NAME AND SESSION ID]** — **[verified contribution areas]**
- Additional Codex account/session: **[NAME AND SESSION ID]** — **[verified contribution areas]**
- Additional Codex account/session: **[NAME AND SESSION ID]** — **[verified contribution areas]**

## Demo assets and submission details to add

- Screenshots or a short demo video of mascot customization, the dashboard, the Extension viewer, and the OBS overlay.
- Verified names, account names, and Codex session IDs for all three contributors, with one primary session identified.
- A hosted demo URL and any test-channel instructions, if available.
- A project-level license decision. The repository currently has no root license; the adapted `lib/bloub/` engine has a separate MIT license.
