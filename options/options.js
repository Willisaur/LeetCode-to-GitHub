////////// Restores all options to last save (on refresh) //////////
const restoreOptions = () => {
  chrome.storage.sync.get(
    {"github-username" : "", "github-repo-name" :  "LeetCode-Solutions", "github-token" : ""}, //, github-commit-preview-checkbox: true },
    (items) => {
      console.log(items)

      if (items["github-username"] !== ""){
        document.getElementById('github-token').placeholder = items["github-token"];
        document.getElementById('github-repo-name').value = items["github-username"];
      }

      document.getElementById('github-repo-name').placeholder = items["github-repo-name"];
      document.getElementById('github-repo-name').value = items["github-repo-name"];

      if (items["github-token"] !== ""){
        document.getElementById('github-token').placeholder = "•".repeat(items["github-token"].length);
      }

      //document.getElementById('github-commit-preview-checkbox').checked = items.github-commit-preview-checkbox;
    }
  );
};

////////// Saves options (via save button) //////////
const saveOptions = () => {
  saveGitHubUsername();
  saveGitHubRepoName();
  saveGitHubAuthToken();
};


///// Save GitHub username /////
function saveGitHubUsername(){
  // Store typed GitHub username and get status text (to notify of save status)
  const github_username = document.querySelector("#github-username").value;
  const status = document.getElementById("save-github-username-status");
  console.log("Typed username: " + github_username);


  // Make sure it doesn't equal the last username
  chrome.storage.sync.get("github-username", function (username){
    // Check if typed text is new
    if (github_username !== document.querySelector("#github-username").placeholder){
      // Check if username is valid; update status text
      if (github_username !== "" && /^[a-zA-Z\d](?:[a-zA-Z\d]|-(?=[a-zA-Z\d])){0,38}$/.test(github_username)){ // Check if possible username
        // Save username (to storage and placeholder) and print success
        chrome.storage.sync.set( {"github-username": github_username} );
        document.getElementById('github-username').placeholder = github_username;
        status.style.color = "#00be00";
        status.textContent = "Username saved!";
      } else {
        // Print username constraints
        status.style.color = "#f22c21";
        status.textContent = "This is not a possible GitHub username. Please Try again.";
      }
    
      // Clear the status text
      setTimeout(() => {
        status.textContent = "";
      }, 3000);
    }
  });
}

///// Save GitHub repository name /////
function saveGitHubRepoName(){
  // Store typed repo name and get status text (to notify of save status)
  const github_repo = document.querySelector("#github-repo-name").value;
  const status = document.getElementById("save-repo-status");
  console.log("Typed repo name: " + github_repo);

  // Check if typed text is new
  if (github_repo !== document.querySelector("#github-repo-name").placeholder){
    // Check if repo name is valid; update status text
    if (github_repo !== "" && /^[a-zA-Z_.-]+$/.test(github_repo)){ // Repo name cannot be blank and must only contain valid repo name characters
      // Save repo name (to storage and placeholder) and print success
      chrome.storage.sync.set( {"github-repo-name": github_repo} );
      document.getElementById('github-repo-name').placeholder = github_repo;
      status.style.color = "#00be00";
      status.textContent = "Repo name saved!";
    } else {
      // Print repo name constraints
      status.style.color = "#f22c21";
      status.textContent = "Repo names cannot be blank and can only contain characters \"a-z\", \"A-Z\", \"_\", \".\", and \"-\". Please Try again.";
    }
  
    // Clear the status text
    setTimeout(() => {
      status.textContent = "";
    }, 3000);
  }
};

///// Save GitHub authentication token /////
function saveGitHubAuthToken(){
  // Store typed token and get status text (to notify of save status)
  const github_token = document.querySelector("#github-token").value;
  const status = document.getElementById("save-github-token-status");
  console.log("Typed auth token: " + github_token);

  // Make sure it doesn't equal the last token
  chrome.storage.sync.get("github-token", function (token){
    if (("github-token" in token && github_token === "" && token["github-token"] !== github_token)){ // Token is empty
      // Delete the token
      chrome.storage.sync.set( {"github-token": ""} );
      document.getElementById('github-token').placeholder = "ghp_... or github_pat_.....";
      status.style.color = "#ebae34";
      status.textContent = "Token deleted!";

      // Clear the status text
      setTimeout(() => {
        status.textContent = "";
      }, 3000);
    }
    else if (token["github-token"] !== github_token){ // Token doesn't equal last submission
      // Save token (to storage and placeholder)
      chrome.storage.sync.set( {"github-token": github_token} );
      document.getElementById('github-token').placeholder = "•".repeat(github_token.length);
      status.style.color = "#00be00";
      status.textContent = "Token saved!";
      
      // Clear the status text
      setTimeout(() => {
        status.textContent = "";
      }, 3000);
    }
    // do nothing otherwise (if it is equal to the last submission)
  });
};


document.addEventListener('DOMContentLoaded', restoreOptions); // On refresh, restore options' values
document.getElementById('save-options-button').addEventListener('click', saveOptions); // Save options on "save" button click


