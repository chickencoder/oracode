import { Outlet, useParams, useLocation, Link } from "react-router";
import { Settings } from "lucide-react";

const settingsNav = [
  { name: "General", href: "", icon: Settings, type: "item" as const },
  { name: "Agents", type: "label" as const },
  { name: "Claude Code", href: "/claude-code", iconImage: "/claude.png", type: "item" as const },
];

export function OrgSettingsLayout() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const location = useLocation();

  // Determine the active page based on the current path
  const basePath = `/${orgSlug}/settings`;
  const currentPath = location.pathname;

  const getActivePage = () => {
    if (currentPath === basePath) return "General";
    if (currentPath.endsWith("/claude-code")) return "Claude Code";
    return "General";
  };

  const activePage = getActivePage();

  return (
    <div className="flex gap-6 p-4 max-w-7xl mx-auto">
      {/* Sidebar Navigation */}
      <aside className="w-64 shrink-0">
        <nav className="space-y-1">
          {settingsNav.map((item, index) => {
            if (item.type === "label") {
              return (
                <div
                  key={item.name}
                  className="px-3 pt-4 pb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider"
                >
                  {item.name}
                </div>
              );
            }

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
                {item.icon && <item.icon className="h-4 w-4" />}
                {item.iconImage && (
                  <img src={item.iconImage} alt="" className="h-4 w-4" />
                )}
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
