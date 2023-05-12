////////// Restores all options to last save (on refresh) //////////
const restoreOptions = () => {
  chrome.storage.sync.get(
    {"github-repo-name" : "github-repo-name", "github-token" : "github-token"}, //, github-commit-preview-checkbox: true },
    (items) => {
      console.log(items)

      document.getElementById('github-repo-name').placeholder = items["github-repo-name"];
      document.getElementById('github-repo-name').value = items["github-repo-name"];

      document.getElementById('github-token').placeholder = "•".repeat(items["github-token"].length);
      document.getElementById('github-token').value = items["github-token"];

      //document.getElementById('github-commit-preview-checkbox').checked = items.github-commit-preview-checkbox;
    }
  );
};

////////// Saves options (via save button) //////////
const saveOptions = () => {
  saveGitHubRepoName();
  saveGitHubAuthToken();
  
  
  
  //chrome.storage.sync.set(
  //  { github_repo_name : document.getElementById('github-repo-name').value},
  //  () => {
  //    // Update status to let user know options were saved.
  //    document.getElementById('github-repo-name').placeholder = document.getElementById('github-repo-name').value;
  //    const status = document.getElementById('status2');
  //    status.textContent = 'Options saved.';
  //    setTimeout(() => {
  //      status.textContent = '';
  //    }, 2000);
  //  }
  //);
};


document.addEventListener('DOMContentLoaded', restoreOptions); // On refresh, restore options' values
document.getElementById('save-options-button').addEventListener('click', saveOptions); // Save options on "save" button click


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
        document.getElementById('github-token').placeholder = "";
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