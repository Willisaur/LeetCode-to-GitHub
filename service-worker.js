// constants
const STORAGE_GITHUB_USERNAME = "github-username"
const STORAGE_GITHUB_REPO = "github-repo-name"
const STORAGE_GITHUB_TOKEN = "github-token"

const STORAGE_SETTINGS_AUTOCOMMIT = "commit-preview-checkbox"
const STORAGE_SETTINGS_ERROR_AUTH_TOKEN = "error_bad-auth-token"

const langExts = {
  "C++": ".cpp",
  "Java": ".java",
  "Python": ".py",
  "Python3": ".py",
  "C": ".c",
  "C#": ".cs",
  "JavaScript": ".js",
  "Ruby": ".rb",
  "Swift": ".swift",
  "Go": ".go",
  "Scala": ".scala",
  "Kotlin": ".kt",
  "Rust": ".rs",
  "PHP": ".php",
  "TypeScript": ".ts",
  "Racket": ".rkt",
  "Erlang": ".erl",
  "Elixir": ".ex",
  "Dart": ".dart",
  "Pandas": ".py",
  "MySQL": ".sql",
  "MS SQL Server": ".sql",
  "Oracle": ".pls"
}


// event listeners
chrome.runtime.onInstalled.addListener(function(details) {
  // On extension install, open the options page and set some defaults
  if (details.reason === 'install') {
    chrome.storage.sync.set( {
      "github-username" : "", 
      STORAGE_GITHUB_REPO : "LeetCode-Solutions", 
      STORAGE_GITHUB_TOKEN : "" , 
      STORAGE_SETTINGS_AUTOCOMMIT : false, 
      STORAGE_SETTINGS_ERROR_AUTH_TOKEN: 0
    }).then(chrome.runtime.openOptionsPage());
  }
});

chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    // Listen for when the submit button's request is sent to grab the user's solution code and the leetcode problem name
    const decoder = new TextDecoder("utf-8");
    const rawBytes = details.requestBody.raw[0].bytes;
    const uint8Arr = new Uint8Array(rawBytes);
    const requestBody = JSON.parse(decoder.decode(uint8Arr));

    const submittedCode = requestBody["typed_code"];
    const leetcodeUrlProblemName = details.url.split("/")[details.url.split("/").indexOf("problems") + 1];

    console.debug("LeetCode submission request body:", requestBody);
    console.debug(`Submission URL: ${details.url} | Problem slug: ${leetcodeUrlProblemName}`);

    chrome.runtime.sendMessage({
      type: "leetcodeSubmission",
      submittedCode,
      leetcodeUrlProblemName
    });
  },
  {
    urls: [
      "*://leetcode.com/problems/*/submit/"
    ]
  },
  ["requestBody"]
);

chrome.webRequest.onCompleted.addListener(
  async function (details) {
    // Check to see if the user's solution was accepted and grab relevant submission data
    const newUrl = details.url;

    // Prevent callback hell by seeing if the request is already being intercepted
    if (newUrl === lastUrl || details.url.startsWith("https://leetcode.com/contest")) { 
      console.info("Aborting: Request already being intercepted.");
      return;
    }

    // Ensure code solution submission polling is complete
    var responseHeaders = details["responseHeaders"];
    console.debug("Headers:", responseHeaders)
    
    if (!responseHeaders.some((header) => (header.name === "content-encoding" && header.value === "br"))) {
      console.info("Awaiting polling completion...");
      return; 
    }

    lastUrl = newUrl;
    const response = await fetch(details.url);

    if (!response.ok){
      console.error("Response error when fetching LeetCode submission details. Please try again later.", response.status);
    }

    const data = await response.json();
    console.debug("User solution submission data:", data);

    // Stop if the user ran code instead of submitting it
    if (data.task_name !== "judger.judgetask.Judge" || data.status_msg !== "Accepted"){
      console.info("Aborting: User ran code instead of submitting.");
      return;
    }

    // Receive submittedCode and leetcodeUrlProblemName via message
    let submittedCode = "";
    let leetcodeUrlProblemName = ""; // kabob-case
    await new Promise((resolve) => {
      chrome.runtime.onMessage.addListener(function handler(message) {
        if (message.type === "leetcodeSubmission") {
          submittedCode = message.submittedCode;
          leetcodeUrlProblemName = message.leetcodeUrlProblemName;
          chrome.runtime.onMessage.removeListener(handler);
          resolve();
        }
      });
    });

    let leetcodeProblemName = ""; // "human readable" title
    try {
      const response = await fetch('https://leetcode.com/graphql/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          operationName: 'consolePanelConfig',
          query: `
            query consolePanelConfig($titleSlug: String!) {
              question(titleSlug: $titleSlug) {
                questionTitle
              }
            }
          `,
          variables: { titleSlug: leetcodeUrlProblemName },
        }),
      });

      const data = await response.json();
      console.debug("GraphQL response for question: ", data);

      if (data?.data?.question?.questionTitle) {
        leetcodeProblemName = data.data.question.questionTitle;
        console.info("Fetched question title: ", leetcodeProblemName);
      } else {
        console.error("Aborting: Question title not found in response: ", data);
        return;
      }
    } catch (error) {
      console.error("Aborting: Error fetching problem name from GraphQL: ", error);
      return;
    }

    if (!(data["status_code"] === 10 && data["status_msg"] === "Accepted" && data["state"] === "SUCCESS" && data["memory_percentile"] !== null && data["runtime_percentile"] !== null)) {
      console.info("Aborting: User solution incorrect.")
      return;
    }

    const { githubUsername, githubRepo, githubAuthToken, optionsAutocommit } = await getGithubSettings();
    const { questionId, lang, runtimePercentile, runtime, memoryPercentile, memory, filePath } = getSubmissionStats(data, leetcodeProblemName);

    // Commit path (folders + filename), message, content, and extended description
    let message = // newline-sensitive; format is commitName\n\ncommitDescription
      `${lang} Solution

      Submission Statistics:
      Question #: ${questionId}
      Language: ${lang}
      Runtime: ${runtime}
      Runtime percentile: ${runtimePercentile}
      Memory: ${memory} MB
      Memory percentile: ${memoryPercentile}`;
    let content = btoa(submittedCode);
    
    console.debug("Solution code:\n", submittedCode);
    console.debug("Solution language:\n", lang, langExts[lang]);
    console.debug("GitHub info:\n", githubUsername, githubRepo);

    // USING THE API TO CREATE A REPO AND FILE IN BACKGROUND
    // Create the LeetCode solutions repo if it does not exist
    // Checks if the repo exists
    await fetch(`https://api.github.com/repos/${githubUsername}/${githubRepo}`,
      {
        headers: {
        Authorization: `Bearer ${githubAuthToken}`,
        'Content-Type': 'application/json',
      }
    }).then(response => {
      console.log("Checking if repo exists...");
            
      if (response.status === 404){
        // If the repo doesn't exist, try to create it
        console.log("Repo not found. Creating repo...");

        createGithubRepo(githubAuthToken, githubRepo);

      } else if (response.status === 401){
        // Bad auth token
        console.log("Auth token is invalid.")
        chrome.storage.sync.set({STORAGE_SETTINGS_ERROR_AUTH_TOKEN: 1}).then(() => {
          chrome.runtime.openOptionsPage();
        });
        
      } else if (!response.ok){
        // Unknown error when checking if repo exists
        throw new Error("Failed to check repo existence.");
      } else {
        chrome.storage.sync.set({STORAGE_SETTINGS_ERROR_AUTH_TOKEN: 0});
        console.log("Repo exists.");
      }
    }).then(
      // If the repo exists, check if the file exists (meaning a solution was already saved for the problem)
      fetch(`https://api.github.com/repos/${githubUsername}/${githubRepo}/contents/${filePath}`)
      .then(response => {

        if (response.status === 404) {
          // If the file doesn't exist in GitHub, create the file -- no need to look for file details
          console.log('Solution file does not exist. Creating file...');

            if (!optionsAutocommit){
              chrome.storage.local.set({
                "file-path": decodeURIComponent(filePath),
                "file-content": atob(content),
                "commit-message": message.split('\n\n')[0],
                "commit-description": message.split('\n\n')[1].replace(/^\s+/gm, ''),
                "commit-hash": ""
              }).then(
                // Open the editor
                chrome.tabs.create({ url: "./editor/editor.html" })
              );
            } else {
              // Automatically create the file 
              fetch(`https://api.github.com/repos/${githubUsername}/${githubRepo}/contents/${filePath}`, {
                method: 'PUT',
                headers: {
                  Authorization: `Bearer ${githubAuthToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  message: message, // Provide a commit message and extended description
                  content: content, // Replace with the base64-encoded content of the file
                }),
              })
              .then(response => {
                if (!response.ok) {
                  throw new Error('Failed to commit changes', response);
                }
                return response.json();
              })
              .then(data => {
                console.log('Changes committed successfully; file created.');
                console.log('Commit details:', data);
              })
            }
          
        } else if (response.ok){
          // If the file does exist in GitHub, get the file details to get the SHA and then commit to the fole
          console.log('Solution file exists. Getting file information...');

          // Retrieve the current file content (its SHA is what we need)
          fetch(`https://api.github.com/repos/${githubUsername}/${githubRepo}/contents/${filePath}`, {
            headers: {
              Authorization: `Bearer ${githubAuthToken}`,
            },
          }).catch(error => {
            console.error('Failed to retrieve file content:', error);
          })
          .then(response => response.json())
          .then(data => {
            if (!optionsAutocommit){
              // Save file and commit details to local storage to load in the editor
              chrome.storage.local.set({
                "file-path": decodeURIComponent(filePath),
                "file-content": atob(content),
                "commit-message": message.split('\n\n')[0],
                "commit-description": message.split('\n\n')[1].replace(/^\s+/gm, ''),
                "commit-hash": data.sha
              }).then(
                // Open the editor
                chrome.tabs.create({ url: "./editor/editor.html"})
              );
            } else {
              commitToExistingFile({ githubUsername, githubRepo, filePath, githubAuthToken, message, content, sha });
            }
          }).catch(error => {
            console.error('Failed to commit to existing file:', error);
          });
        } else {
          throw new Error('Failed to check file existence. Not committing to GitHub.');
        }

      })
    );
  },
  {
    urls: [
      "*://leetcode.com/submissions/detail/*/check/"
    ]
  },
  ["responseHeaders"]
);


// helper functions
async function getGithubSettings() {
  console.info("Getting Github settings");

  const settings = await chrome.storage.sync.get([
    STORAGE_GITHUB_USERNAME,
    STORAGE_GITHUB_REPO,
    STORAGE_GITHUB_TOKEN,
    STORAGE_SETTINGS_AUTOCOMMIT
  ]);

  return {
    githubUsername: settings[STORAGE_GITHUB_USERNAME],
    githubRepo: settings[STORAGE_GITHUB_REPO],
    githubAuthToken: settings[STORAGE_GITHUB_TOKEN],
    settingsAutocommit: settings[STORAGE_SETTINGS_AUTOCOMMIT]
  };
}


function getSubmissionStats(data, problemName) {
  console.info("Parsing submission stats");

  const questionId = data["question_id"];
  const lang = data["pretty_lang"];
  const runtimePercentile = Number(data["runtime_percentile"]).toFixed(2);
  const runtime = data["status_runtime"];
  const memoryPercentile = Number(data["memory_percentile"]).toFixed(2);
  const memory = data["memory"] / 1000000;
  const filePath = encodeURIComponent(`${questionId}. ${problemName}/Solution${langExts[lang]}`);

  return {
    questionId,
    lang,
    runtimePercentile,
    runtime,
    memoryPercentile,
    memory,
    filePath
  };
}


/**
 * Creates a new GitHub repository.
 * @param {string} githubAuthToken - GitHub authentication token
 * @param {string} githubRepo - Repository name
 * @returns {Promise<Response>} - The fetch response
 */
function createGithubRepo(githubAuthToken, githubRepo) {
  return fetch('https://api.github.com/user/repos', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${githubAuthToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: `${githubRepo}`,
      description: 'All of my solutions for LeetCode problems. Made with LeetCode-to-GitHub: bit.ly/L2G-GH',
      private: false
    })
  }).then(response => {
    if (response.status === 422){
      // Intended repo already exists
      console.error("Repo already made. Please wait a moment before trying again.");
    } else if (!response.ok) {
      // Intended repo creation failed
      throw new Error("Repo could not be created.");
    } else {
      console.log("Repo now exists.");
    }
    return response;
  });
}


/**
 * Commits changes to an existing file in a GitHub repository.
 * @param {string} githubUsername
 * @param {string} githubRepo
 * @param {string} filePath
 * @param {string} githubAuthToken
 * @param {string} message
 * @param {string} content
 * @param {string} sha
 */
function commitToExistingFile({ githubUsername, githubRepo, filePath, githubAuthToken, message, content, sha }) {


  return fetch(`https://api.github.com/repos/${githubUsername}/${githubRepo}/contents/${filePath}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${githubAuthToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: message, // Commit message and extended description
      content: content, // Base64-encoded file content
      sha: sha, // SHA of the current Github file commit
    }),
  })
    .then(response => response.json())
    .then(data => {
      console.info('Committed to existing file:', data);
      return data;
    });
}


