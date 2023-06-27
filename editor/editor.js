////////// Paste in code/commit information on page load //////////
const restoreFileContent = () => {
    chrome.storage.local.get([
        "file-path",
        "file-content",
        "commit-message",
        "commit-description",
        "commit-hash"
    ]).then((storage) => {
        document.getElementById("file-path").value = storage["file-path"];
        document.getElementById("file-content").value = storage["file-content"];
        document.getElementById("commit-message").value = storage["commit-message"]
        document.getElementById("commit-description").value = storage["commit-description"];
        document.getElementById("hash").value = storage["commit-hash"];
    });
};
document.addEventListener('DOMContentLoaded', restoreFileContent);

////////// Upload commit information to GitHub on form submission //////////
document.getElementById("github-commit-form").addEventListener("submit", async (event) => {
    event.preventDefault(); // Prevent the default form submission

    // Get github login info and error div
    const github_username = (await chrome.storage.sync.get(["github-username"]))["github-username"];
    const github_repo = (await chrome.storage.sync.get(["github-repo-name"]))["github-repo-name"];
    const github_authToken = (await chrome.storage.sync.get(["github-token"]))["github-token"];
    
    // Commit to/create the file
    await fetch(`https://api.github.com/repos/${github_username}/${github_repo}/contents/${encodeURIComponent(document.getElementById("file-path").value)}`, {
        method: 'PUT',
        headers: {
            Authorization: `Bearer ${github_authToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            message: `${document.getElementById("commit-message").value}\n\n${document.getElementById("commit-description").value}`, 
            content: btoa(document.getElementById("file-content").value), 
            sha: document.getElementById("hash").value ? document.getElementById("hash").value : null, 
        }),
    }).then(
        chrome.tabs.getCurrent(function(tab) {
            chrome.tabs.remove(tab.id)
        })
    ).catch((error) => {
        if (error["message"] === "Bad credentials"){
            const errorMessage = document.createElement('p');
            errorMessage.textContent = "Invalid authentication token or usename.\nPlease check settings and try again.";
            document.getElementById("error-messages").appendChild(errorMessage);
        }
    });
});

