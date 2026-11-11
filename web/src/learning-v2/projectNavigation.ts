import type { Project, Lang } from "./types";
export function projectSelection(projects: Project[], search: string) {
  const params = new URLSearchParams(search),
    requestedMission = params.get("mission"),
    requestedProject = params.get("project");
  const byMission = requestedMission
    ? projects.findIndex((p) =>
        p.missions.some((m) => m.id === requestedMission),
      )
    : -1;
  const byProject = requestedProject
    ? projects.findIndex((p) => p.id === requestedProject)
    : -1;
  const projectIndex = Math.max(0, byMission >= 0 ? byMission : byProject);
  const missionIndex = Math.max(
    0,
    projects[projectIndex]?.missions.findIndex(
      (m) => m.id === requestedMission,
    ) ?? 0,
  );
  return {
    projectIndex,
    missionIndex,
    missing: !!requestedMission && byMission < 0,
  };
}
export function projectHref(language: Lang, project: string, mission?: string) {
  return (
    "/learn?" +
    new URLSearchParams({
      section: "projects",
      lang: language,
      project,
      ...(mission ? { mission } : {}),
    })
  );
}
