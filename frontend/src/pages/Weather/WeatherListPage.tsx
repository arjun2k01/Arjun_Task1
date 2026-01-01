import { useState, useEffect, useCallback, useMemo } from 'react';
import Topbar from '../../components/layout/Topbar';
import AnimatedButton from '../../components/common/AnimatedButton';
import LoadingOverlay from '../../components/common/LoadingOverlay';
import { useToast } from '../../components/common/ToastProvider';
import DataTable from '../../components/tables/DataTable';
import RecordModal from '../../components/modals/RecordModal';
import DeleteConfirmModal from '../../components/modals/DeleteConfirmModal';
import { apiUrl } from '../../config/api';

interface WeatherRecord {
  _id: string;
  siteName?: string;
  date: string;
  time: string;
  poa: number;
  ghi: number;
  albedoUp?: number;
  albedoDown?: number;
  moduleTemp: number;
  ambientTemp: number;
  windSpeed?: number;
  rainfall?: number;
  humidity?: number;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

const WEATHER_COLUMNS = [
  { key: 'date', label: 'Date', width: 100 },
  { key: 'siteName', label: 'Site Name', width: 140 },
  { key: 'time', label: 'Time', width: 80 },
  { key: 'poa', label: 'POA (W/m²)', width: 100 },
  { key: 'ghi', label: 'GHI (W/m²)', width: 100 },
  { key: 'moduleTemp', label: 'Module Temp (°C)', width: 130 },
  { key: 'ambientTemp', label: 'Ambient Temp (°C)', width: 130 },
  { key: 'windSpeed', label: 'Wind Speed', width: 100 },
  { key: 'humidity', label: 'Humidity (%)', width: 100 },
  { key: 'status', label: 'Status', width: 80 },
];

const WEATHER_FIELDS = [
  { key: 'siteName', label: 'Site Name', type: 'text' as const, required: false, placeholder: 'Site A' },
  { key: 'date', label: 'Date', type: 'text' as const, required: true, placeholder: 'DD-MMM-YY (e.g., 01-Dec-24)' },
  { key: 'time', label: 'Time', type: 'text' as const, required: true, placeholder: 'HH:MM (e.g., 09:30)' },
  { key: 'poa', label: 'POA (W/m²)', type: 'number' as const, required: true, min: 0, max: 1500 },
  { key: 'ghi', label: 'GHI (W/m²)', type: 'number' as const, required: true, min: 0, max: 1500 },
  { key: 'albedoUp', label: 'Albedo Up (W/m²)', type: 'number' as const, required: false, min: 0, max: 1500 },
  { key: 'albedoDown', label: 'Albedo Down (W/m²)', type: 'number' as const, required: false, min: 0, max: 1500 },
  { key: 'moduleTemp', label: 'Module Temp (°C)', type: 'number' as const, required: true, min: 0.01, max: 100 },
  { key: 'ambientTemp', label: 'Ambient Temp (°C)', type: 'number' as const, required: true, min: 0, max: 100 },
  { key: 'windSpeed', label: 'Wind Speed', type: 'number' as const, required: false, min: 0, max: 200 },
  { key: 'rainfall', label: 'Rainfall', type: 'number' as const, required: false, min: 0, max: 500 },
  { key: 'humidity', label: 'Humidity (%)', type: 'number' as const, required: false, min: 0, max: 100 },
  { key: 'status', label: 'Status', type: 'text' as const, required: false, placeholder: 'draft' },
];

const DEFAULT_PAGE_SIZE = 20;
const FETCH_BATCH_SIZE = 200;
const SITE_ALL = 'all';
const SITE_UNASSIGNED = '__unassigned';

export default function WeatherListPage() {
  const { pushToast } = useToast();

  const [data, setData] = useState<WeatherRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(DEFAULT_PAGE_SIZE);
  const [siteFilter, setSiteFilter] = useState(SITE_ALL);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<WeatherRecord | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let skip = 0;
      let totalCount = 0;
      const rows: WeatherRecord[] = [];

      while (true) {
        const res = await fetch(apiUrl(`/weather?limit=${FETCH_BATCH_SIZE}&skip=${skip}`));
        if (!res.ok) throw new Error('Failed to fetch');
        const result = await res.json();

        const batch = Array.isArray(result.data) ? result.data : [];
        const totalValue = Number(result.total);
        if (Number.isFinite(totalValue)) {
          totalCount = totalValue;
        }

        rows.push(...batch);

        if (batch.length === 0 || batch.length < FETCH_BATCH_SIZE) {
          break;
        }

        if (totalCount > 0 && rows.length >= totalCount) {
          break;
        }

        skip += batch.length;
      }

      setData(rows);
      setTotal(totalCount > 0 ? totalCount : rows.length);
    } catch (err: any) {
      pushToast({ type: 'error', title: 'Failed to load data', message: err.message });
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setPage(1);
  }, [siteFilter]);

  const siteOptions = useMemo(() => {
    const names = new Set<string>();
    data.forEach((row) => {
      const name = row.siteName ? row.siteName.trim() : '';
      if (name) {
        names.add(name);
      }
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [data]);

  const hasUnassigned = useMemo(
    () => data.some((row) => !row.siteName || row.siteName.trim() === ''),
    [data],
  );

  useEffect(() => {
    if (siteFilter === SITE_ALL) return;
    if (siteFilter === SITE_UNASSIGNED) {
      if (!hasUnassigned) setSiteFilter(SITE_ALL);
      return;
    }
    if (!siteOptions.includes(siteFilter)) {
      setSiteFilter(SITE_ALL);
    }
  }, [hasUnassigned, siteFilter, siteOptions]);

  const filteredData = useMemo(() => {
    if (siteFilter === SITE_ALL) return data;
    if (siteFilter === SITE_UNASSIGNED) {
      return data.filter((row) => !row.siteName || row.siteName.trim() === '');
    }
    return data.filter((row) => row.siteName && row.siteName.trim() === siteFilter);
  }, [data, siteFilter]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
    if (page > totalPages) {
      setPage(1);
    }
  }, [filteredData.length, page, pageSize]);

  const pagedData = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, page, pageSize]);

  const handleCreate = async (formData: Record<string, any>) => {
    try {
      const res = await fetch(apiUrl('/weather'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to create');
      }
      pushToast({ type: 'success', title: 'Record created successfully' });
      setShowCreateModal(false);
      fetchData();
    } catch (err: any) {
      pushToast({ type: 'error', title: 'Create failed', message: err.message });
    }
  };

  const handleEdit = async (formData: Record<string, any>) => {
    if (!selectedRecord) return;
    try {
      const res = await fetch(apiUrl(`/weather/${selectedRecord._id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || 'Failed to update');
      }
      pushToast({ type: 'success', title: 'Record updated successfully' });
      setShowEditModal(false);
      setSelectedRecord(null);
      fetchData();
    } catch (err: any) {
      pushToast({ type: 'error', title: 'Update failed', message: err.message });
    }
  };

  const handleDelete = async () => {
    try {
      if (selectedRecord) {
        const res = await fetch(apiUrl(`/weather/${selectedRecord._id}`), { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete');
        pushToast({ type: 'success', title: 'Record deleted successfully' });
      } else if (selectedIds.length > 0) {
        const res = await fetch(apiUrl('/weather/delete-many'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids: selectedIds }),
        });
        if (!res.ok) throw new Error('Failed to delete');
        pushToast({ type: 'success', title: `${selectedIds.length} records deleted` });
        setSelectedIds([]);
      }
      setShowDeleteModal(false);
      setSelectedRecord(null);
      fetchData();
    } catch (err: any) {
      pushToast({ type: 'error', title: 'Delete failed', message: err.message });
    }
  };

  const openEditModal = (record: WeatherRecord) => {
    setSelectedRecord(record);
    setShowEditModal(true);
  };

  const openDeleteModal = (record?: WeatherRecord) => {
    if (record) {
      setSelectedRecord(record);
      setSelectedIds([]);
    }
    setShowDeleteModal(true);
  };

  return (
    <div className="flex flex-col gap-6">
      <LoadingOverlay show={loading} title="Loading data..." />

      <Topbar title="Weather Data" subtitle="View, create, edit, and delete weather records" />

      <div className="surface p-6">
        <div className="flex items-center justify-between mb-4">
          <h3>Weather Records ({siteFilter === SITE_ALL ? total : filteredData.length} total)</h3>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted">Site</span>
              <select
                value={siteFilter}
                onChange={(e) => setSiteFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                aria-label="Filter by site"
              >
                <option value={SITE_ALL}>All Sites</option>
                {hasUnassigned && <option value={SITE_UNASSIGNED}>Unassigned</option>}
                {siteOptions.map((site) => (
                  <option key={site} value={site}>
                    {site}
                  </option>
                ))}
              </select>
            </div>
            {selectedIds.length > 0 && (
              <AnimatedButton variant="danger" onClick={() => openDeleteModal()}>
                Delete Selected ({selectedIds.length})
              </AnimatedButton>
            )}
            <AnimatedButton variant="primary" onClick={() => setShowCreateModal(true)}>
              + Add Record
            </AnimatedButton>
          </div>
        </div>

        <DataTable
          data={pagedData}
          columns={WEATHER_COLUMNS}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          onEdit={openEditModal}
          onDelete={(record) => openDeleteModal(record)}
          idKey="_id"
        />

        {filteredData.length > pageSize && (
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-border-light dark:border-border-dark">
            <span className="text-sm text-text-muted">
              Page {page} of {Math.ceil(filteredData.length / pageSize)}
            </span>
            <div className="flex gap-2">
              <AnimatedButton
                variant="secondary"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </AnimatedButton>
              <AnimatedButton
                variant="secondary"
                disabled={page >= Math.ceil(total / pageSize)}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </AnimatedButton>
            </div>
          </div>
        )}
      </div>

      {/* Create Modal */}
      <RecordModal
        show={showCreateModal}
        title="Create Weather Record"
        fields={WEATHER_FIELDS}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreate}
      />

      {/* Edit Modal */}
      <RecordModal
        show={showEditModal}
        title="Edit Weather Record"
        fields={WEATHER_FIELDS}
        initialData={selectedRecord || undefined}
        onClose={() => {
          setShowEditModal(false);
          setSelectedRecord(null);
        }}
        onSubmit={handleEdit}
      />

      {/* Delete Confirmation Modal */}
      <DeleteConfirmModal
        show={showDeleteModal}
        title={selectedRecord ? 'Delete Record' : 'Delete Selected Records'}
        message={
          selectedRecord
            ? `Are you sure you want to delete the weather record for ${selectedRecord.date} ${selectedRecord.time}?`
            : `Are you sure you want to delete ${selectedIds.length} selected records?`
        }
        onClose={() => {
          setShowDeleteModal(false);
          setSelectedRecord(null);
        }}
        onConfirm={handleDelete}
      />
    </div>
  );
}
