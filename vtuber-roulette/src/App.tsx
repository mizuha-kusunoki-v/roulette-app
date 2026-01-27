import { BrowserRouter, Routes, Route } from "react-router-dom";
import AdminApp from "./AdminApp";
import { ViewerPage } from "./viewer/ViewerPage";

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AdminApp />} />
        <Route path="/viewer" element={<ViewerPage />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;