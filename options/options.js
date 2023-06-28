////////// Restores all options to last save (on refresh) //////////
const restoreOptions = () => {
  chrome.storage.sync.get(
    {"github-username" : "", "github-repo-name" :  "LeetCode-Solutions", "github-token" : "", "commit-preview-checkbox" : false },
    (storage) => {

      if (storage["github-username"] !== ""){
        document.getElementById('github-username').placeholder = storage["github-username"];
        document.getElementById('github-username').value = storage["github-username"];
      }

      document.getElementById('github-repo-name').placeholder = storage["github-repo-name"];
      document.getElementById('github-repo-name').value = storage["github-repo-name"];

      if (storage["github-token"] !== ""){
        document.getElementById('github-token').placeholder = "•".repeat(storage["github-token"].length);
      } else {
        document.getElementById('github-token').placeholder = "ghp_... or github_pat_..."
      }

      document.getElementById('preview-checkbox').checked = storage["commit-preview-checkbox"];
    }
  );
};
document.addEventListener('DOMContentLoaded', restoreOptions); 


////////// Saves options (submitted through the form & save button) //////////
document.getElementById('options-form').addEventListener('submit', (event) => {
  event.preventDefault();

  // Get error and success message divs
  const successMessage = document.getElementById("success-message");
  const errorMessages = document.getElementById("error-messages");
  // Clear existing error messages
  errorMessages.innerText = '';

  // Get the user's options
  const github_username = document.getElementById("github-username").value;
  const github_repo = document.getElementById("github-repo-name").value;
  const github_token = document.getElementById("github-token").value;
  const preview_checkbox = document.getElementById("preview-checkbox").checked;
  
  // Perform input validation and print appropriate status message(s)
  chrome.storage.sync.get(
    {
      "github-username" : "", 
      "github-repo-name" : "LeetCode-Solutions", 
      "github-token" : "" , 
      "commit-preview-checkbox" : false 
    }, function (storage)
    {
      // Check if typed text is new
      if (storage["github-username"] !== github_username && github_username !== document.getElementById("github-username").placeholder){
        // Check if username is valid; update status text
        if (github_username !== "" && /^[a-zA-Z\d](?:[a-zA-Z\d]|-(?=[a-zA-Z\d])){0,38}$/.test(github_username)){ // Check if possible username
          // Save username (to storage and placeholder) and print success
          chrome.storage.sync.set( {"github-username": github_username} );
          document.getElementById('github-username').placeholder = github_username;
        } else {
          const errorMessage = document.createElement('p');
          errorMessage.textContent = "This is not a possible GitHub username.";
          errorMessages.appendChild(errorMessage);
        }
      }

      // Check if typed text is new
      if (storage["github-repo-name"] !== github_repo && github_repo !== document.getElementById("github-repo-name").placeholder){
        // Check if repo name is valid; update status text
        if (github_repo && /^[a-zA-Z_.-]+$/.test(github_repo)){ // Repo name cannot be blank and must only contain valid repo name characters
          // Save repo name (to storage and placeholder) and print success
          chrome.storage.sync.set( {"github-repo-name": github_repo} );
          document.getElementById('github-repo-name').placeholder = github_repo;
        } else {
          const errorMessage = document.createElement('p');
          errorMessage.textContent = "Repo names cannot be blank and can only contain characters \"a-z\", \"A-Z\", \"_\", \".\", and \"-\".";
          errorMessages.appendChild(errorMessage);
        }
      }

      if (github_token && github_token !== storage["github-token"]){ // Token doesn't equal last submission
        // Save token (to storage and placeholder)
        chrome.storage.sync.set( {"github-token": github_token} );
        document.getElementById('github-token').placeholder = "•".repeat(github_token.length);
      }
      // do nothing otherwise (it is equal to the last submission or empty)

      if (storage["commit-preview-checkbox"] !== preview_checkbox){ // Checkbox doesn't equal last state
        // Save checkbox to storage
        chrome.storage.sync.set( {"commit-preview-checkbox": preview_checkbox } );
      }
      // do nothing otherwise (if it is equal to the last checkbox)


      // If there are no errors, proceed with saving settings and provide success feedback
      if (errorMessages.childElementCount === 0) {
        successMessage.innerText = "Saved!";

        // Clear the status text
        setTimeout(() => {
          successMessage.innerText = "";
        }, 3000);
      }
    }
  );
});


///// Delete repo token /////
document.getElementById("delete-token-button").addEventListener("click", function() {
  const github_token = document.getElementById("github-token").value;
  const tokenStatus = document.getElementById("delete-token");

  chrome.storage.sync.get({"github-token" : "" }, function (storage)
  {
    if (storage["github-token"]){ // Token is not blank in storage
      // Delete the token
      chrome.storage.sync.set( {"github-token": ""} );
      document.getElementById("github-token").value = "";
      document.getElementById('github-token').placeholder = "ghp_... or github_pat_...";
      
      // Print deletion status
      tokenStatus.innerText = "Token deleted!";
  
      // Clear the status text
      setTimeout(() => {
        tokenStatus.innerText = "";
      }, 3000);
    }
    else if (github_token){
      // Remove whatever else is typed in if the token was already deleted
      document.getElementById("github-token").value = "";
    }
  });
});

