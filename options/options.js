// Restores select box and checkbox state using the preferences
// stored in chrome.storage.
const restoreOptions = () => {
  chrome.storage.sync.get(
    { favoriteColor: 'red', likesColor: true },
    (items) => {
      document.getElementById('color').value = items.favoriteColor;
      document.getElementById('like').checked = items.likesColor;
    }
  );
};

document.addEventListener('DOMContentLoaded', restoreOptions);

// Save typed GitHub repository name
document.querySelector("#save-repo-name").addEventListener("click", function() {
  const github_repo = document.querySelector("#github-repo-name").value;
  let status = document.getElementById("status");
  console.log("Repo name: " + document.querySelector("#github-repo-name").value);

  // Update status text
  if (github_repo.includes(" ")){
    // Repo name contains a space
    status.style.color = "#f22c21";
    status.textContent = "You cannot have a space in your repo name! Try again.";
    
    setTimeout(() => {
      status.textContent = "";
    }, 2000);
  } else{
    // Repo name was saved successfully
    status.style.color = "#00be00";
    status.textContent = "Repo name successfully saved!!";

    // Save name to chrome storage
    chrome.storage.local.set( {"github-repo-name": document.querySelector("#github-repo-name").value} );
    setTimeout(() => {
      status.textContent = "";
    }, 2000);
  }
});