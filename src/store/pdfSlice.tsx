import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface Seal {
  id: number;
  assetId: string;
  url: string;
  name: string;
  page: number;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  _customSize: boolean;
}

export interface PdfPage {
  image: HTMLImageElement;
  layout?: {
    width: number;
    height: number;
    offsetX: number;
    offsetY: number;
  };
}

interface PDFState {
  pages: PdfPage[];
  seals: Seal[];
  currentPage: number;
  selectedItem: Seal | null;
  selectedDocument?: { url: string } | null;
  selectedEffects: string[];
  rotation: number;
  orientation: 'book' | 'album';
}

const initialState: PDFState = {
  pages: [],
  seals: [],
  currentPage: 0,
  selectedItem: null,
  selectedDocument: null,
  selectedEffects: [],
  rotation: 0,
  orientation: 'book',
};

const pdfSlice = createSlice({
  name: 'pdf',
  initialState,
  reducers: {
    setPages: (state, action: PayloadAction<PdfPage[]>) => {
      state.pages = action.payload;
    },
    setSeals: (state, action: PayloadAction<Seal[]>) => {
      state.seals = action.payload;
    },
    addSeal: (state, action: PayloadAction<Seal>) => {
      state.seals.push(action.payload);
    },
    updateSeal: (state, action: PayloadAction<Seal>) => {
      const index = state.seals.findIndex((s) => s.id === action.payload.id);
      if (index >= 0) state.seals[index] = action.payload;
    },
    setSelectedItem: (state, action: PayloadAction<Seal | null>) => {
      state.selectedItem = action.payload;
    },
    setSelectedDocument: (state, action: PayloadAction<{ url: string } | null>) => {
      state.selectedDocument = action.payload;
    },
    setCurrentPage: (state, action: PayloadAction<number>) => {
      state.currentPage = action.payload;
    },
    setSelectedEffects: (state, action: PayloadAction<string[]>) => {
      state.selectedEffects = action.payload;
    },
    setRotation: (state, action: PayloadAction<number>) => {
      state.rotation = action.payload;
    },
    setOrientation: (state, action: PayloadAction<'book' | 'album'>) => {
      state.orientation = action.payload;
    },
  },
});

export const {
  setPages,
  setSeals,
  addSeal,
  updateSeal,
  setSelectedItem,
  setSelectedDocument,
  setCurrentPage,
  setSelectedEffects,
  setRotation,
  setOrientation,
} = pdfSlice.actions;

export default pdfSlice.reducer;
