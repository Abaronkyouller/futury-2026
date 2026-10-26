import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Sidebar } from "./components/Sidebar";
import { Overview } from "./pages/Overview";
import { Requirements } from "./pages/Requirements";
import { Tests } from "./pages/Tests";
import { Generator } from "./pages/Generator";
import { Validation } from "./pages/Validation";
import { LibraryPage } from "./pages/LibraryPage";
import { GraphPage } from "./pages/GraphPage";
import { ChangeLog } from "./pages/ChangeLog";
import { ReviewProvider } from "./state/ReviewProvider";

export function App() {
  return (
    <ReviewProvider>
      <BrowserRouter>
        <div className="layout">
          <Sidebar />
          <main>
            <Routes>
              <Route path="/" element={<Overview />} />
              <Route path="/requirements" element={<Requirements />} />
              <Route path="/tests" element={<Tests />} />
              <Route path="/generate" element={<Generator />} />
              <Route path="/validation" element={<Validation />} />
              <Route path="/library" element={<LibraryPage />} />
              <Route path="/graph" element={<GraphPage />} />
              <Route path="/changelog" element={<ChangeLog />} />
              <Route path="*" element={<Overview />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </ReviewProvider>
  );
}
