import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { Overview } from "./pages/Overview";
import { DocumentsPage } from "./pages/DocumentsPage";
import { Requirements } from "./pages/Requirements";
import { Tests } from "./pages/Tests";
import { Generator } from "./pages/Generator";
import { Validation } from "./pages/Validation";
import { GraphPage } from "./pages/GraphPage";
import { ChangeLog } from "./pages/ChangeLog";
import { ReviewProvider } from "./state/ReviewProvider";
import { DocumentProvider } from "./state/DocumentProvider";

export function App() {
  return (
    <ReviewProvider>
      {/* DocumentProvider logs to the change log, so it sits inside ReviewProvider. */}
      <DocumentProvider>
        <BrowserRouter>
          <div className="layout">
            <Sidebar />
            <main>
              <Routes>
                <Route path="/" element={<Overview />} />
                <Route path="/documents" element={<DocumentsPage />} />
                {/* Former static "Specification library"; kept so old links still work. */}
                <Route path="/library" element={<DocumentsPage />} />
                <Route path="/requirements" element={<Requirements />} />
                <Route path="/generate" element={<Generator />} />
                <Route path="/tests" element={<Tests />} />
                <Route path="/validation" element={<Validation />} />
                <Route path="/graph" element={<GraphPage />} />
                <Route path="/changelog" element={<ChangeLog />} />
                <Route path="*" element={<Overview />} />
              </Routes>
            </main>
          </div>
        </BrowserRouter>
      </DocumentProvider>
    </ReviewProvider>
  );
}
