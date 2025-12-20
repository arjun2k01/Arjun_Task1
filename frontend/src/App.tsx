import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { ThemeProvider } from './theme/ThemeProvider';
import { ToastProvider } from './components/common/ToastProvider';

import Sidebar from './components/layout/Sidebar';

// Pages
import WeatherUploadPage from './pages/Weather/WeatherUploadPage';
import WeatherListPage from './pages/Weather/WeatherListPage';
import MeterUploadPage from './pages/Meter/MeterUploadPage';
import MeterListPage from './pages/Meter/MeterListPage';
import MeterErrorPage from './pages/Meter/MeterErrorPage'; // Added Import
import WeatherErrorPage from './pages/Weather/WeatherErrorpage';

function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <BrowserRouter>
          <div className="min-h-screen bg-bg-light dark:bg-bg-dark transition-colors duration-300">
            <div className="flex min-h-screen">
              <Sidebar />

              <main className="flex-1 p-6 overflow-auto">
                <Routes>
                  <Route path="/" element={<Navigate to="/weather/upload" replace />} />

                  {/* Weather */}
                  <Route path="/weather/upload" element={<WeatherUploadPage />} />
                  <Route path="/weather/list" element={<WeatherListPage />} />
                  <Route path="/weather/errors" element={<WeatherErrorPage/>}/>

                  {/* Meter */}
                  <Route path="/meter/upload" element={<MeterUploadPage />} />
                  <Route path="/meter/errors" element={<MeterErrorPage />} /> {/* Added Route */}
                  <Route path="/meter/list" element={<MeterListPage />} />

                  {/* Fallback */}
                  <Route
                    path="*"
                    element={
                      <div className="surface p-6">
                        <h2 className="mb-2">Page not found</h2>
                        <p>The page you are trying to access does not exist.</p>
                      </div>
                    }
                  />
                </Routes>
              </main>
            </div>
          </div>
        </BrowserRouter>
      </ToastProvider>
    </ThemeProvider>
  );
}

export default App;