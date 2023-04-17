document.querySelector('#log-in').addEventListener('click', function() {
  /*
  chrome.windows.create({
    url: "../log-in/log-in.html",
    type: "popup",
    width: 400,
    height: 600
  });
  */
  chrome.windows.create({
    url: "https://github.com/login",
    type: "popup",
    width: 400,
    height: 600
  },
  function(window){
    chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
      // Check if the updated tab belongs to the created window
      if (tab.windowId === window.id && changeInfo.url) {
        console.log("URL changed to:", changeInfo.url);
      }

      if (changeInfo.url === "https://github.com/" && tab.windowId === window.id && tabId === tab.id) {
        // Get username for link to repo
        chrome.cookies.get({ url: changeInfo.url, name: "dotcom_user" }, function(cookie) {
          chrome.storage.local.set( {"github-username": cookie.value} );
        });

        // Update status to let user know they signed in.
        const status = document.getElementById("status");
        status.textContent = "You are signed in!";
        setTimeout(() => {
          status.textContent = "";
        }, 2000);

        // Close the window
        chrome.windows.remove(window.id);
      }
    });
  }
  
  );
});
document.querySelector("#options").addEventListener("click", function() {
  if (chrome.runtime.openOptionsPage) {
    chrome.runtime.openOptionsPage();
  } else {
    window.open(chrome.runtime.getURL("../options/options.html"));
  }
});
document.querySelector("#help").addEventListener("click", function() {
  window.open(chrome.runtime.getURL("../help/help.html"));
});