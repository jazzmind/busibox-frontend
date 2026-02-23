'use client';

import React, { useState } from 'react';
import { ExternalLink, Save, X, Edit2 } from 'lucide-react';
import type { AppDataSchema, AppDataFieldDef } from '@jazzmind/busibox-app';

interface SchemaFormRendererProps {
  schema?: AppDataSchema | null;
  record: Record<string, any>;
  readonly?: boolean;
  onSave?: (updates: Record<string, any>) => Promise<void>;
  sourceApp?: string;
}

export function SchemaFormRenderer({
  schema,
  record,
  readonly = false,
  onSave,
  sourceApp,
}: SchemaFormRendererProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!schema?.fields) {
    return (
      <div className="text-gray-500 text-sm">
        No schema available for this data.
      </div>
    );
  }

  // Get visible, editable fields sorted by order
  const visibleFields = Object.entries(schema.fields)
    .filter(([_, fieldDef]) => !fieldDef.hidden)
    .sort((a, b) => (a[1].order ?? 999) - (b[1].order ?? 999));

  function handleStartEdit() {
    // Copy current values to form data
    const initialData: Record<string, any> = {};
    visibleFields.forEach(([fieldName]) => {
      initialData[fieldName] = record[fieldName];
    });
    setFormData(initialData);
    setIsEditing(true);
    setError(null);
  }

  function handleCancelEdit() {
    setIsEditing(false);
    setFormData({});
    setError(null);
  }

  async function handleSave() {
    if (!onSave) return;

    try {
      setSaving(true);
      setError(null);

      // Only save changed fields
      const updates: Record<string, any> = {};
      for (const [fieldName, value] of Object.entries(formData)) {
        if (value !== record[fieldName]) {
          updates[fieldName] = value;
        }
      }

      if (Object.keys(updates).length > 0) {
        await onSave(updates);
      }

      setIsEditing(false);
      setFormData({});
    } catch (err: any) {
      setError(err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  function handleFieldChange(fieldName: string, value: any) {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
  }

  // Check if any fields are editable (not readonly)
  const hasEditableFields = visibleFields.some(([_, def]) => !def.readonly);
  const canEdit = !readonly && hasEditableFields && onSave;

  return (
    <div className="space-y-4">
      {/* Header with actions */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-700">Details</h3>
        
        <div className="flex items-center space-x-2">
          {isEditing ? (
            <>
              <button
                onClick={handleCancelEdit}
                disabled={saving}
                className="inline-flex items-center px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
              >
                <X className="w-4 h-4 mr-1" />
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                <Save className="w-4 h-4 mr-1" />
                {saving ? 'Saving...' : 'Save'}
              </button>
            </>
          ) : (
            <>
              {canEdit && (
                <button
                  onClick={handleStartEdit}
                  className="inline-flex items-center px-3 py-1.5 text-sm text-blue-600 hover:text-blue-800"
                >
                  <Edit2 className="w-4 h-4 mr-1" />
                  Edit
                </button>
              )}
              {sourceApp && (
                <a
                  href={`/${sourceApp}/${record.id || ''}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-3 py-1.5 text-sm text-purple-600 hover:text-purple-800"
                >
                  <ExternalLink className="w-4 h-4 mr-1" />
                  Full Edit in App
                </a>
              )}
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Form Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {visibleFields.map(([fieldName, fieldDef]) => (
          <FormField
            key={fieldName}
            fieldName={fieldName}
            fieldDef={fieldDef}
            value={isEditing ? formData[fieldName] : record[fieldName]}
            onChange={(value) => handleFieldChange(fieldName, value)}
            disabled={!isEditing || fieldDef.readonly || saving}
            isEditing={isEditing}
          />
        ))}
      </div>
    </div>
  );
}

interface FormFieldProps {
  fieldName: string;
  fieldDef: AppDataFieldDef;
  value: any;
  onChange: (value: any) => void;
  disabled: boolean;
  isEditing: boolean;
}

function FormField({ fieldName, fieldDef, value, onChange, disabled, isEditing }: FormFieldProps) {
  const label = fieldDef.label || fieldName;
  const isRequired = fieldDef.required;

  // Render read-only display
  if (!isEditing || fieldDef.readonly) {
    return (
      <div className={fieldDef.multiline ? 'md:col-span-2' : ''}>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          {label}
        </label>
        <div className="text-sm text-gray-900">
          {renderReadOnlyValue(value, fieldDef)}
        </div>
      </div>
    );
  }

  // Render editable form control
  const inputClasses = "w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-500";

  return (
    <div className={fieldDef.multiline ? 'md:col-span-2' : ''}>
      <label className="block text-xs font-medium text-gray-700 mb-1">
        {label}
        {isRequired && <span className="text-red-500 ml-1">*</span>}
      </label>

      {/* Select/Dropdown for enum */}
      {fieldDef.type === 'enum' && fieldDef.values ? (
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={inputClasses}
        >
          <option value="">Select {label}</option>
          {fieldDef.values.map((v) => (
            <option key={v} value={v}>
              {v.replace(/-/g, ' ')}
            </option>
          ))}
        </select>
      ) : fieldDef.type === 'boolean' ? (
        /* Checkbox for boolean */
        <input
          type="checkbox"
          checked={value || false}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
        />
      ) : fieldDef.widget === 'slider' || (fieldDef.type === 'integer' && fieldDef.min !== undefined && fieldDef.max !== undefined) ? (
        /* Slider for integer with min/max */
        <div className="flex items-center space-x-3">
          <input
            type="range"
            min={fieldDef.min ?? 0}
            max={fieldDef.max ?? 100}
            value={value ?? 0}
            onChange={(e) => onChange(parseInt(e.target.value, 10))}
            disabled={disabled}
            className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <span className="text-sm text-gray-600 w-12 text-right">{value ?? 0}%</span>
        </div>
      ) : fieldDef.multiline || fieldDef.widget === 'textarea' ? (
        /* Textarea for multiline strings */
        <textarea
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={fieldDef.placeholder}
          rows={4}
          className={inputClasses}
        />
      ) : fieldDef.widget === 'date' || fieldDef.type === 'datetime' ? (
        /* Date input */
        <input
          type="date"
          value={value ? value.split('T')[0] : ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className={inputClasses}
        />
      ) : fieldDef.type === 'integer' || fieldDef.type === 'number' ? (
        /* Number input */
        <input
          type="number"
          value={value ?? ''}
          onChange={(e) => onChange(fieldDef.type === 'integer' ? parseInt(e.target.value, 10) : parseFloat(e.target.value))}
          disabled={disabled}
          min={fieldDef.min}
          max={fieldDef.max}
          placeholder={fieldDef.placeholder}
          className={inputClasses}
        />
      ) : fieldDef.type === 'array' ? (
        /* Read-only for arrays (complex editing not supported) */
        <div className="text-sm text-gray-500 italic">
          {Array.isArray(value) ? value.join(', ') : '—'}
          <span className="text-xs ml-2">(Edit in app for arrays)</span>
        </div>
      ) : (
        /* Default text input */
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={fieldDef.placeholder}
          className={inputClasses}
        />
      )}
    </div>
  );
}

function renderReadOnlyValue(value: any, fieldDef: AppDataFieldDef): React.ReactNode {
  if (value === null || value === undefined) {
    return <span className="text-gray-400">—</span>;
  }

  switch (fieldDef.type) {
    case 'boolean':
      return value ? 'Yes' : 'No';

    case 'enum':
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(String(value))}`}>
          {String(value).replace(/-/g, ' ')}
        </span>
      );

    case 'array':
      if (Array.isArray(value)) {
        if (value.length === 0) return <span className="text-gray-400">—</span>;
        return (
          <div className="flex flex-wrap gap-1">
            {value.map((item, i) => (
              <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700">
                {String(item)}
              </span>
            ))}
          </div>
        );
      }
      return String(value);

    case 'integer':
    case 'number':
      if (fieldDef.max === 100 && fieldDef.min === 0) {
        // Progress bar for 0-100 values
        return (
          <div className="flex items-center space-x-2">
            <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full"
                style={{ width: `${Number(value)}%` }}
              />
            </div>
            <span className="text-sm">{value}%</span>
          </div>
        );
      }
      return String(value);

    case 'datetime':
    case 'string':
      if (typeof value === 'string' && fieldDef.widget === 'date') {
        try {
          return new Date(value).toLocaleDateString();
        } catch {
          return value;
        }
      }
      // Render multiline with proper whitespace
      if (fieldDef.multiline && typeof value === 'string') {
        return <div className="whitespace-pre-wrap">{value}</div>;
      }
      return String(value);

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
