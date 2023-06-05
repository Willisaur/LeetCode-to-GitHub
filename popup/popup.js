// Options button
document.querySelector("#options").addEventListener("click", function() {
  chrome.runtime.openOptionsPage();
});

// Help button (not yet implemented)
//document.querySelector("#help").addEventListener("click", function() {
//  window.open(chrome.runtime.getURL("../help/help.html"));
//});

// Social links
document.querySelector("#github-links").addEventListener("click", function() {
  window.open("https://github.com/Willisaur");
});
document.querySelector("#linkedin-links").addEventListener("click", function() {
  window.open("https://www.linkedin.com/in/willstarling/");
});document.querySelector("#paypal-links").addEventListener("click", function() {
  window.open("https://paypal.me/willisaur");
});