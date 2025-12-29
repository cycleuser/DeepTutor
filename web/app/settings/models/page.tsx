"use client";

import { useEffect, useState } from "react";
import { Brain, AlertCircle, Loader2 } from "lucide-react";
import { apiUrl } from "@/lib/api";
import { getTranslation } from "@/lib/i18n";
import { useGlobal } from "@/context/GlobalContext";

interface ModelInfo {
  name: string;
  size?: number;
  digest?: string;
  created?: number;
  modified_at?: string;
  source: string;
}

interface ModelListResponse {
  models: ModelInfo[];
  binding: string;
  base_url: string;
}

export default function ModelSelectorPage() {
  const { uiSettings } = useGlobal();
  const t = (key: string) => getTranslation(uiSettings.language, key);
  const [modelsResp, setModelsResp] = useState<ModelListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchModels = async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl("/api/v1/settings/models"));
      if (res.ok) {
        const data: ModelListResponse = await res.json();
        setModelsResp(data);
      } else {
        setError("Failed to load models");
      }
    } catch {
      setError("Failed to connect to backend");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModels();
  }, []);

  const applyModel = async (modelName: string) => {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(apiUrl("/api/v1/settings/model"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: modelName }),
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "Failed to set model");
      }
    } catch (err: any) {
      setError(err.message || "Failed to set model");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="h-[calc(100vh-4rem)] overflow-y-auto animate-fade-in">
      <div className="max-w-4xl mx-auto p-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/30 rounded-xl">
              <Brain className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
              {t("Model Selection")}
            </h1>
          </div>
          <span className="text-xs bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 px-2 py-1 rounded">
            {modelsResp?.binding || "unknown"}
          </span>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-center gap-3 text-red-700 dark:text-red-400 font-medium">
            <AlertCircle className="w-5 h-5" />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="h-[50vh] flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {(modelsResp?.models || []).map((m) => (
              <div
                key={m.name}
                className="p-4 rounded-xl border bg-slate-50 dark:bg-slate-700/40 border-slate-200 dark:border-slate-600 flex items-center justify-between"
              >
                <div>
                  <p className="font-mono text-sm text-slate-900 dark:text-slate-100">
                    {m.name}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {m.source}
                  </p>
                </div>
                <button
                  onClick={() => applyModel(m.name)}
                  disabled={saving}
                  className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg"
                >
                  {t("Use This")}
                </button>
              </div>
            ))}
            {(!modelsResp || modelsResp.models.length === 0) && (
              <div className="text-sm text-slate-600 dark:text-slate-300">
                {t("No local models found. Please pull models in Ollama.")}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
