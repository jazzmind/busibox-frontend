'use client';

import { useState, useEffect, useCallback } from 'react';
import { Tag, X, Plus, Trash2, Loader2, Save, ChevronDown, ChevronUp, Settings2 } from 'lucide-react';

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

interface LibraryClassificationProps {
  libraryId: string;
  libraryName: string;
  canManage: boolean;
  isPersonal?: boolean;
}

export function LibraryClassification({
  libraryId,
  canManage,
  isPersonal = true,
}: LibraryClassificationProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [classificationGuidance, setClassificationGuidance] = useState('');
  const [classificationRules, setClassificationRules] = useState<ClassificationRule[]>([]);
  const [showAddRule, setShowAddRule] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalData, setOriginalData] = useState<LibraryMetadata>({});
  const [classificationMode, setClassificationMode] = useState<'simple' | 'advanced'>('simple');

  const fetchLibraryMetadata = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/libraries/${libraryId}`);
      if (!response.ok) return;
      const data = await response.json();
      const library = data.data?.library || data.library || data.data || data;
      const meta: LibraryMetadata = library?.metadata || {};

      setKeywords(meta.keywords || []);
      setClassificationGuidance(meta.classificationGuidance || '');
      setClassificationRules(meta.classificationRules || []);
      setOriginalData(meta);
      setHasChanges(false);
      setClassificationMode((meta.classificationRules?.length ?? 0) > 0 ? 'advanced' : 'simple');
    } catch (err) {
      console.error('Failed to load library metadata:', err);
    } finally {
      setIsLoading(false);
    }
  }, [libraryId]);

  useEffect(() => {
    if (isExpanded && !isLoading) {
      fetchLibraryMetadata();
    }
  }, [isExpanded, libraryId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const metadata: LibraryMetadata = {
        ...originalData,
        keywords: classificationMode === 'simple' ? keywords : [],
        classificationGuidance: classificationMode === 'simple' ? (classificationGuidance || undefined) : undefined,
        classificationRules: classificationMode === 'advanced' ? classificationRules : [],
      };

      const response = await fetch(`/api/libraries/${libraryId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metadata }),
      });

      if (!response.ok) throw new Error('Save failed');
      setHasChanges(false);
      setOriginalData(metadata);
    } catch (err) {
      console.error('Failed to save classification metadata:', err);
    } finally {
      setIsSaving(false);
    }
  };

  const addKeyword = () => {
    const kw = newKeyword.trim().toLowerCase();
    if (kw && !keywords.includes(kw)) {
      setKeywords(prev => [...prev, kw]);
      setHasChanges(true);
    }
    setNewKeyword('');
  };

  const removeKeyword = (kw: string) => {
    setKeywords(prev => prev.filter(k => k !== kw));
    setHasChanges(true);
  };

  const addRule = (rule: ClassificationRule) => {
    setClassificationRules(prev => [...prev, rule]);
    setShowAddRule(false);
    setHasChanges(true);
  };

  const removeRule = (index: number) => {
    setClassificationRules(prev => prev.filter((_, i) => i !== index));
    setHasChanges(true);
  };

  const ruleCount = classificationRules.length;
  const keywordCount = keywords.length;
  const hasConfig = ruleCount > 0 || keywordCount > 0;

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-medium text-gray-900">Classification Guidance</span>
          {hasConfig && (
            <span className="px-1.5 py-0.5 text-[11px] bg-blue-100 text-blue-700 rounded-full">
              {classificationMode === 'simple'
                ? `${keywordCount} keyword${keywordCount !== 1 ? 's' : ''}`
                : `${ruleCount} rule${ruleCount !== 1 ? 's' : ''}`
              }
            </span>
          )}
        </div>
        {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {isExpanded && (
        <div className="border-t border-gray-200 px-4 py-4 space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
            </div>
          ) : (
            <>
              {/* Mode toggle */}
              {canManage && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center bg-gray-100 rounded-md p-0.5">
                    <button
                      onClick={() => { setClassificationMode('simple'); setHasChanges(true); }}
                      className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors ${
                        classificationMode === 'simple'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      Simple
                    </button>
                    <button
                      onClick={() => { setClassificationMode('advanced'); setHasChanges(true); }}
                      className={`flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded transition-colors ${
                        classificationMode === 'advanced'
                          ? 'bg-white text-gray-900 shadow-sm'
                          : 'text-gray-500 hover:text-gray-700'
                      }`}
                    >
                      <Settings2 className="w-2.5 h-2.5" />
                      Advanced
                    </button>
                  </div>
                </div>
              )}

              {classificationMode === 'simple' ? (
                /* Simple: keywords + guidance */
                <>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1.5">Keywords</label>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {keywords.map(kw => (
                        <span key={kw} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs">
                          {kw}
                          {canManage && (
                            <button onClick={() => removeKeyword(kw)} className="hover:text-blue-900">
                              <X className="w-2.5 h-2.5" />
                            </button>
                          )}
                        </span>
                      ))}
                      {keywords.length === 0 && (
                        <span className="text-xs text-gray-400">No keywords</span>
                      )}
                    </div>
                    {canManage && (
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          value={newKeyword}
                          onChange={e => setNewKeyword(e.target.value)}
                          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addKeyword())}
                          placeholder="Add keyword..."
                          className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <button
                          onClick={addKeyword}
                          disabled={!newKeyword.trim()}
                          className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                        >
                          Add
                        </button>
                      </div>
                    )}
                  </div>

                  {canManage && (
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1.5">Guidance Text</label>
                      <textarea
                        value={classificationGuidance}
                        onChange={e => { setClassificationGuidance(e.target.value); setHasChanges(true); }}
                        rows={2}
                        placeholder="Describe what documents belong in this library..."
                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  )}
                </>
              ) : (
                /* Advanced: classification rules */
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-gray-700">Rules</label>
                    {canManage && (
                      <button
                        onClick={() => setShowAddRule(!showAddRule)}
                        className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-700"
                      >
                        {showAddRule ? <X className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                        {showAddRule ? 'Cancel' : 'Add Rule'}
                      </button>
                    )}
                  </div>

                  {showAddRule && (
                    <InlineAddRuleForm
                      isPersonal={isPersonal}
                      onSubmit={addRule}
                      onCancel={() => setShowAddRule(false)}
                    />
                  )}

                  {classificationRules.length === 0 ? (
                    <p className="text-xs text-gray-400 py-2">No classification rules configured</p>
                  ) : (
                    <div className="space-y-1.5">
                      {classificationRules.map((rule, idx) => (
                        <div key={idx} className="flex items-center gap-2 p-2 border border-gray-100 rounded bg-gray-50 text-xs">
                          <div className="flex-1">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              rule.action === 'auto_move' ? 'bg-green-100 text-green-700'
                                : rule.action === 'copy' ? 'bg-blue-100 text-blue-700'
                                  : 'bg-yellow-100 text-yellow-700'
                            }`}>
                              {rule.action === 'auto_move' ? 'Move' : rule.action === 'copy' ? 'Copy' : 'Suggest'}
                            </span>
                            <span className="ml-1.5 text-gray-600">
                              {rule.keywords.join(', ')}
                              {rule.documentTypes.length > 0 && ` | types: ${rule.documentTypes.join(', ')}`}
                            </span>
                            <span className="ml-1 text-gray-400">({Math.round(rule.minConfidence * 100)}%+)</span>
                          </div>
                          {canManage && (
                            <button onClick={() => removeRule(idx)} className="p-0.5 hover:bg-red-50 rounded">
                              <Trash2 className="w-3 h-3 text-red-400" />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Save Button */}
              {canManage && hasChanges && (
                <div className="pt-2 border-t border-gray-100">
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    Save Classification Settings
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function InlineAddRuleForm({
  isPersonal,
  onSubmit,
  onCancel,
}: {
  isPersonal: boolean;
  onSubmit: (rule: ClassificationRule) => void;
  onCancel: () => void;
}) {
  const [ruleKeywords, setRuleKeywords] = useState('');
  const [ruleDocTypes, setRuleDocTypes] = useState('');
  const [action, setAction] = useState<'auto_move' | 'copy' | 'suggest'>(isPersonal ? 'auto_move' : 'suggest');
  const [minConfidence, setMinConfidence] = useState(50);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const kws = ruleKeywords.split(',').map(k => k.trim().toLowerCase()).filter(Boolean);
    const dts = ruleDocTypes.split(',').map(d => d.trim().toLowerCase()).filter(Boolean);
    if (kws.length === 0 && dts.length === 0) return;

    onSubmit({ keywords: kws, documentTypes: dts, action, minConfidence: minConfidence / 100 });
  };

  return (
    <form onSubmit={handleSubmit} className="p-3 border border-blue-200 rounded bg-blue-50/30 mb-2 space-y-2">
      <input
        type="text"
        value={ruleKeywords}
        onChange={e => setRuleKeywords(e.target.value)}
        placeholder="Keywords (comma-separated)"
        className="w-full px-2 py-1 text-xs border border-gray-300 rounded bg-white"
      />
      <input
        type="text"
        value={ruleDocTypes}
        onChange={e => setRuleDocTypes(e.target.value)}
        placeholder="Doc types (optional, comma-separated)"
        className="w-full px-2 py-1 text-xs border border-gray-300 rounded bg-white"
      />
      <div className="flex gap-2">
        <select
          value={action}
          onChange={e => setAction(e.target.value as typeof action)}
          className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded bg-white"
        >
          <option value="suggest">Suggest</option>
          <option value="copy">Copy</option>
          <option value="auto_move">Auto Move</option>
        </select>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-gray-500">{minConfidence}%</span>
          <input type="range" min={10} max={100} step={5} value={minConfidence} onChange={e => setMinConfidence(Number(e.target.value))} className="w-20" />
        </div>
      </div>
      <div className="flex gap-2">
        <button type="submit" disabled={!ruleKeywords.trim() && !ruleDocTypes.trim()} className="px-2 py-1 text-[11px] bg-blue-600 text-white rounded disabled:opacity-50">
          Add Rule
        </button>
        <button type="button" onClick={onCancel} className="px-2 py-1 text-[11px] text-gray-600 hover:text-gray-800">
          Cancel
        </button>
      </div>
    </form>
  );
}
