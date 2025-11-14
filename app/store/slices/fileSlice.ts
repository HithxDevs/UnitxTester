import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';

export interface GitHubFileContent {
  content: string;
  name: string;
  path: string;
}

interface FileState {
  fileContent: GitHubFileContent | null;
  selectedFiles: GitHubFileContent[];
  selectedCode: string;
}

const initialState: FileState = {
  fileContent: null,
  selectedFiles: [],
  selectedCode: '',
};

// Async thunk
export const fetchFileContent = createAsyncThunk(
  'file/fetchFileContent',
  async ({ owner, repo, path, accessToken }: { owner: string; repo: string; path: string; accessToken: string }) => {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });
    if (!response.ok) {
      throw new Error('Failed to fetch file content');
    }
    const data = await response.json();
    
    if (data.size > 1000000) {
      throw new Error('File is too large to display (>1MB)');
    }
    
    const decodedContent = atob(data.content.replace(/\s/g, ''));
    const isBinary = /[\x00-\x08\x0E-\x1F\x7F-\xFF]/.test(decodedContent.substring(0, 1000));
    
    if (isBinary) {
      return {
        content: `Binary file: ${data.name} (${data.size} bytes)`,
        name: data.name,
        path: data.path,
      };
    }
    
    return {
      content: decodedContent,
      name: data.name,
      path: data.path,
    };
  }
);

const fileSlice = createSlice({
  name: 'file',
  initialState,
  reducers: {
    setFileContent: (state, action: PayloadAction<GitHubFileContent | null>) => {
      state.fileContent = action.payload;
    },
    setSelectedCode: (state, action: PayloadAction<string>) => {
      state.selectedCode = action.payload;
    },
    addSelectedFile: (state, action: PayloadAction<GitHubFileContent>) => {
      const exists = state.selectedFiles.some(f => f.path === action.payload.path);
      if (!exists) {
        state.selectedFiles.push(action.payload);
      }
    },
    removeSelectedFile: (state, action: PayloadAction<string>) => {
      state.selectedFiles = state.selectedFiles.filter(f => f.path !== action.payload);
    },
    clearSelectedFiles: (state) => {
      state.selectedFiles = [];
    },
    clearFileContent: (state) => {
      state.fileContent = null;
      state.selectedCode = '';
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchFileContent.fulfilled, (state, action) => {
        state.fileContent = action.payload;
      });
  },
});

export const {
  setFileContent,
  setSelectedCode,
  addSelectedFile,
  removeSelectedFile,
  clearSelectedFiles,
  clearFileContent,
} = fileSlice.actions;

export default fileSlice.reducer;

