import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import AdminApp from "./AdminApp";
import { ResultViewerPage } from "./viewer/ResultViewerPage";
import { RouletteViewerPage } from "./viewer/RouletteViewerPage";

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AdminApp />} />
        <Route path="/viewer" element={<Navigate to="/viewer/result" replace />} />
        <Route path="/viewer/result" element={<ResultViewerPage />} />
        <Route path="/viewer/roulette" element={<RouletteViewerPage />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
