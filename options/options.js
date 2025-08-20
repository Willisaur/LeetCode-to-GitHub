const STORAGE_GITHUB_USERNAME = "github-username"
const STORAGE_GITHUB_REPO = "github-repo-name"
const STORAGE_GITHUB_TOKEN = "github-token"

const STORAGE_SETTINGS_ERROR_AUTH_TOKEN = "error_bad-auth-token"

////////// Restores all options to last save (on refresh) //////////
const restoreOptions = () => {
  chrome.storage.sync.get(
    {
      STORAGE_GITHUB_USERNAME : "", STORAGE_GITHUB_REPO :  "LeetCode-Solutions", STORAGE_GITHUB_TOKEN : "", "commit-preview-checkbox" : false 
    },
    (settings) => {
      console.debug("Settings:", settings);
      console.debug("Repo name:", settings.STORAGE_GITHUB_REPO);
      if (settings.STORAGE_GITHUB_USERNAME !== ""){
        document.getElementById("github-username").placeholder = settings.STORAGE_GITHUB_USERNAME;
        document.getElementById("github-username").value = settings.STORAGE_GITHUB_USERNAME;
        document.getElementById("github-repo-name").placeholder = settings.STORAGE_GITHUB_REPO;
        document.getElementById("github-repo-name").value = settings.STORAGE_GITHUB_REPO;

        if (settings.STORAGE_GITHUB_TOKEN !== ""){
          document.getElementById("github-token").placeholder = "••••••••••••••";
        } else {
          document.getElementById("github-token").placeholder = "ghp_... or github_pat_..."
        }
      }
    }
  );
};
document.addEventListener("DOMContentLoaded", restoreOptions); 


////////// Saves options (submitted through the form & save button) //////////
document.getElementById("options-form").addEventListener("submit", (event) => {
  event.preventDefault();

  // Get error and success message divs
  const successMessage = document.getElementById("success-message");
  const errorMessages = document.getElementById("error-messages");
  // Clear existing error messages
  errorMessages.innerText = "";

  // Get the user's options
  const github_username = document.getElementById(STORAGE_GITHUB_USERNAME).value;
  const github_repo = document.getElementById("github-repo-name").value;
  const github_token = document.getElementById("github-token").value;
  
  // Perform input validation and print appropriate status message(s)
  chrome.storage.sync.get(
    {
      STORAGE_GITHUB_USERNAME : "", 
      STORAGE_GITHUB_REPO : "LeetCode-Solutions", 
      STORAGE_GITHUB_TOKEN : "" , 
      "error_bad-auth-token": 0
    }, function (settings)
    {
      // Check if typed text is new
      if (settings[STORAGE_GITHUB_USERNAME] !== github_username && github_username !== document.getElementById(STORAGE_GITHUB_USERNAME).placeholder){
        // Check if username is valid; update status text
        if (github_username !== "" && /^[a-zA-Z\d](?:[a-zA-Z\d]|-(?=[a-zA-Z\d])){0,38}$/.test(github_username)){ // Check if possible username
          // Save username (to storage and placeholder) and print success
          chrome.storage.sync.set( {STORAGE_GITHUB_USERNAME: github_username} );
          document.getElementById("github-username").placeholder = github_username;
        } else {
          const errorMessage = document.createElement("p");
          errorMessage.textContent = "This is not a possible GitHub username.";
          errorMessages.appendChild(errorMessage);
        }
      }

      // Check if typed text is new
      if (settings[STORAGE_GITHUB_REPO] !== github_repo && github_repo !== document.getElementById("github-repo-name").placeholder){
        // Check if repo name is valid; update status text
        if (github_repo && /^[a-zA-Z_.-]+$/.test(github_repo)){ // Repo name cannot be blank and must only contain valid repo name characters
          // Save repo name (to storage and placeholder) and print success
          chrome.storage.sync.set( {STORAGE_GITHUB_REPO: github_repo} );
          document.getElementById("github-repo-name").placeholder = github_repo;
        } else {
          const errorMessage = document.createElement("p");
          errorMessage.textContent = "Repo names cannot be blank and can only contain characters \"a-z\", \"A-Z\", \"_\", \".\", and \"-\".";
          errorMessages.appendChild(errorMessage);
        }
      }

      if (github_token && github_token !== settings[STORAGE_GITHUB_TOKEN]){ // Token doesn't equal last submission
        // Save token (to storage and placeholder)
        chrome.storage.sync.set( {STORAGE_GITHUB_TOKEN: github_token} );
        document.getElementById("github-token").placeholder = "•".repeat(github_token.length);
        chrome.storage.sync.set( {"error_bad-auth-token": 0} );
      } else if (settings["error_bad-auth-token"] === 1) { // the last token was invalid; must display error
        const errorMessage = document.createElement("p");
        errorMessage.textContent = "Auth token is invalid. Please ensure it has not expired or try regenerating it.";
        errorMessages.appendChild(errorMessage);  
        console.log("error_bad-auth-token");
      }
      // do nothing otherwise (it is equal to the last submission or empty)

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

  chrome.storage.sync.get({STORAGE_GITHUB_TOKEN : "" }, function (storage)
  {
    if (storage[STORAGE_GITHUB_TOKEN]){ // Token is not blank in storage
      // Delete the token
      chrome.storage.sync.set( {STORAGE_GITHUB_TOKEN: ""} );
      document.getElementById("github-token").value = "";
      document.getElementById("github-token").placeholder = "ghp_... or github_pat_...";
      
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

