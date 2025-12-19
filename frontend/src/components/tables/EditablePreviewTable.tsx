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
  pageSize?: number;
}

export default function EditablePreviewTable({
  data,
  errors,
  onCellChange,
  pageSize = 20,
}: EditablePreviewTableProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

  // Calculate pagination
  const totalPages = Math.ceil(data.length / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, data.length);
  const currentData = data.slice(startIndex, endIndex);

  // Get columns from first row
  const columns = useMemo(() => {
    if (!data.length) return [];
    return Object.keys(data[0]);
  }, [data]);

  // Create error lookup map
  const errorRowIndexes = useMemo(() => {
    return new Set(errors.map((e) => e.rowNumber - 2)); // Excel row → 0-based index
  }, [errors]);

  // Check if all visible rows are selected
  const allVisibleSelected = currentData.length > 0 && 
    currentData.every((_, i) => selectedRows.has(startIndex + i));

  const someVisibleSelected = currentData.some((_, i) => selectedRows.has(startIndex + i));

  // Toggle all visible rows
  const toggleAllVisible = () => {
    const newSelected = new Set(selectedRows);
    if (allVisibleSelected) {
      // Deselect all visible
      currentData.forEach((_, i) => newSelected.delete(startIndex + i));
    } else {
      // Select all visible
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

  // Pagination handlers
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

  return (
    <div className="space-y-4">
      {/* Table Info */}
      <div className="flex items-center justify-between text-sm text-text-muted">
        <span>
          Showing {startIndex + 1}-{endIndex} of {data.length} rows
          {selectedRows.size > 0 && ` (${selectedRows.size} selected)`}
        </span>
        <span>
          {errors.length > 0 ? (
            <span className="text-danger">{errors.length} row(s) with errors</span>
          ) : (
            <span className="text-success">All rows valid</span>
          )}
        </span>
      </div>

      {/* Table */}
      <div className="overflow-auto border border-border-light dark:border-border-dark rounded-lg max-h-[500px]">
        <table className="min-w-full border-collapse text-sm">
          <thead className="bg-slate-50 dark:bg-slate-900 sticky top-0 z-10">
            <tr>
              {/* Select All Checkbox */}
              <th className="px-3 py-3 text-left font-medium border-b border-border-light dark:border-border-dark w-10">
                <input
                  type="checkbox"
                  checked={allVisibleSelected}
                  ref={(el) => {
                    if (el) el.indeterminate = someVisibleSelected && !allVisibleSelected;
                  }}
                  onChange={toggleAllVisible}
                  className="rounded border-slate-300 dark:border-slate-600"
                  title="Select all visible rows"
                />
              </th>
              {/* Row Number */}
              <th className="px-3 py-3 text-left font-medium border-b border-border-light dark:border-border-dark w-16 bg-slate-100 dark:bg-slate-800">
                #
              </th>
              {/* Data Columns */}
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
              const hasError = errorRowIndexes.has(globalIndex);
              const isSelected = selectedRows.has(globalIndex);
              const rowNumber = globalIndex + 2; // Excel row number (1-indexed + header)

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
                  {/* Row Checkbox */}
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleRow(globalIndex)}
                      className="rounded border-slate-300 dark:border-slate-600"
                    />
                  </td>
                  {/* Row Number */}
                  <td className="px-3 py-2 text-text-muted font-mono text-xs bg-slate-50 dark:bg-slate-800/50">
                    {rowNumber}
                  </td>
                  {/* Data Cells */}
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
            {/* First Page */}
            <button
              onClick={() => goToPage(1)}
              disabled={currentPage === 1}
              className={clsx(
                'px-3 py-1.5 text-sm rounded-lg border transition-colors',
                currentPage === 1
                  ? 'border-slate-200 text-slate-400 cursor-not-allowed'
                  : 'border-slate-300 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800'
              )}
            >
              First
            </button>

            {/* Previous Page */}
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              className={clsx(
                'px-3 py-1.5 text-sm rounded-lg border transition-colors',
                currentPage === 1
                  ? 'border-slate-200 text-slate-400 cursor-not-allowed'
                  : 'border-slate-300 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800'
              )}
            >
              ← Prev
            </button>

            {/* Page Numbers */}
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => goToPage(pageNum)}
                    className={clsx(
                      'w-8 h-8 text-sm rounded-lg transition-colors',
                      currentPage === pageNum
                        ? 'bg-primary text-white'
                        : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                    )}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>

            {/* Next Page */}
            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className={clsx(
                'px-3 py-1.5 text-sm rounded-lg border transition-colors',
                currentPage === totalPages
                  ? 'border-slate-200 text-slate-400 cursor-not-allowed'
                  : 'border-slate-300 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800'
              )}
            >
              Next →
            </button>

            {/* Last Page */}
            <button
              onClick={() => goToPage(totalPages)}
              disabled={currentPage === totalPages}
              className={clsx(
                'px-3 py-1.5 text-sm rounded-lg border transition-colors',
                currentPage === totalPages
                  ? 'border-slate-200 text-slate-400 cursor-not-allowed'
                  : 'border-slate-300 hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-800'
              )}
            >
              Last
            </button>
          </div>

          {/* Page Jump */}
          <div className="flex items-center gap-2 text-sm">
            <span className="text-text-muted">Go to:</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              value={currentPage}
              onChange={(e) => goToPage(parseInt(e.target.value, 10) || 1)}
              className="w-16 px-2 py-1 border border-slate-300 dark:border-slate-600 rounded-lg text-center"
            />
          </div>
        </div>
      )}
    </div>
  );
}