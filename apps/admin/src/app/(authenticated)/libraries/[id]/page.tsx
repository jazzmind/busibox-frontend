'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useCustomization } from '@jazzmind/busibox-app';
import { LibraryTriggers } from '@jazzmind/busibox-app/components/documents/LibraryTriggers';
import { LibraryDeleteModal } from '@jazzmind/busibox-app/components/documents/LibraryDeleteModal';
import {
  ArrowLeft,
  Save,
  Trash2,
  Loader2,
  FolderOpen,
  Shield,
  Tag,
  X,
  Plus,
  FileText,
  AlertCircle,
  Settings2,
} from 'lucide-react';

interface Role {
  id: string;
  name: string;
  description: string | null;
}

interface ClassificationRule {
  keywords: string[];
  documentTypes: string[];
  action: 'auto_move' | 'copy' | 'suggest';
  minConfidence: number;
}

interface LibraryMetadata {
  keywords?: string[];
  classificationRules?: ClassificationRule[];
  classificationGuidance?: string;
  [key: string]: unknown;
}

interface Library {
  id: string;
  name: string;
  description?: string;
  isPersonal: boolean;
  libraryType?: string;
  metadata?: LibraryMetadata;
  documentCount?: number;
  roles?: Role[];
  createdAt?: string;
  updatedAt?: string;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function LibraryDetailPage({ params }: PageProps) {
  const { customization } = useCustomization();
  const router = useRouter();

  const [libraryId, setLibraryId] = useState<string | null>(null);
  const [library, setLibrary] = useState<Library | null>(null);
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Editable fields
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [classificationGuidance, setClassificationGuidance] = useState('');
  const [classificationRules, setClassificationRules] = useState<ClassificationRule[]>([]);
  const [showAddRule, setShowAddRule] = useState(false);
  // 'simple' = keywords + guidance, 'advanced' = classification rules
  const [classificationMode, setClassificationMode] = useState<'simple' | 'advanced'>('simple');

  useEffect(() => {
    params.then(p => setLibraryId(p.id));
  }, [params]);

  const fetchLibrary = useCallback(async () => {
    if (!libraryId) return;
    setIsLoading(true);
    setError(null);
    try {
      const [libRes, rolesRes] = await Promise.all([
        fetch(`/api/libraries/${libraryId}`),
        fetch('/api/roles'),
      ]);

      if (!libRes.ok) {
        throw new Error('Library not found');
      }

      const libData = await libRes.json();
      const lib = libData.data?.library || libData.library;

      setLibrary(lib);
      setName(lib.name || '');
      setDescription(lib.description || '');
      setSelectedRoleIds((lib.roles || []).map((r: Role) => r.id));

      const meta = lib.metadata || {};
      setKeywords(meta.keywords || []);
      setClassificationGuidance(meta.classificationGuidance || '');
      setClassificationRules(meta.classificationRules || []);
      // Show advanced mode if rules already exist
      setClassificationMode((meta.classificationRules?.length ?? 0) > 0 ? 'advanced' : 'simple');

      if (rolesRes.ok) {
        const rolesData = await rolesRes.json();
        setAllRoles(rolesData?.data?.roles || rolesData?.roles || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load library');
    } finally {
      setIsLoading(false);
    }
  }, [libraryId]);

  useEffect(() => {
    fetchLibrary();
  }, [fetchLibrary]);

  const handleSave = async () => {
    if (!libraryId) return;
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      // Only persist the active mode's data; clear the other
      const metadata: LibraryMetadata = {
        ...(library?.metadata || {}),
        keywords: classificationMode === 'simple' ? keywords : [],
        classificationGuidance: classificationMode === 'simple' ? (classificationGuidance || undefined) : undefined,
        classificationRules: classificationMode === 'advanced' ? classificationRules : [],
      };

      const response = await fetch(`/api/libraries/${libraryId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          metadata,
          roleIds: selectedRoleIds,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save');
      }

      setSuccessMessage('Library saved successfully');
      fetchLibrary();
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (action: 'delete' | 'move', targetLibraryId?: string) => {
    if (!libraryId) return;
    setIsDeleting(true);
    try {
      const params = new URLSearchParams({ document_action: action });
      if (action === 'move' && targetLibraryId) {
        params.set('targetLibraryId', targetLibraryId);
      }
      const response = await fetch(`/api/libraries/${libraryId}?${params}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete');
      router.push('/data?tab=shared');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const addKeyword = () => {
    const kw = newKeyword.trim().toLowerCase();
    if (kw && !keywords.includes(kw)) {
      setKeywords([...keywords, kw]);
    }
    setNewKeyword('');
  };

  const removeKeyword = (kw: string) => {
    setKeywords(keywords.filter(k => k !== kw));
  };

  const toggleRole = (roleId: string) => {
    setSelectedRoleIds(prev =>
      prev.includes(roleId)
        ? prev.filter(id => id !== roleId)
        : [...prev, roleId]
    );
  };

  const addClassificationRule = (rule: ClassificationRule) => {
    setClassificationRules([...classificationRules, rule]);
    setShowAddRule(false);
  };

  const removeClassificationRule = (index: number) => {
    setClassificationRules(classificationRules.filter((_, i) => i !== index));
  };

  if (isLoading) {
    return (
      <div className="min-h-full bg-white flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  if (error && !library) {
    return (
      <div className="min-h-full bg-white">
        <div className="max-w-4xl mx-auto px-6 py-12 text-center">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Library Not Found</h2>
          <p className="text-gray-500 mb-6">{error}</p>
          <button
            onClick={() => router.push('/data?tab=shared')}
            className="text-purple-600 hover:underline"
          >
            Back to Libraries
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-4xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push('/data?tab=shared')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5 text-gray-500" />
              </button>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <FolderOpen className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h1 className="text-2xl font-semibold text-gray-900">
                    {library?.name || 'Library'}
                  </h1>
                  {library?.documentCount !== undefined && (
                    <p className="text-sm text-gray-500">
                      {library.documentCount} documents
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowDeleteModal(true)}
                disabled={isDeleting}
                className="flex items-center gap-2 px-4 py-2 text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors text-sm disabled:opacity-50"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || !name.trim()}
                className="flex items-center gap-2 px-4 py-2 text-white rounded-lg transition-colors text-sm disabled:opacity-50"
                style={{ backgroundColor: customization.primaryColor }}
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Changes
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="max-w-4xl mx-auto px-6 pt-4">
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        </div>
      )}
      {successMessage && (
        <div className="max-w-4xl mx-auto px-6 pt-4">
          <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-600">
            {successMessage}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Basic Info */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-gray-400" />
            Library Details
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={3}
                placeholder="Describe the purpose of this library..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
          </div>
        </section>

        {/* Access Roles */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Shield className="w-5 h-5 text-gray-400" />
            Access Roles
          </h2>
          <p className="text-sm text-gray-500 mb-3">
            Users with these roles can access documents in this library.
          </p>
          <div className="border border-gray-200 rounded-lg max-h-56 overflow-y-auto">
            {allRoles.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">No roles available</p>
            ) : (
              <div className="p-2 space-y-1">
                {allRoles.map(role => (
                  <label
                    key={role.id}
                    className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                      selectedRoleIds.includes(role.id)
                        ? 'bg-purple-50 border border-purple-200'
                        : 'hover:bg-gray-50 border border-transparent'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedRoleIds.includes(role.id)}
                      onChange={() => toggleRole(role.id)}
                      className="mt-0.5 h-4 w-4 text-purple-600 focus:ring-purple-500 border-gray-300 rounded"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-gray-900">{role.name}</span>
                      {role.description && (
                        <p className="text-xs text-gray-500 truncate">{role.description}</p>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>
          {selectedRoleIds.length > 0 && (
            <p className="text-xs text-purple-600 mt-1">
              {selectedRoleIds.length} role{selectedRoleIds.length !== 1 ? 's' : ''} selected
            </p>
          )}
        </section>

        {/* Triggers */}
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Post-Processing Triggers</h2>
          <p className="text-sm text-gray-500 mb-3">
            Actions that run automatically when documents finish processing in this library.
          </p>
          {libraryId && (
            <LibraryTriggers
              libraryId={libraryId}
              libraryName={library?.name || ''}
              canManage={true}
            />
          )}
        </section>

        {/* Classification Guidance */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Tag className="w-5 h-5 text-gray-400" />
              Classification Guidance
            </h2>
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setClassificationMode('simple')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  classificationMode === 'simple'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Simple
              </button>
              <button
                onClick={() => setClassificationMode('advanced')}
                className={`flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  classificationMode === 'advanced'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Settings2 className="w-3 h-3" />
                Advanced
              </button>
            </div>
          </div>

          {classificationMode === 'simple' ? (
            /* Simple mode: Keywords + Guidance */
            <div className="space-y-5">
              <p className="text-sm text-gray-500">
                Add keywords that describe this library. Documents matching these keywords will be suggested for this library.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Keywords</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {keywords.map(kw => (
                    <span
                      key={kw}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-sm"
                    >
                      {kw}
                      <button onClick={() => removeKeyword(kw)} className="hover:text-blue-900">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {keywords.length === 0 && (
                    <span className="text-sm text-gray-400">No keywords yet</span>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newKeyword}
                    onChange={e => setNewKeyword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
                    placeholder="Add keyword..."
                    className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <button
                    onClick={addKeyword}
                    disabled={!newKeyword.trim()}
                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Guidance Text</label>
                <p className="text-xs text-gray-500 mb-2">
                  Free-text description to help classifiers understand what belongs in this library.
                </p>
                <textarea
                  value={classificationGuidance}
                  onChange={e => setClassificationGuidance(e.target.value)}
                  rows={3}
                  placeholder="e.g., This library contains recruitment-related documents including resumes, job descriptions, and interview notes."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
            </div>
          ) : (
            /* Advanced mode: Classification Rules */
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                Define rules with specific keyword sets, document type filters, confidence thresholds, and actions.
              </p>

              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-700">
                  Classification Rules
                  {classificationRules.length > 0 && (
                    <span className="ml-2 text-xs text-gray-400 font-normal">
                      ({classificationRules.length} rule{classificationRules.length !== 1 ? 's' : ''})
                    </span>
                  )}
                </label>
                <button
                  onClick={() => setShowAddRule(!showAddRule)}
                  className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700"
                >
                  {showAddRule ? <><X className="w-3 h-3" /> Cancel</> : <><Plus className="w-3 h-3" /> Add Rule</>}
                </button>
              </div>

              {showAddRule && (
                <AddRuleForm
                  onSubmit={addClassificationRule}
                  onCancel={() => setShowAddRule(false)}
                />
              )}

              {classificationRules.length === 0 && !showAddRule ? (
                <div className="text-center py-6 border border-dashed border-gray-200 rounded-lg">
                  <Tag className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">No classification rules</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Add rules with keyword patterns, document types, and actions
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {classificationRules.map((rule, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg bg-gray-50"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                            rule.action === 'auto_move'
                              ? 'bg-green-100 text-green-700'
                              : rule.action === 'copy'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {rule.action === 'auto_move' ? 'Auto Move' : rule.action === 'copy' ? 'Copy' : 'Suggest'}
                          </span>
                          <span className="text-xs text-gray-500">
                            Min confidence: {Math.round(rule.minConfidence * 100)}%
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {rule.keywords.map(kw => (
                            <span key={kw} className="px-1.5 py-0.5 text-xs bg-blue-50 text-blue-600 rounded">
                              {kw}
                            </span>
                          ))}
                          {rule.documentTypes.map(dt => (
                            <span key={dt} className="px-1.5 py-0.5 text-xs bg-purple-50 text-purple-600 rounded">
                              type:{dt}
                            </span>
                          ))}
                        </div>
                      </div>
                      <button
                        onClick={() => removeClassificationRule(index)}
                        className="p-1 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4 text-red-400 hover:text-red-600" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {showDeleteModal && library && (
        <LibraryDeleteModal
          libraryId={libraryId || ''}
          libraryName={library.name}
          documentCount={library.documentCount || 0}
          onConfirm={handleDelete}
          onCancel={() => setShowDeleteModal(false)}
          isDeleting={isDeleting}
          librariesApiPath="/api/libraries"
        />
      )}
    </div>
  );
}

function AddRuleForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (rule: ClassificationRule) => void;
  onCancel: () => void;
}) {
  const [ruleKeywords, setRuleKeywords] = useState('');
  const [ruleDocTypes, setRuleDocTypes] = useState('');
  const [action, setAction] = useState<'auto_move' | 'copy' | 'suggest'>('suggest');
  const [minConfidence, setMinConfidence] = useState(50);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const kws = ruleKeywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
    const dts = ruleDocTypes.split(',').map(d => d.trim().toLowerCase()).filter(Boolean);

    if (kws.length === 0 && dts.length === 0) return;

    onSubmit({
      keywords: kws,
      documentTypes: dts,
      action,
      minConfidence: minConfidence / 100,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 border border-purple-200 rounded-lg bg-purple-50/30 mb-4 space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Keywords (comma-separated)
        </label>
        <input
          type="text"
          value={ruleKeywords}
          onChange={e => setRuleKeywords(e.target.value)}
          placeholder="resume, cv, candidate"
          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-white"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Document Types (comma-separated, optional)
        </label>
        <input
          type="text"
          value={ruleDocTypes}
          onChange={e => setRuleDocTypes(e.target.value)}
          placeholder="report, article, email"
          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-white"
        />
        <p className="text-[11px] text-gray-500 mt-1">
          Types: report, article, email, code, presentation, spreadsheet, manual, other
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Action</label>
          <select
            value={action}
            onChange={e => setAction(e.target.value as typeof action)}
            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded bg-white"
          >
            <option value="suggest">Suggest (show recommendation)</option>
            <option value="copy">Copy to this library</option>
            <option value="auto_move">Auto Move (personal only)</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Min Confidence: {minConfidence}%
          </label>
          <input
            type="range"
            min={10}
            max={100}
            step={5}
            value={minConfidence}
            onChange={e => setMinConfidence(Number(e.target.value))}
            className="w-full"
          />
        </div>
      </div>
      <div className="flex items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={!ruleKeywords.trim() && !ruleDocTypes.trim()}
          className="px-3 py-1.5 text-xs font-medium text-white bg-purple-600 hover:bg-purple-700 rounded disabled:opacity-50"
        >
          Add Rule
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-800"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
