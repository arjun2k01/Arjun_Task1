import clsx from 'clsx';

interface Column {
  key: string;
  label: string;
  width?: number;
}

interface DataTableProps<T extends Record<string, any>> {
  data: T[];
  columns: Column[];
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
  onEdit: (record: T) => void;
  onDelete: (record: T) => void;
  idKey?: string;
}

export default function DataTable<T extends Record<string, any>>({
  data,
  columns,
  selectedIds,
  onSelectionChange,
  onEdit,
  onDelete,
  idKey = '_id',
}: DataTableProps<T>) {
  const allSelected = data.length > 0 && data.every((row) => selectedIds.includes(row[idKey]));
  const someSelected = data.some((row) => selectedIds.includes(row[idKey]));

  const toggleAll = () => {
    if (allSelected) {
      onSelectionChange([]);
    } else {
      onSelectionChange(data.map((row) => row[idKey]));
    }
  };

  const toggleOne = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((i) => i !== id));
    } else {
      onSelectionChange([...selectedIds, id]);
    }
  };

  if (!data.length) {
    return (
      <div className="text-center py-12 text-text-muted">
        <p>No records found.</p>
      </div>
    );
  }

  return (
    <div className="overflow-auto border border-border-light dark:border-border-dark rounded-lg">
      <table className="min-w-full border-collapse text-sm">
        <thead className="bg-slate-50 dark:bg-slate-900 sticky top-0 z-10">
          <tr>
            <th className="px-3 py-3 text-left font-medium border-b border-border-light dark:border-border-dark w-10">
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = someSelected && !allSelected;
                }}
                onChange={toggleAll}
                className="rounded border-slate-300 dark:border-slate-600"
              />
            </th>
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-3 py-3 text-left font-medium border-b border-border-light dark:border-border-dark whitespace-nowrap"
                style={{ minWidth: col.width }}
              >
                {col.label}
              </th>
            ))}
            <th className="px-3 py-3 text-center font-medium border-b border-border-light dark:border-border-dark w-24">
              Actions
            </th>
          </tr>
        </thead>

        <tbody>
          {data.map((row) => {
            const id = row[idKey];
            const isSelected = selectedIds.includes(id);

            return (
              <tr
                key={id}
                className={clsx(
                  'border-b border-border-light dark:border-border-dark transition-colors',
                  isSelected ? 'bg-primary/5' : 'hover:bg-slate-50 dark:hover:bg-slate-900/50',
                )}
              >
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleOne(id)}
                    className="rounded border-slate-300 dark:border-slate-600"
                  />
                </td>
                {columns.map((col) => (
                  <td key={col.key} className="px-3 py-2 whitespace-nowrap">
                    {formatValue(getNestedValue(row, col.key))}
                  </td>
                ))}
                <td className="px-3 py-2">
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={() => onEdit(row)}
                      className="p-1.5 rounded-lg text-slate-600 hover:text-primary hover:bg-slate-100 dark:text-slate-400 dark:hover:text-primary dark:hover:bg-slate-800 transition-colors"
                      title="Edit"
                    >
                      <EditIcon />
                    </button>
                    <button
                      onClick={() => onDelete(row)}
                      className="p-1.5 rounded-lg text-slate-600 hover:text-danger hover:bg-red-50 dark:text-slate-400 dark:hover:text-danger dark:hover:bg-red-950/30 transition-colors"
                      title="Delete"
                    >
                      <DeleteIcon />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function getNestedValue(obj: any, key: string): any {
  return key.split('.').reduce((acc, part) => acc?.[part], obj);
}

function formatValue(value: any): string {
  if (value === null || value === undefined) return '-';
  if (typeof value === 'number') return value.toLocaleString();
  return String(value);
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}