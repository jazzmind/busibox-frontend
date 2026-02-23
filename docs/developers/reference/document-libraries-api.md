# Document Libraries API Reference

Document libraries API reference. Authentication via session cookie.

## Library Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/libraries` | List libraries |
| POST | `/api/libraries` | Create library (admin only) |
| GET | `/api/libraries/[id]` | Get library |
| PATCH | `/api/libraries/[id]` | Update library name |
| DELETE | `/api/libraries/[id]` | Soft delete library |
| DELETE | `/api/libraries/[id]/purge` | Permanent delete library |

## Document Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/libraries/[id]/documents` | List documents. Params: `search`, `status`, `sort` |
| GET | `/api/libraries/[id]/tags` | Get semantic tag groups |
| POST | `/api/documents/upload` | Upload document. Multipart form-data: `file`, `libraryId?`, `metadata?`, `processing_config?` |
| GET | `/api/documents/[fileId]` | Get document |
| DELETE | `/api/documents/[fileId]` | Delete document |
| POST | `/api/documents/[fileId]/move` | Move document to another library |

## Data Models

### Library

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier |
| name | string | Library name |
| isPersonal | boolean | Personal library flag |
| userId | string | Owner user ID |
| createdBy | string | Creator user ID |
| deletedAt | string \| null | Soft delete timestamp |

### Document

| Field | Type | Description |
|-------|------|-------------|
| id | string | Unique identifier |
| userId | string | Owner user ID |
| libraryId | string | Parent library ID |
| filename | string | Stored filename |
| originalFilename | string | Original upload filename |
| mimeType | string | MIME type |
| sizeBytes | number | File size in bytes |
| status | string | Processing status |
| documentType | string | Document type |
| primaryLanguage | string | Detected primary language |
| chunkCount | number | Number of chunks |
| vectorCount | number | Number of vectors |
| extractedTitle | string | Extracted title |
| extractedAuthor | string | Extracted author |
| extractedKeywords | string[] | Extracted keywords |
| visibility | string | `personal` \| `shared` |

## Access Control

- **Personal libraries:** Accessible by owner only
- **Shared libraries:** Accessible by authz roles
- **Documents:** Inherit access from parent library
