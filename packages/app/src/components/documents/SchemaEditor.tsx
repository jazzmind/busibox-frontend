'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useCrossAppApiPath } from '../../contexts/ApiContext';
import { Button } from '@jazzmind/busibox-app';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  GripVertical,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Code,
  Copy,
  Layers,
  Search,
  Brain,
  Share2,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────────

type SchemaDocument = {
  id: string;
  name: string;
  schema?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
  visibility?: 'personal' | 'shared';
};

interface SchemaEditorProps {
  document?: SchemaDocument | null;
  onSaved: () => Promise<void> | void;
  onDeleted: () => Promise<void> | void;
  onClone?: (clonedDoc: SchemaDocument) => void;
}

const FIELD_TYPES = [
  { value: 'string', label: 'Text' },
  { value: 'integer', label: 'Integer' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'array', label: 'Array' },
  { value: 'object', label: 'Object' },
  { value: 'enum', label: 'Enum' },
  { value: 'datetime', label: 'Date/Time' },
] as const;

const ARRAY_ITEM_TYPES = [
  { value: 'string', label: 'Text' },
  { value: 'integer', label: 'Integer' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'object', label: 'Object' },
] as const;

type FieldType = (typeof FIELD_TYPES)[number]['value'];

type SearchMode = 'keyword' | 'embed' | 'graph';

const SEARCH_MODES: { value: SearchMode; label: string; icon: typeof Search; description: string }[] = [
  { value: 'keyword', label: 'Keyword', icon: Search, description: 'BM25 keyword search (exact match, filtering)' },
  { value: 'embed', label: 'Embed', icon: Brain, description: 'Semantic search via vector embeddings' },
  { value: 'graph', label: 'Graph', icon: Share2, description: 'Entity extraction for knowledge graph' },
];

interface ObjectProperty {
  id: string;
  name: string;
  type: FieldType;
  description: string;
  required: boolean;
  enumValues?: string[];
  items?: ItemsDef;
  properties?: ObjectProperty[];
  search?: SearchMode[];
}

interface ItemsDef {
  type: string;
  properties?: ObjectProperty[];
}

interface SchemaField {
  id: string;
  name: string;
  type: FieldType;
  required: boolean;
  description: string;
  items?: ItemsDef;
  enumValues?: string[];
  properties?: ObjectProperty[];
  search?: SearchMode[];
}

// ─── ID Generation ──────────────────────────────────────────────────────────

let _idCounter = 0;
function generateId(): string {
  _idCounter += 1;
  return `f_${Date.now()}_${_idCounter}_${Math.random().toString(36).slice(2, 6)}`;
}

// ─── Schema ↔ Fields conversion ─────────────────────────────────────────────

function parseSearchModes(raw: any): SearchMode[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const valid = raw
    .map((v: any) => (v === 'index' ? 'keyword' : v))
    .filter((v: any) => v === 'keyword' || v === 'embed' || v === 'graph') as SearchMode[];
  return valid.length > 0 ? valid : undefined;
}

function defToObjectProperties(
  properties: Record<string, any> | undefined
): ObjectProperty[] {
  if (!properties || typeof properties !== 'object') return [];
  return Object.entries(properties).map(([propName, propDef]: [string, any]) => ({
    id: generateId(),
    name: propName,
    type: (propDef?.type || 'string') as FieldType,
    description: propDef?.description || '',
    required: propDef?.required ?? false,
    enumValues: propDef?.enum_values || propDef?.enumValues || undefined,
    items: propDef?.items
      ? {
          type: propDef.items.type || 'string',
          properties: defToObjectProperties(propDef.items.properties),
        }
      : undefined,
    properties: defToObjectProperties(propDef?.properties),
    search: parseSearchModes(propDef?.search),
  }));
}

function schemaToFields(schema: Record<string, any> | null | undefined): SchemaField[] {
  if (!schema?.fields || typeof schema.fields !== 'object') return [];
  const entries = Object.entries(schema.fields as Record<string, any>);

  const sorted = entries.sort(([, a], [, b]) => {
    const aOrder = a?.display_order ?? a?.order ?? Number.POSITIVE_INFINITY;
    const bOrder = b?.display_order ?? b?.order ?? Number.POSITIVE_INFINITY;
    return aOrder - bOrder;
  });

  return sorted.map(([name, def]) => ({
    id: generateId(),
    name,
    type: (def?.type || 'string') as FieldType,
    required: def?.required ?? false,
    description: def?.description || '',
    enumValues: def?.enum_values || def?.enumValues || undefined,
    items: def?.items
      ? {
          type: def.items.type || 'string',
          properties: defToObjectProperties(def.items.properties),
        }
      : undefined,
    properties: defToObjectProperties(def?.properties),
    search: parseSearchModes(def?.search),
  }));
}

function objectPropertiesToDef(
  props: ObjectProperty[] | undefined
): Record<string, any> | undefined {
  if (!props || props.length === 0) return undefined;
  const result: Record<string, any> = {};
  for (const prop of props) {
    const def: Record<string, any> = {
      type: prop.type,
    };
    if (prop.description) def.description = prop.description;
    if (prop.required) def.required = true;
    if (prop.search?.length) def.search = [...prop.search];
    if (prop.type === 'enum' && prop.enumValues?.length) {
      def.enum_values = prop.enumValues.filter(Boolean);
    }
    if (prop.type === 'array' && prop.items) {
      def.items = { type: prop.items.type };
      const subProps = objectPropertiesToDef(prop.items.properties);
      if (subProps && Object.keys(subProps).length > 0) {
        def.items.properties = subProps;
      }
    }
    if (prop.type === 'object') {
      const subProps = objectPropertiesToDef(prop.properties);
      if (subProps && Object.keys(subProps).length > 0) {
        def.properties = subProps;
      }
    }
    result[prop.name] = def;
  }
  return result;
}

function fieldsToSchema(
  fields: SchemaField[],
  displayName: string,
  itemLabel: string,
  extraTopLevel: Record<string, any>
): Record<string, any> {
  const fieldMap: Record<string, any> = {};
  const indexes: string[] = [];
  const embedFields: string[] = [];

  fields.forEach((field, index) => {
    const def: Record<string, any> = {
      type: field.type,
      display_order: index + 1,
    };
    if (field.description) def.description = field.description;
    if (field.required) def.required = true;
    if (field.search?.length) def.search = [...field.search];

    if (field.search?.includes('keyword')) indexes.push(field.name);
    if (field.search?.includes('embed')) embedFields.push(field.name);

    if (field.type === 'array' && field.items) {
      def.items = { type: field.items.type };
      const subProps = objectPropertiesToDef(field.items.properties);
      if (subProps && Object.keys(subProps).length > 0) {
        def.items.properties = subProps;
      }
    }

    if (field.type === 'object') {
      const subProps = objectPropertiesToDef(field.properties);
      if (subProps && Object.keys(subProps).length > 0) {
        def.properties = subProps;
      }
    }

    if (field.type === 'enum' && field.enumValues?.length) {
      def.enum_values = field.enumValues.filter(Boolean);
    }

    fieldMap[field.name] = def;
  });

  const result: Record<string, any> = {
    ...extraTopLevel,
    displayName,
    itemLabel,
    fields: fieldMap,
  };

  if (indexes.length > 0) result.indexes = indexes;
  if (embedFields.length > 0) result.embedFields = embedFields;

  return result;
}

function toFieldKey(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9_\s]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '');
}

// ─── Object Properties Editor (recursive) ───────────────────────────────────

interface ObjectPropertiesEditorProps {
  properties: ObjectProperty[];
  onChange: (props: ObjectProperty[]) => void;
  depth: number;
  label?: string;
}

function ObjectPropertiesEditor({
  properties,
  onChange,
  depth,
  label,
}: ObjectPropertiesEditorProps) {
  const addProperty = () => {
    const existing = new Set(properties.map((p) => p.name));
    let newName = 'property';
    let counter = 1;
    while (existing.has(newName)) {
      newName = `property_${counter}`;
      counter++;
    }
    onChange([
      ...properties,
      {
        id: generateId(),
        name: newName,
        type: 'string',
        description: '',
        required: false,
      },
    ]);
  };

  const updateProperty = (id: string, updates: Partial<ObjectProperty>) => {
    onChange(properties.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  };

  const removeProperty = (id: string) => {
    onChange(properties.filter((p) => p.id !== id));
  };

  const indent = Math.min(depth, 3);
  const bgClass =
    indent === 0
      ? 'bg-gray-50 dark:bg-gray-800/60'
      : indent === 1
        ? 'bg-blue-50/40 dark:bg-blue-900/10'
        : 'bg-purple-50/30 dark:bg-purple-900/10';

  return (
    <div className={`rounded-md border border-gray-200 p-2.5 dark:border-gray-600 ${bgClass}`}>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-300">
          <Layers className="h-3 w-3" />
          {label || 'Properties'}
        </div>
        <button
          onClick={addProperty}
          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20"
        >
          <Plus className="h-3 w-3" />
          Add
        </button>
      </div>

      {properties.length === 0 ? (
        <div className="rounded border border-dashed border-gray-200 px-3 py-2 text-center text-[11px] text-gray-400 dark:border-gray-600">
          No properties defined. Object will use free-form extraction.
        </div>
      ) : (
        <div className="space-y-1.5">
          {properties.map((prop) => (
            <ObjectPropertyRow
              key={prop.id}
              property={prop}
              onUpdate={(updates) => updateProperty(prop.id, updates)}
              onRemove={() => removeProperty(prop.id)}
              allNames={properties.map((p) => p.name)}
              depth={depth}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface ObjectPropertyRowProps {
  property: ObjectProperty;
  onUpdate: (updates: Partial<ObjectProperty>) => void;
  onRemove: () => void;
  allNames: string[];
  depth: number;
}

function ObjectPropertyRow({
  property,
  onUpdate,
  onRemove,
  allNames,
  depth,
}: ObjectPropertyRowProps) {
  const [expanded, setExpanded] = useState(false);
  const hasSubStructure =
    property.type === 'object' ||
    (property.type === 'array' && property.items?.type === 'object') ||
    property.type === 'enum';

  return (
    <div className="rounded border border-gray-200 bg-white dark:border-gray-600 dark:bg-gray-800">
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <input
          value={property.name}
          onChange={(e) => onUpdate({ name: toFieldKey(e.target.value) || e.target.value })}
          placeholder="prop_name"
          className="min-w-0 flex-1 rounded border border-gray-200 bg-transparent px-1.5 py-0.5 font-mono text-xs text-gray-900 dark:border-gray-600 dark:text-gray-100"
        />
        <select
          value={property.type}
          onChange={(e) => {
            const newType = e.target.value as FieldType;
            const updates: Partial<ObjectProperty> = { type: newType };
            if (newType === 'array' && !property.items) {
              updates.items = { type: 'string' };
            }
            if (newType === 'enum' && !property.enumValues?.length) {
              updates.enumValues = [''];
            }
            if (newType === 'object' && !property.properties?.length) {
              updates.properties = [];
            }
            onUpdate(updates);
          }}
          className="w-24 rounded border border-gray-200 bg-transparent px-1 py-0.5 text-xs text-gray-900 dark:border-gray-600 dark:text-gray-100"
        >
          {FIELD_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>

        <label className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400">
          <input
            type="checkbox"
            checked={property.required}
            onChange={(e) => onUpdate({ required: e.target.checked })}
            className="h-3 w-3 rounded border-gray-300"
          />
          Req
        </label>

        {hasSubStructure && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          >
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
        )}

        <button
          onClick={onRemove}
          className="text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-2 py-2 dark:border-gray-700">
          <div className="space-y-2">
            <input
              value={property.description}
              onChange={(e) => onUpdate({ description: e.target.value })}
              placeholder="Description..."
              className="w-full rounded border border-gray-200 bg-transparent px-1.5 py-1 text-xs text-gray-900 dark:border-gray-600 dark:text-gray-100"
            />

            {property.type === 'object' && (
              <ObjectPropertiesEditor
                properties={property.properties || []}
                onChange={(props) => onUpdate({ properties: props })}
                depth={depth + 1}
                label="Object Properties"
              />
            )}

            {property.type === 'array' && (
              <div className="space-y-2">
                <div>
                  <label className="mb-1 block text-[11px] font-medium text-gray-500 dark:text-gray-400">
                    Array Item Type
                  </label>
                  <select
                    value={property.items?.type || 'string'}
                    onChange={(e) => {
                      const newItemType = e.target.value;
                      onUpdate({
                        items: {
                          type: newItemType,
                          properties:
                            newItemType === 'object'
                              ? property.items?.properties || []
                              : undefined,
                        },
                      });
                    }}
                    className="w-full rounded border border-gray-200 bg-transparent px-1.5 py-1 text-xs text-gray-900 dark:border-gray-600 dark:text-gray-100"
                  >
                    {ARRAY_ITEM_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
                {property.items?.type === 'object' && (
                  <ObjectPropertiesEditor
                    properties={property.items.properties || []}
                    onChange={(props) =>
                      onUpdate({
                        items: { ...property.items!, properties: props },
                      })
                    }
                    depth={depth + 1}
                    label="Item Properties"
                  />
                )}
              </div>
            )}

            {property.type === 'enum' && (
              <EnumValuesEditor
                values={property.enumValues || ['']}
                onChange={(vals) => onUpdate({ enumValues: vals })}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Enum Values Editor ─────────────────────────────────────────────────────

function EnumValuesEditor({
  values,
  onChange,
}: {
  values: string[];
  onChange: (vals: string[]) => void;
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-medium text-gray-500 dark:text-gray-400">
        Enum Values
      </label>
      <div className="space-y-1">
        {values.map((val, idx) => (
          <div key={idx} className="flex items-center gap-1.5">
            <input
              value={val}
              onChange={(e) => {
                const newVals = [...values];
                newVals[idx] = e.target.value;
                onChange(newVals);
              }}
              placeholder={`Value ${idx + 1}`}
              className="min-w-0 flex-1 rounded border border-gray-200 bg-transparent px-1.5 py-0.5 text-xs text-gray-900 dark:border-gray-600 dark:text-gray-100"
            />
            <button
              onClick={() => {
                const newVals = values.filter((_, i) => i !== idx);
                onChange(newVals.length ? newVals : ['']);
              }}
              className="text-gray-400 hover:text-red-500"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
        <button
          onClick={() => onChange([...values, ''])}
          className="text-[11px] text-blue-600 hover:text-blue-700 dark:text-blue-400"
        >
          + Add value
        </button>
      </div>
    </div>
  );
}

// ─── Search Mode Selector ────────────────────────────────────────────────────

function SearchModeSelector({
  search,
  onChange,
}: {
  search?: SearchMode[];
  onChange: (modes: SearchMode[]) => void;
}) {
  const current = search || [];
  const toggle = (mode: SearchMode) => {
    const next = current.includes(mode)
      ? current.filter((m) => m !== mode)
      : [...current, mode];
    onChange(next);
  };

  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-300">
        Search &amp; Indexing
      </label>
      <div className="flex flex-wrap gap-1.5">
        {SEARCH_MODES.map(({ value, label, icon: Icon, description }) => {
          const active = current.includes(value);
          return (
            <button
              key={value}
              type="button"
              onClick={() => toggle(value)}
              title={description}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                active
                  ? value === 'keyword'
                    ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-600 dark:bg-blue-900/30 dark:text-blue-300'
                    : value === 'embed'
                      ? 'border-purple-300 bg-purple-50 text-purple-700 dark:border-purple-600 dark:bg-purple-900/30 dark:text-purple-300'
                      : 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300'
                  : 'border-gray-200 bg-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:border-gray-600 dark:text-gray-400 dark:hover:border-gray-500 dark:hover:text-gray-300'
              }`}
            >
              <Icon className="h-3 w-3" />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Sortable Field Card ────────────────────────────────────────────────────

interface SortableFieldCardProps {
  field: SchemaField;
  index: number;
  onUpdate: (id: string, updates: Partial<SchemaField>) => void;
  onRemove: (id: string) => void;
  allFieldNames: string[];
}

function SortableFieldCard({
  field,
  index,
  onUpdate,
  onRemove,
  allFieldNames,
}: SortableFieldCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: field.id });

  const [expanded, setExpanded] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : undefined,
  };

  const handleNameChange = (value: string) => {
    const key = toFieldKey(value);
    const nameToCheck = key || value;
    if (
      nameToCheck &&
      allFieldNames.filter((n) => n === nameToCheck).length > 0 &&
      nameToCheck !== field.name
    ) {
      setNameError('Field name already exists');
    } else {
      setNameError(null);
    }
    onUpdate(field.id, { name: key || value });
  };

  const hasSubStructure =
    field.type === 'object' ||
    (field.type === 'array' && field.items?.type === 'object') ||
    field.type === 'array' ||
    field.type === 'enum';

  const typeHint = useMemo(() => {
    if (field.type === 'array') {
      const itemType = field.items?.type || 'string';
      const itemLabel = ARRAY_ITEM_TYPES.find((t) => t.value === itemType)?.label || itemType;
      const propCount =
        itemType === 'object' ? (field.items?.properties?.length || 0) : 0;
      return propCount > 0 ? `${itemLabel}[${propCount}]` : itemLabel;
    }
    if (field.type === 'object') {
      const propCount = field.properties?.length || 0;
      return propCount > 0 ? `${propCount} props` : '';
    }
    if (field.type === 'enum') {
      const count = field.enumValues?.filter(Boolean).length || 0;
      return count > 0 ? `${count} vals` : '';
    }
    return '';
  }, [field.type, field.items, field.properties, field.enumValues]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border bg-white dark:bg-gray-800 ${
        isDragging
          ? 'border-blue-400 shadow-lg dark:border-blue-500'
          : 'border-gray-200 dark:border-gray-700'
      }`}
    >
      {/* Compact row */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          className="cursor-grab touch-none text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          {...attributes}
          {...listeners}
          tabIndex={-1}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <span className="w-5 text-center text-[11px] font-medium text-gray-400 dark:text-gray-500">
          {index + 1}
        </span>

        <input
          value={field.name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="field_name"
          className={`min-w-0 flex-1 rounded border px-2 py-1 font-mono text-sm ${
            nameError
              ? 'border-red-400 dark:border-red-600'
              : 'border-gray-200 dark:border-gray-600'
          } bg-transparent text-gray-900 dark:text-gray-100`}
        />

        <select
          value={field.type}
          onChange={(e) => {
            const newType = e.target.value as FieldType;
            const updates: Partial<SchemaField> = { type: newType };
            if (newType === 'array' && !field.items) {
              updates.items = { type: 'string' };
            }
            if (newType === 'enum' && !field.enumValues?.length) {
              updates.enumValues = [''];
            }
            if (newType === 'object' && !field.properties?.length) {
              updates.properties = [];
            }
            onUpdate(field.id, updates);
          }}
          className="w-28 rounded border border-gray-200 bg-transparent px-2 py-1 text-sm text-gray-900 dark:border-gray-600 dark:text-gray-100"
        >
          {FIELD_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>

        {typeHint && (
          <span className="text-[10px] text-gray-400 dark:text-gray-500">{typeHint}</span>
        )}

        {field.search && field.search.length > 0 && (
          <div className="flex items-center gap-0.5">
            {field.search.includes('keyword') && (
              <span title="Keyword Indexed" className="text-blue-500 dark:text-blue-400"><Search className="h-3 w-3" /></span>
            )}
            {field.search.includes('embed') && (
              <span title="Embedded" className="text-purple-500 dark:text-purple-400"><Brain className="h-3 w-3" /></span>
            )}
            {field.search.includes('graph') && (
              <span title="Graph" className="text-emerald-500 dark:text-emerald-400"><Share2 className="h-3 w-3" /></span>
            )}
          </div>
        )}

        <label className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
          <input
            type="checkbox"
            checked={field.required}
            onChange={(e) => onUpdate(field.id, { required: e.target.checked })}
            className="h-3.5 w-3.5 rounded border-gray-300"
          />
          Req
        </label>

        <button
          onClick={() => setExpanded(!expanded)}
          className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          title={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>

        <button
          onClick={() => onRemove(field.id)}
          className="text-gray-400 hover:text-red-500 dark:text-gray-500 dark:hover:text-red-400"
          title="Remove field"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {nameError && (
        <div className="px-3 pb-1 text-[11px] text-red-500">{nameError}</div>
      )}

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-gray-100 px-3 py-3 dark:border-gray-700">
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
                Description
              </label>
              <input
                value={field.description}
                onChange={(e) => onUpdate(field.id, { description: e.target.value })}
                placeholder="Describe what this field contains..."
                className="w-full rounded border border-gray-200 bg-transparent px-2 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:text-gray-100"
              />
            </div>

            <SearchModeSelector
              search={field.search}
              onChange={(modes) => onUpdate(field.id, { search: modes })}
            />

            {/* Array configuration */}
            {field.type === 'array' && (
              <div className="space-y-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
                    Array Item Type
                  </label>
                  <select
                    value={field.items?.type || 'string'}
                    onChange={(e) => {
                      const newItemType = e.target.value;
                      onUpdate(field.id, {
                        items: {
                          type: newItemType,
                          properties:
                            newItemType === 'object'
                              ? field.items?.properties || []
                              : undefined,
                        },
                      });
                    }}
                    className="w-full rounded border border-gray-200 bg-transparent px-2 py-1.5 text-sm text-gray-900 dark:border-gray-600 dark:text-gray-100"
                  >
                    {ARRAY_ITEM_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>

                {field.items?.type === 'object' && (
                  <ObjectPropertiesEditor
                    properties={field.items.properties || []}
                    onChange={(props) =>
                      onUpdate(field.id, {
                        items: { ...field.items!, properties: props },
                      })
                    }
                    depth={1}
                    label="Array Item Properties"
                  />
                )}
              </div>
            )}

            {/* Object properties */}
            {field.type === 'object' && (
              <ObjectPropertiesEditor
                properties={field.properties || []}
                onChange={(props) => onUpdate(field.id, { properties: props })}
                depth={1}
                label="Object Properties"
              />
            )}

            {/* Enum values */}
            {field.type === 'enum' && (
              <EnumValuesEditor
                values={field.enumValues || ['']}
                onChange={(vals) => onUpdate(field.id, { enumValues: vals })}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main SchemaEditor ──────────────────────────────────────────────────────

const DEFAULT_SCHEMA = {
  displayName: 'New Extraction Schema',
  itemLabel: 'Record',
  fields: {
    field_name: { type: 'string', required: false, display_order: 1 },
  },
};

export function SchemaEditor({ document, onSaved, onDeleted, onClone }: SchemaEditorProps) {
  const resolve = useCrossAppApiPath();
  const [name, setName] = useState(document?.name || '');
  const [displayName, setDisplayName] = useState('');
  const [itemLabel, setItemLabel] = useState('');
  const [visibility, setVisibility] = useState<'personal' | 'shared'>(
    document?.visibility || 'shared'
  );
  const [fields, setFields] = useState<SchemaField[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showJson, setShowJson] = useState(false);

  // Preserve extra top-level keys (graphNode, graphRelationships, etc.)
  const [extraTopLevel, setExtraTopLevel] = useState<Record<string, any>>({});

  const isEditing = Boolean(document?.id);

  useEffect(() => {
    const schema = (document?.schema || DEFAULT_SCHEMA) as Record<string, any>;
    setName(document?.name || '');
    setVisibility(document?.visibility || 'shared');
    setDisplayName(schema.displayName || '');
    setItemLabel(schema.itemLabel || 'Record');
    setFields(schemaToFields(schema));
    setError(null);
    setShowJson(false);

    // Preserve unknown top-level keys (indexes/embedFields are computed from per-field search)
    const knownKeys = new Set(['displayName', 'itemLabel', 'fields', 'indexes', 'embedFields']);
    const extra: Record<string, any> = {};
    for (const [key, value] of Object.entries(schema)) {
      if (!knownKeys.has(key)) {
        extra[key] = value;
      }
    }
    setExtraTopLevel(extra);
  }, [document?.id, document?.name, document?.visibility, document?.schema]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setFields((prev) => {
      const oldIndex = prev.findIndex((f) => f.id === active.id);
      const newIndex = prev.findIndex((f) => f.id === over.id);
      return arrayMove(prev, oldIndex, newIndex);
    });
  }, []);

  const updateField = useCallback((id: string, updates: Partial<SchemaField>) => {
    setFields((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...updates } : f))
    );
  }, []);

  const removeField = useCallback((id: string) => {
    setFields((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const addField = useCallback(() => {
    setFields((prev) => {
      const existing = new Set(prev.map((f) => f.name));
      let newName = 'new_field';
      let counter = 1;
      while (existing.has(newName)) {
        newName = `new_field_${counter}`;
        counter++;
      }
      return [
        ...prev,
        {
          id: generateId(),
          name: newName,
          type: 'string' as FieldType,
          required: false,
          description: '',
        },
      ];
    });
  }, []);

  const allFieldNames = fields.map((f) => f.name);

  const builtSchema = useMemo(
    () => fieldsToSchema(fields, displayName, itemLabel, extraTopLevel),
    [fields, displayName, itemLabel, extraTopLevel]
  );

  const handleSave = async () => {
    setError(null);
    if (!name.trim()) {
      setError('Schema name is required');
      return;
    }
    if (fields.length === 0) {
      setError('Schema must have at least one field');
      return;
    }
    const emptyNames = fields.filter((f) => !f.name.trim());
    if (emptyNames.length > 0) {
      setError('All fields must have a name');
      return;
    }
    const dupNames = allFieldNames.filter((n, i) => allFieldNames.indexOf(n) !== i);
    if (dupNames.length > 0) {
      setError(`Duplicate field name: ${dupNames[0]}`);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        schema: builtSchema,
        visibility,
        metadata: { type: 'extraction_schema' },
      };

      const response = await fetch(
        resolve('data', isEditing ? `/api/data/${document!.id}` : '/api/data'),
        {
          method: isEditing ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Failed to save schema');
      }

      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save schema');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!isEditing || !document?.id) return;
    if (!confirm('Delete this extraction schema?')) return;
    setDeleting(true);
    try {
      const response = await fetch(resolve('data', `/api/data/${document.id}`), {
        method: 'DELETE',
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Failed to delete schema');
      }
      await onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete schema');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          {isEditing ? 'Edit Extraction Schema' : 'New Extraction Schema'}
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Define fields for structured extraction. Drag to reorder, expand to
          configure nested structures.
        </p>
      </div>

      <div className="space-y-4">
        {/* Name & visibility */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
              Schema Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              placeholder="Parsed Resumes"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
              Visibility
            </label>
            <select
              value={visibility}
              onChange={(e) =>
                setVisibility(e.target.value as 'personal' | 'shared')
              }
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
            >
              <option value="shared">Shared</option>
              <option value="personal">Personal</option>
            </select>
          </div>
        </div>

        {/* Display name & item label */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
              Display Name
            </label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              placeholder="e.g. Resume Data"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-200">
              Item Label
            </label>
            <input
              value={itemLabel}
              onChange={(e) => setItemLabel(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
              placeholder="e.g. Candidate"
            />
          </div>
        </div>

        {/* Fields header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Fields ({fields.length})
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Drag to reorder. Expand fields to configure descriptions and
              nested structures.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowJson(!showJson)}
              className="inline-flex items-center gap-1 rounded border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              title="Toggle JSON preview"
            >
              <Code className="h-3.5 w-3.5" />
              {showJson ? 'Hide' : 'JSON'}
            </button>
            <Button size="sm" onClick={addField}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              Add Field
            </Button>
          </div>
        </div>

        {/* Column labels */}
        {fields.length > 0 && (
          <div className="flex items-center gap-2 px-3 text-[11px] font-medium uppercase tracking-wider text-gray-400 dark:text-gray-500">
            <span className="w-4" />
            <span className="w-5 text-center">#</span>
            <span className="min-w-0 flex-1">Field Name</span>
            <span className="w-28">Type</span>
            <span className="w-12" />
            <span className="w-14 text-center">Search</span>
            <span className="w-10 text-center">Req</span>
            <span className="w-4" />
            <span className="w-4" />
          </div>
        )}

        {/* Sortable field list */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={fields.map((f) => f.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {fields.map((field, index) => (
                <SortableFieldCard
                  key={field.id}
                  field={field}
                  index={index}
                  onUpdate={updateField}
                  onRemove={removeField}
                  allFieldNames={allFieldNames}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {fields.length === 0 && (
          <div className="rounded-lg border-2 border-dashed border-gray-200 p-6 text-center dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No fields yet. Click &quot;Add Field&quot; to get started.
            </p>
          </div>
        )}

        {/* JSON preview */}
        {showJson && (
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600 dark:text-gray-300">
              Generated Schema JSON
            </label>
            <pre className="max-h-[400px] overflow-auto rounded-md border border-gray-200 bg-gray-50 p-3 font-mono text-xs text-gray-800 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-200">
              {JSON.stringify(builtSchema, null, 2)}
            </pre>
          </div>
        )}

        {error && (
          <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/50 dark:text-red-200">
            {error}
          </div>
        )}

        <div className="flex items-center gap-2 border-t border-gray-100 pt-3 dark:border-gray-700">
          <Button onClick={handleSave} disabled={saving || deleting}>
            {saving
              ? 'Saving...'
              : isEditing
                ? 'Update Schema'
                : 'Create Schema'}
          </Button>
          {isEditing && onClone && (
            <Button
              variant="secondary"
              onClick={() => {
                onClone({
                  id: '',
                  name: `${name} (Copy)`,
                  schema: builtSchema as Record<string, unknown>,
                  visibility,
                });
              }}
              disabled={saving || deleting}
            >
              <Copy className="mr-1.5 h-3.5 w-3.5" />
              Clone
            </Button>
          )}
          {isEditing && (
            <Button
              variant="ghost"
              onClick={handleDelete}
              disabled={saving || deleting}
              className="text-red-600"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
