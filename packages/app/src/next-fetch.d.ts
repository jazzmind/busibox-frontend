/**
 * Augment the global fetch RequestInit to include Next.js-specific options.
 * This allows server-side files to use `{ next: { revalidate: ... } }` without
 * requiring the full Next.js type definitions.
 */
interface RequestInit {
  next?: {
    revalidate?: number | false;
    tags?: string[];
  };
}
