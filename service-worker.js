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



// Saves the current leetcode problem name
chrome.webRequest.onCompleted.addListener(
  function (details) {
    chrome.tabs.query({ active: true, currentWindow: true }, async function (tabs) {
      // Execute the script in the context of the active tab
      await chrome.scripting.executeScript({
        target: { tabId: tabs[0].id },
        func: function getTextContent() {
          // Returns the current leetcode problem name
          return new Promise((resolve, reject) => {
            let intervalId = setInterval(() => {
              const problemName = document.querySelector(".mr-2.text-lg.font-medium.text-label-1.dark\\:text-dark-label-1");
              if (problemName) {
                clearInterval(intervalId);
                resolve(problemName.textContent);
              }
            }, 100); // check every .1 second
          });
        }
      })

        // Save the problem name to leetcode_problemName
        .then((result) => chrome.storage.local.set({ "leetcode_problemName": result[0]["result"] }))
        .catch((error) => console.error(error));

      leetcode_problemName = ((await chrome.storage.local.get(["leetcode_problemName"]))["leetcode_problemName"]);
      await chrome.storage.local.remove("leetcode_problemName");


    });



  },
  {
    urls: [
      "*://leetcode.com/problems/*/*"
    ]
  },
  ["responseHeaders"]
);

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

      if (response.ok) {
        const data = await response.json();
        console.log(data); // All data from the link has arrived and is stored

        // If the submission was accepted (correct), store the relevant data
        if (data["status_code"] === 10 && data["status_msg"] === "Accepted" && data["state"] === "SUCCESS" && data["memory_percentile"] !== null && data["runtime_percentile"] !== null) {
          let github_username = (await chrome.storage.local.get(["github-username"]))["github-username"];
          let github_repo = "LeetCode-Solutions";  //(await chrome.storage.local.get(["github-repo"]))["github-repo"];

          let questionId = data["question_id"];
          let lang = data["pretty_lang"];
          let runPerc = data["runtime_percentile"].toFixed(2);
          let runtime = data["status_runtime"]
          let memPerc = parseFloat(data["memory_percentile"]).toFixed(2);
          let memory = data["memory"] / 1000000;
          let fileExt = langExts[lang];


          codeData +=
            "#Question #: " + questionId +
            "\n#Language: " + lang +
            "\n#Runtime: " + runtime +
            "\n#Runtime percentile: " + runPerc +
            "\n#Memory: " + memory + " MB" +
            "\n#Memory percentile: " + memPerc;
          console.log(submittedCode + "\n\n" + codeData);
          console.log(leetcode_problemName, lang, langExts[lang]);
          console.log(github_username, github_repo, leetcode_problemName);



          chrome.windows.create({
            url: "https://github.com/" + github_username + "/" + github_repo + "/new/main",
            type: "popup",
            width: 400,
            height: 600
          }, function (window) {
            // Get the active tab
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
              // Execute the script in the context of the active tab
              chrome.scripting.executeScript(
                {
                  args: [leetcode_problemName, fileExt, submittedCode, codeData],
                  target: { tabId: tabs[0].id },
                  func: function (lcpn, fe, sc, cd) {
                    // Get the input element by its class name
                    let github_fileName = document.querySelector(".form-control.js-detect-filename-language.js-blob-filename.js-breadcrumb-nav.mr-1.mt-1.mt-sm-0.col-12.width-sm-auto");
                    github_fileName.value = lcpn + "/Solution" + fe;

                    let github_code = document.querySelector("span[cm-text]:first-child");
                    console.log(github_code);
                    //github_code.value = submittedCode + "\n\n\n\n" + codeData;
                    github_code.textContent = sc + "\n\n\n-----SUBMISSION STATISTICS-----" + cd;

                  }
                }
              );
            });
          });
        }



      } else {
        // Handle the error
        console.error('Request failed with status ' + response.status);
      }
    }

    submittedCode = "";
    codeData = "";
    lastUrl = "";
    newUrl = "";

  },
  {
    urls: [
      "*://leetcode.com/submissions/detail/*/check/"
    ]
  },
  ["responseHeaders"]
);


/*
function uploadToGitHubWithOctoKit(){
  let authToken = "";
  chrome.storage.local.get(["github-auth"], function(result) {
    authToken = result.github-auth;
  });
  const octokit = new Octokit({
    auth: authToken
  });
  
  const commitMessage = questionId + ". [Problem name]";
  const content = submittedCode + codeData;
  const filePath = questionId + ". [Problem name]/[Problem name]-" + lang + "." + langExts[lang];
  const repositoryName = "my-github-repo";
  
  octokit.repos.createOrUpdateFileContents({
    owner: "YOUR_GITHUB_USERNAME",
    repo: repositoryName,
    path: filePath,
    message: commitMessage,
    content: Buffer.from(content).toString("base64")
  })
  .then(response => {
    console.log("File created:", response.data.content.path);
  })
  .catch(error => {
    console.error("Error creating file:", error);
  });
}
*/
