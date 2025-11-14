'use client';
import { useEffect } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { SignInButton } from './SignInButton';
import { useAppDispatch, useAppSelector } from '../store/hooks';
import {
  fetchUserRepos,
  fetchDirectoryContents,
  setSelectedRepo,
  setCurrentPath,
  addToPathHistory,
  goBackInHistory,
  clearError as clearRepoError,
} from '../store/slices/repositorySlice';
import {
  fetchFileContent,
  setFileContent,
  setSelectedCode,
  addSelectedFile,
  removeSelectedFile,
  clearSelectedFiles,
  clearFileContent,
} from '../store/slices/fileSlice';
import {
  generateTestSummaries,
  generateTestCode,
  setTestFramework,
  setTestType,
  setSelectedTestForModal,
  setPrUrl,
  clearTests,
  addGeneratedTest,
} from '../store/slices/testSlice';
import {
  setLoading,
  setError,
  setIsFullScreen,
  setShowTestSection,
  setShowSummarySection,
  setIsGeneratingSummaries,
  setIsGeneratingTests,
  clearError as clearUiError,
} from '../store/slices/uiSlice';
import type { TestCase, TestCaseSummary } from '../store/slices/testSlice';
import type { GitHubFileContent } from '../store/slices/fileSlice';

import type { GitHubRepo, GitHubFileItem } from '../store/slices/repositorySlice';

declare module "next-auth" {
  interface Session {
    accessToken?: string;
  }
}

const RepoExplorerSection = () => {
  const { data: session, status } = useSession({
    required: false,
  });
  const dispatch = useAppDispatch();
  
  // Redux selectors
  const repos = useAppSelector((state) => state.repository.repos);
  const selectedRepo = useAppSelector((state) => state.repository.selectedRepo);
  const currentPath = useAppSelector((state) => state.repository.currentPath);
  const directoryContents = useAppSelector((state) => state.repository.directoryContents);
  const pathHistory = useAppSelector((state) => state.repository.pathHistory);
  const repoLoading = useAppSelector((state) => state.repository.loading);
  const repoError = useAppSelector((state) => state.repository.error);
  
  const fileContent = useAppSelector((state) => state.file.fileContent);
  const selectedCode = useAppSelector((state) => state.file.selectedCode);
  const selectedFiles = useAppSelector((state) => state.file.selectedFiles);
  
  const testCaseSummaries = useAppSelector((state) => state.test.testCaseSummaries);
  const generatedTests = useAppSelector((state) => state.test.generatedTests);
  const testFramework = useAppSelector((state) => state.test.testFramework);
  const testType = useAppSelector((state) => state.test.testType);
  const selectedTestForModal = useAppSelector((state) => state.test.selectedTestForModal);
  const prUrl = useAppSelector((state) => state.test.prUrl);
  
  const loading = useAppSelector((state) => state.ui.loading || state.repository.loading);
  const error = useAppSelector((state) => state.ui.error || state.repository.error);
  const isFullScreen = useAppSelector((state) => state.ui.isFullScreen);
  const showTestSection = useAppSelector((state) => state.ui.showTestSection);
  const showSummarySection = useAppSelector((state) => state.ui.showSummarySection);
  const isGeneratingSummaries = useAppSelector((state) => state.ui.isGeneratingSummaries);
  const isGeneratingTests = useAppSelector((state) => state.ui.isGeneratingTests);

  useEffect(() => {
    if (session?.accessToken) {
      dispatch(fetchUserRepos(session.accessToken));
    }
  }, [session, dispatch]);

  const getOwner = (repoName: string): string => {
    const selectedRepoObj = repos.find(r => r.name === repoName);
    return selectedRepoObj?.owner?.login || session?.user?.name || '';
  };

  const callGemini = async (prompt: string, maxTokens = 1000) => {
    try {
      const response = await fetch('/api/openai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prompt, maxTokens }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Extract error message from response
        const errorMessage = data.error || data.details || `API request failed with status ${response.status}`;
        const errorDetails = data.last_error ? ` Last error: ${data.last_error}` : '';
        const suggestion = data.suggestion ? ` Suggestion: ${data.suggestion}` : '';
        throw new Error(`${errorMessage}${errorDetails}${suggestion}`);
      }

      if (!data.result) {
        throw new Error('No result returned from API. ' + (data.error || 'Unknown error'));
      }

      return data.result;
    } catch (error) {
      console.error('Error calling Gemini AI:', error);
      throw error;
    }
  };


  // Helper function to clean and format code from API response
  const cleanCodeResponse = (code: string): string => {
    if (!code) return '';
    
    let cleaned = code;
    
    // Remove markdown code block markers if present
    cleaned = cleaned
      .replace(/```[\w]*\n?/g, '') // Remove opening code block markers (```js, ```javascript, etc.)
      .replace(/```\n?/g, '') // Remove closing code block markers
      .trim();
    
    // Handle escaped newlines - replace literal \n strings with actual newlines
    // This handles both single backslash (\n) and double backslash (\\n) cases
    cleaned = cleaned.replace(/\\n/g, '\n');
    cleaned = cleaned.replace(/\\r\\n/g, '\n'); // Handle Windows line endings
    cleaned = cleaned.replace(/\\r/g, '\n'); // Handle old Mac line endings
    
    // Replace literal \t strings with actual tabs
    cleaned = cleaned.replace(/\\t/g, '\t');
    
    // Replace other common escape sequences
    cleaned = cleaned.replace(/\\'/g, "'");
    cleaned = cleaned.replace(/\\"/g, '"');
    cleaned = cleaned.replace(/\\\\/g, '\\');
    
    // Split by newlines and clean each line
    const lines = cleaned.split('\n');
    
    // Remove empty lines at the start and end, but preserve internal empty lines
    while (lines.length > 0 && lines[0].trim() === '') {
      lines.shift();
    }
    while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
      lines.pop();
    }
    
    // Join back with newlines
    cleaned = lines.join('\n');
    
    return cleaned;
  };

  const handleGenerateTestCode = async (summary: TestCaseSummary) => {
    dispatch(setIsGeneratingTests(true));
    dispatch(setError(null));
    
    try {
      const file = selectedFiles.find(f => f.path === summary.filePath) || fileContent;
      if (!file) throw new Error('Original file content not found');

      const filesData = selectedFiles.length > 0 ? selectedFiles : (fileContent ? [fileContent] : []);
      await dispatch(generateTestCode({ summary, selectedFiles: filesData.map(f => ({ content: f.content, path: f.path })), testFramework, testType })).unwrap();
      dispatch(setShowTestSection(false));
    } catch (err) {
      console.error('Error generating test code:', err);
      dispatch(setError('Failed to generate test code'));
    } finally {
      dispatch(setIsGeneratingTests(false));
    }
  };

const createPullRequest = async (test: TestCase) => {
  if (!session?.accessToken || !selectedRepo) {
    dispatch(setError('Not authenticated or no repo selected'));
    return;
  }

  dispatch(setLoading(true));
  dispatch(setError(null));
  
  try {
    const selectedRepoObj = repos.find(r => r.name === selectedRepo);
    const owner = selectedRepoObj?.owner?.login || session.user?.name;
    
    console.log('Creating PR for repo:', `${owner}/${selectedRepo}`);
    
    // Step 1: Get the default branch (might be 'main' or 'master')
    const repoResponse = await fetch(
      `https://api.github.com/repos/${owner}/${selectedRepo}`,
      {
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    );
    
    if (!repoResponse.ok) {
      const errorData = await repoResponse.json();
      throw new Error(`Failed to get repo info: ${errorData.message}`);
    }
    
    const repoData = await repoResponse.json();
    const defaultBranch = repoData.default_branch; // This will be 'main', 'master', etc.
    
    console.log('Default branch:', defaultBranch);
    
    // Step 2: Get the latest commit SHA from the default branch
    const branchRefResponse = await fetch(
      `https://api.github.com/repos/${owner}/${selectedRepo}/git/refs/heads/${defaultBranch}`,
      {
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      }
    );
    
    if (!branchRefResponse.ok) {
      const errorData = await branchRefResponse.json();
      throw new Error(`Failed to get branch reference: ${errorData.message}`);
    }
    
    const branchRefData = await branchRefResponse.json();
    const baseSha = branchRefData.object.sha;
    
    console.log('Base SHA:', baseSha);
    
    // Step 3: Create a new branch with a unique name
    const timestamp = Date.now();
    const branchName = `add-test-${timestamp}`;
    
    const createBranchResponse = await fetch(
      `https://api.github.com/repos/${owner}/${selectedRepo}/git/refs`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ref: `refs/heads/${branchName}`,
          sha: baseSha,
        }),
      }
    );
    
    if (!createBranchResponse.ok) {
      const errorData = await createBranchResponse.json();
      throw new Error(`Failed to create branch: ${errorData.message}`);
    }
    
    console.log('Branch created:', branchName);
    
    // Step 4: Determine the test file path
    let testFilePath;
    if (test.filePath) {
      // Create test file next to the original file or in a tests directory
      const pathParts = test.filePath.split('/');
      const fileName = pathParts[pathParts.length - 1];
      const fileNameWithoutExt = fileName.split('.').slice(0, -1).join('.');
      const fileExt = fileName.split('.').pop();
      
      // Try to determine appropriate test file extension and path
      let testFileName;
      let testDir = 'tests';
      
      switch (fileExt) {
        case 'js':
        case 'jsx':
          testFileName = `${fileNameWithoutExt}.test.js`;
          break;
        case 'ts':
        case 'tsx':
          testFileName = `${fileNameWithoutExt}.test.ts`;
          break;
        case 'py':
          testFileName = `test_${fileNameWithoutExt}.py`;
          break;
        case 'java':
          testFileName = `${fileNameWithoutExt}Test.java`;
          testDir = 'src/test/java';
          break;
        default:
          testFileName = `${fileNameWithoutExt}.test.${fileExt}`;
      }
      
      testFilePath = `${testDir}/${testFileName}`;
    } else {
      testFilePath = `tests/test-${timestamp}.spec.js`;
    }
    
    console.log('Test file path:', testFilePath);
    
    // Step 5: Check if the tests directory exists, if not we'll create the file anyway
    // (GitHub will create directories automatically when creating files)
    
    // Step 6: Create the test file
    const createFileResponse = await fetch(
      `https://api.github.com/repos/${owner}/${selectedRepo}/contents/${testFilePath}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: `Add test: ${test.description}`,
          content: btoa(unescape(encodeURIComponent(test.code))), // Proper UTF-8 encoding
          branch: branchName,
        }),
      }
    );
    
    if (!createFileResponse.ok) {
      const errorData = await createFileResponse.json();
      throw new Error(`Failed to create test file: ${errorData.message}`);
    }
    
    console.log('Test file created');
    
    // Step 7: Create the pull request
    const prBody = `
## Automated Test Case

**Description:** ${test.description}

**Test Type:** ${test.type}
**Framework:** ${test.framework}
${test.filePath ? `**Original File:** ${test.filePath}` : ''}

---

This test case was automatically generated. Please review the test logic and modify as needed before merging.

### Generated Test File
\`${testFilePath}\`
    `.trim();
    
    const createPrResponse = await fetch(
      `https://api.github.com/repos/${owner}/${selectedRepo}/pulls`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: `🧪 Add ${test.type} test: ${test.description}`,
          head: branchName,
          base: defaultBranch, // Use the actual default branch
          body: prBody,
        }),
      }
    );

    if (!createPrResponse.ok) {
      const errorData = await createPrResponse.json();
      console.error('PR creation error:', errorData);
      throw new Error(`Failed to create PR: ${errorData.message || errorData.errors?.[0]?.message || 'Unknown error'}`);
    }

    const prData = await createPrResponse.json();
    console.log('Pull request created successfully:', prData.html_url);

    setPrUrl(prData.html_url);
    
    // Show success message
    setError(null);
    
  } catch (err) {
    console.error('Error creating PR:', err);
    setError(`Failed to create pull request: ${err instanceof Error ? err.message : 'Unknown error'}`);
  } finally {
    setLoading(false);
  }
};

  const handleCodeSelection = () => {
    if (typeof window !== 'undefined') {
      const selection = window.getSelection();
      if (selection && selection.toString().trim()) {
        setSelectedCode(selection.toString().trim());
      }
    }
  };

  const handleGenerateSummariesClick = async () => {
    const filesToAnalyze = selectedFiles.length > 0 ? selectedFiles : (fileContent ? [fileContent] : []);
    if (filesToAnalyze.length === 0) {
      dispatch(setError('Please select files to analyze'));
      return;
    }
    
    dispatch(setIsGeneratingSummaries(true));
    dispatch(setError(null));
    
    try {
      const filesData = filesToAnalyze.map(f => ({ content: f.content, path: f.path }));
      await dispatch(generateTestSummaries({ selectedFiles: filesData, testFramework, testType })).unwrap();
      dispatch(setShowSummarySection(true));
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      dispatch(setError(`Failed to generate test summaries: ${errorMessage}`));
    } finally {
      dispatch(setIsGeneratingSummaries(false));
    }
  };

  const handleFileSelect = (file: GitHubFileContent) => {
    const exists = selectedFiles.some(f => f.path === file.path);
    if (exists) {
      dispatch(removeSelectedFile(file.path));
    } else {
      dispatch(addSelectedFile(file));
    }
  };

  const handleRepoClick = (repoName: string) => {
    if (!session?.accessToken) {
      dispatch(setError('No access token available'));
      return;
    }
    dispatch(setSelectedRepo(repoName));
    dispatch(clearFileContent());
    dispatch(clearSelectedFiles());
    dispatch(clearTests());
    dispatch(setSelectedCode(''));
    const owner = getOwner(repoName);
    dispatch(fetchDirectoryContents({ owner, repo: repoName, path: '', accessToken: session.accessToken }));
  };

  const handleDirectoryClick = (item: GitHubFileItem) => {
    if (!session?.accessToken || !selectedRepo) return;
    
    if (item.type === 'dir') {
      const newPath = item.path;
      dispatch(addToPathHistory(newPath));
      const owner = getOwner(selectedRepo);
      dispatch(fetchDirectoryContents({ owner, repo: selectedRepo, path: newPath, accessToken: session.accessToken }));
    } else {
      const owner = getOwner(selectedRepo);
      dispatch(fetchFileContent({ owner, repo: selectedRepo, path: item.path, accessToken: session.accessToken }));
    }
  };

  const handleBackClick = () => {
    if (!session?.accessToken || !selectedRepo) return;
    
    dispatch(goBackInHistory());
    const previousPath = pathHistory.length > 1 ? pathHistory[pathHistory.length - 2] : '';
    const owner = getOwner(selectedRepo);
    dispatch(fetchDirectoryContents({ owner, repo: selectedRepo, path: previousPath, accessToken: session.accessToken }));
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  const getFileIcon = (item: GitHubFileItem) => {
    if (item.type === 'dir') return '📁';
    const ext = item.name.split('.').pop()?.toLowerCase();
    const iconMap: Record<string, string> = {
      'js': '🟨', 'jsx': '⚛️', 'ts': '🔵', 'tsx': '⚛️',
      'py': '🐍', 'java': '☕', 'cpp': '🔧', 'c': '🔧',
      'html': '🌐', 'css': '🎨', 'scss': '🎨',
      'json': '📋', 'xml': '📋', 'yaml': '📋', 'yml': '📋',
      'md': '📝', 'txt': '📄', 'pdf': '📕',
      'png': '🖼️', 'jpg': '🖼️', 'gif': '🖼️', 'svg': '🖼️',
      'zip': '📦', 'tar': '📦', 'gz': '📦'
    };
    return iconMap[ext || ''] || '📄';
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleClearTests = () => {
    dispatch(clearTests());
    dispatch(clearSelectedFiles());
    dispatch(setSelectedCode(''));
    dispatch(setShowTestSection(false));
    dispatch(setShowSummarySection(false));
  };

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] bg-gray-50 rounded-lg p-8">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">GitHub Repository Explorer</h2>
        <p className="text-gray-600 mb-6 text-center">
          Please sign in with GitHub to explore your repositories and generate test cases.
        </p>
        <SignInButton />
      </div>
    );
  }

  if (!session.accessToken) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] bg-gray-50 rounded-lg p-8">
        <h2 className="text-2xl font-bold mb-4 text-gray-800">GitHub Repository Explorer</h2>
        <p className="text-gray-600 mb-6 text-center">
          Access token not available. Please sign out and sign in again.
        </p>
        <button
          onClick={() => signIn('github')}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Sign In Again
        </button>
      </div>
    );
  }

  return (
    <div className={`bg-white overflow-hidden flex flex-col ${isFullScreen ? 'fixed inset-0 z-50 rounded-none' : 'rounded-lg shadow-md w-full'}`}>
      {/* Header */}
      <div className={`border-b bg-gradient-to-r from-blue-50 to-indigo-50 flex-shrink-0 ${isFullScreen ? 'p-4' : 'p-6'}`}>
        <div className="flex justify-between items-center">
          <div>
            <h2 className={`font-bold text-gray-800 ${isFullScreen ? 'text-xl' : 'text-2xl'}`}>GitHub Test Generator</h2>
            <p className={`text-gray-600 ${isFullScreen ? 'text-sm mt-0.5' : 'mt-1'}`}>Welcome, {session.user?.name}!</p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => dispatch(setIsFullScreen(!isFullScreen))}
              className={`${isFullScreen ? 'px-4 py-2' : 'px-3 py-2'} text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium`}
              title={isFullScreen ? 'Exit Full Screen' : 'Enter Full Screen'}
            >
              {isFullScreen ? (
                <span className="flex items-center space-x-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>Exit Full Screen</span>
                </span>
              ) : (
                <span className="flex items-center space-x-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                  <span>Full Screen</span>
                </span>
              )}
            </button>
            <button
              onClick={() => signOut()}
              className={`${isFullScreen ? 'px-4 py-2' : 'px-4 py-2'} bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium`}
            >
              Sign Out
            </button>
          </div>
        </div>
        
        {error && (
          <div className={`mt-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-md ${isFullScreen ? 'text-sm' : ''}`}>
            <div className="flex justify-between items-center">
              <span>{error}</span>
              <button 
                onClick={() => dispatch(clearUiError())}
                className="text-red-500 hover:text-red-700 font-bold"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>

      <div className={`flex flex-col flex-1 overflow-hidden ${isFullScreen ? 'h-[calc(100vh-120px)]' : 'min-h-[90vh] h-[90vh] max-h-[1200px]'}`}>
        {/* Main Explorer Section */}
        <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
          {/* Repo List */}
          <div className={`w-full border-r overflow-y-auto bg-gray-50 ${isFullScreen ? 'lg:w-64' : 'lg:w-1/5'}`}>
            <div className={`bg-gray-100 border-b sticky top-0 z-10 ${isFullScreen ? 'p-3' : 'p-4'}`}>
              <h3 className={`font-medium text-gray-700 ${isFullScreen ? 'text-sm' : ''}`}>Your Repositories</h3>
            </div>
            {loading && !repos.length ? (
              <div className="p-4 text-center text-gray-500">
                <div className="animate-pulse">Loading repositories...</div>
              </div>
            ) : (
              <ul>
                {repos.map((repo) => (
                  <li
                    key={repo.id}
                    className={`p-4 border-b cursor-pointer hover:bg-gray-100 ${
                      selectedRepo === repo.name ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                    }`}
                    onClick={() => handleRepoClick(repo.name)}
                  >
                    <h4 className="font-medium text-gray-800 text-sm">{repo.name}</h4>
                    <p className="text-xs text-gray-600 truncate mt-1">{repo.description || 'No description'}</p>
                    {repo.language && (
                      <span className="inline-block mt-2 px-2 py-1 text-xs bg-gray-200 rounded text-gray-700">
                        {repo.language}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* File Browser */}
          {selectedRepo && (
            <div className={`w-full border-r overflow-y-auto bg-gray-50 ${isFullScreen ? 'lg:w-80' : 'lg:w-1/5'}`}>
              <div className={`bg-gray-100 border-b sticky top-0 z-10 ${isFullScreen ? 'p-3' : 'p-4'}`}>
                <h3 className={`font-medium text-gray-700 mb-2 ${isFullScreen ? 'text-sm' : ''}`}>Files & Folders</h3>
                <div className={`text-gray-600 break-all ${isFullScreen ? 'text-xs' : 'text-xs'}`}>
                  <span className={`font-mono bg-white px-2 py-1 rounded ${isFullScreen ? 'text-xs' : ''}`}>
                    {selectedRepo}/{currentPath || 'root'}
                  </span>
                </div>
                {currentPath && (
                  <button
                    onClick={handleBackClick}
                    className={`mt-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors ${isFullScreen ? 'px-2 py-1 text-xs' : 'px-3 py-1 text-xs'}`}
                  >
                    ← Back
                  </button>
                )}
              </div>
              
              {loading ? (
                <div className="p-4 text-center text-gray-500">
                  <div className="animate-pulse">Loading...</div>
                </div>
              ) : (
                <ul>
                  {directoryContents.map((item, index) => (
                    <li
                      key={index}
                      className="p-3 border-b cursor-pointer hover:bg-gray-100"
                      onClick={() => handleDirectoryClick(item)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2 flex-1 min-w-0">
                          <span className="flex-shrink-0">{getFileIcon(item)}</span>
                          <span className="text-sm text-gray-800 truncate">{item.name}</span>
                        </div>
                        {item.type === 'file' && item.size && (
                          <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                            {formatFileSize(item.size)}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {/* Code Viewer */}
          <div className="flex-1 overflow-hidden flex flex-col">
            {fileContent ? (
              <div className="h-full flex flex-col">
                <div className={`bg-gray-800 text-gray-300 border-b border-gray-700 flex justify-between items-center flex-wrap ${isFullScreen ? 'px-4 py-3 gap-2' : 'px-5 py-4 gap-3'}`}>
                  <div className={`flex items-center min-w-0 flex-1 ${isFullScreen ? 'space-x-2' : 'space-x-3'}`}>
                    <svg className={`text-gray-400 flex-shrink-0 ${isFullScreen ? 'w-4 h-4' : 'w-5 h-5'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className={`font-medium truncate ${isFullScreen ? 'text-xs' : 'text-sm'}`}>{fileContent.path}</span>
                    {selectedFiles.some(f => f.path === fileContent.path) && (
                      <span className={`font-semibold bg-green-600 text-white rounded-full flex-shrink-0 ${isFullScreen ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs'}`}>Selected</span>
                    )}
                  </div>
                  <div className={`flex items-center flex-wrap ${isFullScreen ? 'space-x-1.5 gap-1.5' : 'space-x-2 gap-2'}`}>
                    <select
                      value={testFramework}
                      onChange={(e) => dispatch(setTestFramework(e.target.value))}
                      className={`bg-gray-700 text-gray-300 border border-gray-600 rounded-lg hover:bg-gray-600 transition-colors ${isFullScreen ? 'text-xs px-2 py-1' : 'text-sm px-3 py-1.5'}`}
                    >
                      <option value="jest">Jest</option>
                      <option value="mocha">Mocha</option>
                      <option value="pytest">PyTest</option>
                      <option value="junit">JUnit</option>
                      <option value="selenium">Selenium</option>
                    </select>
                    <select
                      value={testType}
                      onChange={(e) => dispatch(setTestType(e.target.value))}
                      className={`bg-gray-700 text-gray-300 border border-gray-600 rounded-lg hover:bg-gray-600 transition-colors ${isFullScreen ? 'text-xs px-2 py-1' : 'text-sm px-3 py-1.5'}`}
                    >
                      <option value="unit">Unit</option>
                      <option value="integration">Integration</option>
                      <option value="e2e">E2E</option>
                      <option value="ui">UI</option>
                    </select>
                    <button
                      onClick={() => handleFileSelect(fileContent)}
                      className={`font-medium rounded-lg transition-colors ${
                        selectedFiles.some(f => f.path === fileContent.path)
                          ? 'bg-red-600 text-white hover:bg-red-700'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      } ${isFullScreen ? 'px-3 py-1 text-xs' : 'px-4 py-1.5 text-sm'}`}
                    >
                      {selectedFiles.some(f => f.path === fileContent.path) ? 'Deselect' : 'Select File'}
                    </button>
                    <button
                      onClick={handleGenerateSummariesClick}
                      disabled={isGeneratingSummaries}
                      className={`font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center ${isFullScreen ? 'px-3 py-1 text-xs space-x-1.5' : 'px-4 py-1.5 text-sm space-x-2'}`}
                    >
                      {isGeneratingSummaries ? (
                        <>
                          <div className={`animate-spin border-2 border-white border-t-transparent rounded-full ${isFullScreen ? 'w-3 h-3' : 'w-4 h-4'}`}></div>
                          <span>Analyzing...</span>
                        </>
                      ) : (
                        <>
                          <svg className={isFullScreen ? 'w-3 h-3' : 'w-4 h-4'} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                          </svg>
                          <span>Analyze</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-auto" onMouseUp={handleCodeSelection}>
                  <SyntaxHighlighter
                    language={fileContent.name.split('.').pop() || 'javascript'}
                    style={vscDarkPlus}
                    showLineNumbers
                    customStyle={{ 
                      margin: 0, 
                      padding: isFullScreen ? '1rem' : '1.5rem', 
                      background: '#1a1a1a',
                      height: '100%',
                      minHeight: '100%',
                      fontSize: isFullScreen ? '13px' : '14px',
                      lineHeight: '1.6'
                    }}
                  >
                    {fileContent.content}
                  </SyntaxHighlighter>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 bg-gray-50">
                <div className="text-center">
                  <div className={`mb-6 ${isFullScreen ? 'text-6xl' : 'text-7xl'}`}>📁</div>
                  <p className={`font-medium text-gray-600 mb-2 ${isFullScreen ? 'text-lg' : 'text-xl'}`}>
                    {selectedRepo
                      ? 'Browse and select a file to view its content'
                      : 'Select a repository to browse its files'}
                  </p>
                  <p className={isFullScreen ? 'text-xs text-gray-500' : 'text-sm text-gray-500'}>
                    {selectedRepo ? 'Click on any file in the file browser to view its code' : 'Choose a repository from the list to get started'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Test Case Summary Section */}
        {showSummarySection && (
          <div className="border-t bg-gradient-to-br from-blue-50 to-indigo-50 flex-shrink-0 shadow-lg">
            <div className={`bg-white/80 backdrop-blur-sm border-b border-gray-200 flex justify-between items-center ${isFullScreen ? 'p-3' : 'p-5'}`}>
              <div className={`flex items-center ${isFullScreen ? 'space-x-2' : 'space-x-3'}`}>
                <div className={`bg-blue-100 rounded-lg ${isFullScreen ? 'p-1.5' : 'p-2'}`}>
                  <svg className={`text-blue-600 ${isFullScreen ? 'w-5 h-5' : 'w-6 h-6'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className={`font-semibold text-gray-800 ${isFullScreen ? 'text-base' : 'text-lg'}`}>Suggested Test Cases</h3>
                  <p className={isFullScreen ? 'text-xs text-gray-600' : 'text-sm text-gray-600'}>
                    {testCaseSummaries.length} suggestions from {selectedFiles.length || 1} file{selectedFiles.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <div className={`flex items-center ${isFullScreen ? 'space-x-1.5' : 'space-x-2'}`}>
                <button
                  onClick={() => dispatch(setShowSummarySection(!showSummarySection))}
                  className={`font-medium bg-white text-gray-700 rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors shadow-sm ${isFullScreen ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'}`}
                >
                  {showSummarySection ? 'Hide' : 'Show'} Suggestions
                </button>
                <button
                  onClick={handleClearTests}
                  className={`font-medium bg-red-50 text-red-700 rounded-lg border border-red-200 hover:bg-red-100 transition-colors ${isFullScreen ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'}`}
                >
                  Clear All
                </button>
              </div>
            </div>
            
            <div className="overflow-y-auto" style={{ maxHeight: isFullScreen ? 'calc(100vh - 500px)' : '600px' }}>
              {isGeneratingSummaries ? (
                <div className="text-center py-12">
                  <div className="inline-block relative">
                    <div className="animate-spin inline-block w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full mb-4"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-6 h-6 bg-blue-600 rounded-full animate-pulse"></div>
                    </div>
                  </div>
                  <p className="text-gray-700 font-medium">Analyzing code and generating test suggestions...</p>
                  <p className="text-sm text-gray-500 mt-2">This may take a few moments</p>
                </div>
              ) : testCaseSummaries.length > 0 ? (
                <div className={`grid grid-cols-1 ${isFullScreen ? 'lg:grid-cols-3 xl:grid-cols-4' : 'lg:grid-cols-2 xl:grid-cols-3'} gap-4 ${isFullScreen ? 'p-4' : 'p-6'}`}>
                  {testCaseSummaries.map((summary, index) => (
                    <div 
                      key={index} 
                      className="bg-white rounded-xl p-5 border border-gray-200 shadow-md hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 group"
                    >
                      <div className="flex justify-between items-start mb-4">
                        <h4 className="text-sm font-semibold text-gray-800 flex-1 pr-2 leading-snug">{summary.description}</h4>
                        <span className={`px-3 py-1 text-xs font-semibold rounded-full ml-2 flex-shrink-0 ${
                          summary.type === 'unit' ? 'bg-green-100 text-green-700 border border-green-200' :
                          summary.type === 'integration' ? 'bg-blue-100 text-blue-700 border border-blue-200' :
                          summary.type === 'e2e' ? 'bg-purple-100 text-purple-700 border border-purple-200' :
                          'bg-orange-100 text-orange-700 border border-orange-200'
                        }`}>
                          {summary.type.toUpperCase()}
                        </span>
                      </div>
                      <div className="space-y-2 mb-4">
                        <div className="flex items-center space-x-2">
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                          </svg>
                          <span className="text-xs font-medium text-gray-600">Framework: <span className="text-gray-800">{summary.framework}</span></span>
                        </div>
                        {summary.filePath && (
                          <div className="flex items-center space-x-2">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="text-xs text-gray-500 font-mono truncate">{summary.filePath}</span>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleGenerateTestCode(summary)}
                        disabled={isGeneratingTests}
                        className="w-full px-4 py-2.5 text-sm font-semibold bg-gradient-to-r from-green-600 to-green-700 text-white rounded-lg hover:from-green-700 hover:to-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-md hover:shadow-lg transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center space-x-2"
                      >
                        {isGeneratingTests ? (
                          <>
                            <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                            <span>Generating...</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            <span>Generate Test Code</span>
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16">
                  <div className="inline-block p-4 bg-blue-100 rounded-full mb-4">
                    <svg className="w-12 h-12 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <p className="text-gray-700 font-medium text-lg mb-2">No test suggestions generated yet</p>
                  <p className="text-sm text-gray-500">Select files and click "Analyze" to get test suggestions</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Generated Test Cases Notification */}
        {generatedTests.length > 0 && !selectedTestForModal && (
          <div className="border-t bg-gradient-to-br from-green-50 to-emerald-50 flex-shrink-0 shadow-lg">
            <div className={`bg-white/80 backdrop-blur-sm border-b border-gray-200 ${isFullScreen ? 'p-3' : 'p-4'}`}>
              <div className="flex items-center justify-between">
                <div className={`flex items-center ${isFullScreen ? 'space-x-2' : 'space-x-3'}`}>
                  <div className={`bg-green-100 rounded-lg ${isFullScreen ? 'p-1.5' : 'p-2'}`}>
                    <svg className={`text-green-600 ${isFullScreen ? 'w-4 h-4' : 'w-5 h-5'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className={`font-semibold text-gray-800 ${isFullScreen ? 'text-sm' : 'text-base'}`}>Generated Test Cases</h3>
                    <p className={isFullScreen ? 'text-xs text-gray-600' : 'text-sm text-gray-600'}>
                      {generatedTests.length} test{generatedTests.length !== 1 ? 's' : ''} generated • {testFramework} • {testType}
                    </p>
                  </div>
                </div>
                <div className={`flex items-center ${isFullScreen ? 'space-x-1.5' : 'space-x-2'}`}>
                  <button
                    onClick={() => dispatch(setSelectedTestForModal(generatedTests[generatedTests.length - 1]))}
                    className={`font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shadow-sm flex items-center ${isFullScreen ? 'px-3 py-1.5 text-xs space-x-1.5' : 'px-4 py-2 text-sm space-x-2'}`}
                  >
                    <svg className={isFullScreen ? 'w-3.5 h-3.5' : 'w-4 h-4'} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    <span>View Tests</span>
                  </button>
                  <button
                    onClick={handleClearTests}
                    className={`font-medium bg-red-50 text-red-700 rounded-lg border border-red-200 hover:bg-red-100 transition-colors ${isFullScreen ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'}`}
                  >
                    Clear
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Test Case Modal */}
      {selectedTestForModal && (
        <div 
          className={`fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60 backdrop-blur-sm ${isFullScreen ? 'p-2' : 'p-4'}`}
          onClick={() => dispatch(setSelectedTestForModal(null))}
        >
          <div 
            className={`bg-white shadow-2xl w-full flex flex-col overflow-hidden ${isFullScreen ? 'rounded-lg max-h-[98vh]' : 'rounded-2xl max-w-6xl max-h-[90vh]'}`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className={`bg-gradient-to-r from-indigo-600 to-purple-600 text-white border-b border-indigo-700 ${isFullScreen ? 'p-4' : 'p-6'}`}>
              <div className={`flex justify-between items-start ${isFullScreen ? 'mb-3' : 'mb-4'}`}>
                <div className={`flex-1 ${isFullScreen ? 'pr-3' : 'pr-4'}`}>
                  <h3 className={`font-bold mb-2 ${isFullScreen ? 'text-xl' : 'text-2xl'}`}>{selectedTestForModal.description}</h3>
                  <div className="flex items-center space-x-3 flex-wrap gap-2">
                    <span className={`px-3 py-1 text-sm font-semibold rounded-full ${
                      selectedTestForModal.type === 'unit' ? 'bg-green-100 text-green-800' :
                      selectedTestForModal.type === 'integration' ? 'bg-blue-100 text-blue-800' :
                      selectedTestForModal.type === 'e2e' ? 'bg-purple-100 text-purple-800' :
                      'bg-orange-100 text-orange-800'
                    }`}>
                      {selectedTestForModal.type.toUpperCase()}
                    </span>
                    <span className="px-3 py-1 text-sm font-semibold bg-white text-gray-800 rounded-full">
                      {selectedTestForModal.framework}
                    </span>
                    {selectedTestForModal.filePath && (
                      <div className="flex items-center space-x-2 text-sm bg-white/20 rounded-full px-3 py-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span className="font-mono text-xs">{selectedTestForModal.filePath}</span>
                      </div>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => dispatch(setSelectedTestForModal(null))}
                  className={`hover:bg-white/20 rounded-lg transition-colors flex-shrink-0 ${isFullScreen ? 'p-1.5' : 'p-2'}`}
                >
                  <svg className={isFullScreen ? 'w-5 h-5' : 'w-6 h-6'} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body - Code */}
            <div className="flex-1 overflow-hidden flex flex-col bg-gray-900">
              <div className={`bg-gray-800 border-b border-gray-700 flex items-center justify-between ${isFullScreen ? 'p-3' : 'p-4'}`}>
                <div className={`flex items-center text-gray-300 ${isFullScreen ? 'space-x-1.5 text-xs' : 'space-x-2 text-sm'}`}>
                  <svg className={isFullScreen ? 'w-4 h-4' : 'w-5 h-5'} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                  <span className="font-mono">
                    {selectedTestForModal.framework === 'pytest' ? 'Python' : selectedTestForModal.framework === 'junit' ? 'Java' : 'JavaScript'}
                  </span>
                </div>
                <button
                  onClick={() => copyToClipboard(selectedTestForModal.code)}
                  className={`font-medium bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors flex items-center ${isFullScreen ? 'px-3 py-1.5 text-xs space-x-1.5' : 'px-4 py-2 text-sm space-x-2'}`}
                >
                  <svg className={isFullScreen ? 'w-3.5 h-3.5' : 'w-4 h-4'} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span>Copy Code</span>
                </button>
              </div>
              <div className={`flex-1 overflow-auto ${isFullScreen ? 'p-4' : 'p-6'}`}>
                <SyntaxHighlighter
                  language={
                    selectedTestForModal.framework === 'pytest' ? 'python' : 
                    selectedTestForModal.framework === 'junit' ? 'java' : 
                    (selectedTestForModal.code.includes('import') && selectedTestForModal.code.includes('from')) || 
                    selectedTestForModal.code.includes('interface') || 
                    selectedTestForModal.code.includes('type ') ? 'typescript' :
                    'javascript'
                  }
                  style={vscDarkPlus}
                  customStyle={{ 
                    margin: 0, 
                    padding: 0,
                    background: 'transparent',
                    fontSize: isFullScreen ? '14px' : '15px',
                    lineHeight: '1.8'
                  }}
                  showLineNumbers
                  PreTag="div"
                  codeTagProps={{
                    style: {
                      fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace'
                    }
                  }}
                >
                  {cleanCodeResponse(selectedTestForModal.code)}
                </SyntaxHighlighter>
              </div>
            </div>

            {/* Modal Footer */}
            <div className={`bg-gray-50 border-t border-gray-200 flex items-center justify-between flex-wrap ${isFullScreen ? 'p-4 gap-2' : 'p-6 gap-3'}`}>
              <button
                onClick={() => createPullRequest(selectedTestForModal)}
                disabled={loading}
                className={`font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center shadow-lg ${isFullScreen ? 'px-4 py-2 text-sm space-x-1.5' : 'px-6 py-3 text-base space-x-2'}`}
              >
                {loading ? (
                  <>
                    <div className={`animate-spin border-2 border-white border-t-transparent rounded-full ${isFullScreen ? 'w-4 h-4' : 'w-5 h-5'}`}></div>
                    <span>Creating Pull Request...</span>
                  </>
                ) : prUrl ? (
                  <>
                    <svg className={isFullScreen ? 'w-4 h-4' : 'w-5 h-5'} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>PR Created</span>
                  </>
                ) : (
                  <>
                    <svg className={isFullScreen ? 'w-4 h-4' : 'w-5 h-5'} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    <span>Create Pull Request</span>
                  </>
                )}
              </button>
              <div className={`flex items-center ${isFullScreen ? 'space-x-1.5' : 'space-x-2'}`}>
                {generatedTests.length > 1 && (
                  <>
                    <button
                      onClick={() => {
                        const currentIndex = generatedTests.findIndex(t => t.id === selectedTestForModal.id);
                        const prevIndex = currentIndex > 0 ? currentIndex - 1 : generatedTests.length - 1;
                        setSelectedTestForModal(generatedTests[prevIndex]);
                      }}
                      className={`font-medium bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors ${isFullScreen ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'}`}
                    >
                      ← Previous
                    </button>
                    <span className={`text-gray-600 ${isFullScreen ? 'text-xs px-1.5' : 'text-sm px-2'}`}>
                      {generatedTests.findIndex(t => t.id === selectedTestForModal.id) + 1} / {generatedTests.length}
                    </span>
                    <button
                      onClick={() => {
                        const currentIndex = generatedTests.findIndex(t => t.id === selectedTestForModal.id);
                        const nextIndex = currentIndex < generatedTests.length - 1 ? currentIndex + 1 : 0;
                        dispatch(setSelectedTestForModal(generatedTests[nextIndex]));
                      }}
                      className={`font-medium bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors ${isFullScreen ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'}`}
                    >
                      Next →
                    </button>
                  </>
                )}
                <button
                  onClick={() => dispatch(setSelectedTestForModal(null))}
                  className={`font-medium bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors ${isFullScreen ? 'px-4 py-2 text-sm' : 'px-6 py-2 text-base'}`}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RepoExplorerSection;