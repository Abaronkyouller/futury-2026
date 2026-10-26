import React from "react";
import { Link, NavLink } from "react-router-dom";
import logoUrl from "../assets/logo.png";
import {
  LayoutDashboard,
  FileUp,
  FlaskConical,
  Sparkles,
  CheckCircle2,
  Network,
  History,
} from "lucide-react";

/** Navigation entries; `section` starts a labelled group. Keep in sync with routes in App.tsx. */
const LINKS = [
  { path: "/", label: "Übersicht", Icon: LayoutDashboard },
  { path: "/documents", label: "Dokumente & Testfälle", Icon: FileUp, section: "ABLAUF" },
  { path: "/generate", label: "Testfall-Generator", Icon: Sparkles },
  { path: "/tests", label: "Testfälle", Icon: FlaskConical },
  { path: "/validation", label: "Validierung & Bericht", Icon: CheckCircle2 },
  { path: "/graph", label: "Nachverfolgbarkeit", Icon: Network, section: "NACHWEIS" },
  { path: "/changelog", label: "Änderungsprotokoll", Icon: History },
] as const;

export function Sidebar() {
  return (
    <aside className="sidebar">
      <Link to="/" className="brand" aria-label="Zur Übersicht">
        <span className="brandmark">P</span>
        <div>
          <img className="brandlogo" src={logoUrl} alt="Prüfassistent" />
        </div>
      </Link>
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
