---
title: "Ingestion Configuration"
category: "administrator"
order: 3
description: "Document ingestion and processing configuration"
published: true
---

# Ingestion Configuration

## Admin UI

Access ingestion settings at Admin Dashboard, then Ingestion Settings.

## Processing Features

**LLM cleanup**: AI-powered text normalization. Improves extraction quality by cleaning and normalizing extracted text.

**Multi-flow processing**: Supports parallel processing strategies. Multiple strategies can run simultaneously for different document types or quality requirements.

## Processing Strategies

- **Marker**: Enhanced PDF extraction. Better handling of complex layouts, tables, and multi-column documents.
- **ColPali**: Visual embeddings. Extracts semantic information from document images for improved search and retrieval.

## Chunking Configuration

- **Chunk size**: Min 100, max 2000 characters. Default 400 min, 800 max.
- **Overlap**: 0-50%. Default 12%. Overlap between chunks improves context continuity for search.

## Timeouts by File Size

- Small files (under 5MB): 300 seconds
- Medium files (5-20MB): 600 seconds
- Large files (over 20MB): 1200 seconds

## API

- `GET /api/admin/ingestion-settings` - Retrieve current settings
- `PATCH /api/admin/ingestion-settings` - Update settings

## Recommended Configurations

**Development (fast, simple)**: Simple extraction, smaller chunks (400/800), minimal overlap (5%), LLM cleanup disabled.

**Production balanced**: Marker for PDFs, default chunk size (400/800), 12% overlap, LLM cleanup enabled.

**Production high quality**: Marker and ColPali where applicable, larger chunks (600/1200), 15% overlap, LLM cleanup enabled, extended timeouts for large files.

## Important Note

Settings apply only to new uploads. Existing documents retain their original processing. Re-upload documents to apply new settings.
