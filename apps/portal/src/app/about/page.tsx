/**
 * About Page - Busibox Product Landing
 * 
 * Clean, professional product page for Busibox.
 */

import Link from 'next/link';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { PublicFooter } from '@/components/layout/PublicFooter';

export const metadata = {
  title: 'Busibox - Own Your AI',
  description: 'Secure, local AI infrastructure. Run AI inside your boundary with row-level access control.',
};

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <PublicHeader />
      
      <main className="flex-1">
        {/* Hero */}
        <section className="py-20 lg:py-28 relative overflow-hidden">
          {/* Subtle grid background */}
          <div className="absolute inset-0 opacity-[0.03]">
            <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <pattern id="hero-grid" width="32" height="32" patternUnits="userSpaceOnUse">
                  <path d="M0 32V0h32" fill="none" stroke="currentColor" strokeWidth="1"/>
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#hero-grid)" />
            </svg>
          </div>
          {/* Gradient accent */}
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-orange-100/40 via-transparent to-transparent rounded-full blur-3xl -translate-y-1/3 translate-x-1/4 pointer-events-none"></div>
          
          <div className="max-w-5xl mx-auto px-6 relative">
            <h1 className="text-4xl lg:text-6xl font-semibold text-gray-900 tracking-tight leading-tight">
              Own Your <span className="text-orange-500">AI</span>
            </h1>
            <p className="mt-6 text-xl lg:text-2xl text-gray-600 max-w-2xl leading-relaxed">
              Run AI on your hardware. Control your data. 
              Deploy agents in days, not months.
            </p>
            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/login"
                className="px-6 py-3 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 transition-colors"
              >
                Get started
              </Link>
              <Link
                href="/docs/user"
                className="px-6 py-3 text-gray-700 font-medium rounded-lg border border-gray-300 hover:border-gray-400 transition-colors"
              >
                Documentation
              </Link>
            </div>
          </div>
        </section>

        {/* Value Props */}
        <section className="py-20 border-t border-gray-100">
          <div className="max-w-5xl mx-auto px-6">
            <div className="grid md:grid-cols-2 gap-12 lg:gap-16">
              <ValueProp
                title="Data stays with you"
                description="Your documents, conversations, and embeddings never leave your infrastructure. No third-party APIs required for core operations."
              />
              <ValueProp
                title="Predictable costs"
                description="Local inference means flat costs as usage grows. Optional cloud burst for peak demand, controlled by policy."
              />
              <ValueProp
                title="Ship fast"
                description="Pre-built agents and workflows get you from zero to production in days. Customize with low-code tools or full code access."
              />
              <ValueProp
                title="Enterprise controls"
                description="Row-level access control on every document. Audit logs for compliance. Role-based permissions throughout."
              />
            </div>
          </div>
        </section>

        {/* Architecture */}
        <section className="py-20 bg-gray-50">
          <div className="max-w-5xl mx-auto px-6">
            <h2 className="text-2xl lg:text-3xl font-semibold text-gray-900 mb-12">
              What you get
            </h2>
            <div className="space-y-8">
              <ArchItem
                num="01"
                title="Document ingestion"
                description="Upload PDFs, Word docs, images. Automatic text extraction, chunking, and embedding. Metadata and access controls stamped at data."
              />
              <ArchItem
                num="02"
                title="Hybrid search"
                description="Vector similarity plus keyword search. Results filtered by your permissions. Optional re-ranking for better relevance."
              />
              <ArchItem
                num="03"
                title="Local inference"
                description="vLLM for GPU acceleration, Ollama for smaller models. LiteLLM gateway for unified API. Cloud fallback when policy allows."
              />
              <ArchItem
                num="04"
                title="Agent runtime"
                description="Define agents with custom tools and knowledge bases. Workflow automation. Per-agent permissions and audit trails."
              />
              <ArchItem
                num="05"
                title="Portal and apps"
                description="Chat interface, document browser, admin console. SSO integration. White-label ready."
              />
            </div>
          </div>
        </section>

        {/* Security */}
        <section className="py-20 border-t border-gray-100">
          <div className="max-w-5xl mx-auto px-6">
            <h2 className="text-2xl lg:text-3xl font-semibold text-gray-900 mb-4">
              Security by default
            </h2>
            <p className="text-lg text-gray-600 mb-12 max-w-2xl">
              Built for regulated industries and security-conscious organizations.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
              <SecurityItem title="Air-gap capable" description="No outbound calls required" />
              <SecurityItem title="Least privilege" description="Permissions checked at every layer" />
              <SecurityItem title="Full audit trail" description="Every action logged and exportable" />
              <SecurityItem title="Compliance ready" description="Evidence hooks for SOC2, ISO, HIPAA" />
            </div>
          </div>
        </section>

        {/* Editions */}
        <section className="py-20 bg-gray-50">
          <div className="max-w-5xl mx-auto px-6">
            <h2 className="text-2xl lg:text-3xl font-semibold text-gray-900 mb-12">
              Deployment options
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              <Edition
                title="Core"
                description="Single-tenant deployment on your infrastructure. Full feature set for one organization."
                items={['All 5 platform layers', 'Local inference', 'Row-level security', 'Standard support']}
              />
              <Edition
                title="Enterprise"
                description="High availability, compliance features, and advanced integrations."
                items={['Everything in Core', 'HA configuration', 'SAML/SCIM', 'Compliance pack', 'Priority support']}
                highlighted
              />
              <Edition
                title="MSP"
                description="Multi-tenant control plane for service providers."
                items={['Everything in Enterprise', 'Multi-org management', 'White-label portal', 'Usage metering', 'Partner program']}
              />
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20">
          <div className="max-w-5xl mx-auto px-6">
            <div className="bg-gray-900 rounded-2xl p-10 lg:p-14 relative overflow-hidden">
              {/* Circuit-like pattern background */}
              <div className="absolute inset-0 opacity-[0.07]">
                <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <pattern id="cta-circuit" width="60" height="60" patternUnits="userSpaceOnUse">
                      <circle cx="30" cy="30" r="1.5" fill="#f97316"/>
                      <path d="M30 0v12M30 48v12M0 30h12M48 30h12" stroke="#f97316" strokeWidth="0.5" fill="none"/>
                      <path d="M30 18v6M30 36v6M18 30h6M36 30h6" stroke="#f97316" strokeWidth="0.5" fill="none"/>
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#cta-circuit)" />
                </svg>
              </div>
              {/* Glow accent */}
              <div className="absolute top-0 right-0 w-80 h-80 bg-orange-500/15 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 pointer-events-none"></div>
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-orange-600/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4 pointer-events-none"></div>
              
              <h2 className="text-2xl lg:text-3xl font-semibold text-white mb-4 relative">
                Start in 30 days
              </h2>
              <p className="text-gray-400 text-lg mb-8 max-w-xl relative">
                Pilot with one dataset and two agent apps. See results before committing.
              </p>
              <Link
                href="/login"
                className="inline-block px-6 py-3 bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 transition-colors relative"
              >
                Request access
              </Link>
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}

function ValueProp({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 leading-relaxed">{description}</p>
    </div>
  );
}

function ArchItem({ num, title, description }: { num: string; title: string; description: string }) {
  return (
    <div className="flex gap-6">
      <span className="text-sm font-mono text-orange-500 pt-1">{num}</span>
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">{title}</h3>
        <p className="text-gray-600">{description}</p>
      </div>
    </div>
  );
}

function SecurityItem({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h4 className="font-medium text-gray-900 mb-1">{title}</h4>
      <p className="text-sm text-gray-500">{description}</p>
    </div>
  );
}

function Edition({ 
  title, 
  description, 
  items, 
  highlighted = false 
}: { 
  title: string; 
  description: string; 
  items: string[];
  highlighted?: boolean;
}) {
  return (
    <div className={`p-6 rounded-xl ${highlighted ? 'bg-gray-900 text-white ring-2 ring-orange-500' : 'bg-white border border-gray-200'}`}>
      <h3 className={`text-xl font-semibold mb-2 ${highlighted ? 'text-white' : 'text-gray-900'}`}>
        {title}
      </h3>
      <p className={`text-sm mb-6 ${highlighted ? 'text-gray-400' : 'text-gray-500'}`}>
        {description}
      </p>
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className={`text-sm flex items-start gap-2 ${highlighted ? 'text-gray-300' : 'text-gray-600'}`}>
            <svg className={`w-4 h-4 mt-0.5 flex-shrink-0 ${highlighted ? 'text-orange-400' : 'text-orange-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
