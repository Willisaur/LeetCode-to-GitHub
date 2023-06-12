chrome.runtime.onMessage.addListener((content) => {
    console.log("content", content);
    document.getElementById("filename").value = decodeURIComponent(content["filePath"]);
    document.getElementById("file-content").value = atob(content["fileContent"]);
    document.getElementById("commit-message").value = content["message"].split('\n\n')[0];
    document.getElementById("commit-description").value = content["message"].split('\n\n')[1].replace(/^\s+/gm, '');
    document.getElementById("hash").value = content["sha"];
});
