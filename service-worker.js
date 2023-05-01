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

// Listen for when the submit button's request is sent
// Gets the code that the user submitted AND the problem name
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    // Get the typed code that was submitted
    let enc = new TextDecoder("utf-8");
    let arr = new Uint8Array(details["requestBody"]["raw"][0]["bytes"]);
    let requestBody = JSON.parse(enc.decode(arr)); // Turn the decoded data into a JSON
    console.log(requestBody);
    submittedCode = requestBody["typed_code"]; // Update submitted code variable
    
    // Get LeetCode problem name
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      //console.log("tabs:", tabs, "\ntabs[0]:", tabs[0])
      var currentTabTitle = tabs[0].title;
      leetcode_problemName = currentTabTitle.split("-")[0].slice(0, -1);
    });
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
          // Get GitHub username and repository
          let github_username = (await chrome.storage.sync.get(["github-username"]))["github-username"];
          let github_repo = (await chrome.storage.sync.get(["github-repo-name"]))["github-repo-name"];

          // Get submission statistics, questionid, and file extension
          let questionId = data["question_id"];
          let lang = data["pretty_lang"];
          let runPerc = data["runtime_percentile"].toFixed(2);
          let runtime = data["status_runtime"]
          let memPerc = parseFloat(data["memory_percentile"]).toFixed(2);
          let memory = data["memory"] / 1000000;
          let fileExt = langExts[lang];


          codeData += 
            "Submission Statistics:" + 
            "\nQuestion #: " + questionId +
            "\nLanguage: " + lang +
            "\nRuntime: " + runtime +
            "\nRuntime percentile: " + runPerc +
            "\nMemory: " + memory + " MB" +
            "\nMemory percentile: " + memPerc;
          console.log(submittedCode + "\n\n" + codeData);
          console.log(leetcode_problemName, lang, langExts[lang]);
          console.log(github_username, github_repo, leetcode_problemName);

          // may not work for URLs that exceed 2k characters
          await chrome.windows.create({
            url: "https://github.com/" + encodeURIComponent(github_username) + "/" + encodeURIComponent(github_repo) + "/new/main?filename=" + encodeURIComponent(questionId + ". " + leetcode_problemName) + "/Solution" + encodeURIComponent(fileExt) + "&message=" + encodeURIComponent(lang) + "%20Solution" + "&description=" + encodeURIComponent(codeData) + "&value=" + encodeURIComponent(submittedCode),
            type: "popup",
            width: 400,
            height: 600
          }, function (window) {
            submittedCode = "";
            codeData = "";
            lastUrl = "";
            newUrl = "";
          });
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

