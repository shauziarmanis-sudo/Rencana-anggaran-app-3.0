// ============================================================
// Zustand Store - Selected PI State (with Company assignment)
// NO PERSIST: State resets on every page refresh per client request
// ============================================================

import { create } from 'zustand';
import type { RencanaAnggaranRow, InvoiceFile } from '@/types/finance';

interface SelectedPIState {
  // Selected row IDs
  selectedIds: Set<string>;
  // Company assignment per PI: piId -> companyName
  companyAssignment: Record<string, string>;
  // All rows data (cached for use across pages)
  allRows: RencanaAnggaranRow[];
  // Google Drive invoice data: piId -> array of files
  invoiceData: Record<string, InvoiceFile[]>;
  // Rekap data with AI enrichment (persists across pages)
  rekapGroups: any[];
  rekapGrandTotal: number;

  // Actions
  toggleSelection: (id: string) => void;
  selectAll: (ids: string[]) => void;
  deselectAll: () => void;
  setAllRows: (rows: RencanaAnggaranRow[]) => void;
  getSelectedRows: () => RencanaAnggaranRow[];
  isSelected: (id: string) => boolean;
  setCompany: (piId: string, company: string) => void;
  getCompany: (piId: string) => string;
  setInvoiceData: (data: Record<string, InvoiceFile[]>) => void;
  setRekapData: (groups: any[], grandTotal: number) => void;
}

export const useSelectedPIStore = create<SelectedPIState>()(
  (set, get) => ({
    selectedIds: new Set<string>(),
    companyAssignment: {},
    allRows: [],
    invoiceData: {},
    rekapGroups: [],
    rekapGrandTotal: 0,

    toggleSelection: (id: string) => {
      set((state) => {
        const newSet = new Set(state.selectedIds);
        if (newSet.has(id)) {
          newSet.delete(id);
        } else {
          newSet.add(id);
        }
        return { selectedIds: newSet };
      });
    },

    selectAll: (ids: string[]) => {
      set(() => ({
        selectedIds: new Set(ids),
      }));
    },

    deselectAll: () => {
      set(() => ({
        selectedIds: new Set<string>(),
      }));
    },

    setAllRows: (rows: RencanaAnggaranRow[]) => {
      set(() => ({ allRows: rows }));
    },

    getSelectedRows: () => {
      const state = get();
      return state.allRows
        .filter((r) => state.selectedIds.has(r.id))
        .map((r) => ({
          ...r,
          perusahaan: state.companyAssignment[r.id] || r.perusahaan || '',
        }));
    },

    isSelected: (id: string) => {
      return get().selectedIds.has(id);
    },

    setCompany: (piId: string, company: string) => {
      set((state) => ({
        companyAssignment: { ...state.companyAssignment, [piId]: company },
      }));
    },

    getCompany: (piId: string) => {
      return get().companyAssignment[piId] || '';
    },

    setInvoiceData: (data: Record<string, InvoiceFile[]>) => {
      set(() => ({ invoiceData: data }));
    },

    setRekapData: (groups: any[], grandTotal: number) => {
      set(() => ({ rekapGroups: groups, rekapGrandTotal: grandTotal }));
    },
  })
);
