// Log in button
//document.querySelector('#log-in').addEventListener('click', function() {
//  window.open("../login/login.html");
//});

document.querySelector('#log-in').addEventListener('click', function() {
  

  chrome.windows.create({
    url: "https://github.com/login",
    type: "popup",
    width: 400,
    height: 600
  },
  function(window)
    {
      chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
        // Check if the updated tab belongs to the created window
        if (tab.windowId === window.id && changeInfo.url) {
          console.log("URL changed to:", changeInfo.url);
        }

        if (changeInfo.url === "https://github.com/" && tab.windowId === window.id && tabId === tab.id) {
          // Get username for link to repo
          chrome.cookies.get({ url: changeInfo.url, name: "dotcom_user" }, function(cookie) {
            chrome.storage.sync.set( {"github-username": cookie.value} );
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


// Options button
document.querySelector("#options").addEventListener("click", function() {
  chrome.runtime.openOptionsPage();
});

// Help button (not yet implemented)
//document.querySelector("#help").addEventListener("click", function() {
//  window.open(chrome.runtime.getURL("../help/help.html"));
//});

// Social links
document.querySelector(".github-links").addEventListener("click", function() {
  window.open("https://github.com/Willisaur");
});
document.querySelector(".linkedin-links").addEventListener("click", function() {
  window.open("https://www.linkedin.com/in/willstarling/");
});document.querySelector(".paypal-links").addEventListener("click", function() {
  window.open("https://paypal.me/willisaur");
});