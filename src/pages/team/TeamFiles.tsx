import { AdminFiles } from "@/pages/admin/AdminFiles";
import { useTeamWork } from "@/components/team/useTeamWork";

export function TeamFiles() {
  const { myProjects } = useTeamWork();
  return (
    <AdminFiles
      projectBasePath="/team/projects"
      projectsHref="/team/projects"
      restrictToProjectIds={myProjects.map((project) => project.id)}
    />
  );
}
