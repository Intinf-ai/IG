import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, Plus, Loader2, LogIn, Search } from 'lucide-react';
import { useDrive } from '../services/useDrive';
import type { DriveFile } from '../services/google-drive-service';

export default function InvoiceList() {
  const { isSignedIn, signIn, listPDFs, isInitialized } = useDrive();
  const [invoices, setInvoices] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>(undefined);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!isInitialized) return;

    if (!isSignedIn) {
      setLoading(false);
      return;
    }

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, isInitialized]);

  // Load data function
  const loadData = async (token?: string, query?: string) => {
    try {
      if (token) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      // Fetch 12 items per page, pass current search term (or query)
      const fetchQuery = query !== undefined ? query : searchTerm;
      const { files, nextPageToken: newToken } = await listPDFs(12, token, fetchQuery);

      if (token) {
        setInvoices(prev => [...prev, ...files]);
      } else {
        setInvoices(files);
      }
      setNextPageToken(newToken);

    } catch (error) {
      console.error('Failed to load invoices:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleLoadMore = () => {
    if (nextPageToken) {
      loadData(nextPageToken);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    // Reset list and load with new search term
    setNextPageToken(undefined);
    loadData(undefined, searchTerm);
  };

  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="animate-spin" style={{ color: '#8B0000' }} size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Company Header - Matches Invoice Design */}
        <div className="bg-white rounded-xl p-6 mb-8 border border-slate-200 shadow-sm">
          {/* Top info bar - GSTIN, PAN, State */}
          <div className="flex justify-between items-center mb-4 text-xs text-slate-600 flex-wrap gap-2">
            <span>GSTIN : Gst No</span>
            <span>PAN No. : Pan No</span>
            <span>State Name : TAMIL NADU</span>
            <span>Code : Number</span>
          </div>

          {/* Company Name - Maroon/Brown color */}
          <h1 className="text-4xl font-bold mb-3 text-center" style={{ color: '#8B0000' }}>
            Company Name
          </h1>

          {/* Company Address and Contact Details */}
          <div className="text-center space-y-1">
            <p className="text-sm text-slate-800">
              No.4,Sruthi Complex, Sai Kovil Street, Sai Nagar, chennai - 641 009.
            </p>
            <p className="text-xs text-slate-700">
              Cell : 998877556652 
            </p>
            <p className="text-xs text-slate-700">
              E-mail : example@gmail.com
            </p>
          </div>

          {/* Availability message */}
          <p className="text-xs font-semibold text-center mt-3 text-slate-800">
            AVAILABLE IN ALL TYPES OF A/C - NON A/C TOURIST VEHICLES
          </p>

          {/* Divider Line */}
          <div className="border-t-2 border-slate-300 mt-4"></div>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Invoices</h2>
            <p className="text-slate-500 mt-1">Manage your travel invoices</p>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            {/* Search Bar */}
            <form onSubmit={handleSearch} className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Search invoices..."
                className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 outline-none text-sm"
                style={{ '--tw-ring-color': '#8B0000' } as React.CSSProperties}
                value={searchTerm}
                onChange={(e) => {
                  const val = e.target.value;
                  setSearchTerm(val);
                  if (val.trim() === '') {
                    setNextPageToken(undefined);
                    loadData(undefined, '');
                  }
                }}
              />
            </form>

            <Link
              to="/create"
              className="flex items-center gap-2 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm whitespace-nowrap"
              style={{ backgroundColor: '#8B0000' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#A52A2A')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#8B0000')}
            >
              <Plus size={20} />
              New Invoice
            </Link>
          </div>
        </div>

        {!isSignedIn ? (
          <div className="bg-white p-12 rounded-xl border border-slate-200 shadow-sm text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#FFF5F5', color: '#8B0000' }}>
              <LogIn size={32} />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 mb-2">Connect to Google Drive</h2>
            <p className="text-slate-500 mb-6 max-w-md mx-auto">
              Sign in with your Google account to view and manage your invoices stored in Google Drive.
            </p>
            <button
              onClick={() => signIn()}
              className="inline-flex items-center gap-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 px-6 py-2.5 rounded-lg font-medium transition-colors"
            >
              <img src="https://www.svgrepo.com/show/475656/google-color.svg" className="w-5 h-5" alt="Google" />
              Sign in with Google
            </button>
          </div>
        ) : (
          <>
            {loading ? (
              <div className="flex justify-center items-center h-64">
                <Loader2 className="animate-spin" style={{ color: '#8B0000' }} size={32} />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                {invoices.length === 0 ? (
                  <div className="col-span-full text-center py-12 text-slate-500 bg-white rounded-xl border border-slate-200 border-dashed">
                    No invoices found. Create one to get started!
                  </div>
                ) : (
                  invoices.map((file) => (
                    <div
                      key={file.id}
                      className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group"
                    >
                      <div className="flex items-start justify-between">
                        <div className="p-3 bg-red-50 text-red-600 rounded-lg group-hover:scale-110 transition-transform">
                          <FileText size={24} />
                        </div>
                        <span className="text-xs font-medium text-slate-400">
                          {file.createdTime ? new Date(file.createdTime).toLocaleDateString() : 'N/A'}
                        </span>
                      </div>
                      <h3 className="mt-4 font-semibold text-slate-900 truncate" title={file.name}>
                        {file.name}
                      </h3>
                      <div className="mt-4 flex gap-2">
                        <a
                          href={file.webViewLink}
                          target="_blank"
                          rel="noreferrer"
                          className="flex-1 px-3 py-2 text-sm font-medium text-center text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                        >
                          View
                        </a>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Pagination / Load More */}
            {nextPageToken && !loading && (
              <div className="flex justify-center pb-8">
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="flex items-center gap-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 px-6 py-2.5 rounded-full font-medium transition-colors shadow-sm disabled:opacity-50"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Load More Invoices'
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
