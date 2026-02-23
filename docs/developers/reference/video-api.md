# Video API Reference

Video generation API reference using OpenAI Sora-2. Authentication via session cookie.

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/videos/generate` | Generate video. Body: `prompt`, `seconds` (4/8/12), `size`, `referenceMedia?` (base64, fileType, format, fileSizeBytes) |
| GET | `/api/videos/library` | List videos. Params: `filter` (my-videos/public/shared), `limit`, `offset`, `status` |
| GET | `/api/videos/[id]` | Get video (includes full reference media) |
| GET | `/api/videos/[id]/status` | Poll OpenAI for fresh status |
| DELETE | `/api/videos/[id]` | Delete video |
| POST | `/api/videos/[id]/share` | Share video. Body: `userIds` (array) |
| PATCH | `/api/videos/[id]/visibility` | Update visibility. Body: `PRIVATE` \| `PUBLIC` \| `SHARED` |

## Data Models

### Video

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier |
| ownerId | string | Owner user ID |
| openaiVideoId | string | OpenAI video ID |
| prompt | string | Generation prompt |
| durationSeconds | number | 4, 8, or 12 |
| resolution | string | Output resolution |
| status | string | `QUEUED` \| `PENDING` \| `PROCESSING` \| `COMPLETED` \| `FAILED` \| `EXPIRED` |
| visibility | string | Visibility setting |
| createdAt | string | ISO timestamp |
| updatedAt | string | ISO timestamp |
| downloadUrl | string | Download URL (when COMPLETED) |
| posterUrl | string | Poster/thumbnail URL |
| progress | number | Progress percentage |
| errorMessage | string | Error message (when FAILED) |

### VideoReferenceMedia

Reference media for video generation (base64, fileType, format, fileSizeBytes).

### VideoShare

Share record linking video to user IDs.

## Status Progression

```
QUEUED -> PENDING -> PROCESSING -> COMPLETED (downloadUrl, expiresAt 7 days)
                                    |
                                    +-> FAILED
```

## Rate Limits

OpenAI Sora-2 limits apply (5–20 requests/minute by tier). Poll status every 3 seconds.

## Video Expiration

Videos expire 7 days after completion. Subject to OpenAI retention policy.
