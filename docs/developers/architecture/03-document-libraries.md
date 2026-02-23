# Document Libraries Architecture

## Storage Architecture

Documents are stored across multiple systems:

| Storage | Location | Content |
|---------|----------|---------|
| Raw file | MinIO | Original uploaded file |
| Markdown | MinIO | Extracted/cleaned markdown version |
| Extracted images | MinIO | Images extracted during processing |
| Text chunks | PostgreSQL | Chunked text for retrieval |
| Embeddings | Milvus | text_dense (1024-d), page_vectors (128-d ColPali) |

## Document Detail Page

The document detail view has four tabs:

| Tab | Content |
|-----|---------|
| Overview | Stats (chunk count, vector count, status, keywords) |
| Content | Rendered markdown/HTML |
| Metadata | Document metadata fields |
| Processing | Processing status and logs |

## Chunks Browsing

Chunks are browsable at `/documents/{fileId}/chunks` with pagination and filtering. Users can inspect individual chunks and their embeddings.

## Library Model

- id, name, isPersonal, userId
- RBAC enforced via authz (roles determine access to shared libraries)

## Document Model

- id, userId, libraryId, filename
- status: queued, parsing, completed, failed
- chunkCount, vectorCount, extractedKeywords
- visibility: personal, shared

## Access Control

- **Personal libraries**: Accessible only by the owner (userId).
- **Shared libraries**: Access controlled by authz roles.
- **Documents**: Inherit access from their library.

## API Endpoints

| Endpoint | Purpose |
|---------|---------|
| Library CRUD | Create, list, update, delete libraries |
| Document upload | Upload file to a library |
| Document listing | List documents in a library with filters |
| Document deletion | Remove document and associated data |
| Document move | Move document between libraries |
| Tag groups | Manage document tags and tag groups |
