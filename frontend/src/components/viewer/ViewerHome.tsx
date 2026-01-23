import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import {
  BarChart3,
  Eye,
  Clock,
  TrendingUp,
  Search,
  Star,
  Loader2,
} from 'lucide-react';
import { apiGet } from '../../lib/api';

interface Dashboard {
  id: number;
  name: string;
  description: string | null;
  config: string | object;
  created_by: number;
  created_by_email?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  permission_type?: 'view' | 'edit';
}

export default function ViewerHome() {
  const navigate = useNavigate();
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [favorites, setFavorites] = useState<string[]>([]);

  const fetchDashboards = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiGet<Dashboard[]>('/api/dashboards');
      if (res.success && res.data) {
        setDashboards(Array.isArray(res.data) ? res.data : []);
      } else {
        setDashboards([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch dashboards');
      setDashboards([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboards();
  }, [fetchDashboards]);

  const filteredDashboards = dashboards.filter(
    (d) =>
      d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (d.description ?? '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const sortedDashboards = [...filteredDashboards].sort((a, b) => {
    const aFav = favorites.includes(String(a.id));
    const bFav = favorites.includes(String(b.id));
    if (aFav && !bFav) return -1;
    if (!aFav && bFav) return 1;
    return 0;
  });

  const widgetCount = (d: Dashboard) => {
    if (!d.config) return 0;
    try {
      const c = typeof d.config === 'string' ? JSON.parse(d.config) : d.config;
      const w = (c as { widgets?: unknown[] }).widgets;
      return Array.isArray(w) ? w.length : 0;
    } catch {
      return 0;
    }
  };

  const toggleFavorite = (dashboardId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites((prev) =>
      prev.includes(dashboardId)
        ? prev.filter((id) => id !== dashboardId)
        : [...prev, dashboardId]
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-6">
        <div className="flex-shrink-0">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Dashboards</h1>
          <p className="text-gray-600">Access your assigned analytics dashboards</p>
        </div>
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search dashboards..."
              className="w-full pl-12 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none bg-white shadow-sm"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Available Dashboards</p>
              <p className="text-3xl font-bold text-gray-900">
                {loading ? '—' : dashboards.length}
              </p>
            </div>
            <BarChart3 className="w-12 h-12 text-green-400" />
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Favorites</p>
              <p className="text-3xl font-bold text-gray-900">{favorites.length}</p>
            </div>
            <Star className="w-12 h-12 text-yellow-400" />
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Recently Viewed</p>
              <p className="text-3xl font-bold text-gray-900">—</p>
            </div>
            <Clock className="w-12 h-12 text-blue-400" />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-10 h-10 text-green-500 animate-spin" />
        </div>
      ) : (
        <>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Your Dashboards</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedDashboards.map((d) => {
                const isFavorite = favorites.includes(String(d.id));
                return (
                  <div
                    key={d.id}
                    onClick={() => navigate(`/viewer/view/${d.id}`)}
                    className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-all cursor-pointer group relative"
                  >
                    <button
                      onClick={(e) => toggleFavorite(String(d.id), e)}
                      className={`absolute top-3 right-3 z-10 p-2 rounded-full transition-all ${
                        isFavorite
                          ? 'bg-yellow-100 text-yellow-500 hover:bg-yellow-200'
                          : 'bg-white/90 text-gray-400 hover:bg-white hover:text-yellow-500'
                      }`}
                    >
                      <Star
                        className={`w-5 h-5 ${isFavorite ? 'fill-yellow-500' : ''}`}
                      />
                    </button>
                    <div className="h-40 bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center border-b border-gray-200">
                      <BarChart3 className="w-16 h-16 text-green-600 opacity-50 group-hover:opacity-100 transition-opacity" />
                    </div>
                    <div className="p-6">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2 group-hover:text-green-600 transition-colors">
                        {d.name}
                      </h3>
                      <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                        {d.description || 'No description'}
                      </p>
                      <div className="flex items-center justify-between text-sm text-gray-500">
                        <div className="flex items-center">
                          <Star
                            className={`w-4 h-4 mr-1 ${
                              isFavorite ? 'fill-yellow-500 text-yellow-500' : ''
                            }`}
                          />
                          <span>
                            {isFavorite ? 'Favorited' : 'Add to favorites'}
                          </span>
                        </div>
                        <div className="flex items-center">
                          <BarChart3 className="w-4 h-4 mr-1" />
                          <span>{widgetCount(d)} widgets</span>
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t border-gray-200">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/viewer/view/${d.id}`);
                          }}
                          className="w-full flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View Dashboard
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {filteredDashboards.length === 0 && (
            <div className="bg-white rounded-xl p-12 text-center border border-gray-200">
              <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Dashboards Found</h3>
              <p className="text-gray-600">
                {searchTerm
                  ? 'Try adjusting your search terms'
                  : 'No dashboards have been assigned to you yet'}
              </p>
            </div>
          )}
        </>
      )}

      {/* Quick Tips */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Tips</h2>
        <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl p-6 shadow-sm text-white">
          <div className="flex items-start">
            <div className="bg-white/20 p-3 rounded-lg mr-4">
              <Star className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold mb-2 text-lg">
                Star Your Favorite Dashboards
              </h3>
              <p className="text-green-50 mb-3">
                Click the star icon on any dashboard card to mark it as a favorite.
                Your starred dashboards appear at the top for quick access.
              </p>
              <ul className="space-y-2 text-green-50">
                <li className="flex items-center">
                  <span className="mr-2">•</span>
                  <span>Use the search bar to find specific dashboards</span>
                </li>
                <li className="flex items-center">
                  <span className="mr-2">•</span>
                  <span>Dashboards update with the latest data</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
