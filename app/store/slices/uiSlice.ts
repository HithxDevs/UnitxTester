import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UiState {
  loading: boolean;
  error: string | null;
  isFullScreen: boolean;
  showTestSection: boolean;
  showSummarySection: boolean;
  isGeneratingSummaries: boolean;
  isGeneratingTests: boolean;
}

const initialState: UiState = {
  loading: false,
  error: null,
  isFullScreen: false,
  showTestSection: false,
  showSummarySection: false,
  isGeneratingSummaries: false,
  isGeneratingTests: false,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    setIsFullScreen: (state, action: PayloadAction<boolean>) => {
      state.isFullScreen = action.payload;
    },
    setShowTestSection: (state, action: PayloadAction<boolean>) => {
      state.showTestSection = action.payload;
    },
    setShowSummarySection: (state, action: PayloadAction<boolean>) => {
      state.showSummarySection = action.payload;
    },
    setIsGeneratingSummaries: (state, action: PayloadAction<boolean>) => {
      state.isGeneratingSummaries = action.payload;
    },
    setIsGeneratingTests: (state, action: PayloadAction<boolean>) => {
      state.isGeneratingTests = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
  },
});

export const {
  setLoading,
  setError,
  setIsFullScreen,
  setShowTestSection,
  setShowSummarySection,
  setIsGeneratingSummaries,
  setIsGeneratingTests,
  clearError,
} = uiSlice.actions;

export default uiSlice.reducer;

