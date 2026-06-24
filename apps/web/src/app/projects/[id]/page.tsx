import { ProjectDetailClient } from '@/components/projects/ProjectDetailClient'

type PageProps = {
  params: {
    id: string
  }
}

export default function ProjectDetailPage({ params }: PageProps) {
  return <ProjectDetailClient projectId={params.id} />
}
