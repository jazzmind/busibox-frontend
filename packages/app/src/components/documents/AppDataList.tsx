'use client';

import React, { useEffect, useState } from 'react';
import { useCrossAppApiPath } from '../../contexts/ApiContext';
import { ArrowLeft, ExternalLink, Loader2, RefreshCw, Search, ChevronDown, ChevronUp, Lock, Globe } from 'lucide-react';
import type { AppDataLibraryItem, AppDataSchema, AppDataFieldDef } from '@jazzmind/busibox-app';
import { SchemaFormRenderer } from './SchemaFormRenderer';
import { AppDataItemActions, VisibilityBadge } from './AppDataItemActions';

interface AppDataListProps {
  appDataItem: AppDataLibraryItem;
  onBack?: () => void;
}

interface DataRecord {
  id: string;
  _visibility?: 'personal' | 'shared';
  [key: string]: any;
}

interface QueryResponse {
  records: DataRecord[];
  total: number;
  limit: number;
  offset: number;
}

export function AppDataList({ appDataItem, onBack }: AppDataListProps) {
  const resolve = useCrossAppApiPath();
  const [records, setRecords] = useState<DataRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRecordId, setExpandedRecordId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    loadRecords();
  }, [appDataItem.documentId]);

  async function loadRecords() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(resolve('data', `/api/data/${appDataItem.documentId}/query`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          limit: 100,
          offset: 0,
          orderBy: sortField ? [{ field: sortField, direction: sortDirection }] : undefined,
        }),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to load records');
      }

      const data: QueryResponse = await response.json();
      setRecords(data.records || []);
    } catch (err: any) {
      console.error('Failed to load app data records:', err);
      setError(err.message || 'Failed to load records');
    } finally {
      setLoading(false);
    }
  }

  function handleSort(field: string) {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  }

  // Get visible fields from schema (non-hidden, ordered)
  const visibleFields = getVisibleFields(appDataItem.schema);

  // Filter records by search query
  const filteredRecords = records.filter(record => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return Object.values(record).some(value => 
      String(value).toLowerCase().includes(query)
    );
  });

  // Get display columns for table (limited to first 4 visible fields)
  const displayColumns = visibleFields.slice(0, 4);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <div className="flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
          <span className="ml-2 text-gray-600">Loading {appDataItem.displayName || appDataItem.name}...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={loadRecords}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {onBack && (
              <button
                onClick={onBack}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                title="Back to libraries"
              >
                <ArrowLeft className="w-5 h-5 text-gray-600" />
              </button>
            )}
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {appDataItem.displayName || appDataItem.name}
              </h2>
              <p className="text-sm text-gray-500">
                {filteredRecords.length} {appDataItem.itemLabel || 'item'}{filteredRecords.length !== 1 ? 's' : ''}
                {' '}from {appDataItem.sourceApp.replace(/-/g, ' ')}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder={`Search ${appDataItem.itemLabel || 'items'}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            {/* Refresh */}
            <button
              onClick={loadRecords}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-5 h-5 text-gray-600" />
            </button>
            
            {/* Open in App */}
            <a
              href={`/${appDataItem.sourceApp}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-3 py-2 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-200 transition-colors"
            >
              <ExternalLink className="w-4 h-4 mr-1.5" />
              Open in App
            </a>
          </div>
        </div>
      </div>

      {/* Records Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        {filteredRecords.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            {searchQuery ? 'No matching records found.' : 'No records yet.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {displayColumns.map(({ fieldName, fieldDef }) => (
                    <th
                      key={fieldName}
                      onClick={() => handleSort(fieldName)}
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    >
                      <div className="flex items-center space-x-1">
                        <span>{fieldDef.label || fieldName}</span>
                        {sortField === fieldName && (
                          sortDirection === 'asc' 
                            ? <ChevronUp className="w-4 h-4" />
                            : <ChevronDown className="w-4 h-4" />
                        )}
                      </div>
                    </th>
                  ))}
                  {/* Visibility column if sharing is enabled */}
                  {appDataItem.allowSharing && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Visibility
                    </th>
                  )}
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredRecords.map((record) => (
                  <React.Fragment key={record.id}>
                    <tr 
                      className={`hover:bg-gray-50 cursor-pointer ${expandedRecordId === record.id ? 'bg-blue-50' : ''}`}
                      onClick={() => setExpandedRecordId(expandedRecordId === record.id ? null : record.id)}
                    >
                      {displayColumns.map(({ fieldName, fieldDef }) => (
                        <td key={fieldName} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatFieldValue(record[fieldName], fieldDef)}
                        </td>
                      ))}
                      {/* Visibility cell with sharing controls */}
                      {appDataItem.allowSharing && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <AppDataItemActions
                            documentId={appDataItem.documentId}
                            recordId={record.id}
                            currentVisibility={record._visibility || appDataItem.visibility || 'personal'}
                            allowSharing={appDataItem.allowSharing}
                            appDataItem={appDataItem}
                            onVisibilityChange={(newVisibility) => {
                              // Update local record state
                              setRecords(prev => prev.map(r => 
                                r.id === record.id ? { ...r, _visibility: newVisibility } : r
                              ));
                            }}
                          />
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedRecordId(expandedRecordId === record.id ? null : record.id);
                          }}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          {expandedRecordId === record.id ? 'Collapse' : 'View'}
                        </button>
                      </td>
                    </tr>
                    
                    {/* Expanded Row with Form */}
                    {expandedRecordId === record.id && (
                      <tr>
                        <td colSpan={displayColumns.length + (appDataItem.allowSharing ? 2 : 1)} className="px-6 py-4 bg-gray-50">
                          <SchemaFormRenderer
                            schema={appDataItem.schema}
                            record={record}
                            readonly={true}
                            onSave={async (updates) => {
                              // Save updates via data-api
                              const response = await fetch(resolve('data', `/api/data/${appDataItem.documentId}/records`), {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  updates,
                                  where: { field: 'id', op: 'eq', value: record.id },
                                }),
                                credentials: 'include',
                              });
                              if (!response.ok) {
                                throw new Error('Failed to save');
                              }
                              loadRecords();
                            }}
                            sourceApp={appDataItem.sourceApp}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// Helper functions

function getVisibleFields(schema?: AppDataSchema | null): Array<{ fieldName: string; fieldDef: AppDataFieldDef }> {
  if (!schema?.fields) return [];
  
  return Object.entries(schema.fields)
    .filter(([_, fieldDef]) => !fieldDef.hidden)
    .sort((a, b) => (a[1].order ?? 999) - (b[1].order ?? 999))
    .map(([fieldName, fieldDef]) => ({ fieldName, fieldDef }));
}

function formatFieldValue(value: any, fieldDef: AppDataFieldDef): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-gray-400">—</span>;
  }

  switch (fieldDef.type) {
    case 'boolean':
      return value ? '✓' : '✗';
    
    case 'enum':
      // Format enum values nicely
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(String(value))}`}>
          {String(value).replace(/-/g, ' ')}
        </span>
      );
    
    case 'array':
      if (Array.isArray(value)) {
        return value.slice(0, 3).join(', ') + (value.length > 3 ? ` +${value.length - 3}` : '');
      }
      return String(value);
    
    case 'integer':
    case 'number':
      if (fieldDef.max === 100 && fieldDef.min === 0) {
        // Progress bar for 0-100 values
        return (
          <div className="flex items-center space-x-2">
            <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-600 rounded-full" 
                style={{ width: `${Number(value)}%` }}
              />
            </div>
            <span className="text-xs text-gray-500">{value}%</span>
          </div>
        );
      }
      return String(value);
    
    case 'datetime':
    case 'string':
      // Check if it's a date string
      if (typeof value === 'string' && fieldDef.widget === 'date') {
        try {
          return new Date(value).toLocaleDateString();
        } catch {
          return value;
        }
      }
      // Truncate long strings
      const str = String(value);
      return str.length > 50 ? str.substring(0, 50) + '...' : str;
    
    default:
      return String(value);
  }
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    'on-track': 'bg-green-100 text-green-800',
    'at-risk': 'bg-yellow-100 text-yellow-800',
    'off-track': 'bg-red-100 text-red-800',
    'completed': 'bg-blue-100 text-blue-800',
    'paused': 'bg-gray-100 text-gray-800',
    'todo': 'bg-gray-100 text-gray-800',
    'in-progress': 'bg-blue-100 text-blue-800',
    'blocked': 'bg-red-100 text-red-800',
    'done': 'bg-green-100 text-green-800',
    'low': 'bg-gray-100 text-gray-700',
    'medium': 'bg-yellow-100 text-yellow-700',
    'high': 'bg-orange-100 text-orange-700',
    'critical': 'bg-red-100 text-red-700',
  };
  return colors[status.toLowerCase()] || 'bg-gray-100 text-gray-800';
}
