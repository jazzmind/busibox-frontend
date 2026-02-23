---
title: "Document Management Guide"
category: "platform"
order: 2
description: "Managing document libraries and uploads"
published: true
---

# Document Management Guide

## Libraries

Libraries organize documents with access control.

**Personal library**: Created automatically for each user. Only you can see and manage documents in your personal library.

**Shared libraries**: Created by admins. Access is controlled by assigned roles. Users with access can view and search documents in shared libraries.

## Uploading Documents

1. Click Upload
2. Select one or more files
3. Choose the target library (defaults to personal)
4. Confirm upload

## Supported Formats

PDF, DOCX, XLSX, PPTX, TXT, MD, CSV.

## Processing

Documents are automatically parsed, chunked, and embedded for semantic search. Processing time depends on file size and complexity.

## Viewing Documents

Document view provides:

- **Overview**: Statistics and summary
- **Content**: Rendered markdown of extracted text
- **Metadata**: File properties and extraction metadata
- **Processing details**: Chunk count, embedding status, processing history

## Chunk Browsing

View individual text chunks at `/documents/{fileId}/chunks`. Chunks are the units used for semantic search.

## Tag Groups

Documents are automatically categorized into semantic tag groups. These groups help organize and discover related content.

## Searching

Use document search in the chat interface to query your libraries. Alternatively, browse a library and use its search or filter options.
