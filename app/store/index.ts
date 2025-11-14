import { configureStore } from '@reduxjs/toolkit';
import repositoryReducer from './slices/repositorySlice';
import fileReducer from './slices/fileSlice';
import testReducer from './slices/testSlice';
import uiReducer from './slices/uiSlice';

export const store = configureStore({
  reducer: {
    repository: repositoryReducer,
    file: fileReducer,
    test: testReducer,
    ui: uiReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

