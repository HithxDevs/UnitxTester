'use client';
import { useState, useEffect } from 'react';
import { useSession, signIn, signOut } from 'next-auth/react';
import SyntaxHighlighter from 'react-syntax-highlighter';
import { atomOneDark } from 'react-syntax-highlighter/dist/cjs/styles/hljs';
import { SignInButton } from './SignInButton';

interface GitHubRepo {
  id: number;
  name: string;
  description: string;
  html_url: string;
  language: string;
  owner: {
    login: string;
  };
}

interface GitHubFileContent {
  content: string;
  name: string;
  path: string;
}

interface GitHubFileItem {
  name: string;
  path: string;
  type: 'file' | 'dir';
  size?: number;
}

interface TestCase {
  id: string;
  description: string;
  code: string;
  type: 'unit' | 'integration' | 'e2e' | 'ui';
  status: 'suggested' | 'generated';
  framework: string;
  filePath?: string;
}

interface TestCaseSummary {
  id: string;
  description: string;
  type: 'unit' | 'integration' | 'e2e' | 'ui';
  framework: string;
  filePath?: string;
}

declare module "next-auth" {
  interface Session {
    accessToken?: string;
  }
}

const RepoExplorerSection = () => {
  const { data: session } = useSession();
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string | null>(null);
  const [currentPath, setCurrentPath] = useState<string>('');
  const [directoryContents, setDirectoryContents] = useState<GitHubFileItem[]>([]);
  const [fileContent, setFileContent] = useState<GitHubFileContent | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pathHistory, setPathHistory] = useState<string[]>(['']);
  const [selectedCode, setSelectedCode] = useState<string>('');
  const [selectedFiles, setSelectedFiles] = useState<GitHubFileContent[]>([]);
  const [testCaseSummaries, setTestCaseSummaries] = useState<TestCaseSummary[]>([]);
  const [generatedTests, setGeneratedTests] = useState<TestCase[]>([]);
  const [isGeneratingTests, setIsGeneratingTests] = useState(false);
  const [isGeneratingSummaries, setIsGeneratingSummaries] = useState(false);
  const [testFramework, setTestFramework] = useState<string>('jest');
  const [testType, setTestType] = useState<string>('unit');
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [showTestSection, setShowTestSection] = useState(false);
  const [showSummarySection, setShowSummarySection] = useState(false);
  const [prUrl, setPrUrl] = useState<string | null>(null);

  useEffect(() => {
    if (session?.accessToken) {
      fetchUserRepos();
    }
  }, [session]);

  const fetchUserRepos = async () => {
    if (!session?.accessToken) {
      setError('No access token available');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch('https://api.github.com/user/repos', {
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
          'Accept': 'application/vnd.github.v3+json',
        },
      });
      
      if (!response.ok) throw new Error(`Failed to fetch repositories: ${response.status}`);
      
      const data = await response.json();
      setRepos(data);
    } catch (err) {
      console.error('Error fetching repos:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const fetchDirectoryContents = async (repo: string, path: string = '') => {
    if (!session?.accessToken) {
      setError('No access token available');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const selectedRepoObj = repos.find(r => r.name === repo);
      const owner = selectedRepoObj?.owner?.login || session.user?.name;
      
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
        {
          headers: {
            'Authorization': `Bearer ${session.accessToken}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        }
      );
      
      if (!response.ok) throw new Error(`Failed to fetch directory contents: ${response.status}`);
      
      const data = await response.json();
      
      if (Array.isArray(data)) {
        const sortedData = data.sort((a, b) => {
          if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
          return a.name.localeCompare(b.name);
        });

        setDirectoryContents(sortedData.map(item => ({
          name: item.name,
          path: item.path,
          type: item.type as 'file' | 'dir',
          size: item.size,
        })));
        setCurrentPath(path);
        setFileContent(null);
      }
    } catch (err) {
      console.error('Error fetching directory contents:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const fetchFileContent = async (repo: string, filePath: string) => {
    if (!session?.accessToken) {
      setError('No access token available');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const selectedRepoObj = repos.find(r => r.name === repo);
      const owner = selectedRepoObj?.owner?.login || session.user?.name;
      
      const response = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
        {
          headers: {
            'Authorization': `Bearer ${session.accessToken}`,
            'Accept': 'application/vnd.github.v3+json',
          },
        }
      );
      
      if (!response.ok) throw new Error(`Failed to fetch file content: ${response.status}`);
      
      const data = await response.json();
      
      if (data.type === 'file') {
        try {
          if (data.size > 1000000) {
            setError('File is too large to display (>1MB)');
            return;
          }
          
          const decodedContent = atob(data.content.replace(/\s/g, ''));
          const isBinary = /[\x00-\x08\x0E-\x1F\x7F-\xFF]/.test(decodedContent.substring(0, 1000));
          
          if (isBinary) {
            setFileContent({
              content: `Binary file: ${data.name} (${data.size} bytes)`,
              name: data.name,
              path: data.path,
            });
          } else {
            setFileContent({
              content: decodedContent,
              name: data.name,
              path: data.path,
            });
          }
        } catch (decodeError) {
          console.error('Decode error:', decodeError);
          setError('Failed to decode file content');
        }
      }
    } catch (err) {
      console.error('Error fetching file content:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    } finally {
      setLoading(false);
    }
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

  const generateTestSummaries = async (files: GitHubFileContent[]) => {
    if (!files.length) {
      setError('Please select at least one file');
      return;
    }

    setIsGeneratingSummaries(true);
    setError(null);
    
    try {
      const fileContents = files.map(f => `File: ${f.path}\n${f.content.substring(0, 1000)}`).join('\n\n');
      
      const prompt = `
        Analyze the following code files and suggest comprehensive test cases.
        For each suggestion include:
        - A clear description of what the test should verify
        - The type of test (unit, integration, e2e, ui)
        - The most appropriate testing framework
        
        Code files:
        ${fileContents}
        
        Respond with a JSON array of test case summaries like this:
        [{
          "description": "Test description",
          "type": "test type",
          "framework": "suggested framework",
          "filePath": "relevant file path"
        }]
      `;

      const result = await callGemini(prompt);

      let summaries;
      try {
        summaries = JSON.parse(result);
      } catch (parseError) {
        console.error('JSON Parse Error:', parseError);
        console.log('Raw result:', result);
        
        const jsonMatch = result.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          try {
            summaries = JSON.parse(jsonMatch[1]);
          } catch (secondParseError) {
            throw new Error('Could not parse response as JSON: ' + result);
          }
        } else {
          throw new Error('Response is not valid JSON: ' + result);
        }
      }

      setTestCaseSummaries(summaries);
      setShowSummarySection(true);
    } catch (err) {
      console.error('Error generating test summaries:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(`Failed to generate test summaries: ${errorMessage}`);
    } finally {
      setIsGeneratingSummaries(false);
    }
  };

  const generateTestCode = async (summary: TestCaseSummary) => {
    setIsGeneratingTests(true);
    setError(null);
    
    try {
      const file = selectedFiles.find(f => f.path === summary.filePath) || fileContent;
      if (!file) throw new Error('Original file content not found');

      const prompt = `
        Write a complete test implementation for the following test case.
        Use ${summary.framework} for ${summary.type} testing.
        Include all necessary imports and setup.
        
        Test description: ${summary.description}
        File to test: ${file.path}
        Code context:
        ${file.content.substring(0, 2000)}
        
        Respond with just the complete test code in a code block.
      `;

      const testCode = await callGemini(prompt, 2000);
      
      const newTest: TestCase = {
        ...summary,
        id: `test-${Date.now()}`,
        code: testCode,
        status: 'generated',
      };
      
      setGeneratedTests(prev => [...prev, newTest]);
      setShowTestSection(true);
    } catch (err) {
      console.error('Error generating test code:', err);
      setError('Failed to generate test code');
    } finally {
      setIsGeneratingTests(false);
    }
  };

const createPullRequest = async (test: TestCase) => {
  if (!session?.accessToken || !selectedRepo) {
    setError('Not authenticated or no repo selected');
    return;
  }

  setLoading(true);
  setError(null);
  
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
    if (selectedFiles.length > 0) {
      await generateTestSummaries(selectedFiles);
    } else if (fileContent) {
      await generateTestSummaries([fileContent]);
    } else {
      setError('Please select files to analyze');
    }
  };

  const handleFileSelect = (file: GitHubFileContent) => {
    setSelectedFiles(prev => {
      const exists = prev.some(f => f.path === file.path);
      return exists 
        ? prev.filter(f => f.path !== file.path)
        : [...prev, file];
    });
  };

  const handleRepoClick = (repoName: string) => {
    setSelectedRepo(repoName);
    setCurrentPath('');
    setPathHistory(['']);
    setFileContent(null);
    setDirectoryContents([]);
    setSelectedFiles([]);
    setTestCaseSummaries([]);
    setGeneratedTests([]);
    setSelectedCode('');
    fetchDirectoryContents(repoName);
  };

  const handleDirectoryClick = (item: GitHubFileItem) => {
    if (item.type === 'dir') {
      const newPath = item.path;
      setPathHistory(prev => [...prev, newPath]);
      fetchDirectoryContents(selectedRepo!, newPath);
    } else {
      fetchFileContent(selectedRepo!, item.path);
    }
  };

  const handleBackClick = () => {
    if (pathHistory.length > 1) {
      const newHistory = pathHistory.slice(0, -1);
      const previousPath = newHistory[newHistory.length - 1];
      setPathHistory(newHistory);
      fetchDirectoryContents(selectedRepo!, previousPath);
    }
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

  const clearTests = () => {
    setGeneratedTests([]);
    setTestCaseSummaries([]);
    setSelectedFiles([]);
    setSelectedCode('');
    setShowTestSection(false);
    setShowSummarySection(false);
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
    <div className={`bg-white rounded-lg shadow-md overflow-hidden ${isFullScreen ? 'fixed inset-0 z-50' : ''}`}>
      {/* Header */}
      <div className="p-6 border-b bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">GitHub Test Generator</h2>
            <p className="text-gray-600 mt-1">Welcome, {session.user?.name}!</p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              title={isFullScreen ? 'Exit Full Screen' : 'Enter Full Screen'}
            >
              {isFullScreen ? '📱 Exit Full' : '🖥️ Full Screen'}
            </button>
            <button
              onClick={() => signOut()}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Sign Out
            </button>
          </div>
        </div>
        
        {error && (
          <div className="mt-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-md">
            <div className="flex justify-between items-center">
              <span>{error}</span>
              <button 
                onClick={() => setError(null)}
                className="text-red-500 hover:text-red-700"
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>

      <div className={`flex flex-col ${isFullScreen ? 'h-[calc(100vh-110px)]' : 'h-[700px]'}`}>
        {/* Main Explorer Section */}
        <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
          {/* Repo List */}
          <div className="w-full lg:w-1/5 border-r overflow-y-auto bg-gray-50">
            <div className="p-4 bg-gray-100 border-b sticky top-0">
              <h3 className="font-medium text-gray-700">Your Repositories</h3>
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
            <div className="w-full lg:w-1/5 border-r overflow-y-auto bg-gray-50">
              <div className="p-4 bg-gray-100 border-b sticky top-0">
                <h3 className="font-medium text-gray-700 mb-2">Files & Folders</h3>
                <div className="text-xs text-gray-600 break-all">
                  <span className="font-mono bg-white px-2 py-1 rounded">
                    {selectedRepo}/{currentPath || 'root'}
                  </span>
                </div>
                {currentPath && (
                  <button
                    onClick={handleBackClick}
                    className="mt-2 px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
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
                <div className="px-4 py-3 bg-gray-800 text-gray-300 border-b border-gray-700 flex justify-between items-center flex-wrap gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium truncate max-w-xs">{fileContent.path}</span>
                    {selectedFiles.some(f => f.path === fileContent.path) && (
                      <span className="px-2 py-0.5 text-xs bg-green-600 text-white rounded">Selected</span>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <select
                      value={testFramework}
                      onChange={(e) => setTestFramework(e.target.value)}
                      className="text-xs bg-gray-700 text-gray-300 border border-gray-600 rounded px-2 py-1"
                    >
                      <option value="jest">Jest</option>
                      <option value="mocha">Mocha</option>
                      <option value="pytest">PyTest</option>
                      <option value="junit">JUnit</option>
                      <option value="selenium">Selenium</option>
                    </select>
                    <select
                      value={testType}
                      onChange={(e) => setTestType(e.target.value)}
                      className="text-xs bg-gray-700 text-gray-300 border border-gray-600 rounded px-2 py-1"
                    >
                      <option value="unit">Unit</option>
                      <option value="integration">Integration</option>
                      <option value="e2e">E2E</option>
                      <option value="ui">UI</option>
                    </select>
                    <button
                      onClick={() => handleFileSelect(fileContent)}
                      className={`px-3 py-1 text-xs rounded ${
                        selectedFiles.some(f => f.path === fileContent.path)
                          ? 'bg-red-600 text-white hover:bg-red-700'
                          : 'bg-blue-600 text-white hover:bg-blue-700'
                      }`}
                    >
                      {selectedFiles.some(f => f.path === fileContent.path) ? 'Deselect' : 'Select File'}
                    </button>
                    <button
                      onClick={handleGenerateSummariesClick}
                      disabled={isGeneratingSummaries}
                      className="px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                    >
                      {isGeneratingSummaries ? 'Analyzing...' : 'Analyze'}
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-auto" onMouseUp={handleCodeSelection}>
                  <SyntaxHighlighter
                    language={fileContent.name.split('.').pop()}
                    style={atomOneDark}
                    showLineNumbers
                    customStyle={{ 
                      margin: 0, 
                      padding: '1rem', 
                      background: '#1a1a1a',
                      height: '100%',
                      minHeight: '100%'
                    }}
                  >
                    {fileContent.content}
                  </SyntaxHighlighter>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400">
                <div className="text-center">
                  <div className="text-6xl mb-4">📁</div>
                  <p className="text-lg">
                    {selectedRepo
                      ? 'Browse and select a file to view its content'
                      : 'Select a repository to browse its files'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Test Case Summary Section */}
        {showSummarySection && (
          <div className="border-t bg-white flex-shrink-0">
            <div className="p-4 bg-blue-50 border-b flex justify-between items-center">
              <div>
                <h3 className="font-medium text-gray-800">Suggested Test Cases</h3>
                <p className="text-sm text-gray-600">
                  {testCaseSummaries.length} suggestions generated from {selectedFiles.length || 1} files
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowSummarySection(!showSummarySection)}
                  className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                >
                  {showSummarySection ? 'Hide' : 'Show'} Suggestions
                </button>
                <button
                  onClick={clearTests}
                  className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                >
                  Clear All
                </button>
              </div>
            </div>
            
            <div className="overflow-y-auto" style={{ maxHeight: '200px' }}>
              {isGeneratingSummaries ? (
                <div className="text-center py-8">
                  <div className="animate-spin inline-block w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full mb-4"></div>
                  <p className="text-gray-600">Analyzing code and generating test suggestions...</p>
                </div>
              ) : testCaseSummaries.length > 0 ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 p-4">
                  {testCaseSummaries.map((summary, index) => (
                    <div key={index} className="bg-white rounded-lg p-4 border shadow-sm">
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="text-sm font-medium text-gray-800 flex-1">{summary.description}</h4>
                        <span className={`px-2 py-1 text-xs rounded ml-2 ${
                          summary.type === 'unit' ? 'bg-green-100 text-green-700' :
                          summary.type === 'integration' ? 'bg-blue-100 text-blue-700' :
                          summary.type === 'e2e' ? 'bg-purple-100 text-purple-700' :
                          'bg-orange-100 text-orange-700'
                        }`}>
                          {summary.type}
                        </span>
                      </div>
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-xs text-gray-600">Framework: {summary.framework}</span>
                        {summary.filePath && (
                          <span className="text-xs text-gray-500 truncate max-w-xs">{summary.filePath}</span>
                        )}
                      </div>
                      <button
                        onClick={() => generateTestCode(summary)}
                        disabled={isGeneratingTests}
                        className="w-full mt-2 px-3 py-1 text-xs bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                      >
                        Generate Test Code
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-4xl mb-4">🧪</div>
                  <p className="text-gray-600 mb-2">No test suggestions generated yet.</p>
                  <p className="text-sm text-gray-500">Select files and click "Analyze" to get test suggestions.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Generated Test Cases Section */}
        {showTestSection && (
          <div className="border-t bg-white flex-shrink-0">
            <div className="p-4 bg-green-50 border-b flex justify-between items-center">
              <div>
                <h3 className="font-medium text-gray-800">Generated Test Cases</h3>
                <p className="text-sm text-gray-600">
                  {generatedTests.length} tests generated | {testFramework} | {testType}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => setShowTestSection(!showTestSection)}
                  className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                >
                  {showTestSection ? 'Hide' : 'Show'} Tests
                </button>
                <button
                  onClick={clearTests}
                  className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200"
                >
                  Clear Tests
                </button>
              </div>
            </div>
            
            <div className="overflow-y-auto" style={{ maxHeight: '200px' }}>
              {isGeneratingTests ? (
                <div className="text-center py-8">
                  <div className="animate-spin inline-block w-8 h-8 border-4 border-gray-200 border-t-green-600 rounded-full mb-4"></div>
                  <p className="text-gray-600">Generating test code...</p>
                </div>
              ) : generatedTests.length > 0 ? (
                <div className="space-y-4 p-4">
                  {generatedTests.map((test) => (
                    <div key={test.id} className="bg-white rounded-lg p-4 border shadow-sm">
                      <div className="flex justify-between items-start mb-3">
                        <h4 className="text-sm font-medium text-gray-800 flex-1">{test.description}</h4>
                        <div className="flex space-x-2">
                          <span className={`px-2 py-1 text-xs rounded ${
                            test.type === 'unit' ? 'bg-green-100 text-green-700' :
                            test.type === 'integration' ? 'bg-blue-100 text-blue-700' :
                            test.type === 'e2e' ? 'bg-purple-100 text-purple-700' :
                            'bg-orange-100 text-orange-700'
                          }`}>
                            {test.type}
                          </span>
                          <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                            {test.framework}
                          </span>
                        </div>
                      </div>
                      <div className="relative">
                        <pre className="text-xs bg-gray-900 text-gray-300 p-3 rounded overflow-x-auto">
                          <code>{test.code}</code>
                        </pre>
                        <div className="absolute top-2 right-2 flex space-x-1">
                          <button
                            onClick={() => copyToClipboard(test.code)}
                            className="px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
                            title="Copy to clipboard"
                          >
                            📋
                          </button>
                          <button
                            onClick={() => createPullRequest(test)}
                            disabled={loading}
                            className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                            title="Create Pull Request"
                          >
                            {prUrl ? 'PR Created' : 'Create PR'}
                          </button>
                        </div>
                      </div>
                      {test.filePath && (
                        <div className="mt-2 text-xs text-gray-500">
                          For file: <span className="font-mono">{test.filePath}</span>
                        </div>
                      )}
                      {prUrl && (
                        <div className="mt-2">
                          <a 
                            href={prUrl} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:underline"
                          >
                            View Pull Request on GitHub
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-4xl mb-4">🛠️</div>
                  <p className="text-gray-600 mb-2">No test cases generated yet.</p>
                  <p className="text-sm text-gray-500">
                    Select test suggestions and click "Generate Test Code" to create test implementations.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RepoExplorerSection;