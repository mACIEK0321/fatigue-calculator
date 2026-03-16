"use client";

import { Activity } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import AnalysisEngine from "@/components/analysis/AnalysisEngine";
import ResearchContent from "@/components/research/ResearchContent";
import WorkflowPipeline from "@/components/workflow/WorkflowPipeline";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-6 py-4">
          <div className="rounded-lg bg-blue-600 p-2">
            <Activity className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">FatigueMaster Pro</h1>
            <p className="text-xs text-slate-400">
              Industrial Fatigue Life Estimation Platform
            </p>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="mx-auto max-w-7xl px-6 py-6">
        <Tabs defaultValue="research">
          <TabsList className="mb-6">
            <TabsTrigger value="research">Research &amp; Problem Definition</TabsTrigger>
            <TabsTrigger value="analysis">Core Analysis Engine</TabsTrigger>
            <TabsTrigger value="workflow">Workflow Pipeline</TabsTrigger>
          </TabsList>

          <TabsContent value="research">
            <ResearchContent />
          </TabsContent>

          <TabsContent value="analysis">
            <AnalysisEngine />
          </TabsContent>

          <TabsContent value="workflow">
            <WorkflowPipeline />
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}
