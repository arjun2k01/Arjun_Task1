import { useState } from 'react';
import Topbar from '../../components/layout/Topbar';
import AnimatedButton from '../../components/common/AnimatedButton';
import EditablePreviewTable from '../../components/tables/EditablePreviewTable';
import ErrorSummaryPanel from '../../components/tables/ErrorSummaryPanel';
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
    .filter(Boolean) as RowError[];
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

  const [file, setFile] = useState<File | null>(null);
  const [data, setData] = useState<Record<string, any>[]>([]);
  const [errors, setErrors] = useState<RowError[]>([]);
  const [isValid, setIsValid] = useState(false);
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState<LoadingPhase>('idle');
  const [success, setSuccess] = useState<SubmitResponse | null>(null);

  const downloadTemplate = () => {
    window.open(apiUrl('/weather/template'), '_blank');
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

      // Backend returns { weatherData, errors } from weather-upload.controller
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
          : `${normalizedErrors.length} row(s) have validation issues. Edit and re-validate.`,
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

    // Mark as invalid after editing - user must re-validate
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

      // Validation endpoint returns { rows, errors, isValid }
      const enrichedRows = normalizeData(result?.rows ?? result?.data);
      const normalizedErrors = normalizeErrors(result?.errors);

      // Update data with enriched rows if available
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

      const totalAffected = (result.inserted ?? 0);

      pushToast({
        type: 'success',
        title: 'Submitted successfully',
        message: `${totalAffected} record(s) saved to database. ${result.skipped ?? 0} skipped (duplicates).`,
      });

      // Clear form after successful submission
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
          <h3 className="mb-4">Preview & Edit Data</h3>
          <p className="text-sm text-text-muted mb-4">
            You can edit cells directly. After editing, click "Re-Validate" to check for errors.
          </p>
          <EditablePreviewTable data={data} errors={errors} onCellChange={handleCellChange} />
        </div>
      )}

      {/* Error Summary Section */}
      {errors.length > 0 && (
        <div className="surface p-6">
          <ErrorSummaryPanel errors={errors} />
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