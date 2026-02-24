import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@jazzmind/busibox-app';
import { ChunksBrowser } from '@jazzmind/busibox-app';

interface PageProps {
  params: Promise<{ fileId: string }>;
}

async function getDocumentMetadata(fileId: string) {
  try {
    const response = await fetch(`/documents/api/documents/${fileId}/status`, {
      cache: 'no-store',
    });
    
    if (!response.ok) {
      return null;
    }
    
    return response.json();
  } catch (error) {
    console.error('Error fetching document metadata:', error);
    return null;
  }
}

export default async function ChunksPage({ params }: PageProps) {
  const resolvedParams = await params;
  const { fileId } = resolvedParams;
  
  const metadata = await getDocumentMetadata(fileId);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <Link href={`/${fileId}`}>
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Document
            </Button>
          </Link>
          
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              {metadata?.filename || 'Document Chunks'}
            </h1>
            {metadata && (
              <p className="text-gray-600 mt-2">
                {metadata.total_chunks || 0} chunks • {metadata.total_pages || 0} pages
              </p>
            )}
          </div>
        </div>

        {/* Chunks Browser */}
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-96">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <span className="ml-3 text-gray-600">Loading chunks...</span>
            </div>
          }
        >
          <ChunksBrowser 
            fileId={fileId} 
            totalChunks={metadata?.total_chunks || 0}
          />
        </Suspense>
      </div>
    </div>
  );
}
