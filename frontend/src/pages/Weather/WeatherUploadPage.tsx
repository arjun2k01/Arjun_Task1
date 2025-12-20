import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Topbar from '../../components/layout/Topbar';
import AnimatedButton from '../../components/common/AnimatedButton';
import EditablePreviewTable from '../../components/tables/EditablePreviewTable';
import { useToast } from '../../components/common/ToastProvider';
import LoadingOverlay from '../../components/common/LoadingOverlay';
import FileDropzone from '../../components/common/FileDropzone';
import { apiUrl } from '../../config/api';

interface RowError {
  rowNumber: number;
  errors: string[];
}

interface SubmitResponse {
  inserted: number;
  skipped: number;
  message: string;
}

/**
 * Normalize errors from backend
 */
function normalizeErrors(input: any): RowError[] {
  if (!Array.isArray(input)) return [];

  return input
    .map((e: any) => {
      if (typeof e?.rowNumber === 'number' && Array.isArray(e?.errors)) {
        return { rowNumber: e.rowNumber, errors: e.errors };
      }
      if (typeof e?.rowIndex === 'number' && Array.isArray(e?.messages)) {
        return { rowNumber: e.rowIndex, errors: e.messages };
      }
      return null;
    })
    .filter((e): e is RowError => e !== null)
    .sort((a, b) => a.rowNumber - b.rowNumber);
}

/**
 * Normalize data from backend
 */
function normalizeData(input: any): Record<string, any>[] {
  if (Array.isArray(input)) return input;
  return [];
}

type LoadingPhase = 'idle' | 'upload' | 'validate' | 'submit';

export default function WeatherUploadPage() {
  const { pushToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  // Initialize state from location.state if available (preserves data when returning from Error Page)
  const [data, setData] = useState<Record<string, any>[]>(location.state?.data || []);
  const [errors, setErrors] = useState<RowError[]>(location.state?.errors || []);
  const [isValid, setIsValid] = useState(false);
  
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<LoadingPhase>('idle');
  const [success, setSuccess] = useState<SubmitResponse | null>(null);

  // Recalculate isValid on mount or when data changes
  useEffect(() => {
    if (data.length > 0) {
      setIsValid(errors.length === 0);
    }
  }, [data, errors]);

  const downloadTemplate = () => {
    window.open(apiUrl('/weather/template'), '_blank');
  };

  // Navigate to separate error page
  const handleViewErrors = () => {
    navigate('/weather/errors', { state: { data, errors } });
  };

  const overlayTitle =
    phase === 'upload'
      ? 'Uploading & parsing Excel…'
      : phase === 'validate'
      ? 'Validating rows…'
      : phase === 'submit'
      ? 'Submitting to database…'
      : 'Processing…';

  const overlaySubtitle =
    phase === 'upload'
      ? 'Reading the file and converting it into rows.'
      : phase === 'validate'
      ? 'Checking schema rules and highlighting issues.'
      : phase === 'submit'
      ? 'Saving valid rows and skipping duplicates.'
      : 'Please wait.';

  const handleUpload = async () => {
    if (!file) {
      pushToast({
        type: 'error',
        title: 'No file selected',
        message: 'Please choose an Excel file (.xlsx/.xls) and try again.',
      });
      return;
    }

    setLoading(true);
    setPhase('upload');
    setSuccess(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(apiUrl('/weather/upload'), {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || 'Upload failed');
      }

      const result: any = await res.json();

      const normalizedData = normalizeData(result?.weatherData ?? result?.rows ?? result?.data);
      const normalizedErrors = normalizeErrors(result?.errors);

      setData(normalizedData);
      setErrors(normalizedErrors);

      const valid = typeof result?.isValid === 'boolean' ? result.isValid : normalizedErrors.length === 0;
      setIsValid(valid);

      pushToast({
        type: valid ? 'success' : 'info',
        title: valid ? 'Upload validated' : 'Upload needs fixes',
        message: valid
          ? 'All rows are valid. You can submit to the database.'
          : `${normalizedErrors.length} row(s) have validation issues.`,
      });

    } catch (err: any) {
      pushToast({
        type: 'error',
        title: 'Upload failed',
        message: err?.message || 'Could not upload/validate the file. Please try again.',
      });
    } finally {
      setLoading(false);
      setPhase('idle');
    }
  };

  const handleCellChange = (rowIndex: number, columnKey: string, value: string) => {
    setData((prev) => {
      const updated = [...prev];
      updated[rowIndex] = { ...updated[rowIndex], [columnKey]: value };
      return updated;
    });

    setIsValid(false);
    setSuccess(null);
  };

  const handleRevalidate = async () => {
    if (!data.length) {
      pushToast({
        type: 'info',
        title: 'Nothing to validate',
        message: 'Upload a file first to validate data.',
      });
      return;
    }

    setLoading(true);
    setPhase('validate');
    setSuccess(null);

    try {
      const res = await fetch(apiUrl('/weather/validate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: data }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || 'Validation failed');
      }

      const result: any = await res.json();

      const enrichedRows = normalizeData(result?.rows ?? result?.data);
      const normalizedErrors = normalizeErrors(result?.errors);

      if (enrichedRows.length > 0) {
        setData(enrichedRows);
      }

      setErrors(normalizedErrors);

      const valid = typeof result?.isValid === 'boolean' ? result.isValid : normalizedErrors.length === 0;
      setIsValid(valid);

      pushToast({
        type: valid ? 'success' : 'info',
        title: valid ? 'Validation passed' : 'Validation failed',
        message: valid
          ? 'All rows are valid. You can submit now.'
          : `${normalizedErrors.length} row(s) still have issues.`,
      });

    } catch (err: any) {
      pushToast({
        type: 'error',
        title: 'Re-validation failed',
        message: err?.message || 'Could not validate the edited data. Please try again.',
      });
    } finally {
      setLoading(false);
      setPhase('idle');
    }
  };

  const handleSubmit = async () => {
    if (!data.length) {
      pushToast({
        type: 'info',
        title: 'Nothing to submit',
        message: 'Upload and validate a file first.',
      });
      return;
    }

    if (!isValid) {
      pushToast({
        type: 'error',
        title: 'Cannot submit',
        message: 'Please re-validate and fix errors before submitting.',
      });
      return;
    }

    setLoading(true);
    setPhase('submit');

    try {
      const res = await fetch(apiUrl('/weather/submit'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: data }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || 'Submit failed');
      }

      const result: SubmitResponse = await res.json();
      setSuccess(result);

      const totalAffected = result.inserted ?? 0;

      pushToast({
        type: 'success',
        title: 'Submitted successfully',
        message: `${totalAffected} record(s) saved to database. ${result.skipped ?? 0} skipped (duplicates).`,
      });

      setData([]);
      setErrors([]);
      setIsValid(false);
      setFile(null);
    } catch (err: any) {
      pushToast({
        type: 'error',
        title: 'Submission failed',
        message: err?.message || 'Could not submit to database. Please try again.',
      });
    } finally {
      setLoading(false);
      setPhase('idle');
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <LoadingOverlay show={loading} title={overlayTitle} subtitle={overlaySubtitle} />

      <Topbar title="Weather Excel Upload" subtitle="Upload, edit, validate, and submit weather data" />

      {/* Upload Section */}
      <div className="surface p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="mb-2">Upload Excel File</h3>
            <p className="mb-4">
              Upload a weather Excel file. Fix validation errors directly in the table before submitting to the database.
            </p>
          </div>

          <AnimatedButton variant="secondary" onClick={downloadTemplate}>
            Download Template
          </AnimatedButton>
        </div>

        <div className="mt-4">
          <FileDropzone
            value={file}
            onChange={setFile}
            accept=".xlsx,.xls"
            disabled={loading}
            title="Drop your Weather Excel file here"
            hint="or click to browse (XLSX / XLS)"
          />
        </div>

        <div className="mt-4">
          <AnimatedButton variant="primary" onClick={handleUpload} disabled={loading}>
            {loading ? 'Processing…' : 'Upload & Validate'}
          </AnimatedButton>
        </div>
      </div>

      {/* Preview & Edit Section */}
      {data.length > 0 && (
        <div className="surface p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3>Preview & Edit Data ({data.length} rows)</h3>
              <p className="text-sm text-text-muted mt-1">
                You can edit cells directly. After editing, click "Re-Validate" to check for errors.
              </p>
            </div>

            {/* Error Actions */}
            <div className="flex items-center gap-3">
              {errors.length > 0 && (
                <button
                  onClick={handleViewErrors}
                  className="flex items-center gap-2 px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors font-medium"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  View All {errors.length} Errors in Separate Page
                </button>
              )}

              {/* Valid Badge */}
              {errors.length === 0 && (
                <span className="flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  All Rows Valid
                </span>
              )}
            </div>
          </div>

          <EditablePreviewTable data={data} errors={errors} onCellChange={handleCellChange} />
        </div>
      )}

      {/* Action Buttons */}
      {data.length > 0 && (
        <div className="flex items-center gap-4">
          <AnimatedButton variant="secondary" onClick={handleRevalidate} disabled={loading}>
            Re-Validate
          </AnimatedButton>

          <AnimatedButton variant="primary" onClick={handleSubmit} disabled={!isValid || loading}>
            Submit to Database
          </AnimatedButton>

          {errors.length > 0 && (
            <span className="text-sm text-red-600 dark:text-red-400">
              ⚠️ Fix {errors.length} error(s) before submitting
            </span>
          )}
        </div>
      )}

      {/* Success Summary */}
      {success && (
        <div className="surface p-6">
          <h3 className="mb-2 text-success">Submission Successful</h3>
          <div className="text-sm space-y-1">
            <p>Inserted: {success.inserted ?? 0}</p>
            <p>Skipped (duplicates): {success.skipped ?? 0}</p>
            <p className="text-text-muted">{success.message}</p>
          </div>
        </div>
      )}
    </div>
  );
}