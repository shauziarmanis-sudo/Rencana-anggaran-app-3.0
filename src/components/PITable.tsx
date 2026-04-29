'use client';

import React, { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type ColumnFiltersState,
} from '@tanstack/react-table';
import { formatRupiah } from '@/lib/format';
import { useSelectedPIStore } from '@/store/useSelectedPI';
import type { RencanaAnggaranRow } from '@/types/finance';
import {
  Search,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

const PT_OPTIONS = ['PT VCI', 'PT VVA', 'PT VLA'];

const columnHelper = createColumnHelper<RencanaAnggaranRow>();

interface PITableProps {
  data: RencanaAnggaranRow[];
}

export default function PITable({ data }: PITableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  const { selectedIds, toggleSelection, selectAll, deselectAll, setCompany, getCompany } = useSelectedPIStore();

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: 'select',
        header: ({ table }) => {
          const filteredIds = table.getFilteredRowModel().rows.map(r => r.original.id);
          const isAllSelected = filteredIds.length > 0 && filteredIds.every(id => selectedIds.has(id));
          return (
            <input
              type="checkbox"
              className="checkbox"
              checked={isAllSelected}
              onChange={(e) => {
                if (e.target.checked) {
                  selectAll([...selectedIds, ...filteredIds]);
                } else {
                  deselectAll();
                }
              }}
              title="Select All"
            />
          );
        },
        cell: ({ row }) => (
          <input
            type="checkbox"
            className="checkbox"
            checked={selectedIds.has(row.original.id)}
            onChange={() => toggleSelection(row.original.id)}
          />
        ),
        size: 50,
      }),
      columnHelper.display({
        id: 'no',
        header: 'No',
        cell: ({ row }) => (
          <span style={{ fontWeight: 600, color: '#6b7280', fontSize: 12 }}>
            {row.index + 1}
          </span>
        ),
        size: 50,
      }),
      columnHelper.accessor('noPi', {
        header: 'No. PI',
        cell: ({ getValue }) => (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 600, color: '#0f766e' }}>
            {getValue()}
          </span>
        ),
        size: 180,
      }),
      // Perusahaan dropdown column
      columnHelper.display({
        id: 'perusahaan',
        header: 'Sumber Dana (PT)',
        cell: ({ row }) => {
          const piId = row.original.id;
          const currentCompany = getCompany(piId) || row.original.perusahaan || '';
          return (
            <select
              value={currentCompany}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                e.stopPropagation();
                setCompany(piId, e.target.value);
              }}
              style={{
                padding: '4px 8px',
                borderRadius: 6,
                border: '1px solid #d1d5db',
                fontSize: 12,
                fontWeight: 600,
                background: currentCompany ? '#f0fdfa' : '#ffffff',
                color: currentCompany ? '#0f766e' : '#0f766e',
                cursor: 'pointer',
                width: '100%',
              }}
            >
              <option value="">-- Pilih PT --</option>
              {PT_OPTIONS.map(pt => (
                <option key={pt} value={pt}>{pt}</option>
              ))}
            </select>
          );
        },
        size: 150,
      }),
      columnHelper.accessor('tglBeli', {
        header: 'Tgl. Beli',
        size: 120,
      }),
      columnHelper.accessor('namaSupplier', {
        header: 'Supplier',
        cell: ({ getValue }) => (
          <div style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {getValue()}
          </div>
        ),
        size: 200,
      }),
      columnHelper.accessor('hutang', {
        header: 'Hutang',
        cell: ({ getValue }) => (
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, whiteSpace: 'nowrap' }}>
            {formatRupiah(getValue())}
          </span>
        ),
        size: 150,
      }),
      columnHelper.accessor('tempo', {
        header: 'Tempo',
        cell: ({ getValue }) => {
          const tempo = getValue();
          const isLate = tempo < 0;
          return (
            <span style={{
              fontWeight: 600,
              color: isLate ? '#dc2626' : tempo <= 7 ? '#d97706' : '#059669',
            }}>
              {tempo} hari
            </span>
          );
        },
        size: 100,
      }),
      columnHelper.accessor('paymentDueState', {
        header: 'Status',
        cell: ({ getValue, row }) => {
          const state = getValue()?.toLowerCase();
          const isLate = state === 'late' || row.original.tempo < 0;
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {isLate ? (
                <span className="badge late">
                  <XCircle size={12} /> LATE
                </span>
              ) : (
                <span className="badge on-time">
                  <CheckCircle2 size={12} /> ON TIME
                </span>
              )}
            </div>
          );
        },
        size: 120,
      }),
    ],
    [selectedIds, selectAll, deselectAll, toggleSelection, setCompany, getCompany]
  );

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter,
      columnFilters,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize: 50 },
    },
  });

  return (
    <div>
      {/* Toolbar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 16,
        marginBottom: 16,
        flexWrap: 'wrap',
      }}>
        {/* Search */}
        <div style={{ position: 'relative', minWidth: 300, flex: '1 1 300px', maxWidth: 500 }}>
          <Search size={18} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="Cari PI, vendor, atau nomor rekening..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            id="pi-search-input"
          />
        </div>

        {/* Selection info */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <span style={{ fontSize: 13, color: '#6b7280' }}>
            <strong style={{ color: '#0f766e' }}>{selectedIds.size}</strong> dari {data.length} PI dipilih
          </span>
          {selectedIds.size > 0 && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={deselectAll}
              id="deselect-all-btn"
            >
              Reset Pilihan
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            {table.getHeaderGroups().map(headerGroup => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <th
                    key={header.id}
                    onClick={header.column.getCanSort() ? header.column.getToggleSortingHandler() : undefined}
                    style={{
                      cursor: header.column.getCanSort() ? 'pointer' : 'default',
                      width: header.getSize(),
                      minWidth: header.getSize(),
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() && <ArrowUpDown size={12} style={{ opacity: 0.5 }} />}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: 'center', padding: 40, color: '#9ca3af' }}>
                  {globalFilter ? 'Tidak ada data yang cocok dengan pencarian' : 'Tidak ada PI unpaid'}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map(row => (
                <tr
                  key={row.id}
                  className={selectedIds.has(row.original.id) ? 'selected' : ''}
                  onClick={() => toggleSelection(row.original.id)}
                  style={{ cursor: 'pointer' }}
                >
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} onClick={cell.column.id === 'select' || cell.column.id === 'perusahaan' ? (e) => e.stopPropagation() : undefined}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 16,
        padding: '0 4px',
        fontSize: 13,
      }}>
        <span style={{ color: '#6b7280' }}>
          Menampilkan {table.getRowModel().rows.length} dari {data.length} data
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronsLeft size={14} />
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft size={14} />
          </button>
          <span style={{ fontWeight: 600, color: '#374151' }}>
            {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
          </span>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRight size={14} />
          </button>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
          >
            <ChevronsRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
