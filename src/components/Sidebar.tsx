import React from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  FlaskConical,
  Sparkles,
  CheckCircle2,
  Library,
  Network,
  History,
} from "lucide-react";

/** Navigation entries; `section` starts a labelled group. Keep in sync with routes in App.tsx. */
const LINKS = [
  { path: "/", label: "Overview", Icon: LayoutDashboard },
  { path: "/requirements", label: "Requirements & rules", Icon: FileText },
  { path: "/tests", label: "Test cases", Icon: FlaskConical },
  { path: "/generate", label: "AI test generator", Icon: Sparkles },
  { path: "/validation", label: "Validation & report", Icon: CheckCircle2 },
  { path: "/library", label: "Specification library", Icon: Library, section: "KNOWLEDGE" },
  { path: "/graph", label: "Traceability graph", Icon: Network },
  { path: "/changelog", label: "Change log", Icon: History },
] as const;

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brandmark">R</span>
        <div>
          <strong>Review Assistant</strong>
          <small>System review · EEL</small>
        </div>
      </div>
      <nav>
        {LINKS.map((link) => (
          <React.Fragment key={link.path}>
            {"section" in link && <div className="navlabel">{link.section}</div>}
            <NavLink
              end={link.path === "/"}
              to={link.path}
              className={({ isActive }) =>
                "navlink " + (isActive ? "active" : "")
              }
            >
              <link.Icon size={17} />
              {link.label}
            </NavLink>
          </React.Fragment>
        ))}
      </nav>
      <div className="account">
        <span className="avatar">SE</span>
        <div>
          System examiner<small>ITSG</small>
        </div>
      </div>
    </aside>
  );
}
