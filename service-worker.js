let submittedCode = "";
let codeData = "";

let lastUrl = "";
let newUrl = "";


// Listen for when the submit button's request is sent
// Gets the code that the user submitted
chrome.webRequest.onBeforeRequest.addListener(
  (details) => {
    // Get the typed code that was submitted
    var enc = new TextDecoder("utf-8");
    var arr = new Uint8Array(details["requestBody"]["raw"][0]["bytes"]);
    var requestBody = JSON.parse(enc.decode(arr)); // Turn the decoded data into a JSON
    submittedCode = requestBody["typed_code"]; // Update submitted code variable
  },
  { 
    urls: [
      "*://leetcode.com/problems/*/submit/"
    ] 
  },
  ["requestBody"]
);


// Listen for the LAST check to see if a solution is accepted
// Gets all relevant submission data (stored in the listened-for link)
chrome.webRequest.onCompleted.addListener(
  async function(details) {

    // Stores the URL currently listened to
    newUrl = details.url;

    // Check if the request is already being intercepted
    // Prevents an infinite loop
    if (details.initiator === chrome.runtime.id || newUrl === lastUrl) {
      return;
    }

    // Get the response headers
    // Used to see if the current submission check is the last (by checking content encoding)
    var responseHeaders = details["responseHeaders"];

    // If this is the last submission check, update the latest URL to end the listener and store the relevant submission data
    if (responseHeaders.some(header => header.name === "content-encoding" && header.value === "br")){
      lastUrl = newUrl; // Update lastUrl to stop an infinite loop

      const response = await fetch(details.url); // Fetch the data stored at the listened-to link
      
      if (response.ok) {
        const data = await response.json();
        console.log(data); // All data from the link has arrived and is stored

        // If the submission was accepted (correct), store the relevant data
        if (data["status_code"] === 10 && data["status_msg"] === "Accepted" && data["state"] === "SUCCESS" && data["memory_percentile"] !== null && data["runtime_percentile"] !== null){
          let lang = data["pretty_lang"];
          let runPerc = parseFloat(data["runtime_percentile"]).toFixed(2);
          let memPerc = parseFloat(data["memory_percentile"]).toFixed(2);

          codeData += "Language: " + lang + "\nRuntime percentile: " + runPerc + "\nMemory percentile: " + memPerc;
          console.log(submittedCode + "\n\n" + codeData);
        }

      } else {
        // Handle the error
        console.error('Request failed with status ' + response.status);
      }
    }

  },
  {
    urls: [
      "*://leetcode.com/submissions/detail/*/check/"
    ]
  },
  ["responseHeaders"]
);

