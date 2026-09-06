'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  Database,
  ExternalLink,
  Shield,
  ArrowLeft,
  CheckCircle2,
  RefreshCw
} from 'lucide-react';

export default function SwaggerDocsPage() {
  const [dbStatus, setDbStatus] = useState<any>(null);
  const [loadingDb, setLoadingDb] = useState(true);

  const fetchDbStatus = async () => {
    setLoadingDb(true);
    try {
      const res = await fetch('/api/system/db-status');
      const data = await res.json();
      setDbStatus(data);
    } catch (e) {
      setDbStatus({ status: 'unreachable' });
    } finally {
      setLoadingDb(false);
    }
  };

  useEffect(() => {
    fetchDbStatus();

    // Dynamically inject Swagger UI CSS and Bundle JS
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css';
    document.head.appendChild(link);

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js';
    script.async = true;
    script.onload = () => {
      if ((window as any).SwaggerUIBundle) {
        (window as any).SwaggerUIBundle({
          url: '/api/openapi.json',
          dom_id: '#swagger-ui',
          deepLinking: true,
          presets: [
            (window as any).SwaggerUIBundle.presets.apis,
            (window as any).SwaggerUIBundle.SwaggerUIStandalonePreset,
          ],
          layout: 'BaseLayout',
          docExpansion: 'list',
          defaultModelsExpandDepth: 1,
        });
      }
    };
    document.body.appendChild(script);

    return () => {
      document.head.removeChild(link);
      if (document.body.contains(script)) {
        document.body.removeChild(script);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#F8FAF9] text-slate-900 flex flex-col">
      {/* Top USJ-R Navigation Header */}
      <div className="bg-[#005A36] border-b-2 border-[#C99700] text-white px-4 lg:px-8 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-[#FEF08A]/40 flex items-center justify-center shadow-inner">
              <BookOpen className="w-5 h-5 text-[#FEF08A]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-black text-sm tracking-wider uppercase text-white">USJ-R SRVS</span>
                <span className="text-[10px] bg-[#FEF08A] text-[#854D0E] font-extrabold px-2 py-0.5 rounded-full">
                  SWAGGER API DOCS
                </span>
              </div>
              <p className="text-[11px] text-emerald-100 font-medium">
                University of San Jose - Recoletos • Interactive OpenAPI 3.0 Portal
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <a
              href="/api/openapi.json"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 border border-white/20 text-white flex items-center space-x-1.5 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5 text-[#FEF08A]" />
              <span>openapi.json</span>
            </a>
            <Link
              href="/"
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-white text-[#005A36] hover:bg-emerald-50 flex items-center space-x-1.5 transition-all shadow-sm"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Portal</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Database Status Banner */}
      <div className="bg-white border-b border-slate-200 px-4 lg:px-8 py-3.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center">
              <Database className="w-4 h-4 text-[#005A36]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-slate-900">PostgreSQL Database</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                  dbStatus?.status === 'healthy'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'
                }`}>
                  {loadingDb ? 'Connecting...' : dbStatus?.status?.toUpperCase()}
                </span>
                {dbStatus?.latencyMs && (
                  <span className="text-[10px] font-mono text-slate-500">({dbStatus.latencyMs})</span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 font-medium">
                Supabase Pooled PostgreSQL • 8 Normalized Relational Tables Online
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {dbStatus?.tables && (
              <div className="hidden md:flex items-center space-x-2 text-[11px] font-mono text-slate-600 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
                <span>Depts: <strong>{dbStatus.tables.srvs_departments}</strong></span>
                <span>•</span>
                <span>Courses: <strong>{dbStatus.tables.srvs_courses}</strong></span>
                <span>•</span>
                <span>Users: <strong>{dbStatus.tables.srvs_users}</strong></span>
                <span>•</span>
                <span>Audit Logs: <strong>{dbStatus.tables.srvs_audit_logs}</strong></span>
              </div>
            )}
            <button
              onClick={fetchDbStatus}
              disabled={loadingDb}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
              title="Refresh database status"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingDb ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Swagger UI Mount Point */}
      <div className="flex-1 max-w-7xl mx-auto w-full p-4 lg:p-8">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 lg:p-6">
          <div id="swagger-ui" className="swagger-container" />
        </div>
      </div>

      {/* Swagger Style Customization */}
      <style jsx global>{`
        .swagger-ui .topbar {
          display: none !important;
        }
        .swagger-ui .info {
          margin: 15px 0 25px 0 !important;
        }
        .swagger-ui .info .title {
          font-family: inherit !important;
          color: #005a36 !important;
          font-size: 24px !important;
          font-weight: 800 !important;
        }
        .swagger-ui .scheme-container {
          background: #f8faf9 !important;
          box-shadow: none !important;
          border: 1px solid #e2e8f0 !important;
          border-radius: 12px !important;
          padding: 15px 20px !important;
          margin-bottom: 20px !important;
        }
        .swagger-ui .opblock {
          border-radius: 12px !important;
          box-shadow: none !important;
          margin-bottom: 12px !important;
          border: 1px solid #e2e8f0 !important;
        }
        .swagger-ui .opblock .opblock-summary {
          padding: 10px 15px !important;
        }
        .swagger-ui .btn.execute {
          background-color: #005a36 !important;
          border-color: #005a36 !important;
          color: #ffffff !important;
          border-radius: 8px !important;
        }
        .swagger-ui .btn.authorize {
          background-color: #c99700 !important;
          border-color: #c99700 !important;
          color: #ffffff !important;
          border-radius: 8px !important;
        }
      `}</style>
    </div>
  );
}
