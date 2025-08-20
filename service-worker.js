// constants
const STORAGE_GITHUB_USERNAME = "github-username"
const STORAGE_GITHUB_REPO = "github-repo-name"
const STORAGE_GITHUB_TOKEN = "github-token"

const STORAGE_SETTINGS_ERROR_AUTH_TOKEN = "error_bad-auth-token"

const LANGUAGE_FILE_EXTENSIONS = {
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

const submissionDetailsMap = new Map();
const SUBMISSION_DETAILS_TTL = 60 * 1000; // 1 minute

let lastUrl = ""; // used to prevent callback hell


// background jobs, event listeners
function cleanUpSubmissionDetailsMap(){
  for (const [key, value] of submissionDetailsMap.entries()) {
    if (Date.now() - value.timestamp > SUBMISSION_DETAILS_TTL) {
      submissionDetailsMap.delete(key);
    }
  }
}

setInterval(cleanUpSubmissionDetailsMap, SUBMISSION_DETAILS_TTL);


chrome.runtime.onInstalled.addListener(function(details) {
  // On extension install, open the options page and set some defaults
  if (details.reason === 'install') {
    chrome.storage.sync.set( {
      "github-username" : "", 
      STORAGE_GITHUB_REPO : "LeetCode-Solutions", 
      STORAGE_GITHUB_TOKEN : "" , 
      STORAGE_SETTINGS_ERROR_AUTH_TOKEN: 0
    }).then(chrome.runtime.openOptionsPage());
  }
});


chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    // On submission, intercept the user's solution code and the leetcode problem name
    const decoder = new TextDecoder("utf-8");
    const rawBytes = details.requestBody.raw[0].bytes;
    const uint8Arr = new Uint8Array(rawBytes);
    const requestBody = JSON.parse(decoder.decode(uint8Arr));

    const submittedCode = requestBody["typed_code"];
    const leetcodeUrlProblemName = details.url.split("/")[details.url.split("/").indexOf("problems") + 1];

    console.debug("LeetCode submission request body:", requestBody);
    console.debug(`Submission URL: ${details.url} | Problem slug: ${leetcodeUrlProblemName}`);
    console.debug("Details:", details);

    submissionDetailsMap.set(details.tabId, {
      submittedCode: submittedCode,
      leetcodeUrlProblemName: leetcodeUrlProblemName,
      timestamp: Date.now()
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
    if (isCallbackHell(details.url) || !hasCompletedPolling(details)){
      return;
    }
    lastUrl = details.url;
    
    const { questionId, codingLanguage, runtimePercentile, runtime, memoryPercentile, memory } = await getSubmissionStatistics(details.url);
    if (!questionId || !codingLanguage || !runtimePercentile || !runtime || !memoryPercentile || !memory){
      return;
    }

    const { submittedCode, leetcodeUrlProblemName } = await getSubmissionData(details);
    if (!submittedCode || !leetcodeUrlProblemName){
      return;
    }

    const { leetcodeProblemName, leetcodeProblemFrontendId } = await getProblemDetails(leetcodeUrlProblemName);
    if (!leetcodeProblemName || !leetcodeProblemFrontendId){
      return
    }

    const { githubUsername, githubRepo, githubAuthToken } = await getGithubSettings();
    const message = createCommitData(codingLanguage, questionId, runtime, runtimePercentile, memory, memoryPercentile, submittedCode);
    const content = btoa(submittedCode);
    const filePath = encodeURIComponent(`${questionId}. ${leetcodeProblemName}/Solution${LANGUAGE_FILE_EXTENSIONS[codingLanguage]}`);
    console.debug("Solution code:\n", submittedCode);
    
    // USING THE API TO CREATE A REPO AND FILE IN BACKGROUND
    await handleRepoExistence(githubUsername, githubRepo, githubAuthToken);
    await handleFileExistence(githubUsername, githubRepo, filePath, githubAuthToken, message, content);
  },
  {
    urls: [
      "*://leetcode.com/submissions/detail/*/check/"
    ]
  },
  ["responseHeaders"]
);


// helper functions
function isCallbackHell(url){
  // Prevent callback hell by seeing if the request is already being intercepted
  if (url === lastUrl || url.startsWith("https://leetcode.com/contest")) { 
    console.debug("Preventing callback hell");
    return true;
  }

  return false;
}


function hasCompletedPolling(details){
  // Ignore contest submissions for now
  if (details.url.startsWith("https://leetcode.com/contest")){
    return false;
  }

  // Ensure code solution submission polling is complete
  const responseHeaders = details["responseHeaders"];
  console.debug("Headers:", responseHeaders)

  if (!responseHeaders.some((header) => (header.name === "content-encoding" && header.value === "br"))) {
    console.debug("Awaiting polling completion...");
    return false;
  }

  console.info("Polling complete.");
  return true;
}



async function getSubmissionData(details){
  console.info("Gathering submission details.");
  const submission = submissionDetailsMap.get(details.tabId);
  console.debug("Details:", details);
  console.debug("Map:", submissionDetailsMap);
  console.debug("Submission from map:", submission);

  
  if (!submission || !submission.submittedCode || !submission.leetcodeUrlProblemName) {
    console.error("No submission data found for tabId:", details.tabId);
    return { submittedCode: undefined, leetcodeUrlProblemName: undefined };
  }

  const { submittedCode, leetcodeUrlProblemName } = submission;

  return { submittedCode, leetcodeUrlProblemName };
}


async function getProblemDetails(leetcodeUrlProblemName){
  let leetcodeProblemName = ""; // "human readable" title
  let leetcodeProblemFrontendId = "";

  try {
    const response = await fetch('https://leetcode.com/graphql/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operationName: 'questionDetail',
        query: `
          query questionDetail($titleSlug: String!) {
            question(titleSlug: $titleSlug) {
              questionFrontendId
              questionTitle
            }
          }
        `,
        variables: { titleSlug: leetcodeUrlProblemName },
      }),
    });

    const data = await response.json();
    console.debug("GraphQL response for question: ", data);
    
    leetcodeProblemName = data?.data?.question?.questionTitle;
    leetcodeProblemFrontendId = data?.data?.question?.questionFrontendId;
    console.info("Fetched question title: ", leetcodeProblemName);
    console.info("Fetched question frontend ID: ", leetcodeProblemFrontendId);
  } catch (error) {
    console.error("Aborting: Error parsing problem details: ", error);
  }
  
  return { leetcodeProblemName, leetcodeProblemFrontendId }
}


async function getGithubSettings() {
  console.info("Getting Github settings");

  const settings = await chrome.storage.sync.get([
    STORAGE_GITHUB_USERNAME,
    STORAGE_GITHUB_REPO,
    STORAGE_GITHUB_TOKEN
  ]);

  console.debug("GitHub info:\n", settings[STORAGE_GITHUB_USERNAME], settings[STORAGE_GITHUB_REPO]);

  return {
    githubUsername: settings[STORAGE_GITHUB_USERNAME],
    githubRepo: settings[STORAGE_GITHUB_REPO],
    githubAuthToken: settings[STORAGE_GITHUB_TOKEN]
  };
}


async function getSubmissionStatistics(url) {
  console.info("Getting submission statistics");

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (!(data?.task_name === "judger.judgetask.Judge" && data?.status_msg === "Accepted")){
      console.info("Aborting: Code not submitted or not accepted.");
      return {};
    }
  
    const questionId = data["question_id"]; // leetcode_questionFrontendId ?? data["question_id"];
    const codingLanguage = data["pretty_lang"];
    const runtimePercentile = Number(data["runtime_percentile"]).toFixed(2);
    const runtime = data["status_runtime"];
    const memoryPercentile = Number(data["memory_percentile"]).toFixed(2);
    const memory = data["memory"] / 1000000;
  
    return {
      questionId,
      codingLanguage,
      runtimePercentile,
      runtime,
      memoryPercentile,
      memory
    };
  } catch (error) {
    console.error("Error fetching submission statistics: ", error);
    return {};
  }
}


function createCommitData(codingLanguage, questionId, runtime, runtimePercentile, memory, memoryPercentile){
  const message = // newline-sensitive; format is commitName\n\ncommitDescription
    `${codingLanguage} Solution

    Submission Statistics:
    Question #: ${questionId}
    Language: ${codingLanguage}
    Runtime: ${runtime}
    Runtime percentile: ${runtimePercentile}
    Memory: ${memory} MB
    Memory percentile: ${memoryPercentile}`;
  console.debug("Solution language:\n", codingLanguage, LANGUAGE_FILE_EXTENSIONS[codingLanguage]);

  return message;
}


async function handleRepoExistence(githubUsername, githubRepo, githubAuthToken){
  try {
    const response = await fetch(
      `https://api.github.com/repos/${githubUsername}/${githubRepo}`,
      {
        headers: {
        Authorization: `Bearer ${githubAuthToken}`,
        'Content-Type': 'application/json',
      }
    });
    
    switch (response.status) {
      case 404:
        console.log("Repo not found.");
        createGithubRepo(githubAuthToken, githubRepo); // todo: check contract here and refactor
        break;
      
      case 401:
        console.log("Auth token is invalid.");
        chrome.storage.sync.set({STORAGE_SETTINGS_ERROR_AUTH_TOKEN: 1}).then(() => {
          chrome.runtime.openOptionsPage();
        });
        break;

      case !response.ok:
        console.error(`Unknown error when determining repo existence. Error: ${error}`);
        return;

      default:
        chrome.storage.sync.set({STORAGE_SETTINGS_ERROR_AUTH_TOKEN: 0});
        console.log("Repo exists.");
        break;
      }
  } catch (error) {
    console.error(`Failed checking repo existence. Error: ${error}`);
  }
}


/**
 * Creates a new GitHub repository.
 * @param {string} githubAuthToken
 * @param {string} githubRepo
 * @returns {Promise<Response>}
*/
async function createGithubRepo(githubAuthToken, githubRepo) {
  console.log("Creating Github repo");
  return await fetch('https://api.github.com/user/repos', {
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

async function getSha({githubUsername, githubRepo, filePath, githubAuthToken}){
  try {
    const response = await fetch(`https://api.github.com/repos/${githubUsername}/${githubRepo}/contents/${filePath}`, {
      headers: {
        Authorization: `Bearer ${githubAuthToken}`
      }
    });
    
    const data = await response.json();
    return data.sha;
  } catch (error) {
    console.error(`Failed to retrieve sha from existing solution file. Error: ${error}`);
    return "";
  }
}

/**
 * Commits changes to an new or existing file in a GitHub repository.
 * @param {string} githubUsername
 * @param {string} githubRepo
 * @param {string} filePath
 * @param {string} githubAuthToken
 * @param {string} message
 * @param {string} content
 * @param {string} sha
 */
async function createGithubFile({ githubUsername, githubRepo, filePath, githubAuthToken, message, content, sha = "" }){
  let body = {
    message: message, // Provide a commit message and extended description
    content: content // Replace with the base64-encoded content of the file
  };
  
  if (sha){
    body.sha = sha; // SHA of the current Github file commit
  }

  try {
    const response = await fetch(`https://api.github.com/repos/${githubUsername}/${githubRepo}/contents/${filePath}`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${githubAuthToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    console.debug("Committed solution file. Details: ", data);

  } catch (error) {
    console.error(`Could not commit solution file. Error: ${error}`);
  }
}

async function handleFileExistence(githubUsername, githubRepo, filePath, githubAuthToken, message, content){
  try {
    const response = await fetch(`https://api.github.com/repos/${githubUsername}/${githubRepo}/contents/${filePath}`);
    
    console.debug("Response status:", response.status);
    console.debug("response:", response);

    switch (response.status) {
      case 404:
        console.log("Solution file does not exist.");
        await createGithubFile(githubUsername, githubRepo, filePath, githubAuthToken, message, content);
        break;
    
      case 200:
        console.log("Solution file exists.");

        const sha = await getSha({githubUsername, githubRepo, filePath, githubAuthToken});
      
        if (!sha){
          return;
        }
        await createGithubFile({ githubUsername, githubRepo, filePath, githubAuthToken, message, content, sha }); // todo: check contract
        break;
        
      default:
        throw new Error("Failed checking solution file existence.");
    }

  } catch (error) {
    console.error(`Error thrown when handling file existence. Error: ${error}`);
  }
}

