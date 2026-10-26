import React from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  FileUp,
  FileText,
  FlaskConical,
  Sparkles,
  CheckCircle2,
  Network,
  History,
} from "lucide-react";

/** Navigation entries; `section` starts a labelled group. Keep in sync with routes in App.tsx. */
const LINKS = [
  { path: "/", label: "Übersicht", Icon: LayoutDashboard },
  { path: "/documents", label: "Dokumente & Extraktion", Icon: FileUp, section: "ABLAUF" },
  { path: "/requirements", label: "Anforderungen", Icon: FileText },
  { path: "/generate", label: "Testfall-Generator", Icon: Sparkles },
  { path: "/tests", label: "Testfälle", Icon: FlaskConical },
  { path: "/validation", label: "Validierung & Bericht", Icon: CheckCircle2 },
  { path: "/graph", label: "Nachverfolgbarkeit", Icon: Network, section: "NACHWEIS" },
  { path: "/changelog", label: "Änderungsprotokoll", Icon: History },
] as const;

export function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brandmark">P</span>
        <div>
          <strong>Prüfassistent</strong>
          <small>Systemprüfung · DTA EEL</small>
        </div>
      </div>
      <nav>
        {LINKS.map((link) => (
          <React.Fragment key={link.path}>
            {"section" in link && <div className="navlabel">{link.section}</div>}
            <NavLink
              end={link.path === "/"}
              to={link.path}
              className={({ isActive }) => "navlink " + (isActive ? "active" : "")}
            >
              <link.Icon size={17} />
              {link.label}
            </NavLink>
          </React.Fragment>
        ))}
      </nav>
      <div className="account">
        <span className="avatar">SP</span>
        <div>
          Systemprüfer/in<small>Prototyp · ITSG Futury Hackathon</small>
        </div>
      </div>
    </aside>
  );
}
