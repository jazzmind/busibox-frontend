/**
 * Docs Index Page
 * 
 * Redirects to platform documentation by default.
 */

import { redirect } from 'next/navigation';

export default function DocsIndexPage() {
  redirect('/docs/platform');
}
