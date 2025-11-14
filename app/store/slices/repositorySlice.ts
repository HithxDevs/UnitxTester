import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';

export interface GitHubRepo {
  id: number;
  name: string;
  description: string;
  html_url: string;
  language: string;
  owner: {
    login: string;
  };
}

export interface GitHubFileItem {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size?: number;
}

interface RepositoryState {
  repos: GitHubRepo[];
  selectedRepo: string | null;
  currentPath: string;
  directoryContents: GitHubFileItem[];
  pathHistory: string[];
  loading: boolean;
  error: string | null;
}

const initialState: RepositoryState = {
  repos: [],
  selectedRepo: null,
  currentPath: '',
  directoryContents: [],
  pathHistory: [''],
  loading: false,
  error: null,
};

// Async thunks
export const fetchUserRepos = createAsyncThunk(
  'repository/fetchUserRepos',
  async (accessToken: string) => {
    const response = await fetch('https://api.github.com/user/repos', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });
    if (!response.ok) {
      throw new Error('Failed to fetch repositories');
    }
    return await response.json();
  }
);

export const fetchDirectoryContents = createAsyncThunk(
  'repository/fetchDirectoryContents',
  async ({ owner, repo, path, accessToken }: { owner: string; repo: string; path: string; accessToken: string }) => {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });
    if (!response.ok) {
      throw new Error('Failed to fetch directory contents');
    }
    const data = await response.json();
    if (Array.isArray(data)) {
      const sortedData = data.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      return sortedData.map((item: any) => ({
        name: item.name,
        path: item.path,
        type: item.type as 'file' | 'dir',
        size: item.size,
      }));
    }
    return [];
  }
);

const repositorySlice = createSlice({
  name: 'repository',
  initialState,
  reducers: {
    setSelectedRepo: (state, action: PayloadAction<string | null>) => {
      state.selectedRepo = action.payload;
      state.currentPath = '';
      state.pathHistory = [''];
      state.directoryContents = [];
    },
    setDirectoryContents: (state, action: PayloadAction<GitHubFileItem[]>) => {
      state.directoryContents = action.payload;
    },
    setCurrentPath: (state, action: PayloadAction<string>) => {
      state.currentPath = action.payload;
    },
    addToPathHistory: (state, action: PayloadAction<string>) => {
      state.pathHistory.push(action.payload);
    },
    goBackInHistory: (state) => {
      if (state.pathHistory.length > 1) {
        state.pathHistory.pop();
        const newPath = state.pathHistory[state.pathHistory.length - 1];
        state.currentPath = newPath;
      }
    },
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUserRepos.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUserRepos.fulfilled, (state, action) => {
        state.loading = false;
        state.repos = action.payload;
      })
      .addCase(fetchUserRepos.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch repositories';
      })
      .addCase(fetchDirectoryContents.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDirectoryContents.fulfilled, (state, action) => {
        state.loading = false;
        state.directoryContents = action.payload;
        state.currentPath = action.meta.arg.path;
      })
      .addCase(fetchDirectoryContents.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch directory contents';
      });
  },
});

export const {
  setSelectedRepo,
  setCurrentPath,
  addToPathHistory,
  goBackInHistory,
  clearError,
  setDirectoryContents,
} = repositorySlice.actions;

export default repositorySlice.reducer;

