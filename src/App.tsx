import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import InvoiceList from './pages/InvoiceList';
import CreateInvoice from './pages/CreateInvoice';
import { DriveProvider } from './services/DriveContext';
import { Toaster } from 'react-hot-toast';

function App() {
  return (
    <DriveProvider>
      <Toaster position="top-center" />
      <Router>
        <Routes>
          <Route path="/" element={<InvoiceList />} />
          <Route path="/create" element={<CreateInvoice />} />
        </Routes>
        <footer className="bg-slate-50 text-center py-6 text-slate-400 text-sm font-medium">
          Copyright &copy; 2026 Company Name. All rights reserved. Developed by{' '}
          <a
            href="https://intinf.in"
            target="_blank"
            rel="noopener noreferrer"
            className="text-slate-600 hover:text-blue-600 font-bold transition-colors"
          >
            IntInf
          </a>
        </footer>
      </Router>
    </DriveProvider>
  );
}

export default App;
