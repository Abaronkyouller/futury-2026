import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { Overview } from "./pages/Overview";
import { DocumentsPage } from "./pages/DocumentsPage";
import { Tests } from "./pages/Tests";
import { Generator } from "./pages/Generator";
import { Validation } from "./pages/Validation";
import { GraphPage } from "./pages/GraphPage";
import { ChangeLog } from "./pages/ChangeLog";
import { FeedbackPage } from "./pages/FeedbackPage";
import { TestReportPage } from "./pages/TestReportPage";
import { SoftwarePage } from "./pages/SoftwarePage";
import { CoveragePage } from "./pages/CoveragePage";
import { ReviewProvider } from "./state/ReviewProvider";
import { DocumentProvider } from "./state/DocumentProvider";
import { ConfirmProvider } from "./components/ConfirmDialog";

export function App() {
  return (
    <ReviewProvider>
      {/* DocumentProvider logs to the change log, so it sits inside ReviewProvider. */}
      <DocumentProvider>
        <ConfirmProvider>
        <BrowserRouter>
          <div className="layout">
            <Sidebar />
            <main>
              <Routes>
                <Route path="/" element={<Overview />} />
                <Route path="/documents" element={<DocumentsPage />} />
                {/* Former static "Specification library"; kept so old links still work. */}
                <Route path="/library" element={<DocumentsPage />} />
                <Route path="/requirements" element={<Navigate to="/documents" replace />} />
                <Route path="/generate" element={<Generator />} />
                <Route path="/tests" element={<Tests />} />
                <Route path="/validation" element={<Validation />} />
                <Route path="/testbericht" element={<TestReportPage />} />
                <Route path="/software" element={<SoftwarePage />} />
                <Route path="/graph" element={<GraphPage />} />
                <Route path="/abdeckung" element={<CoveragePage />} />
                <Route path="/feedback" element={<FeedbackPage />} />
                <Route path="/changelog" element={<ChangeLog />} />
                <Route path="*" element={<Overview />} />
              </Routes>
            </main>
          </div>
        </BrowserRouter>
        </ConfirmProvider>
      </DocumentProvider>
    </ReviewProvider>
  );
}
