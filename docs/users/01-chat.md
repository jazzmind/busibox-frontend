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

### Starter prompts with a blank to fill in

On the new-chat screen, some starter prompts have a text box in the middle of
the sentence — for example **Deep dive into the topic** `[ topic… ]`. Type the
subject and press Enter (or the arrow) and the whole sentence is sent as your
question. Administrators define these in the chat app's
`NEXT_PUBLIC_CHAT_SUGGESTED_PROMPTS` setting by writing `{{name}}` where the
blank should go.

## Conversation Persistence

Conversations are saved automatically. They appear in the sidebar and can be resumed at any time.

## Message Streaming

Responses appear in real-time as they are generated. The agent streams its response token by token.

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
