import { useState, useMemo } from 'react';
import clsx from 'clsx';

interface RowError {
  rowNumber: number;
  errors: string[];
}

interface EditablePreviewTableProps {
  data: Record<string, any>[];
  errors: RowError[];
  onCellChange: (rowIndex: number, columnKey: string, value: string) => void;
  onDeleteRows?: (indices: number[]) => void;
  pageSize?: number;
  customRowNumbers?: number[]; // Added prop for correct row numbering in filtered views
}

export default function EditablePreviewTable({
  data,
  errors,
  onCellChange,
  onDeleteRows,
  pageSize = 20,
  customRowNumbers,
}: EditablePreviewTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  // Calculate pagination
  const totalPages = Math.ceil(data.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, data.length);

  const currentData = data.slice(startIndex, endIndex);
  // Slice custom row numbers if provided
  const currentRowNumbers = customRowNumbers?.slice(startIndex, endIndex);

  // Get columns from first row (or first available row in full data if current is empty)
  const columns = useMemo(() => {
    if (!data.length) return [];
    return Object.keys(data[0]);
  }, [data]);

  // Create error lookup map
  // If we are in "customRowNumbers" mode (filtered view), we might need to adjust how we match errors.
  // However, usually 'errors' contains the absolute rowNumber.
  // If this table is showing ONLY errors, then every row likely has an error, or we check against the rowNumber.
  const errorRowNumbers = useMemo(() => {
    return new Set(errors.map((e) => e.rowNumber));
  }, [errors]);

  // Check if all visible rows are selected
  const allVisibleSelected = currentData.length > 0 &&
    currentData.every((_, i) => selectedRows.has(startIndex + i));

  const someVisibleSelected = currentData.some((_, i) => selectedRows.has(startIndex + i));

  // Toggle all visible rows
  const toggleAllVisible = () => {
    const newSelected = new Set(selectedRows);
    if (allVisibleSelected) {
      currentData.forEach((_, i) => newSelected.delete(startIndex + i));
    } else {
      currentData.forEach((_, i) => newSelected.add(startIndex + i));
    }
    setSelectedRows(newSelected);
  };

  // Toggle single row
  const toggleRow = (index: number) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    setSelectedRows(newSelected);
  };

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  if (!data.length) {
    return (
      <div className="text-center py-12 text-text-muted">
        <p className="text-lg">No data to preview.</p>
        <p className="text-sm mt-2">Upload an Excel file to see the data here.</p>
      </div>
    );
  }

  // Handle delete selected rows
  const handleDeleteSelected = () => {
    if (selectedRows.size === 0 || !onDeleteRows) return;
    const indices = Array.from(selectedRows).sort((a, b) => b - a); // Sort descending for proper removal
    onDeleteRows(indices);
    setSelectedRows(new Set());
  };

  return (
    <div className="space-y-4">
      {/* Table Info */}
      <div className="flex items-center justify-between text-sm text-text-muted">
        <div className="flex items-center gap-3">
          <span>
            Showing {startIndex + 1}-{endIndex} of {data.length} rows
            {selectedRows.size > 0 && ` (${selectedRows.size} selected)`}
          </span>
          {selectedRows.size > 0 && onDeleteRows && (
            <button
              onClick={handleDeleteSelected}
              className="px-3 py-1 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors font-medium"
            >
              Delete Selected ({selectedRows.size})
            </button>
          )}
        </div>
        <span>
          {errors.length > 0 ? (
            <span className="text-danger">{errors.length} error(s) found</span>
          ) : (
            <span className="text-success">All rows valid</span>
          )}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-auto border border-border-light dark:border-border-dark rounded-lg max-h-[600px]">
        <table className="min-w-full border-collapse text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900 sticky top-0 z-10">
            <tr>
              <th className="px-3 py-3 text-left font-medium border-b border-border-light dark:border-border-dark w-10">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someVisibleSelected && !allVisibleSelected;
                  }}
                  onChange={toggleAllVisible}
                  className="rounded border-slate-300 dark:border-slate-600"
                />
              </th>
              <th className="px-3 py-3 text-left font-medium border-b border-border-light dark:border-border-dark w-16 bg-slate-100 dark:bg-slate-800">
                #
              </th>
              {columns.map((col) => (
                <th
                  key={col}
                  className="px-3 py-3 text-left font-medium border-b border-border-light dark:border-border-dark whitespace-nowrap"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {currentData.map((row, localIndex) => {
              const globalIndex = startIndex + localIndex;
              const isSelected = selectedRows.has(globalIndex);

              // Determine Row Number: Use custom prop if avail, else calculate from index
              const rowNumber = currentRowNumbers
                ? currentRowNumbers[localIndex]
                : globalIndex + 2;

              // Check if this specific row has an error
              const hasError = errorRowNumbers.has(rowNumber);

              return (
                <tr
                  key={globalIndex}
                  className={clsx(
                    'border-b border-border-light dark:border-border-dark transition-colors',
                    hasError && 'bg-red-50 dark:bg-red-950/30',
                    isSelected && !hasError && 'bg-blue-50 dark:bg-blue-950/30',
                    !hasError && !isSelected && 'hover:bg-slate-50 dark:hover:bg-slate-900/50'
                  )}
                >
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleRow(globalIndex)}
                      className="rounded border-slate-300 dark:border-slate-600"
                    />
                  </td>
                  <td className="px-3 py-2 text-text-muted font-mono text-xs bg-slate-50 dark:bg-slate-800/50">
                    {rowNumber}
                  </td>
                  {columns.map((col) => (
                    <td key={col} className="px-2 py-1">
                      <input
                        type="text"
                        value={row[col] ?? ''}
                        onChange={(e) => onCellChange(globalIndex, col, e.target.value)}
                        className={clsx(
                          'w-full min-w-[80px] bg-transparent border rounded px-2 py-1 text-sm',
                          'focus:outline-none focus:ring-2 focus:ring-primary/50',
                          hasError
                            ? 'border-red-300 dark:border-red-700 focus:border-red-500'
                            : 'border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-primary'
                        )}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-border-light dark:border-border-dark">
          <div className="text-sm text-text-muted">
            Page {currentPage} of {totalPages}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => goToPage(1)}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 disabled:opacity-50"
            >
              First
            </button>
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 disabled:opacity-50"
            >
              Prev
            </button>

            <span className="px-2 text-sm">
              {currentPage}
            </span>

            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 disabled:opacity-50"
            >
              Next
            </button>
            <button
              onClick={() => goToPage(totalPages)}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 disabled:opacity-50"
            >
              Last
            </button>
          </div>
        </div>
      )}
    </div>
  );
}