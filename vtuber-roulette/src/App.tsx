import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import AdminApp from "./AdminApp";
import RestrictionAdminApp from "./restriction/RestrictionAdminApp";
import { ResultViewerPage } from "./viewer/ResultViewerPage";
import { RouletteViewerPage } from "./viewer/RouletteViewerPage";
import { RestrictionViewerPage } from "./viewer/RestrictionViewerPage";
import { RestrictionResultViewerPage } from "./viewer/RestrictionResultViewerPage";

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AdminApp />} />
        <Route path="/restriction" element={<RestrictionAdminApp />} />
        <Route path="/viewer" element={<Navigate to="/viewer/result" replace />} />
        <Route path="/viewer/result" element={<ResultViewerPage />} />
        <Route path="/viewer/roulette" element={<RouletteViewerPage />} />
        <Route path="/viewer/restriction" element={<Navigate to="/viewer/restriction/roulette" replace />} />
        <Route path="/viewer/restriction/roulette" element={<RestrictionViewerPage />} />
        <Route path="/viewer/restriction/result" element={<RestrictionResultViewerPage />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
