import { useState, useMemo } from 'react';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import Topbar from '../../components/layout/Topbar';
import AnimatedButton from '../../components/common/AnimatedButton';
import EditablePreviewTable from '../../components/tables/EditablePreviewTable';

interface RowError {
  rowNumber: number;
  errors: string[];
}

export default function WeatherErrorPage() {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Retrieve passed state
  const initialState = location.state as { data: Record<string, any>[], errors: RowError[] } | undefined;

  // Local state to manage edits before saving back
  const [fullData, setFullData] = useState<Record<string, any>[]>(initialState?.data || []);
  const [errors] = useState<RowError[]>(initialState?.errors || []);

  // 1. Identify which rows have errors (Map Excel row number to data index)
  const errorRowIndices = useMemo(() => {
    const indices = new Set<number>();
    errors.forEach((e) => {
      // Row 2 in Excel = Index 0 in data array
      indices.add(e.rowNumber - 2); 
    });
    return Array.from(indices).sort((a, b) => a - b);
  }, [errors]);

  // 2. Create the subset of data to display (Only Error Rows)
  const filteredData = useMemo(() => {
    return errorRowIndices.map(index => fullData[index]);
  }, [fullData, errorRowIndices]);

  // 3. Create the corresponding "Row Numbers" to display in the table
  const filteredRowNumbers = useMemo(() => {
    return errorRowIndices.map(index => index + 2);
  }, [errorRowIndices]);

  // Handle cell changes in the filtered table
  const handleCellChange = (localIndex: number, columnKey: string, value: string) => {
    // Map local index back to global index
    const globalIndex = errorRowIndices[localIndex];

    setFullData((prev) => {
      const updated = [...prev];
      updated[globalIndex] = { 
        ...updated[globalIndex], 
        [columnKey]: value 
      };
      return updated;
    });
  };

  const handleReturn = () => {
    // Navigate back to upload page with the UPDATED data
    navigate('/weather/upload', { 
      state: { 
        data: fullData,
        errors: errors 
      } 
    });
  };

  // Safe check for data existence (Must be after hooks)
  if (!initialState || !initialState.data) {
    return <Navigate to="/weather/upload" replace />;
  }

  return (
    <div className="flex flex-col gap-6">
      <Topbar 
        title="Fix Weather Validation Errors" 
        subtitle={`Editing ${filteredData.length} rows with issues`} 
      />

      <div className="surface p-6 h-full flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-danger flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Error Correction Mode
            </h3>
            <p className="text-text-muted mt-1">
              Correct the values in the table below. Only rows with errors are shown.
            </p>
          </div>
          
          <div className="flex gap-3">
             <AnimatedButton variant="primary" onClick={handleReturn}>
              Apply Fixes & Return
            </AnimatedButton>
          </div>
        </div>

        <div className="flex-1 min-h-[400px]">
            <EditablePreviewTable 
              data={filteredData} 
              errors={errors} 
              onCellChange={handleCellChange}
              customRowNumbers={filteredRowNumbers}
            />
        </div>

        {/* Error Detail List */}
        <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-700">
          <h4 className="font-semibold mb-4 text-sm uppercase text-text-muted">Error Details Reference</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-60 overflow-y-auto">
             {errors.map((err) => (
               <div key={err.rowNumber} className="text-sm p-3 bg-red-50 dark:bg-red-900/10 rounded border border-red-100 dark:border-red-900/30">
                 <span className="font-mono font-bold text-red-700 dark:text-red-400">Row {err.rowNumber}:</span>
                 <ul className="list-disc list-inside mt-1 text-slate-700 dark:text-slate-300 pl-1">
                   {err.errors.map((msg, i) => <li key={i}>{msg}</li>)}
                 </ul>
               </div>
             ))}
          </div>
        </div>
      </div>
    </div>
  );
}