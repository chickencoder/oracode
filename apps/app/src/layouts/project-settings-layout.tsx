import { Outlet, useParams, useLocation, Link } from "react-router";
import { Settings, Code, KeySquare } from "lucide-react";

const settingsNav = [
  { name: "General", href: "", icon: Settings },
  { name: "Development", href: "/development", icon: Code },
  { name: "Environment Variables", href: "/environment", icon: KeySquare },
];

export function ProjectSettingsLayout() {
  const { orgSlug, projectId } = useParams<{
    orgSlug: string;
    projectId: string;
  }>();
  const location = useLocation();

  // Determine the active page based on the current path
  const basePath = `/${orgSlug}/project/${projectId}/settings`;
  const currentPath = location.pathname;

  const getActivePage = () => {
    if (currentPath === basePath) return "General";
    if (currentPath.endsWith("/development")) return "Development";
    if (currentPath.endsWith("/environment")) return "Environment Variables";
    return "General";
  };

  const activePage = getActivePage();

  return (
    <div className="flex gap-6 p-4 max-w-7xl mx-auto">
      {/* Sidebar Navigation */}
      <aside className="w-64 shrink-0">
        <nav className="space-y-1">
          {settingsNav.map((item) => {
            const isActive = item.name === activePage;
            return (
              <Link
                key={item.name}
                to={`${basePath}${item.href}`}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                }`}
              >
                <item.icon className="h-4 w-4" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0">
        <Outlet />
      </main>
    </div>
  );
}
