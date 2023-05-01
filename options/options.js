// Restores the options to what was last selected
const restoreOptions = () => {
  chrome.storage.sync.get(
    {"github-repo-name" : "github-repo-name"}, //, likesColor: true },
    (items) => {
      console.log(items)
      document.getElementById('github-repo-name').placeholder = items["github-repo-name"];
      document.getElementById('github-repo-name').value = items["github-repo-name"];
      //document.getElementById('like').checked = items.likesColor;
    }
  );
};
//// Saves the options
//const saveOptions = () => {
//  chrome.storage.sync.set(
//    { github_repo_name : document.getElementById('github-repo-name').value},
//    () => {
//      // Update status to let user know options were saved.
//      document.getElementById('github-repo-name').placeholder = document.getElementById('github-repo-name').value;
//      const status = document.getElementById('status2');
//      status.textContent = 'Options saved.';
//      setTimeout(() => {
//        status.textContent = '';
//      }, 2000);
//    }
//  );
//};


document.addEventListener('DOMContentLoaded', restoreOptions); // On refresh, restore options' values
//document.getElementById('save-repo-name').addEventListener('click', saveOptions); // Save options on "save" button click


// Save typed GitHub repository name
document.querySelector("#save-repo-name").addEventListener("click", function() {
  const github_repo = document.querySelector("#github-repo-name").value;
  let status = document.getElementById("status");
  console.log("Repo name: " + document.querySelector("#github-repo-name").value);

  // Update status text
  if (github_repo === "" || !(/^[a-zA-Z_.-]+$/.test(github_repo))){ // repo name cannot be blank and must only contain valid repo name characters
    status.style.color = "#f22c21";
    status.textContent = "Repository names cannot be blank and must be characters \"a-z\", \"A-Z\", \"_\", \".\", and \"-\". Please Try again.";
    
    setTimeout(() => {
      status.textContent = "";
    }, 2000);
  } else{
    // Repo name was saved successfully
    status.style.color = "#00be00";
    status.textContent = "Repository name for LeetCode solutions successfully saved!";

    // Save name to chrome storage
    chrome.storage.sync.set( {"github-repo-name": document.querySelector("#github-repo-name").value} );
    setTimeout(() => {
      status.textContent = "";
    }, 2000);
  }
});