let leetcode_URL_problemName = "";
let leetcode_questionTitle = "";
let leetcode_questionFrontendId = ""

let submittedCode = "";

let lastUrl = "";
let newUrl = "";

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

// On extension install, open the options page and set some defaults
chrome.runtime.onInstalled.addListener(function(details) {
  if (details.reason === 'install') {
    chrome.storage.sync.set( {
      "github-username" : "", 
      "github-repo-name" : "LeetCode-Solutions", 
      "github-token" : "" , 
      "commit-preview-checkbox" : false, 
      "error_bad-auth-token": 0
    }).then(chrome.runtime.openOptionsPage());
  }
});

// Listen for when the submit button's request is sent
// Gets the code that the user submitted
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    // Get the typed code that was submitted
    let enc = new TextDecoder("utf-8");
    let arr = new Uint8Array(details["requestBody"]["raw"][0]["bytes"]);
    let requestBody = JSON.parse(enc.decode(arr)); // Turn the decoded data into a JSON
    console.log(requestBody);
    submittedCode = requestBody["typed_code"]; // Update submitted code variable

    // get URL-formatted problem name for the later fetch request to get display problem name
    leetcode_URL_problemName = details.url.split("/")[details.url.split("/").indexOf("problems") + 1]; // what comes after "problems" in the URL (i.e., the problem name in the URL)
    console.log(details.url, "URL-formatted problem name:", details.url.split("/")[details.url.split("/").indexOf("problems") + 1]);
  },
  {
    urls: [
      "*://leetcode.com/problems/*/submit/"
    ]
  },
  ["requestBody"]
);


// Listen for the LAST check to see if a solution is accepted
// Gets all relevant submission data (stored in the listened-for link)
chrome.webRequest.onCompleted.addListener(
  async function (details) {
    // Stores the URL currently listened to
    newUrl = details.url;

    // Check if the request is already being intercepted
    // Prevents a callback hell
    if (newUrl === lastUrl || details.url.startsWith("https://leetcode.com/contest")) { 
      return;
    }

    // Get the response headers
    // Used to see if the current submission check is the last (by checking content encoding)
    var responseHeaders = details["responseHeaders"];
    console.log("Headers:", responseHeaders)
    
    // If this is the last submission check, update the latest URL to end the listener and store the relevant submission data
    if (!responseHeaders.some((header) => (header.name === "content-encoding" && header.value === "br"))) return;
    
    lastUrl = newUrl; // Prevents callback hell by later comparison to newUrl
    
    const response = await fetch(details.url); // Fetch the data stored at the listened-to link
    if (!response.ok){
      console.error("Response from LeetCode submission details was an error. Please try again later.", response.status);
    }

    const data = await response.json();
    console.log("Submission data:", data); // All data from the link has arrived and is stored
    
    // Stop if the user ran code instead of submitting it
    if (data.task_name !== "judger.judgetask.Judge" || data.status_msg !== "Accepted") return;

    // Get the leetcode problem name and frontend title id
    await fetch('https://leetcode.com/graphql/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
    },
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
        variables: {
          titleSlug: leetcode_URL_problemName,
        },
      }),
    })
    .then(response => response.json())
    .then(data => {
      // Process the response data
      console.log("Question-specific request response:", data)
      console.log('Question Frontend ID:', data.data.question.questionFrontendId);
      console.log('Question Title:', data.data.question.questionTitle);
      leetcode_questionFrontendId = data.data.question.questionFrontendId;
      leetcode_questionTitle = data.data.question.questionTitle;
    })
    .catch(error => {
      console.log(error);
      console.error('Error getting problem name:', error);
    });

    // If the submission was rejected (incorrect solution), stop
    if (!(data["status_code"] === 10 && data["status_msg"] === "Accepted" && data["state"] === "SUCCESS" && data["memory_percentile"] !== null && data["runtime_percentile"] !== null)) {
      return
    }

    // If the submission was accepted (correct), store the relevant data
    // Get GitHub username and repository
    const github_username = (await chrome.storage.sync.get(["github-username"]))["github-username"];
    const github_repo = (await chrome.storage.sync.get(["github-repo-name"]))["github-repo-name"];
    const github_authToken = (await chrome.storage.sync.get(["github-token"]))["github-token"];
    const options_autocommit = (await chrome.storage.sync.get(["commit-preview-checkbox"]))["commit-preview-checkbox"];

    // Get submission statistics, questionid, and file extension
    const questionId = data["question_id"]; // leetcode_questionFrontendId ?? data["question_id"];
    const lang = data["pretty_lang"];
    const runPerc = data["runtime_percentile"].toFixed(2);
    const runtime = data["status_runtime"]
    const memPerc = parseFloat(data["memory_percentile"]).toFixed(2);
    const memory = data["memory"] / 1000000;
    const fileExt = langExts[lang];

    // Commit path (folders + filename), message, content, and extended description
    const filePath = encodeURIComponent(`${questionId}. ${leetcode_questionTitle}/Solution${fileExt}`);
    let message = // newline-sensitive; format is commitName\n\ncommitDescription
      `${lang} Solution

      Submission Statistics:
      Question #: ${questionId}
      Language: ${lang}
      Runtime: ${runtime}
      Runtime percentile: ${runPerc}
      Memory: ${memory} MB
      Memory percentile: ${memPerc}`; // formmated oddly to remove leading indentation
    let content = btoa(submittedCode);
    
    console.log("Code:\n", submittedCode);
    console.log("Language:\n", lang, langExts[lang]);
    console.log("GitHub info:\n", github_username, github_repo);

    
    // USING THE API TO CREATE A REPO AND FILE IN BACKGROUND
    // Create the LeetCode solutions repo if it does not exist
    // Checks if the repo exists
    await fetch(`https://api.github.com/repos/${github_username}/${github_repo}`,
      {
        headers: {
        Authorization: `Bearer ${github_authToken}`,
        'Content-Type': 'application/json',
      }
    }).then(response => {
      console.log("Checking if repo exists...");
            
      if (response.status === 404){
        // If the repo doesn't exist, try to create it
        console.log("Repo not found. Creating repo...");

        fetch('https://api.github.com/user/repos', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${github_authToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            name: `${github_repo}`,
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
        })

      } else if (response.status === 401){
        console.log("401 response:", response)
        // Bad auth token
        console.log("Auth token is invalid.")
        chrome.storage.sync.set({"error_bad-auth-token": 1}).then(() => {
          chrome.runtime.openOptionsPage();
        });
        
      } else if (!response.ok){
        // Unknown error when checking if repo exists
        throw new Error("Failed to check repo existence.");
      } else {
        chrome.storage.sync.set({"error_bad-auth-token": 0});
        console.log("Repo exists.");
      }
    }).then(
      // If the repo exists, check if the file exists (meaning a solution was already saved for the problem)
      fetch(`https://api.github.com/repos/${github_username}/${github_repo}/contents/${filePath}`)
      .then(response => {

        if (response.status === 404) {
          // If the file doesn't exist in GitHub, create the file -- no need to look for file details
          console.log('Solution file does not exist. Creating file...');

            if (!options_autocommit){
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
              fetch(`https://api.github.com/repos/${github_username}/${github_repo}/contents/${filePath}`, {
                method: 'PUT',
                headers: {
                  Authorization: `Bearer ${github_authToken}`,
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
          // If the file does exist in GitHub, get the file details to get the SHA and then commit to the file
          console.log('Solution file exists. Getting file information...');

          // Retrieve the current file content (its SHA is what we need)
          fetch(`https://api.github.com/repos/${github_username}/${github_repo}/contents/${filePath}`, {
            headers: {
              Authorization: `Bearer ${github_authToken}`,
            },
          }).catch(error => {
            console.error('Failed to retrieve file content:', error);
          })
          .then(response => response.json())
          .then(data => {
            if (!options_autocommit){
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
              // Commit to the file
              fetch(`https://api.github.com/repos/${github_username}/${github_repo}/contents/${filePath}`, {
                method: 'PUT',
                headers: {
                  Authorization: `Bearer ${github_authToken}`,
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  message: message, // Provide a commit message and extended description
                  content: content, // Replace with the base64-encoded content of the file
                  sha: data.sha, // the current SHA
                }),
              })
              .then(response => response.json())
              .then(data => {
                console.log('Changes committed successfully to existing file; details:', data);
              })
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
