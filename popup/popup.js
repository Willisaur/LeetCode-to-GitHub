// listeners
document.getElementById("sign-in").addEventListener("click", function() {
  chrome.runtime.sendMessage({ data: "start_auth_flow" });
});
document.getElementById("sign-out").addEventListener("click", function() {
  chrome.storage.sync.set({ STORAGE_GITHUB_TOKEN: "" });
});


document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.sync.get(["USER_AUTH_CODE", "STORAGE_GITHUB_TOKEN", "STORAGE_GITHUB_REPO"], (STORAGE) => {
    console.debug("Storage", STORAGE);

    if (STORAGE?.USER_AUTH_CODE){
      document.getElementById("device-auth-code").textContent = "Enter login code: " + STORAGE.USER_AUTH_CODE;
    }

    
    const signInButton = document.getElementById("sign-in");
    const signOutButton = document.getElementById("sign-out");
    const authCodeText = document.getElementById("device-auth-code");
  
    if (STORAGE?.STORAGE_GITHUB_TOKEN){
      signInButton.hidden = true;
      signOutButton.hidden = false;
      authCodeText.hidden = true;
    } else {
      signInButton.hidden = false;
      signOutButton.hidden = true;
    }


    const repoName = document.getElementById("github-repo-name");
    repoName.placeholder = STORAGE.STORAGE_GITHUB_REPO;
  });
});


document.getElementById("options-form").addEventListener("submit", (event) => {
  event.preventDefault();
  console.log("Saved new repo name");
  const githubRepo = document.getElementById("github-repo-name").value;
  chrome.storage.sync.set({ STORAGE_GITHUB_REPO: githubRepo } );
});
