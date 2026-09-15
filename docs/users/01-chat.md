---
title: "Chat Usage Guide"
category: "platform"
order: 1
description: "Using the chat interface for conversations with AI agents"
published: true
---

# Chat Usage Guide

## Access

Access chat from the navigation bar.

## Starting a Conversation

1. Click "New Conversation"
2. Type your message in the input field
3. Press Enter or click Send to submit

## Conversation Persistence

Conversations are saved automatically. They appear in the sidebar and can be resumed at any time.

## Message Streaming

Responses appear in real-time as they are generated. The agent streams its response token by token.

## Long responses keep running when you step away

A response is produced on the server, not in your browser tab. If your
laptop goes to sleep, you close the tab, or you switch to another
conversation while a long answer (a deep research run, a large
spreadsheet) is being written, the work continues and the finished answer
is saved into the conversation.

- **Coming back:** open the conversation and you are reconnected to the
  response where it is — a "Reconnecting…" notice appears briefly if the
  connection dropped. Nothing is asked twice.
- **Email when it finishes:** if nobody is looking at the conversation
  when the response completes (or it took more than a couple of minutes),
  you get an email with the first part of the answer, links to any files
  it produced, and an "Open the conversation" button. The bell icon in the
  chat header turns these emails on or off for you.
- **Stop** is the only thing that cancels a response. Whatever had been
  written so far stays in the conversation, marked *[Response stopped]*.
- If the service is restarted mid-answer, the partial answer is kept with
  a note asking you to run the question again.

You can have up to three responses in progress at once, and one per
conversation.

## Your memory

The assistant keeps a few short notes about you — your role, how you like
answers, the projects and people you mention — so you don't have to repeat
yourself. It reads them at the start of your own conversations and updates
them after, and you can also tell it directly: "remember that I report to
Dana on Fridays" or "forget what I said about the harbor bid".

Click the brain icon in the chat header to see exactly what it knows: every
file is shown as it is read, you can edit or delete any line, download the
lot, or turn memory off (nothing is read or written from then on). "Forget
everything" wipes it.

Only you can see this. It is stored encrypted under your own key, it is not
searchable, it never appears in shared conversations, and there is no
administrator view of it. Some things are never kept even if you ask —
health, money, identity or card numbers, and details about other people's
private lives.

## Features

**Markdown rendering**: Messages support markdown formatting. Headers, lists, links, and emphasis are rendered correctly.

**Code blocks**: Code blocks include syntax highlighting. Specify the language for accurate highlighting.

**Math rendering**: Mathematical expressions are rendered using KaTeX. Use LaTeX syntax within delimiters.

## Tools

Toggle web search and document search from the toolbar. When enabled, the agent can query external sources and your document libraries.

## Agent Selection

Choose different agents from the agent selector. Each agent may have specialized capabilities or knowledge for specific tasks.

## Library Selection

Select which document libraries to search when document search is enabled. Only selected libraries are queried for context.

## Conversation Management

From the sidebar:

- **Rename**: Click the conversation name to edit
- **Delete**: Use the delete option to remove a conversation
