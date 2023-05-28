let leetcode_URL_problemName = "";
let leetcode_problemName = "";

let submittedCode = "";
let codeData = "";

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
  "Dart": ".dart"
}

// On extension install, open the options page and set some defaults to make sure that the extension won't crash
chrome.runtime.onInstalled.addListener(async function(details) {
  if (details.reason === 'install') {
    await chrome.storage.sync.set( {"github-repo-name": "LeetCode-Solutions"} );
    await chrome.runtime.openOptionsPage();
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
    // Prevents an infinite loop
    if (details.initiator === chrome.runtime.id || newUrl === lastUrl) {
      return;
    }

    // Get the response headers
    // Used to see if the current submission check is the last (by checking content encoding)
    var responseHeaders = details["responseHeaders"];

    // If this is the last submission check, update the latest URL to end the listener and store the relevant submission data
    if (responseHeaders.some(header => header.name === "content-encoding" && header.value === "br")) {
      lastUrl = newUrl; // Update lastUrl to stop an infinite loop
      const response = await fetch(details.url); // Fetch the data stored at the listened-to link


      // Get the leetcode problem name
      await fetch('https://leetcode.com/graphql/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
      },
        body: JSON.stringify({
          operationName: 'hasOfficialSolution',
          query: `
          query hasOfficialSolution($titleSlug: String!) {
            question(titleSlug: $titleSlug) {
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
        const questionTitle = data.data.question.questionTitle;
        console.log('Question Title:', questionTitle);
        leetcode_problemName = questionTitle;
      })
      .catch(error => {
        console.error('Error:', error);
      });


      if (response.ok) {
        const data = await response.json();
        console.log(data); // All data from the link has arrived and is stored

        // If the submission was accepted (correct), store the relevant data
        if (data["status_code"] === 10 && data["status_msg"] === "Accepted" && data["state"] === "SUCCESS" && data["memory_percentile"] !== null && data["runtime_percentile"] !== null) {
          // Get GitHub username and repository
          let github_username = (await chrome.storage.sync.get(["github-username"]))["github-username"];
          let github_repo = (await chrome.storage.sync.get(["github-repo-name"]))["github-repo-name"];
          let github_authToken = (await chrome.storage.sync.get(["github-token"]))["github-token"];

          // Get submission statistics, questionid, and file extension
          let questionId = data["question_id"];
          let lang = data["pretty_lang"];
          let runPerc = data["runtime_percentile"].toFixed(2);
          let runtime = data["status_runtime"]
          let memPerc = parseFloat(data["memory_percentile"]).toFixed(2);
          let memory = data["memory"] / 1000000;
          let fileExt = langExts[lang];

          // Commit path (folders + filename), message, content, and extended description
          let filePath = encodeURIComponent(`${questionId}. ${leetcode_problemName}/Solution${fileExt}`);
          let message = // newline-sensitive; format is commitName\n\ncommitDescription
            `${lang} Solution

            Submission Statistics:
            Question #: ${questionId}
            Language: ${lang}
            Runtime: ${runtime}
            Runtime percentile: ${runPerc}
            Memory: ${memory} MB
            Memory percentile: ${memPerc}`.trim(); // remove leading indentation
          let content = btoa(submittedCode);
          
          console.log(submittedCode + "\n\n" + codeData);
          console.log(leetcode_problemName, lang, langExts[lang]);
          console.log(github_username, github_repo, leetcode_problemName);



          // USING THE API TO CREATE A REPO AND FILE IN BACKGROUND
          // Create the LeetCode solutions repo if it does not exist
          // Checks if the repo exists
          await fetch(`https://api.github.com/repos/${github_username}/${github_repo}`)
          .then(response => {
            console.log("Checking if repo exists: ", response);
                  
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
              }).then(response2 => {
                if (response2.status === 422){
                  // Intended repo already exists
                  console.error("Repo already made. Please wait a moment before trying again.");
                } else if (!response2.ok) {
                  // Intended repo creation failed
                  throw new Error("Repo could not be created.");
                } else {
                  console.log("Repo now exists.");
                }
              }).catch(error2 => {
                console.error("An error occured: ", error2);
              })
      
            } else if (!response.ok){
              // Unknown when checking if repo exists
              throw new Error("Failed to check repo existence.");
            } else {
              console.log("Repo exists.");
            }
          }).then(
            // If the repo exists, check if the file exists (a solution was already saved for the problem)
            fetch(`https://api.github.com/repos/${github_username}/${github_repo}/contents/${filePath}`)
            .then(response3 => {
              if (response3.status === 404) {
                // Create the solution file
                console.log('Solution file does not exist. Creating file...');
      
                fetch(`https://api.github.com/repos/${github_username}/${github_repo}/contents/${filePath}`, {
                  method: 'PUT',
                  headers: {
                    Authorization: `Bearer ${github_authToken}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    message: `${message}\n\n${codeData}`, // Provide a commit message and extended description
                    content: content, // Replace with the base64-encoded content of the file
                  }),
                })
                .then(response => {
                  if (!response.ok) {
                    throw new Error('Failed to commit changes');
                  }
                  return response.json();
                })
                .then(data => {
                  console.log('Changes committed successfully; file created.');
                  console.log('Commit details:', data);
                })
                .catch(error => {
                  console.error('An error occurred:', error);
                });
      
                
              } else if (response3.ok){
                // Commit to the solution file
                console.log('Solution file exists. Getting file information...');
      
                // Retrieve the current file content (its SHA is what we need)
                fetch(`https://api.github.com/repos/${github_username}/${github_repo}/contents/${filePath}`, {
                  headers: {
                    Authorization: `Bearer ${github_authToken}`,
                  },
                }).catch(error => {
                  console.error('Failed to retrieve file content:', error);
                })
                .then(response4 => response4.json())
                .then(data => {
                  // Commit to the file
                  fetch(`https://api.github.com/repos/${github_username}/${github_repo}/contents/${filePath}`, {
                    method: 'PUT',
                    headers: {
                      Authorization: `Bearer ${github_authToken}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      message: `${message}\n\n${codeData}`, // Provide a commit message and extended description
                      content: content, // Replace with the base64-encoded content of the file
                      sha: data.sha, // the current SHA
                    }),
                  })
                  .then(response5 => response5.json())
                  .then(data2 => {
                    console.log('Changes committed successfully; updated existing file.');
                    console.log('Commit details:', data2);
                  })
                  .catch(error => {
                    console.error('An error occurred:', error);
                  })
                }).catch(error => {
                  console.error('Failed to commit to existing file:', error);
                });
                
      
      
              } else {
                throw new Error('Failed to check file existence. Not committing to GitHub.');
              }
            })
            .catch(error => {
              console.error('An error occurred:', error);
            })
      
          ).catch(error => console.error(error))
          .then( () => {
            // Wipe all variables
            submittedCode = "";
            codeData = "";
            lastUrl = "";
            newUrl = "";
          });

          
          
          /*
          // MANUALLY CREATE A REPO AND SOLUTION FILE

          
          // may not work for URLs that exceed 2k characters
          await chrome.windows.create({
            url: "https://github.com/" + encodeURIComponent(github_username) + "/" + encodeURIComponent(github_repo) + "/new/main?filename=" + encodeURIComponent(questionId + ". " + leetcode_problemName) + "/Solution" + encodeURIComponent(fileExt) + "&message=" + encodeURIComponent(lang) + "%20Solution" + "&description=" + encodeURIComponent(codeData) + "&value=" + encodeURIComponent(submittedCode),
            type: "popup",
            width: 400,
            height: 600
          }, function (window) {
            chrome.tabs.onUpdated.addListener(async function(tabId, changeInfo, tab) {
              //console.log("REDIRECT URLS: ", changeInfo, tab)
              // Check if the updated tab belongs to the created window
              if (tab.windowId === window.id && (changeInfo.status && tab.status) && changeInfo.status === "complete" && tab.status === "complete"){
                //console.log("changeinfo: ", changeInfo);
                //console.log("tab: ", tab);
                //console.log("THIS URL:", tab.url);

                // regex expression for the link leading up to the repo name + the repo name
                const repo_regex = new RegExp(`^https:\\/\\/github\\.com\\/${github_username}\\/[^\\/]+\\/?$`);

                // If repo doesn't exist, redirect to create the repo
                if (tab.title === "Page not found · GitHub") {
                  // Create the repo
                  chrome.tabs.update(
                    tabId, 
                    {
                      url: "https://github.com/new?name=" + encodeURIComponent(github_repo) + "&description=" + encodeURIComponent("All of my solutions for LeetCode problems. Made with LeetCode-to-GitHub: bit.ly/L2G-GH")
                    },
                    
                  );

                }
                // When the repo is created, close the tab
                else if (repo_regex.test(tab.url)){ // Works with any github.com/username/*//* link... 

                  github_repo = tab.url.split("/")[tab.url.split("/").length - 1];
                  await chrome.storage.sync.set( {"github-repo-name": github_repo} );
                  console.log("TAB URL:", tab.url, "\nNEW REPO NAME: ", (await chrome.storage.sync.get(["github-repo-name"]))["github-repo-name"]);

                  submittedCode = "";
                  codeData = "";
                  lastUrl = "";
                  newUrl = "";

                  await chrome.windows.remove(window.id);
                }
              }
            });
          });
          */
        }


      } else {
        // Handle the error
        console.error('Request failed with status ' + response.status);
        submittedCode = "";
        codeData = "";
        lastUrl = "";
        newUrl = "";
      }
    }

  },
  {
    urls: [
      "*://leetcode.com/submissions/detail/*/check/"
    ]
  },
  ["responseHeaders"]
);

