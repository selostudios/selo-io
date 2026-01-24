import { getPageSpeedData } from './actions'
import { PerformanceDashboard } from '@/components/performance/performance-dashboard'
import { ProjectSelector } from '@/components/seo/project-selector'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Gauge } from 'lucide-react'

interface PageProps {
  searchParams: Promise<{ project?: string; url?: string }>
}

export default async function PageSpeedPage({ searchParams }: PageProps) {
  const { project: projectId, url: initialUrl } = await searchParams
  const { audits, monitoredPages, projects } = await getPageSpeedData(projectId)

  // Find the selected project
  const selectedProject = projectId ? projects.find((p) => p.id === projectId) : null

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex items-start gap-3">
        <Gauge className="h-8 w-8 text-neutral-700 mt-1" />
        <div>
          <h1 className="text-3xl font-bold">Page Speed</h1>
          <p className="text-muted-foreground">
            Measure Core Web Vitals, load times, and performance scores using Google PageSpeed Insights
          </p>
        </div>
      </div>

      {/* Project Selector Header */}
      <div className="flex items-center justify-between">
        <ProjectSelector
          projects={projects}
          selectedProjectId={projectId}
          basePath="/seo/page-speed"
        />
      </div>

      {/* If no projects exist, show setup message */}
      {projects.length === 0 && (
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100">
              <Gauge className="h-6 w-6 text-neutral-600" />
            </div>
            <CardTitle>No Projects Yet</CardTitle>
            <CardDescription>
              Create a project to start running page speed audits. Projects let you organize audits for different websites.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground">
              Click the project selector above to create your first project.
            </p>
          </CardContent>
        </Card>
      )}

      {/* If projects exist but none selected, prompt to select one */}
      {projects.length > 0 && !projectId && (
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100">
              <Gauge className="h-6 w-6 text-neutral-600" />
            </div>
            <CardTitle>Select a Project</CardTitle>
            <CardDescription>
              Choose a project from the selector above to view its page speed audits.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Project not found */}
      {projectId && !selectedProject && (
        <Card>
          <CardHeader className="text-center">
            <CardTitle>Project Not Found</CardTitle>
            <CardDescription>
              The selected project could not be found. Please select another project.
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Show dashboard when project is selected */}
      {selectedProject && (
        <PerformanceDashboard
          audits={audits}
          monitoredPages={monitoredPages}
          websiteUrl={selectedProject.url}
          initialUrl={initialUrl}
          projectId={selectedProject.id}
        />
      )}
    </div>
  )
}
