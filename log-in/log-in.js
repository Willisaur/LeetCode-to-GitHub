document.querySelector("#save-token-button").addEventListener("click", function() {
    chrome.storage.local.set( {"github-auth": "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"} ); 
});
document.querySelector("#delete-token-button").addEventListener("click", function() {
    chrome.storage.local.remove("github-auth"); 
});