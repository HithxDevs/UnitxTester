import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';

export interface TestCase {
  id: string;
  description: string;
  code: string;
  type: 'unit' | 'integration' | 'e2e' | 'ui';
  status: 'suggested' | 'generated';
  framework: string;
  filePath?: string;
}

export interface TestCaseSummary {
  id: string;
  description: string;
  type: 'unit' | 'integration' | 'e2e' | 'ui';
  framework: string;
  filePath?: string;
}

interface TestState {
  testCaseSummaries: TestCaseSummary[];
  generatedTests: TestCase[];
  testFramework: string;
  testType: string;
  selectedTestForModal: TestCase | null;
  prUrl: string | null;
}

const initialState: TestState = {
  testCaseSummaries: [],
  generatedTests: [],
  testFramework: 'jest',
  testType: 'unit',
  selectedTestForModal: null,
  prUrl: null,
};

// Async thunks
export const generateTestSummaries = createAsyncThunk(
  'test/generateTestSummaries',
  async ({ selectedFiles, testFramework, testType }: {
    selectedFiles: Array<{ content: string; path: string }>;
    testFramework: string;
    testType: string;
  }) => {
    const filesContent = selectedFiles.map(f => `File: ${f.path}\n${f.content}`).join('\n\n---\n\n');
    const prompt = `Analyze the following code files and suggest test cases. Framework: ${testFramework}, Type: ${testType}\n\n${filesContent}\n\nProvide test case suggestions in JSON format: [{"id": "unique-id", "description": "test description", "type": "${testType}", "framework": "${testFramework}", "filePath": "file/path.ts"}]`;
    
    const response = await fetch('/api/openai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, maxTokens: 2000 }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to generate test summaries');
    }
    
    const data = await response.json();
    return JSON.parse(data.result);
  }
);

export const generateTestCode = createAsyncThunk(
  'test/generateTestCode',
  async ({ summary, selectedFiles, testFramework, testType }: {
    summary: TestCaseSummary;
    selectedFiles: Array<{ content: string; path: string }>;
    testFramework: string;
    testType: string;
  }) => {
    const filesContent = selectedFiles.map(f => `File: ${f.path}\n${f.content}`).join('\n\n---\n\n');
    const prompt = `Generate complete test code for: ${summary.description}\nFramework: ${testFramework}, Type: ${testType}\n\nCode files:\n${filesContent}\n\nProvide only the test code, no explanations.`;
    
    const response = await fetch('/api/openai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, maxTokens: 2000 }),
    });
    
    if (!response.ok) {
      throw new Error('Failed to generate test code');
    }
    
    const data = await response.json();
    return {
      ...summary,
      code: data.result,
    };
  }
);

const testSlice = createSlice({
  name: 'test',
  initialState,
  reducers: {
    setTestFramework: (state, action: PayloadAction<string>) => {
      state.testFramework = action.payload;
    },
    setTestType: (state, action: PayloadAction<string>) => {
      state.testType = action.payload;
    },
    setSelectedTestForModal: (state, action: PayloadAction<TestCase | null>) => {
      state.selectedTestForModal = action.payload;
    },
    setPrUrl: (state, action: PayloadAction<string | null>) => {
      state.prUrl = action.payload;
    },
    clearTests: (state) => {
      state.testCaseSummaries = [];
      state.generatedTests = [];
      state.selectedTestForModal = null;
      state.prUrl = null;
    },
    addGeneratedTest: (state, action: PayloadAction<TestCase>) => {
      const exists = state.generatedTests.some(t => t.id === action.payload.id);
      if (!exists) {
        state.generatedTests.push(action.payload);
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(generateTestSummaries.pending, (state) => {
        // Loading handled in UI slice
      })
      .addCase(generateTestSummaries.fulfilled, (state, action) => {
        state.testCaseSummaries = action.payload.map((item: any, index: number) => ({
          id: item.id || `summary-${Date.now()}-${index}`,
          description: item.description,
          type: item.type,
          framework: item.framework || state.testFramework,
          filePath: item.filePath,
        }));
      })
      .addCase(generateTestSummaries.rejected, (state) => {
        // Error handled in UI slice
      })
      .addCase(generateTestCode.pending, (state) => {
        // Loading handled in UI slice
      })
      .addCase(generateTestCode.fulfilled, (state, action) => {
        const newTest: TestCase = {
          ...action.payload,
          id: action.payload.id || `test-${Date.now()}`,
          status: 'generated',
        };
        const exists = state.generatedTests.some(t => t.id === newTest.id);
        if (!exists) {
          state.generatedTests.push(newTest);
        }
        state.selectedTestForModal = newTest;
      })
      .addCase(generateTestCode.rejected, (state) => {
        // Error handled in UI slice
      });
  },
});

export const {
  setTestFramework,
  setTestType,
  setSelectedTestForModal,
  setPrUrl,
  clearTests,
  addGeneratedTest,
} = testSlice.actions;

export default testSlice.reducer;

