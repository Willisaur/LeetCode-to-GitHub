// listeners
document.getElementById("sign-in").addEventListener("click", async function() {
  const authInfo = document.getElementById("auth-info");
  const authCodeText = document.getElementById("auth-code");
  
  chrome.windows.create({
    focused: true,
    url: "https://github.com/login/device",
    width: 800,
    height: 800
  });
  
  chrome.storage.sync.get(["USER_AUTH_CODE"], (STORAGE) => {
    if (!STORAGE?.USER_AUTH_CODE){ // no auth flow started yet
      chrome.runtime.sendMessage({ data: "start_auth_flow" }, (response) => {
        authCodeText.textContent = response;
        authInfo.hidden = false;
      });
    }
  });
});
document.getElementById("sign-out").addEventListener("click", function() {
  const signInButton = document.getElementById("sign-in");
  const signOutButton = document.getElementById("sign-out");

  signInButton.hidden = false;
  signOutButton.hidden = true;

  chrome.storage.sync.set({ STORAGE_GITHUB_TOKEN: "" } );
});


document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.sync.get(["USER_AUTH_CODE", "STORAGE_GITHUB_TOKEN", "STORAGE_GITHUB_REPO"], (STORAGE) => {
    console.debug("Storage", STORAGE);
    const signInButton = document.getElementById("sign-in");
    const signOutButton = document.getElementById("sign-out");
    const authInfo = document.getElementById("auth-info");
    const authCodeText = document.getElementById("auth-code");
    console.log("auth info", authInfo)

    if (STORAGE?.USER_AUTH_CODE){
      authCodeText.textContent = STORAGE.USER_AUTH_CODE;
    } else {
      authInfo.hidden = true;
    }
  
    if (STORAGE?.STORAGE_GITHUB_TOKEN && STORAGE.STORAGE_GITHUB_TOKEN.startsWith("gho_")){ // gho == oauth token
      signInButton.hidden = true;
      signOutButton.hidden = false;
    } else {
      signInButton.hidden = false;
      signOutButton.hidden = true;
    }


    const repoName = document.getElementById("github-repo-name");
    repoName.placeholder = STORAGE.STORAGE_GITHUB_REPO;
  });
});


document.getElementById("options").addEventListener("submit", (event) => {
  event.preventDefault();
  console.log("Saved new repo name");
  const githubRepo = document.getElementById("github-repo-name").value;
  chrome.storage.sync.set({ STORAGE_GITHUB_REPO: githubRepo } );
});
