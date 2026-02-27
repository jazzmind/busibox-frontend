/**
 * Service Installation Flow Component
 * 
 * Automated installation of Busibox services with real-time progress.
 * Uses deploy-api WebSocket for real-time Docker output.
 */

'use client';

import { useState, useEffect, useRef } from 'react';

type ServiceStatus = 'pending' | 'checking' | 'skipped' | 'installing' | 'healthy' | 'error' | 'failed';

type LogEntry = {
  type: 'info' | 'log' | 'success' | 'warning' | 'error';
  stream?: 'stdout' | 'stderr';
  message: string;
  timestamp: number;
};

type Service = {
  id: string;
  name: string;
  description: string;
  features: string[];
  dockerService: string; // Docker compose service name
  companionServices?: string[]; // Additional docker services to deploy with this one
  healthEndpoint?: string; // Optional health check endpoint
  status: ServiceStatus;
  error?: string;
  logs: LogEntry[];
};

type ServiceGroup = {
  id: string;
  title: string;
  description: string;
  services: Service[];
};

// Services in installation order
// Note: PostgreSQL, AuthZ API, and Deploy API are already started during make install
const SERVICE_GROUPS: ServiceGroup[] = [
  {
    id: 'core',
    title: 'Core Systems',
    description: 'Foundational services used by all other components',
    services: [
      {
        id: 'redis',
        name: 'Redis',
        description: 'Cache and job queue',
        features: [],
        dockerService: 'redis',
        status: 'pending',
        logs: [],
      },
      {
        id: 'minio',
        name: 'MinIO',
        description: 'S3-compatible object storage',
        features: [],
        dockerService: 'minio',
        healthEndpoint: '/minio/health/live',
        status: 'pending',
        logs: [],
      },
      {
        id: 'milvus',
        name: 'Milvus',
        description: 'Vector database for semantic search',
        features: [],
        dockerService: 'milvus',
        healthEndpoint: '/healthz',
        status: 'pending',
        logs: [],
      },
      {
        id: 'neo4j',
        name: 'Neo4j',
        description: 'Graph database for relationship queries',
        features: [],
        dockerService: 'neo4j',
        healthEndpoint: '/',
        status: 'pending',
        logs: [],
      },
    ],
  },
  {
    id: 'llm-apis',
    title: 'LLM APIs',
    description: 'Unified gateways for text generation and embeddings',
    services: [
      {
        id: 'embedding',
        name: 'Embedding API',
        description: 'Fast text embeddings for semantic search',
        features: [],
        dockerService: 'embedding-api',
        healthEndpoint: '/health',
        status: 'pending',
        logs: [],
      },
      {
        id: 'litellm',
        name: 'LiteLLM',
        description: 'Unified gateway for 100+ LLM providers',
        features: [],
        dockerService: 'litellm',
        healthEndpoint: '/health',
        status: 'pending',
        logs: [],
      },
    ],
  },
  {
    id: 'data-apis',
    title: 'Data Processing APIs',
    description: 'Document ingestion, search, and knowledge management',
    services: [
      {
        id: 'data',
        name: 'Data API',
        description: 'Document processing pipeline',
        features: [],
        dockerService: 'data-api',
        companionServices: ['data-worker'], // Worker processes jobs from the queue
        healthEndpoint: '/health',
        status: 'pending',
        logs: [],
      },
      {
        id: 'search',
        name: 'Search API',
        description: 'Unified search with RLS',
        features: [],
        dockerService: 'search-api',
        healthEndpoint: '/health',
        status: 'pending',
        logs: [],
      },
      {
        id: 'agent',
        name: 'Agent API',
        description: 'AI agent runtime and orchestration',
        features: [],
        dockerService: 'agent-api',
        healthEndpoint: '/health',
        status: 'pending',
        logs: [],
      },
      {
        id: 'docs',
        name: 'Docs API',
        description: 'Documentation and knowledge base',
        features: [],
        dockerService: 'docs-api',
        healthEndpoint: '/health',
        status: 'pending',
        logs: [],
      },
      {
        id: 'bridge',
        name: 'Bridge API',
        description: 'Email and multi-channel messaging',
        features: [],
        dockerService: 'bridge-api',
        healthEndpoint: '/health',
        status: 'pending',
        logs: [],
      },
    ],
  },
  {
    id: 'llm-validation',
    title: 'LLM Validation',
    description: 'Validate the complete LLM chain is working: MLX/vLLM → LiteLLM → Agent API',
    services: [
      {
        id: 'llm-test',
        name: 'LLM Chain Test',
        description: 'Testing LLM connectivity and response quality',
        features: [
          'Tests direct LLM inference (MLX or vLLM)',
          'Tests LiteLLM gateway routing',
          'Tests Agent API integration',
        ],
        dockerService: 'llm-test', // Special service ID for validation
        healthEndpoint: '/health',
        status: 'pending',
        logs: [],
      },
    ],
  },
  {
    id: 'frontend-apps',
    title: 'Frontend Applications',
    description: 'Web applications for Busibox Portal, Agent Manager, and App Builder',
    services: [
      {
        id: 'busibox-portal-app',
        name: 'Portal',
        description: 'Main admin dashboard and management UI',
        features: [],
        dockerService: 'busibox-portal',
        healthEndpoint: '/portal/api/health',
        status: 'pending',
        logs: [],
      },
      {
        id: 'busibox-agents-app',
        name: 'Agent Manager',
        description: 'Agent chat interface and workflow builder',
        features: [],
        dockerService: 'busibox-agents',
        healthEndpoint: '/agents/api/health',
        status: 'pending',
        logs: [],
      },
      {
        id: 'busibox-appbuilder-app',
        name: 'App Builder',
        description: 'AI app builder with guided generation and deployment',
        features: [],
        dockerService: 'busibox-appbuilder',
        healthEndpoint: '/builder/api/health',
        status: 'pending',
        logs: [],
      },
    ],
  },
];

export type ServiceInstallationFlowProps = {
  onComplete: () => void;
  onSkip: () => void;
};

export function ServiceInstallationFlow({ onComplete }: ServiceInstallationFlowProps) {
  const [services, setServices] = useState<Service[]>(
    SERVICE_GROUPS.flatMap(g => g.services)
  );
  // Dynamic service groups - starts as copy of SERVICE_GROUPS, updated for platform-specific services
  const [serviceGroups, setServiceGroups] = useState<ServiceGroup[]>(SERVICE_GROUPS);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isComplete, setIsComplete] = useState(false); // Installation finished, waiting for user to continue
  const [currentGroup, setCurrentGroup] = useState<string | null>(null);
  const [currentService, setCurrentService] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());
  const [platformInfo, setPlatformInfo] = useState<{ 
    backend?: string; 
    tier?: string; 
    ram_gb?: number; 
    vram_gb?: number;
    environment?: string;
    use_production_vllm?: boolean;
  } | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const installationStartedRef = useRef(false);  // Guard against React Strict Mode double-execution

  // Fetch platform info on mount
  useEffect(() => {
    const fetchPlatformInfo = async () => {
      try {
        const response = await fetch('/api/services/platform', {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data) {
            setPlatformInfo(data.data);
            
            // Update llm-test service name/description based on platform
            const backend = data.data.backend || 'cloud';
            console.log('[ServiceInstallationFlow] Platform backend:', backend, 'Full data:', data.data);
            
            if (backend === 'mlx') {
              console.log('[ServiceInstallationFlow] MLX backend detected, adding mlx-ensure step');
              
              // Define the mlx-ensure service (handles first-time setup + idempotent re-runs)
              const mlxEnsureService: Service = {
                id: 'mlx-ensure',
                name: 'Setup MLX Server',
                description: 'Installing MLX dependencies and starting server on Apple Silicon',
                features: [
                  'Installs MLX-LM and dependencies',
                  'Downloads all required models (LLM + media)',
                  'Starts MLX server in dual mode',
                  'Verifies server is responding',
                ],
                dockerService: 'mlx-ensure', // Routes to /api/services/ensure-mlx -> deploy-api /mlx/setup
                healthEndpoint: '/health',
                status: 'pending',
                logs: [],
              };
              
              // Update serviceGroups to include mlx-ensure in the llm-apis group (before litellm)
              setServiceGroups(prev => prev.map(group => {
                if (group.id === 'llm-apis') {
                  // Check if mlx-ensure already exists
                  if (group.services.some(s => s.id === 'mlx-ensure')) {
                    return group;
                  }
                  // Insert mlx-ensure before litellm so local runtime is ready first
                  const litellmIndex = group.services.findIndex(s => s.id === 'litellm');
                  const updatedServices = [...group.services];
                  if (litellmIndex >= 0) {
                    updatedServices.splice(litellmIndex, 0, mlxEnsureService);
                  } else {
                    updatedServices.unshift(mlxEnsureService);
                  }
                  return { ...group, services: updatedServices };
                }
                if (group.id === 'llm-validation') {
                  return {
                    ...group,
                    services: group.services.map(s =>
                      s.id === 'llm-test'
                        ? {
                            ...s,
                            name: 'LLM Validation (MLX)',
                            description: `Testing MLX → LiteLLM → Agent chain (${data.data.tier || 'unknown'} tier, ${data.data.ram_gb || 'unknown'}GB RAM)`,
                            features: [
                              'Tests direct MLX inference',
                              'Tests LiteLLM gateway routing',
                              'Tests Agent API integration',
                            ],
                          }
                        : s
                    ),
                  };
                }
                return group;
              }));
              
              // Also update services state
              setServices(prev => {
                console.log('[ServiceInstallationFlow] Current services:', prev.map(s => s.id));
                // Check if mlx-ensure already exists
                if (prev.some(s => s.id === 'mlx-ensure')) {
                  // Just update the llm-test service
                  return prev.map(s => 
                    s.id === 'llm-test' 
                      ? { 
                          ...s, 
                          name: 'LLM Validation (MLX)',
                          description: `Testing MLX → LiteLLM → Agent chain (${data.data.tier || 'unknown'} tier, ${data.data.ram_gb || 'unknown'}GB RAM)`,
                          features: [
                            'Tests direct MLX inference',
                            'Tests LiteLLM gateway routing',
                            'Tests Agent API integration',
                          ],
                        }
                      : s
                  );
                }
                
                // Insert mlx-ensure before litellm so runtime starts before gateway/API services
                const litellmIndex = prev.findIndex(s => s.id === 'litellm');
                const updatedServices = [...prev];
                if (litellmIndex >= 0) {
                  updatedServices.splice(litellmIndex, 0, mlxEnsureService);
                } else {
                  // Just append if litellm not found
                  updatedServices.push(mlxEnsureService);
                }
                
                // Update llm-test service
                const finalServices = updatedServices.map(s => 
                  s.id === 'llm-test' 
                    ? { 
                        ...s, 
                        name: 'LLM Validation (MLX)',
                        description: `Testing MLX → LiteLLM → Agent chain (${data.data.tier || 'unknown'} tier, ${data.data.ram_gb || 'unknown'}GB RAM)`,
                        features: [
                          'Tests direct MLX inference',
                          'Tests LiteLLM gateway routing',
                          'Tests Agent API integration',
                        ],
                      }
                    : s
                );
                console.log('[ServiceInstallationFlow] Final services after MLX insert:', finalServices.map(s => s.id));
                return finalServices;
              });
            } else if (backend === 'vllm') {
              console.log('[ServiceInstallationFlow] vLLM backend detected');
              
              // Check if staging is using production vLLM
              const isStaging = data.data.environment === 'staging';
              const useProductionVllm = data.data.use_production_vllm ?? false;
              
              console.log('[ServiceInstallationFlow] environment:', data.data.environment, 'use_production_vllm:', useProductionVllm);
              
              if (isStaging && useProductionVllm) {
                // Staging using production vLLM - add verify service (not install)
                console.log('[ServiceInstallationFlow] Staging using production vLLM, adding vllm-verify step');
                
                const vllmVerifyService: Service = {
                  id: 'vllm-verify',
                  name: 'Verify Production vLLM',
                  description: 'Checking production vLLM availability for staging',
                  features: [
                    'Verifies production vLLM is running',
                    'Confirms model availability',
                    'No local installation needed',
                  ],
                  dockerService: 'vllm-verify', // Special service ID for verification
                  healthEndpoint: '/health',
                  status: 'pending',
                  logs: [],
                };
                
                // Update serviceGroups to include vllm-verify in the llm-apis group (before litellm)
                setServiceGroups(prev => prev.map(group => {
                  if (group.id === 'llm-apis') {
                    // Check if vllm-verify already exists
                    if (group.services.some(s => s.id === 'vllm-verify')) {
                      return group;
                    }
                    // Insert vllm-verify before litellm
                    const litellmIndex = group.services.findIndex(s => s.id === 'litellm');
                    const updatedServices = [...group.services];
                    if (litellmIndex >= 0) {
                      updatedServices.splice(litellmIndex, 0, vllmVerifyService);
                    } else {
                      updatedServices.unshift(vllmVerifyService);
                    }
                    return { ...group, services: updatedServices };
                  }
                  if (group.id === 'llm-validation') {
                    return {
                      ...group,
                      services: group.services.map(s => 
                        s.id === 'llm-test' 
                          ? { 
                              ...s, 
                              name: 'LLM Validation (vLLM)',
                              description: 'Testing production vLLM → LiteLLM → Agent chain',
                            }
                          : s
                      ),
                    };
                  }
                  return group;
                }));
                
                // Also update services state
                setServices(prev => {
                  console.log('[ServiceInstallationFlow] Current services:', prev.map(s => s.id));
                  if (prev.some(s => s.id === 'vllm-verify')) {
                    // Just update llm-test
                    return prev.map(s => 
                      s.id === 'llm-test' 
                        ? { ...s, name: 'LLM Validation (vLLM)', description: 'Testing production vLLM → LiteLLM → Agent chain' }
                        : s
                    );
                  }
                  
                  // Insert vllm-verify before litellm
                  const litellmIndex = prev.findIndex(s => s.id === 'litellm');
                  const updatedServices = [...prev];
                  if (litellmIndex >= 0) {
                    updatedServices.splice(litellmIndex, 0, vllmVerifyService);
                  } else {
                    updatedServices.push(vllmVerifyService);
                  }
                  
                  // Update llm-test service
                  const finalServices = updatedServices.map(s => 
                    s.id === 'llm-test' 
                      ? { ...s, name: 'LLM Validation (vLLM)', description: 'Testing production vLLM → LiteLLM → Agent chain' }
                      : s
                  );
                  console.log('[ServiceInstallationFlow] Final services after vllm-verify insert:', finalServices.map(s => s.id));
                  return finalServices;
                });
              } else {
                // Production or staging without use_production_vllm - add install service
                console.log('[ServiceInstallationFlow] Adding vllm-install step');
                
                const vllmInstallService: Service = {
                  id: 'vllm',
                  name: 'vLLM Runtime',
                  description: `GPU-accelerated LLM inference with vLLM (${data.data.vram_gb || 'unknown'}GB VRAM)`,
                  features: [
                    'Downloads configured models',
                    'Starts vLLM server on GPU',
                    'Configures tensor parallelism',
                  ],
                  dockerService: 'vllm',
                  healthEndpoint: '/health',
                  status: 'pending',
                  logs: [],
                };
                
                // Update serviceGroups to include vllm in the llm-apis group (before litellm)
                setServiceGroups(prev => prev.map(group => {
                  if (group.id === 'llm-apis') {
                    // Check if vllm already exists
                    if (group.services.some(s => s.id === 'vllm')) {
                      return group;
                    }
                    // Insert vllm before litellm
                    const litellmIndex = group.services.findIndex(s => s.id === 'litellm');
                    const updatedServices = [...group.services];
                    if (litellmIndex >= 0) {
                      updatedServices.splice(litellmIndex, 0, vllmInstallService);
                    } else {
                      updatedServices.unshift(vllmInstallService);
                    }
                    return { ...group, services: updatedServices };
                  }
                  if (group.id === 'llm-validation') {
                    return {
                      ...group,
                      services: group.services.map(s => 
                        s.id === 'llm-test' 
                          ? { 
                              ...s, 
                              name: 'LLM Validation (vLLM)',
                              description: `Testing vLLM → LiteLLM → Agent chain (${data.data.tier || 'unknown'} tier)`,
                            }
                          : s
                      ),
                    };
                  }
                  return group;
                }));
                
                // Also update services state
                setServices(prev => {
                  console.log('[ServiceInstallationFlow] Current services:', prev.map(s => s.id));
                  if (prev.some(s => s.id === 'vllm')) {
                    // Just update llm-test
                    return prev.map(s => 
                      s.id === 'llm-test' 
                        ? { ...s, name: 'LLM Validation (vLLM)', description: `Testing vLLM → LiteLLM → Agent chain (${data.data.tier || 'unknown'} tier)` }
                        : s
                    );
                  }
                  
                  // Insert vllm before litellm
                  const litellmIndex = prev.findIndex(s => s.id === 'litellm');
                  const updatedServices = [...prev];
                  if (litellmIndex >= 0) {
                    updatedServices.splice(litellmIndex, 0, vllmInstallService);
                  } else {
                    updatedServices.push(vllmInstallService);
                  }
                  
                  // Update llm-test service
                  const finalServices = updatedServices.map(s => 
                    s.id === 'llm-test' 
                      ? { ...s, name: 'LLM Validation (vLLM)', description: `Testing vLLM → LiteLLM → Agent chain (${data.data.tier || 'unknown'} tier)` }
                      : s
                  );
                  console.log('[ServiceInstallationFlow] Final services after vllm insert:', finalServices.map(s => s.id));
                  return finalServices;
                });
              }
            } else if (backend === 'cloud') {
              // No local AI hardware - update description but still run validation
              setServices(prev => prev.map(s => 
                s.id === 'llm-test' 
                  ? { 
                      ...s, 
                      name: 'LLM Validation (Cloud)',
                      description: 'Testing cloud LLM → LiteLLM → Agent chain',
                    }
                  : s
              ));
            }
          }
        }
      } catch (error) {
        console.error('[ServiceInstallationFlow] Failed to fetch platform info:', error);
      }
    };
    
    fetchPlatformInfo();
  }, []);

  // Auto-start installation on mount (after platform info is fetched and serviceGroups updated)
  useEffect(() => {
    // Wait for platform info AND serviceGroups to be updated
    // Check for mlx-ensure if backend is mlx, or vllm/vllm-verify if backend is vllm
    const shouldHaveMlxEnsure = platformInfo?.backend === 'mlx';
    const hasMlxEnsure = serviceGroups.some(g => g.services.some(s => s.id === 'mlx-ensure'));
    
    const shouldHaveVllmService = platformInfo?.backend === 'vllm';
    const hasVllmService = serviceGroups.some(g => g.services.some(s => s.id === 'vllm' || s.id === 'vllm-verify'));
    
    const isReady = platformInfo !== null && 
      (!shouldHaveMlxEnsure || hasMlxEnsure) &&
      (!shouldHaveVllmService || hasVllmService);
    
    if (isReady && !installationStartedRef.current) {
      console.log('[ServiceInstallationFlow] Starting installation, serviceGroups:', serviceGroups.map(g => ({ id: g.id, services: g.services.map(s => s.id) })));
      // Guard against React Strict Mode double-execution
      installationStartedRef.current = true;
      startInstallation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platformInfo, serviceGroups]);

  const updateServiceStatus = (serviceId: string, status: ServiceStatus, error?: string) => {
    setServices(prev => prev.map(s => 
      s.id === serviceId ? { ...s, status, error } : s
    ));
  };

  const addServiceLog = (serviceId: string, log: LogEntry) => {
    setServices(prev => prev.map(s => 
      s.id === serviceId ? { ...s, logs: [...s.logs, log] } : s
    ));
  };

  const checkServiceHealth = async (service: Service, bustCache: boolean = false): Promise<boolean> => {
    // Always call deploy-api health check - it handles services with/without HTTP endpoints
    try {
      const healthResponse = await fetch('/api/services/health', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': bustCache ? 'no-cache, no-store, must-revalidate' : 'default',
        },
        body: JSON.stringify({ 
          service: service.dockerService,
          endpoint: service.healthEndpoint || '/health', // Provide default if not specified
          bustCache, // Tell backend to skip any caching
        }),
        credentials: 'include',
      });

      if (healthResponse.ok) {
        const response = await healthResponse.json();
        // apiSuccess wraps data in { success: true, data: { healthy: ... } }
        const healthy = response.success && response.data?.healthy === true;
        console.log(`[HealthCheck] ${service.name}:`, { response, healthy });
        return healthy;
      }
    } catch (err) {
      // Health check failed
      console.error(`[HealthCheck] Failed to check ${service.name}:`, err);
    }
    return false;
  };

  const startServiceViaSSE = async (service: Service, forceReinstall: boolean = false): Promise<boolean> => {
    return new Promise((resolve, reject) => {
      // Close any existing connection first to prevent duplicate streams
      if (wsRef.current) {
        try {
          (wsRef.current as any).close?.();
        } catch {
          // Ignore close errors
        }
        wsRef.current = null;
      }
      
      // Connect via SSE through Busibox Portal proxy (EventSource doesn't support custom headers)
      // EventSource doesn't use fetch, so we need to manually prepend basePath
      const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';
      
      // Special handling for MLX ensure and LLM validation - use dedicated endpoints
      let sseUrl: string;
      if (service.dockerService === 'mlx-ensure') {
        sseUrl = `${basePath}/api/services/ensure-mlx`;
      } else if (service.dockerService === 'llm-test') {
        sseUrl = `${basePath}/api/services/validate-llm`;
      } else {
        // Add rebuild query parameter for force reinstall
        const rebuildParam = forceReinstall ? '?rebuild=true' : '';
        sseUrl = `${basePath}/api/services/start/${service.dockerService}${rebuildParam}`;
      }
      
      console.log('[SSE] Connecting to:', sseUrl);
      
      addServiceLog(service.id, {
        type: 'info',
        message: `Connecting to deploy service...`,
        timestamp: Date.now(),
      });

      const eventSource = new EventSource(sseUrl);
      wsRef.current = eventSource as any; // Store for cleanup

      eventSource.onopen = () => {
        console.log('[SSE] Connected successfully');
        addServiceLog(service.id, {
          type: 'info',
          message: `Connected, starting ${service.name}...`,
          timestamp: Date.now(),
        });
      };

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.type === 'log') {
            addServiceLog(service.id, {
              type: 'log',
              stream: data.stream,
              message: data.message,
              timestamp: Date.now(),
            });
          } else if (data.type === 'success') {
            addServiceLog(service.id, {
              type: 'success',
              message: data.message,
              timestamp: Date.now(),
            });
            if (data.done) {
              eventSource.close();
              resolve(true);
            }
          } else if (data.type === 'warning') {
            addServiceLog(service.id, {
              type: 'warning',
              message: data.message,
              timestamp: Date.now(),
            });
            if (data.done) {
              eventSource.close();
              resolve(true);
            }
          } else if (data.type === 'error') {
            addServiceLog(service.id, {
              type: 'error',
              message: data.message,
              timestamp: Date.now(),
            });
            if (data.done) {
              eventSource.close();
              reject(new Error(data.message));
            }
          } else if (data.error) {
            addServiceLog(service.id, {
              type: 'error',
              message: data.error,
              timestamp: Date.now(),
            });
            eventSource.close();
            reject(new Error(data.error));
          }
        } catch (err) {
          console.error('Failed to parse SSE message:', err);
        }
      };

      eventSource.onerror = (error) => {
        console.error('[SSE] Error:', error);
        addServiceLog(service.id, {
          type: 'error',
          message: 'Connection error',
          timestamp: Date.now(),
        });
        eventSource.close();
        reject(new Error('SSE connection error'));
      };
    });
  };

  const startService = async (service: Service, forceReinstall: boolean = false): Promise<boolean> => {
    try {
      setCurrentService(service.id);
      
      // Clear logs if force reinstall
      if (forceReinstall) {
        setServices(prev => prev.map(s => 
          s.id === service.id ? { ...s, logs: [], error: undefined } : s
        ));
      }
      
      // Special handling for MLX setup - skip health check, go straight to SSE
      if (service.dockerService === 'mlx-ensure') {
        updateServiceStatus(service.id, 'installing');
        addServiceLog(service.id, {
          type: 'info',
          message: 'Setting up MLX (install deps, download model, start server)...',
          timestamp: Date.now(),
        });
        
        try {
          await startServiceViaSSE(service);
          updateServiceStatus(service.id, 'healthy');
          return true;
        } catch (error: any) {
          // MLX ensure warnings shouldn't block installation
          if (error.message?.includes('not needed') || error.message?.includes('Skipped')) {
            updateServiceStatus(service.id, 'healthy');
            return true;
          }
          updateServiceStatus(service.id, 'failed', error.message);
          return false;
        }
      }
      
      // Special handling for LLM validation - skip health check, go straight to SSE
      if (service.dockerService === 'llm-test') {
        updateServiceStatus(service.id, 'installing');
        addServiceLog(service.id, {
          type: 'info',
          message: 'Starting LLM chain validation...',
          timestamp: Date.now(),
        });
        
        try {
          await startServiceViaSSE(service);
          updateServiceStatus(service.id, 'healthy');
          return true;
        } catch (error: any) {
          // LLM validation warnings shouldn't block installation
          if (error.message?.includes('partial') || error.message?.includes('warning')) {
            updateServiceStatus(service.id, 'healthy');
            return true;
          }
          throw error;
        }
      }
      
      // First check if service is already healthy (bust cache if force reinstall)
      updateServiceStatus(service.id, 'checking');
      addServiceLog(service.id, {
        type: 'info',
        message: forceReinstall 
          ? `Force reinstalling ${service.name}...`
          : `Checking if ${service.name} is already running...`,
        timestamp: Date.now(),
      });

      const isHealthy = await checkServiceHealth(service, forceReinstall);
      if (isHealthy && !forceReinstall) {
        addServiceLog(service.id, {
          type: 'success',
          message: `${service.name} is already running and healthy - skipping deployment`,
          timestamp: Date.now(),
        });
        updateServiceStatus(service.id, 'skipped');
        return true;
      }

      // Service not healthy or force reinstall - deploy it
      updateServiceStatus(service.id, 'installing');
      await startServiceViaSSE(service, forceReinstall);

      // Wait a bit for service to initialize
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Always verify health after deployment (deploy-api handles all service types)
      // Special handling for vllm/mlx - model downloads happen in background
      const isLLMRuntime = service.id === 'vllm';
      if (isLLMRuntime) {
        addServiceLog(service.id, {
          type: 'info',
          message: 'Model downloads are happening in background (may take 5-15 minutes depending on model size)...',
          timestamp: Date.now(),
        });
        addServiceLog(service.id, {
          type: 'info',
          message: 'Service will be ready once models are downloaded. You can continue using other services.',
          timestamp: Date.now(),
        });
      } else {
        addServiceLog(service.id, {
          type: 'info',
          message: 'Waiting for service to become healthy...',
          timestamp: Date.now(),
        });
      }

      // vllm needs longer timeout due to model downloads (up to 15 minutes)
      const maxRetries = isLLMRuntime ? 900 : 30; // 15 minutes for vllm, 30 seconds for others
      let healthy = false;

      for (let i = 0; i < maxRetries; i++) {
        healthy = await checkServiceHealth(service, true);
        if (healthy) {
          break;
        }
        // Show progress for vllm every 30 seconds
        if (isLLMRuntime && i > 0 && i % 30 === 0) {
          addServiceLog(service.id, {
            type: 'info',
            message: `Still downloading models... (${Math.floor(i / 60)} minutes elapsed)`,
            timestamp: Date.now(),
          });
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      if (!healthy) {
        if (isLLMRuntime) {
          // For vllm, don't fail - just mark as installing (models still downloading)
          addServiceLog(service.id, {
            type: 'warning',
            message: 'Model downloads still in progress. Service will be ready once complete.',
            timestamp: Date.now(),
          });
          updateServiceStatus(service.id, 'installing'); // Keep as installing, not error
          return true; // Don't block installation flow
        } else {
          throw new Error('Service health check timeout after deployment');
        }
      }

      addServiceLog(service.id, {
        type: 'success',
        message: `${service.name} is healthy and ready`,
        timestamp: Date.now(),
      });
      updateServiceStatus(service.id, 'healthy');
      return true;
    } catch (error: any) {
      console.error(`Failed to start ${service.name}:`, error);
      addServiceLog(service.id, {
        type: 'error',
        message: error.message,
        timestamp: Date.now(),
      });
      updateServiceStatus(service.id, 'error', error.message);
      return false;
    }
  };

  const startInstallation = async () => {
    setIsInstalling(true);
    setErrorMessage(null);

    try {
      // Use serviceGroups state (which may include mlx-ensure for MLX backends)
      for (const group of serviceGroups) {
        setCurrentGroup(group.id);

        for (const service of group.services) {
          // Skip services that are already marked as skipped (e.g., no local AI hardware)
          if (service.status === 'skipped') {
            addServiceLog(service.id, {
              type: 'info',
              message: `${service.name} skipped - ${service.description}`,
              timestamp: Date.now(),
            });
            continue;
          }
          
          const success = await startService(service);
          
          if (!success) {
            const failedService = services.find(s => s.id === service.id);
            const errorMsg = failedService?.error || 'Unknown error';
            setErrorMessage(`Failed to install ${service.name}: ${errorMsg}`);
            setIsInstalling(false);
            setCurrentGroup(null);
            setCurrentService(null);
            return;
          }
        }
      }

      setCurrentGroup(null);
      setCurrentService(null);
      setIsInstalling(false);
      setIsComplete(true); // Show continue button instead of auto-advancing
    } catch (error: any) {
      console.error('Installation failed:', error);
      setErrorMessage(error.message || 'Installation failed');
      setIsInstalling(false);
      setCurrentGroup(null);
      setCurrentService(null);
    }
  };

  const getServiceById = (serviceId: string) => {
    return services.find(s => s.id === serviceId);
  };

  const getGroupServices = (groupId: string) => {
    const group = serviceGroups.find(g => g.id === groupId);
    if (!group) return [];
    return group.services.map(s => getServiceById(s.id)!);
  };

  const toggleLogs = (serviceId: string) => {
    setExpandedLogs(prev => {
      const next = new Set(prev);
      if (next.has(serviceId)) {
        next.delete(serviceId);
      } else {
        next.add(serviceId);
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <section className="py-8 lg:py-12 relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.03]">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="setup-grid" width="32" height="32" patternUnits="userSpaceOnUse">
                <path d="M0 32V0h32" fill="none" stroke="currentColor" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#setup-grid)" />
          </svg>
        </div>
        <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-gradient-to-bl from-orange-100/40 via-transparent to-transparent rounded-full blur-3xl -translate-y-1/3 translate-x-1/4 pointer-events-none"></div>
        
        <div className="max-w-5xl mx-auto px-6 relative">
          <h1 className="text-3xl lg:text-4xl font-semibold text-gray-900 tracking-tight leading-tight">
            Installing <span className="text-orange-500">Services</span>
          </h1>
          <p className="mt-3 text-lg text-gray-600 max-w-2xl">
            Setting up your Busibox infrastructure. This may take a few minutes.
          </p>
        </div>
      </section>

      {/* Service Groups */}
      <section className="pb-12">
        <div className="max-w-5xl mx-auto px-6">
          {errorMessage && (
            <div className="mb-8 bg-red-50 border-2 border-red-300 rounded-xl p-6">
              <div className="flex items-start gap-4">
                <svg className="w-6 h-6 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <div className="flex-1">
                  <p className="font-semibold text-red-900 text-lg">Installation Failed</p>
                  <p className="text-red-700 mt-2">{errorMessage}</p>
                  <div className="mt-4">
                    <button
                      onClick={() => {
                        setErrorMessage(null);
                        startInstallation();
                      }}
                      className="px-6 py-2.5 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors"
                    >
                      Retry Installation
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-6">
            {serviceGroups.map((group, groupIndex) => {
              const groupServices = getGroupServices(group.id);
              const allHealthy = groupServices.every(s => s?.status === 'healthy' || s?.status === 'skipped');
              const anyInstalling = groupServices.some(s => s?.status === 'installing' || s?.status === 'checking');
              const isCurrentGroup = currentGroup === group.id;

              return (
                <div
                  key={group.id}
                  className={`border rounded-xl overflow-hidden bg-white transition-all ${
                    isCurrentGroup ? 'border-orange-300 shadow-lg' : 'border-gray-200'
                  }`}
                >
                  <div className="p-4 flex items-start gap-4">
                    <span className="text-sm font-mono text-orange-500 pt-1 min-w-[2rem]">
                      {String(groupIndex + 1).padStart(2, '0')}
                    </span>
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-gray-900 mb-1.5">{group.title}</h3>
                      <p className="text-sm text-gray-600 mb-3">{group.description}</p>
                      
                      <div className="space-y-2.5">
                        {group.services.map(serviceDef => {
                          const service = getServiceById(serviceDef.id);
                          if (!service) return null;

                          const hasLogs = service.logs.length > 0;
                          const isExpanded = expandedLogs.has(service.id);

                          return (
                            <div key={service.id} className="border border-gray-100 rounded-lg p-3">
                              <div className="flex items-start gap-3">
                                <div className="pt-0.5">
                                  {service.status === 'pending' && (
                                    <div className="w-5 h-5 border-2 border-gray-300 rounded"></div>
                                  )}
                                  {(service.status === 'checking' || service.status === 'installing') && (
                                    <svg className="animate-spin w-5 h-5 text-orange-500" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                  )}
                                  {(service.status === 'healthy' || service.status === 'skipped') && (
                                    <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                    </svg>
                                  )}
                                  {service.status === 'error' && (
                                    <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                                    </svg>
                                  )}
                                </div>
                                
                                <div className="flex-1">
                                  <div className="flex items-baseline gap-2">
                                    <h4 className="font-medium text-gray-900">{service.name}</h4>
                                    {service.status === 'checking' && (
                                      <span className="text-xs text-blue-600 font-medium">Checking...</span>
                                    )}
                                    {service.status === 'installing' && (
                                      <span className="text-xs text-orange-600 font-medium">Installing...</span>
                                    )}
                                    {service.status === 'skipped' && (
                                      <span className="text-xs text-green-600 font-medium">Already Running</span>
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-600 mt-0.5">{service.description}</p>
                                  {service.error && (
                                    <p className="text-xs text-red-600 mt-1">Error: {service.error}</p>
                                  )}
                                </div>

                                <div className="flex gap-2">
                                  {(service.status === 'error' || service.status === 'healthy' || service.status === 'skipped') && (
                                    <button
                                      onClick={() => startService(service, true)}
                                      disabled={isInstalling}
                                      className={`text-xs text-white font-medium px-3 py-1 rounded transition-colors ${
                                        service.status === 'error' 
                                          ? 'bg-red-600 hover:bg-red-700 disabled:bg-gray-400'
                                          : 'bg-orange-600 hover:bg-orange-700 disabled:bg-gray-400'
                                      }`}
                                    >
                                      {service.dockerService === 'llm-test' ? 'Retry Test' : service.dockerService === 'mlx-ensure' ? 'Retry' : 'Reinstall'}
                                    </button>
                                  )}
                                  {hasLogs && (
                                    <button
                                      onClick={() => toggleLogs(service.id)}
                                      className="text-xs text-gray-500 hover:text-gray-700 font-medium px-2 py-1 rounded hover:bg-gray-100 transition-colors"
                                    >
                                      {isExpanded ? 'Hide' : 'Show'} Logs
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Collapsible Logs */}
                              {hasLogs && isExpanded && (
                                <div className="mt-3 border-t border-gray-200 pt-3">
                                  <div className="bg-gray-900 rounded-md p-3 max-h-60 overflow-y-auto font-mono text-xs">
                                    {service.logs.map((log, idx) => (
                                      <div
                                        key={idx}
                                        className={`mb-1 ${
                                          log.type === 'error' ? 'text-red-400' :
                                          log.type === 'success' ? 'text-green-400' :
                                          log.type === 'warning' ? 'text-yellow-400' :
                                          log.type === 'info' ? 'text-blue-400' :
                                          log.stream === 'stderr' ? 'text-red-300' :
                                          'text-gray-300'
                                        }`}
                                      >
                                        {log.message}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {allHealthy && (
                        <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                      {anyInstalling && (
                        <svg className="animate-spin h-6 w-6 text-orange-500" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {isComplete && !errorMessage && (
            <div className="mt-12 text-center">
              <div className="flex items-center justify-center gap-3 mb-4">
                <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-lg font-medium text-gray-900">Installation Complete!</p>
              </div>
              <p className="text-gray-600 mb-6">Review the results above, then continue to customize your portal.</p>
              <button
                onClick={() => onComplete()}
                className="px-8 py-3 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 transition-colors shadow-lg shadow-orange-500/25"
              >
                Continue to Portal Customization
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
